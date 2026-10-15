"""Run lock + run log on loom_sync_runs: acquire (check / create / confirm), abandon stale rows, release."""
from config import BASE, TABLES, RUNS, LOCK_STALE_MIN, run, save_run, dump, now, iso, parse_ts
from results import load_result, cells

T = TABLES['loom_sync_runs']

def list_params(sort=True):
    p = {'baseId': BASE, 'tableId': T, 'pageSize': 5, 'fieldIds': [RUNS['run_id'], RUNS['status'], RUNS['started_at']]}
    if sort: p['sort'] = [{'fieldId': RUNS['started_at'], 'direction': 'desc'}]
    return p

def create_params(r, status='running', finished=False):
    f = {RUNS['run_id']: r['run_id'], RUNS['status']: status, RUNS['mode']: r['mode'], RUNS['trigger']: r['trigger'], RUNS['started_at']: r['started_at']}
    if finished: f[RUNS['finished_at']] = iso(now())
    return {'baseId': BASE, 'tableId': T, 'records': [{'fields': f}]}

def update_params(updates):
    """updates: [(record_id, {field_name: value})]"""
    return {'baseId': BASE, 'tableId': T, 'records': [{'id': rid, 'fields': {RUNS[k]: v for k, v in f.items()}} for rid, f in updates]}

def _rows(path):
    out = []
    for rec in load_result(path).get('records', []):
        c = cells(rec, 'loom_sync_runs'); c['_id'] = rec['id']; out.append(c)
    return out

def _running(rows):
    n = now(); stale, live = [], []
    for x in rows:
        ts = parse_ts(x.get('started_at'))
        if x.get('status') != 'running' or not ts: continue
        (stale if (n - ts).total_seconds() > LOCK_STALE_MIN * 60 else live).append(x)
    return stale, live

def write_init_files(r):
    dump('lock_list.json', list_params()); dump('lock_list_nosort.json', list_params(sort=False))
    dump('lock_create.json', create_params(r))

def cmd_lock_check(path):
    r = run(); stale, live = _running(_rows(path))
    if stale:
        dump('lock_abandon.json', update_params([(x['_id'], {'status': 'abandoned', 'finished_at': iso(now())}) for x in stale]))
        print(f'STALE {len(stale)}: airtable__update_records_for_table paramsFile lock_abandon.json')
    if live:
        hhmm = min(parse_ts(x['started_at']) for x in live).strftime('%H:%M')
        dump('lock_rejected.json', create_params(r, 'rejected_busy', finished=True))
        print(f'BUSY since {hhmm} UTC: airtable__create_records_for_table paramsFile lock_rejected.json, then stop. '
              f'Slack runs only: "A sync is already running (started {hhmm} UTC). Try again in a few minutes."')
    else:
        print('PROCEED: airtable__create_records_for_table paramsFile lock_create.json, then `lock-created <result>`')

def cmd_lock_created(path):
    rid = load_result(path)['records'][0]['id']; r = run(); r['record_id'] = rid; save_run(r)
    print(f'lock row {rid}. List again with lock_list.json, then `lock-confirm <result>`')

def cmd_lock_confirm(path):
    r = run(); mine = parse_ts(r['started_at'])
    _, live = _running(_rows(path))
    earlier = [x for x in live if x['_id'] != r['record_id'] and parse_ts(x['started_at']) < mine]
    if earlier:
        dump('lock_selfreject.json', update_params([(r['record_id'], {'status': 'rejected_busy', 'finished_at': iso(now())})]))
        print(f"BUSY since {parse_ts(earlier[0]['started_at']).strftime('%H:%M')} UTC: airtable__update_records_for_table paramsFile lock_selfreject.json, then stop.")
    else:
        nxt = 'airtable__get_table_schema paramsFile schema_params.json, then `schema-check <result>`' if r.get('mode') == 'rebuild' \
            else 'list index_params.json, then `save index <result>` (no schema check unless an error or anomaly appears)'
        ack = ' Slack run: post the acknowledgement "On it — syncing now." in the thread NOW, before reading sources.' if str(r.get('trigger', '')).startswith('slack:') else ''
        print(f'LOCK HELD.{ack} Next: {nxt}')

def release_params(r, log):
    """log: {field_name: value} for the final run-row update."""
    return update_params([(r['record_id'], log)]) if r.get('record_id') else None
