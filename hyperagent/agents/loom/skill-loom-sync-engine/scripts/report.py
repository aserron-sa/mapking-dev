"""Verify + the 7-line report + run-log release params + Slack params."""
import collections
from config import (AIRTABLE_SOURCES, ORDER, ID_PREFIX, PROMPT_VERSION, SLACK_CHANNEL, run, load, dump, now, iso, W)
from results import load_result, pages
import lock

KEYS = ['fetched', 'in_scope', 'created', 'updated', 'closed', 'skipped', 'failed', 'done', 'fallbacks', 'backlog', 'qa_excluded']

def _airtable_total():
    cs = [load(f'{t}_counts.json') for t in AIRTABLE_SOURCES]
    if all(c is None for c in cs): return None
    a = {k: sum((c or {}).get(k, 0) for c in cs) for k in KEYS}
    st = [(c or {}).get('status', 'skipped — budget') for c in cs]
    a['status'] = 'ok' if all(s == 'ok' for s in st) else ('unavailable' if 'unavailable' in st else 'skipped — budget')
    bad = [f'{t} {s}' for t, s in zip(AIRTABLE_SOURCES, st) if s != 'ok']
    if bad: a['note'] = ', '.join(bad)
    a['failed_any'] = sum((c or {}).get('failed', 0) for c in cs)
    return a

def cmd_report():
    r = run(); rows = load('verify.json'); assert rows is not None, 'run `save verify` first'
    vp = pages('verify'); total = (load_result(vp[-1]).get('metadata') or {}).get('totalRecordCount', len(rows)) if vp else len(rows)
    per = {'Airtable': _airtable_total(), 'Attio': load('attio_counts.json'), 'Google Calendar': load('gcal_counts.json'), 'Linear': load('linear_counts.json')}
    allc = [load(f'{t}_counts.json') for t in ORDER]
    cnt = collections.Counter(x['normalized_task_id'] for x in rows if x.get('normalized_task_id'))
    dups = [k for k, v in cnt.items() if v > 1]
    empty = [x.get('normalized_task_id') for x in rows if not x.get('lifecycle')]
    processed = [ID_PREFIX[s] for s, c in per.items() if c and c.get('status') == 'ok']
    in_processed = lambda i: any(str(i).startswith(p) for p in processed)
    problems = []
    for name, c in per.items():
        if not c: problems.append(f'{name}: skipped — budget'); continue
        if c['status'] != 'ok': problems.append(f"{name}: {c['status']}" + (f" ({c['note']})" if c.get('note') else ''))
        if c.get('failed'): problems.append(f"{name}: {c['failed']} failed writes (ids in run log)")
    for t in ORDER:
        c = load(f'{t}_counts.json')
        if c and c.get('anomaly'): problems.append(f'{t}: closes withheld — {c["anomaly"]}')
    if r.get('schema_fail'): problems.append(f"schema: core tables changed {r['schema_fail']}")
    if [d for d in dups if in_processed(d)]: problems.append(f'Verify: duplicates {", ".join(d for d in dups if in_processed(d))[:200]}')
    if [e for e in empty if in_processed(e)]: problems.append(f'Verify: empty lifecycle {", ".join(str(e) for e in empty if in_processed(e))[:200]}')
    wrote = any(c and (c.get('created') or c.get('updated') or c.get('closed')) for c in allc)
    outcome = '❌ Failure' if not wrote or r.get('schema_fail') else ('✅ Success' if not problems else '⚠️ Partial success')
    lines = [('Daily sync · ' if r.get('trigger') == 'schedule' else '') + outcome + (' (rebuild)' if r.get('mode') == 'rebuild' else '')
             + f" · run {r['run_id']} · prompt {PROMPT_VERSION}"]
    for name, c in per.items():
        if not c:
            lines.append(f'• {name}: fetched 0 / in scope 0 / created 0 / updated 0 / closed 0 / failed 0 / skipped — budget' + (' / excluded (Ready for QA) 0' if name == 'Linear' else ''))
            continue
        s = f"• {name}: fetched {c['fetched']} / in scope {c['in_scope']} / created {c['created']} / updated {c['updated']} / closed {c['closed']} / failed {c['failed']} / {c['status']}"
        if name == 'Linear': s += f" / excluded (Ready for QA) {c.get('qa_excluded', 0)}"
        if c['in_scope'] == 0 and c['status'] == 'ok': s += ' / no open items'
        lines.append(s)
    E = lambda k: sum((c or {}).get(k, 0) for c in allc)
    lines.append(f"• Enrichment: done {E('done')} / fallbacks {E('fallbacks')} / backlog {E('backlog')}")
    lines.append(f'• Verify: {len(rows)} rows read (= totalRecordCount {total}) · open {sum(x.get("lifecycle") == "open" for x in rows)} · duplicates {len(dups)} · empty lifecycle {len(empty)}')
    if outcome != '✅ Success': lines += problems
    report = '\n'.join(lines); (W / 'report.txt').write_text(report)
    status = {'✅ Success': 'success', '⚠️ Partial success': 'partial', '❌ Failure': 'failure'}[outcome]
    log = {'status': status, 'finished_at': iso(now()), 'source_counts': '\n'.join(lines[1:5]),
           'failed_ids': '\n'.join(i for c in allc if c for i in c.get('failed_ids', [])),
           'fallback_ids': '\n'.join(i for c in allc if c for i in c.get('fallback_ids', [])), 'report': report,
           'created': E('created'), 'updated': E('updated'), 'closed': E('closed'), 'skipped': E('skipped'),
           'failed': E('failed'), 'enrichment_fallbacks': E('fallbacks')}
    rp = lock.release_params(r, log)
    if rp: dump('release_params.json', rp)
    dump('slack_report_params.json', {'channel': SLACK_CHANNEL, 'text': report})
    print(report)
