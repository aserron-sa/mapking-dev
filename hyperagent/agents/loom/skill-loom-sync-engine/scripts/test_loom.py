#!/usr/bin/env python3
"""Offline tests for the Loom engine. Run after ANY change: `python3 test_loom.py` -> prints PASS or the failing check.
Uses a temp workspace (LOOM_W) and sample results in the real tool-result shapes. No network."""
import os, sys, json, shutil, subprocess, tempfile, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

def wrap(obj, vendor='airtable'):
    return {"content": [{"type": "text", "text": f'<mcp-tool-result vendor="{vendor}">' + json.dumps(obj) + '</mcp-tool-result>'}]}

class Env:
    def __init__(self):
        self.root = tempfile.mkdtemp(prefix='loomtest_'); self.w = os.path.join(self.root, 'w'); os.makedirs(self.w)
    def put(self, name, obj):
        p = os.path.join(self.root, name); json.dump(obj, open(p, 'w')); return p
    def L(self, *args, ok=True):
        r = subprocess.run([sys.executable, os.path.join(HERE, 'loom.py'), *args], capture_output=True, text=True, env={**os.environ, 'LOOM_W': self.w})
        if ok and r.returncode != 0: raise AssertionError(f'{args} failed: {r.stdout}{r.stderr}')
        return r
    def j(self, name): return json.load(open(os.path.join(self.w, name)))
    def done(self): shutil.rmtree(self.root, ignore_errors=True)

from schema import SCHEMA
CCT = {k: v['id'] for k, v in SCHEMA['tables']['command_center_tasks']['fields'].items()}
FA = {k: v['id'] for k, v in SCHEMA['tables']['approvals']['fields'].items()}

def idx_rec(i, nid, src, tbl, lc, lu, cat):
    return {"id": f"recI{i}", "cellValuesByFieldId": {CCT['normalized_task_id']: nid, CCT['source']: {"name": src}, CCT['source_table']: tbl,
            CCT['lifecycle']: {"name": lc}, CCT['last_updated_at']: lu, CCT['category']: ({"name": cat} if cat else None)}}

def live_schema(drop=None):
    """get_table_schema-shaped result built from schema.py; drop=(table, field) removes one field."""
    tabs = []
    for t, s in SCHEMA['tables'].items():
        fields = []
        for name, fs in s['fields'].items():
            if drop == (t, name): continue
            f = {"id": fs['id'], "type": fs['type']}
            if fs.get('options'): f['config'] = {"choices": [{"name": o} for o in fs['options']]}
            fields.append(f)
        tabs.append({"tableId": s['id'], "fields": fields})
    return {"content": [], "structuredContent": '<mcp-tool-result vendor="airtable">' + json.dumps({"tables": tabs}) + '</mcp-tool-result>'}

import base64
ACCT = 'singular@mapking.ai'
def link(eid, cal=ACCT): return 'https://www.google.com/calendar/event?eid=' + base64.urlsafe_b64encode(f'{eid} {cal}'.encode()).decode().rstrip('=')
def ev(eid, start, end, summary='Ev', desc=None, status='confirmed', cal=ACCT):
    return {"id": eid, "summary": summary, "description": desc, "status": status, "start": start, "end": end,
            "updated": "u", "organizer": {"email": ACCT}, "htmlLink": link(eid, cal)}

def tomorrow(): return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)).strftime('%Y-%m-%d')

def base_run(e, index_rows, mode='sync'):
    e.L('init', mode, 'schedule')
    e.L('lock-check', e.put('lock0.json', wrap({"records": []})))
    e.L('lock-created', e.put('lockc.json', wrap({"records": [{"id": "recRUN1"}]})))
    assert 'LOCK HELD' in e.L('lock-confirm', e.put('lock0b.json', wrap({"records": []}))).stdout
    e.L('save', 'index', e.put('index.json', wrap({"records": index_rows, "metadata": {"totalRecordCount": len(index_rows)}})))

def empty_tables(e, skip=()):
    for t in ['approvals', 'follow_ups', 'ticket_candidates', 'dev_tickets', 'invoices']:
        if t in skip: continue
        e.L('save', f'airtable_{t}', e.put(f'{t}.json', wrap({"records": [], "metadata": {"totalRecordCount": 0}})))
        e.L('prep', t); e.L('batch', t); e.L('complete', t)

def test_happy_path():
    e = Env()
    try:
        idx = [idx_rec(1, "linear:MK-1", "Linear", None, "open", "2026-10-01T00:00:00Z", "Product"),
               idx_rec(2, "linear:MK-9", "Linear", None, "open", "2026-10-01T00:00:00Z", "Product"),
               idx_rec(3, "airtable:approvals:recA", "Airtable", "approvals", "open", "2026-08-01T00:00:00.000Z", "Ops"),
               idx_rec(4, "attio:t-old", "Attio", None, "open", "2026-09-01", "Sales")]
        base_run(e, idx)
        ap = {"records": [
            {"id": "recA", "createdTime": "x", "cellValuesByFieldId": {FA['name']: "Approve X", FA['approval_status']: {"name": "Pending"}, FA['last_modified']: "2026-08-01T00:00:00.000Z", FA['approved_by']: {"email": "a@b.co"}}},
            {"id": "recB", "createdTime": "x", "cellValuesByFieldId": {FA['name']: "TEST - foo", FA['approval_status']: {"name": "Pending"}}},
            {"id": "recC", "createdTime": "x", "cellValuesByFieldId": {FA['name']: "Done one", FA['approval_status']: {"name": "Approved"}}}],
            "metadata": {"totalRecordCount": 3}}
        e.L('save', 'airtable_approvals', e.put('ap.json', wrap(ap))); e.L('prep', 'approvals'); e.L('batch', 'approvals'); e.L('complete', 'approvals')
        assert e.j('approvals_counts.json')['in_scope'] == 1 and e.j('approvals_counts.json')['skipped'] == 1
        empty_tables(e, skip=('approvals',))
        attio = 'tasks[2]:\n  - task_id: t-1\n    content: "Send deck to Adam"\n    deadline_at: "2026-10-20T00:00:00Z"\n    is_completed: false\n    created_at: "2026-10-02T16:10:10.646Z"\n  - task_id: t-2\n    content: "test 2 — dummy"\n    is_completed: false\n    created_at: "2026-10-02T16:10:10.646Z"\nhas_more: false'
        e.L('save', 'attio', e.put('attio.json', {"content": [{"type": "text", "text": '<mcp-tool-result vendor="attio">' + attio + '</mcp-tool-result>'}]}))
        e.L('prep', 'attio')
        json.dump({"attio:t-1": {"category": "Sales", "tags": ["follow-up"], "schedulable": True}}, open(os.path.join(e.w, 'enrichments.json'), 'w'))
        e.L('batch', 'attio'); e.L('complete', 'attio')
        c = e.j('attio_counts.json'); assert (c['created'], c['closed'], c['done']) == (1, 1, 1), c
        tm = tomorrow()
        sid = 's49tb7_' + tm.replace('-', '') + 'T123000Z'               # recurring instance: suffix = start in UTC
        gc = {"count": 3, "events": [
            ev(sid, {"dateTime": tm + "T09:30:00-03:00"}, {"dateTime": tm + "T09:45:00-03:00"}, 'Standup'),
            ev("e2", {"date": tm}, {"date": "2099-01-01"}, 'Deadline'),
            ev("e3", {"dateTime": "2020-01-01T09:00:00Z"}, {"dateTime": "2020-01-01T10:00:00Z"}, 'Past')]}
        e.L('save', 'gcal', e.put('gcal.json', gc)); e.L('prep', 'gcal'); e.L('batch', 'gcal'); e.L('complete', 'gcal')
        g = e.j('gcal_write_1.json')['records'][0]['fields']
        assert g[CCT['starts_at']] == tm + 'T12:30:00.000Z' and g[CCT['all_day']] is False and g[CCT['owner']] == ACCT and e.j('gcal_counts.json')['in_scope'] == 2
        lin = {"issues": [
            {"id": "MK-1", "title": "Fix map", "description": "x" * 500 + "… (truncated, use `get_issue` for full description)", "url": "u", "dueDate": None, "updatedAt": "2026-10-10T00:00:00Z", "status": "In Progress", "statusType": "started", "assignee": {"email": "d@m.ai"}},
            {"id": "MK-9", "title": "Done dev", "description": "", "url": "u", "dueDate": None, "updatedAt": "2026-10-10T00:00:00Z", "status": "Ready for QA ", "statusType": "started", "assignee": None},
            {"id": "MK-5", "title": "Add regression tests", "description": "d", "url": "u", "dueDate": "2026-10-20", "updatedAt": "2026-10-11T00:00:00Z", "status": "Todo", "statusType": "unstarted", "assignee": None},
            {"id": "MK-6", "title": "Shipped", "description": "d", "url": "u", "dueDate": None, "updatedAt": "2026-10-11T00:00:00Z", "status": "Done", "statusType": "completed", "assignee": None}],
            "hasNextPage": False, "cursor": "c"}
        e.L('save', 'linear', e.put('lin.json', wrap(lin, 'linear'))); e.L('prep', 'linear')
        assert e.j('linear_full_needed.json') == ['MK-1']
        e.L('save-issue', e.put('iss.json', wrap({"issue": {"identifier": "MK-1", "description": "FULL " + "y" * 2500}}, 'linear')))
        d = e.j('enrichments.json'); d.update({"linear:MK-1": {"category": "Product", "tags": ["bug"], "schedulable": True},
                                               "linear:MK-5": {"category": "QA", "tags": ["bogus"], "schedulable": True}})
        json.dump(d, open(os.path.join(e.w, 'enrichments.json'), 'w'))
        e.L('batch', 'linear'); e.L('complete', 'linear')
        recs = {r['fields'][CCT['normalized_task_id']]: r['fields'] for r in e.j('linear_write_1.json')['records']}
        assert len(recs['linear:MK-1'][CCT['description']]) == 2000 and recs['linear:MK-1'][CCT['tags']] == ['bug']
        assert recs['linear:MK-5'][CCT['category']] == 'Uncategorized'               # invalid tag -> fallback
        assert e.j('linear_close_1.json')['records'][0]['fields'][CCT['normalized_task_id']] == 'linear:MK-9'
        e.L('save', 'verify', e.put('verify.json', wrap({"records": idx, "metadata": {"totalRecordCount": len(idx)}})))
        out = e.L('report').stdout
        assert out.startswith('Daily sync · ⚠️ Partial success') is False and out.startswith('Daily sync · ✅ Success'), out
        assert '• Linear: fetched 4 / in scope 2 / created 1 / updated 1 / closed 1 / failed 0 / ok / excluded (Ready for QA) 1' in out, out
        assert '• Enrichment: done 2 / fallbacks 3 / backlog 0' in out, out    # gcal x2 had no decision + MK-5 invalid
        assert e.j('release_params.json')['records'][0]['id'] == 'recRUN1'
    finally: e.done()

def test_anomaly_empty_key_field():
    e = Env()
    try:
        base_run(e, [idx_rec(3, "airtable:approvals:recA", "Airtable", "approvals", "open", "2026-08-01T00:00:00.000Z", "Ops")])
        ap = {"records": [{"id": f"rec{i}", "createdTime": "x", "cellValuesByFieldId": {FA['name']: f"Item {i}"}} for i in range(3)],
              "metadata": {"totalRecordCount": 3}}                                   # approval_status missing everywhere
        e.L('save', 'airtable_approvals', e.put('ap.json', wrap(ap)))
        assert 'ANOMALY' in e.L('prep', 'approvals').stdout
        out = e.L('batch', 'approvals').stdout
        assert 'CLOSES WITHHELD' in out and not os.path.exists(os.path.join(e.w, 'approvals_close_1.json')), out
        assert 'schema ok' in e.L('schema-check', e.put('s.json', live_schema())).stdout
    finally: e.done()

def test_close_ratio_guard():
    e = Env()
    try:
        idx = [idx_rec(i, f"linear:MK-{i}", "Linear", None, "open", "2026-10-01T00:00:00Z", "Product") for i in range(1, 7)]
        base_run(e, idx)
        lin = {"issues": [{"id": "MK-1", "title": "Keep", "description": "d", "url": "u", "dueDate": None, "updatedAt": "2026-10-01T00:00:00Z", "status": "Todo", "statusType": "unstarted", "assignee": None}], "hasNextPage": False}
        e.L('save', 'linear', e.put('lin.json', wrap(lin, 'linear'))); e.L('prep', 'linear')
        assert 'would close 5 of 6' in e.L('batch', 'linear').stdout
    finally: e.done()

def test_schema_check_and_refresh():
    e = Env()
    try:
        base_run(e, [idx_rec(3, "airtable:approvals:recA", "Airtable", "approvals", "open", "x", "Ops")])
        out = e.L('schema-check', e.put('s1.json', live_schema(drop=('approvals', 'approval_status')))).stdout
        assert 'approvals unavailable' in out and os.path.exists(os.path.join(e.w, 'approvals_unavail_1.json')), out
        r = e.L('schema-check', e.put('s2.json', live_schema(drop=('command_center_tasks', 'lifecycle'))), ok=False)
        assert r.returncode == 2 and 'FAIL core schema' in r.stdout
        e.L('schema-refresh', e.put('s3.json', live_schema(drop=('invoices', 'due_date'))))
        txt = open(os.path.join(e.w, 'schema_proposed.py')).read()
        assert 'invoices.due_date' in txt and 'MISSING' in txt and 'SCHEMA = ' in txt
    finally: e.done()

def test_lock_busy_and_stale():
    e = Env()
    try:
        e.L('init', 'sync', 'schedule')
        RUNS = {k: v['id'] for k, v in SCHEMA['tables']['loom_sync_runs']['fields'].items()}
        n = dt.datetime.now(dt.timezone.utc)
        rows = [{"id": "recOld", "cellValuesByFieldId": {RUNS['run_id']: "a", RUNS['status']: {"name": "running"}, RUNS['started_at']: (n - dt.timedelta(minutes=50)).isoformat()}},
                {"id": "recNew", "cellValuesByFieldId": {RUNS['run_id']: "b", RUNS['status']: {"name": "running"}, RUNS['started_at']: (n - dt.timedelta(minutes=5)).isoformat()}}]
        out = e.L('lock-check', e.put('l.json', wrap({"records": rows}))).stdout
        assert 'STALE 1' in out and 'BUSY since' in out, out
    finally: e.done()

def test_count_mismatch():
    e = Env()
    try:
        e.L('init', 'sync', 'schedule')
        bad = 'tasks[3]:\n  - task_id: t-1\n    content: "a"\n    is_completed: false\nhas_more: false'
        r = e.L('save', 'attio', e.put('a.json', {"content": [{"type": "text", "text": '<mcp-tool-result vendor="attio">' + bad + '</mcp-tool-result>'}]}), ok=False)
        assert r.returncode == 3 and 'COUNT MISMATCH' in r.stdout
    finally: e.done()

def test_attio_plain_text_and_defaults():
    e = Env()
    try:
        out = e.L('init', 'sync', 'slack:#ingestion Tester').stdout
        assert 'On it — syncing now.' in out, out                           # ack reminder on Slack runs
        assert e.j('attio_params.json')['limit'] == 10                        # 50 is rejected by attio__list-tasks
        assert e.j('lock_list.json')['pageSize'] == 5
        raw = 'tasks[2]:\n  - task_id: t-1\n    content: "Send deck"\n    is_completed: false\n    created_at: "2026-10-02T16:10:10.646Z"\n  - task_id: t-2\n    content: "Call Adam"\n    is_completed: false\n    created_at: "2026-10-02T16:10:10.646Z"\nhas_more: true'
        p = os.path.join(e.root, 'plain.txt'); open(p, 'w').write(raw)       # pasted as returned, no wrapper
        out = e.L('save', 'attio', p).stdout
        assert '2 records ok' in out and 'attio_next.json' in out, out
        assert e.j('attio_next.json')['offset'] == 10
        e.L('lock-created', e.put('lc.json', wrap({"records": [{"id": "recRUN9"}]})))
        assert 'On it — syncing now.' in e.L('lock-confirm', e.put('l0.json', wrap({"records": []}))).stdout
    finally: e.done()

def test_gcal_integrity_invariants():
    e = Env()
    try:
        e.L('init', 'sync', 'schedule'); tm = tomorrow(); base = 's49tb7_' + tm.replace('-', '') + 'T123000Z'
        good = ev(base, {"dateTime": tm + "T09:30:00-03:00"}, {"dateTime": tm + "T09:45:00-03:00"})
        cases = {
            'count missing': {"events": [good]},
            'count 2 reported': {"count": 2, "events": [good]},
            'eid id': {"count": 1, "events": [{**good, "htmlLink": link('other-id')}]},
            'matches neither organizer': {"count": 1, "events": [{**good, "htmlLink": link(base, 'someone@else.com')}]},
            'instance suffix': {"count": 1, "events": [{**ev(base, {"dateTime": tm + "T10:30:00-03:00"}, {"dateTime": tm + "T10:45:00-03:00"})}]},
            'end is not after start': {"count": 1, "events": [ev('x1', {"dateTime": tm + "T10:00:00-03:00"}, {"dateTime": tm + "T09:00:00-03:00"})]},
            'not decodable': {"count": 1, "events": [{**good, "htmlLink": "https://www.google.com/calendar/event"}]},
        }
        for want, page in cases.items():
            r = e.L('save', 'gcal', e.put('g.json', page), ok=False)
            assert r.returncode == 5 and 'INTEGRITY FAIL' in r.stdout and want in r.stdout, (want, r.stdout)
            assert not os.path.exists(os.path.join(e.w, 'gcal_page_1.json'))     # failed page is never kept
        allday = ev('ad_' + tm.replace('-', ''), {"date": tm}, {"date": "2099-01-01"})   # all-day instance suffix = start date
        assert '2 records ok' in e.L('save', 'gcal', e.put('ok.json', {"count": 2, "events": [good, allday]})).stdout
    finally: e.done()

def test_description_cap_second_marker_removed():
    """Marker appears twice (first sentence and the very end): after the 2,000-char cap only the FIRST must remain."""
    from text_utils import clean
    m = 'END-MARKER-SHOULD-NOT-APPEAR'
    d = clean(f'Test: Loom must cap at 2,000. {m} is at the very end.\n' + 'x' * 2100 + f'\n{m}')
    assert len(d) == 2000 and d.count(m) == 1 and not d.endswith(m)

if __name__ == '__main__':
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    for t in tests:
        t(); print('ok', t.__name__)
    print(f'PASS ({len(tests)} tests)')
