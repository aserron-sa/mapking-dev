"""Per-source flow: init -> prep (merge pages, scope, normalize, anomaly check, enrichment todo) ->
batch (upsert + guarded close batches) -> complete. Also unavailable / failed bookkeeping."""
import json
from config import (BASE, TABLES, F, ENRICH_CAP, CLOSE_GUARD, AIRTABLE_SOURCES, SOURCE_NAME,
                    run, save_run, dump, load, now, iso, today, counts, save_counts, elapsed_min)
from results import LINEAR_FIELDS, all_records
from text_utils import clean
import src_airtable, src_attio, src_gcal, src_linear, enrichment, tasks_store, lock, schema_tools

def cmd_init(mode='sync', trigger='schedule'):
    assert mode in ('sync', 'rebuild'), mode
    n = now()
    r = {'run_id': 'loom-' + n.strftime('%Y%m%d-%H%M%S'), 'started_at': iso(n), 'mode': mode, 'trigger': trigger,
         'enrich_cap': ENRICH_CAP[mode], 'enrich_spent': 0, 'unavailable': {}, 'anomalies': {}}
    save_run(r)
    lock.write_init_files(r)
    dump('schema_params.json', schema_tools.params())
    dump('index_params.json', tasks_store.index_params())
    for t in AIRTABLE_SOURCES:
        dump(f'airtable_{t}_params.json', {'baseId': BASE, 'tableId': TABLES[t], 'pageSize': 1000, 'fieldIds': list(F[t].values())})
    dump('attio_params.json', {'is_completed': False, 'limit': 10, 'offset': 0})
    dump('gcal_params.json', src_gcal.window_params())
    dump('linear_params.json', {'limit': 250, 'fields': LINEAR_FIELDS})
    nxt = 'airtable__list_records_for_table paramsFile lock_list.json, then `lock-check <result>`'
    if trigger.startswith('slack:'):
        nxt += ('. After the lock is held (LOCK HELD), post the acknowledgement in the Slack thread: '
                'SlackBotSendMessage channel C0BRF6AHDJQ, thread_ts = the triggering message ts, text "On it — syncing now."')
    print(f"run {r['run_id']} mode={mode} trigger={trigger}. Next: {nxt}")

def _src_key(t): return f'airtable_{t}' if t in AIRTABLE_SOURCES else t

def _normalize_all(t, recs):
    N, T = now(), today().isoformat()
    for x in recs:
        if t in AIRTABLE_SOURCES: yield src_airtable.normalize(t, x, T)
        elif t == 'linear': yield src_linear.normalize(x)
        elif t == 'gcal': yield src_gcal.normalize(x, T, N)
        else: yield src_attio.normalize(x)

def _key_presence(t, recs):
    if t in AIRTABLE_SOURCES: return src_airtable.key_presence(t, recs)
    return {'linear': src_linear, 'gcal': src_gcal, 'attio': src_attio}[t].key_presence(recs)

def cmd_prep(t):
    recs = all_records(_src_key(t)); assert recs or load(f'{_src_key(t)}_page_1.json') is not None, f'no saved pages for {t}'
    idx = tasks_store.index(); r = run(); rebuild = r.get('mode') == 'rebuild'
    out, skip, qa = [], 0, 0
    for kind, n in _normalize_all(t, recs):
        if kind == 'test': skip += 1
        elif kind == 'qa': qa += 1; skip += 1
        elif kind == 'in':
            n.update(lifecycle='open', source_status='ok', sync_error=None, synced_at=iso(now())); out.append(n)
    out.sort(key=lambda n: n.get('last_updated_at') or '', reverse=True)
    empty_keys = _key_presence(t, recs)
    if empty_keys:
        r['anomalies'][t] = f'key fields empty in every record: {", ".join(empty_keys)}'; save_run(r)
    todo, backlog = enrichment.take([n for n in out if enrichment.needs_enrichment(n, idx, rebuild)])
    changed = lambda n: n['normalized_task_id'] not in idx or idx[n['normalized_task_id']].get('last_updated_at') != n.get('last_updated_at')
    full = [n['source_record_id'] for n in out if t == 'linear' and n.get('_cut') and (rebuild or changed(n))]
    if t == 'linear': dump('linear_full_needed.json', full)
    dump(f'{t}_normalized.json', out)
    dump(f'{t}_enrich_todo.json', [{k: n.get(k) for k in enrichment.TODO_FIELDS} for n in todo])
    c = {'fetched': len(recs), 'in_scope': len(out), 'created': sum(n['normalized_task_id'] not in idx for n in out),
         'updated': sum(n['normalized_task_id'] in idx for n in out), 'closed': 0, 'skipped': skip, 'failed': 0, 'failed_ids': [],
         'qa_excluded': qa, 'status': 'ok', 'done': 0, 'fallbacks': 0, 'fallback_ids': [], 'backlog': backlog, 'enrich_todo': len(todo)}
    save_counts(t, c)
    msg = (f"{t}: fetched {c['fetched']} in_scope {c['in_scope']} new {c['created']} skipped {skip}" + (f' qa_excluded {qa}' if t == 'linear' else '')
           + f" | enrich {len(todo)} (backlog {backlog})" + (f' -> read {t}_enrich_todo.json' if todo else '')
           + (f' | full descriptions needed: {len(full)} (linear_full_needed.json)' if full else ''))
    if empty_keys:
        msg += (f' | ANOMALY {r["anomalies"][t]}: closes will be withheld. Validate: airtable__get_table_schema paramsFile schema_params.json -> `schema-check <result>`'
                if t in AIRTABLE_SOURCES else f' | ANOMALY {r["anomalies"][t]}: closes will be withheld')
    print(msg + f' | elapsed {elapsed_min()} min')

def cmd_batch(t):
    out = load(f'{t}_normalized.json'); c = counts(t); idx = tasks_store.index(); r = run()
    if c.get('status') == 'unavailable': print(f'{t} is unavailable this run: nothing to write'); return
    dec = enrichment.decisions(); full = load('linear_full.json', {})
    todo = {x['normalized_task_id'] for x in load(f'{t}_enrich_todo.json', [])}
    recs = []
    for n in out:
        nid = n['normalized_task_id']; n = {k: v for k, v in n.items() if not k.startswith('_')}
        i = idx.get(nid); unchanged = i is not None and i.get('last_updated_at') == n.get('last_updated_at') and r.get('mode') != 'rebuild'
        if t == 'linear':
            if unchanged: n.pop('description', None)                       # keep the stored (possibly full) description
            elif n['source_record_id'] in full: n['description'] = clean(full[n['source_record_id']])
        if nid in todo:
            if enrichment.apply(n, dec): c['done'] += 1
            else: c['fallbacks'] += 1; c['fallback_ids'].append(nid)
        recs.append(n)
    w = tasks_store.batches(f'{t}_write', recs)
    ids = {n['normalized_task_id'] for n in out}
    opens = tasks_store.open_rows(t, idx); closing = [x for x in opens if x['normalized_task_id'] not in ids]
    guard = None
    if t in r.get('anomalies', {}): guard = r['anomalies'][t]
    elif t != 'gcal' and len(closing) >= CLOSE_GUARD['min_rows'] and len(closing) > CLOSE_GUARD['max_ratio'] * len(opens):
        guard = f'would close {len(closing)} of {len(opens)} open rows'
        r['anomalies'][t] = guard; save_run(r)
    cl = [] if guard else tasks_store.batches(f'{t}_close', tasks_store.close_records(closing))
    c['closed_pending'] = 0 if guard else len(closing)
    if guard: c['anomaly'] = guard
    save_counts(t, c)
    print(f'{t}: write batches {w or "none"} | close batches {cl or "none"} ({c["closed_pending"]} rows)'
          + (f' | CLOSES WITHHELD — anomaly: {guard}. Validate with schema-check (Airtable sources) and report it.' if guard else
             '. Run close batches only after every write batch succeeded.'))

def cmd_complete(t, closed='yes'):
    c = counts(t); pend = c.pop('closed_pending', 0)
    c['closed'] = pend if closed == 'yes' and not c['failed'] else 0
    if c['failed']: c['note'] = 'closing skipped: write failures'
    save_counts(t, c)
    print(f"{t} complete: in_scope {c['in_scope']} created {c['created']} updated {c['updated']} closed {c['closed']} failed {c['failed']} | elapsed {elapsed_min()} min")

def cmd_failed(t, nid, err):
    c = counts(t); c['failed'] += 1; c['failed_ids'].append(f'{nid} {err[:80]}'); save_counts(t, c); print('logged', nid)

def mark_unavailable(t, err):
    """Source unavailable: existing rows get source_status=unavailable + sync_error; lifecycle unchanged, nothing closed."""
    r = run(); r['unavailable'][t] = err; save_run(r)
    idx = tasks_store.index()
    names = tasks_store.batches(f'{t}_unavail', tasks_store.unavailable_records(tasks_store.rows_of(t, idx), err)) if idx else []
    save_counts(t, {'fetched': 0, 'in_scope': 0, 'created': 0, 'updated': 0, 'closed': 0, 'skipped': 0, 'failed': 0, 'failed_ids': [],
                    'qa_excluded': 0, 'status': 'unavailable', 'done': 0, 'fallbacks': 0, 'fallback_ids': [], 'backlog': 0, 'note': err})
    for f in __import__('config').W.glob(f'{t}_write_*.json'): f.unlink()
    for f in __import__('config').W.glob(f'{t}_close_*.json'): f.unlink()
    print(f'{t} unavailable ({err[:80]}): run batches {names or "none"}; do not run any other {t} batches')

def cmd_unavailable(t, err): mark_unavailable(t, err)
