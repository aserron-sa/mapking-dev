"""Schema validation on demand (after an error, an anomaly, or in rebuild mode) and schema-refresh proposals."""
import copy, pprint
from config import SCHEMA, TABLES, W, run, save_run, dump
from results import load_result

def params():
    return {'baseId': SCHEMA['base'], 'tables': [{'tableId': s['id'], 'fieldIds': [f['id'] for f in s['fields'].values()]}
                                                 for s in SCHEMA['tables'].values()]}

def _live(path):
    """get_table_schema result -> {tableId: {fieldId: {'type', 'choices'(lowercased)}}}; None if unparseable."""
    d = load_result(path); tabs = d.get('tables') if isinstance(d, dict) else None
    if not isinstance(tabs, list): return None
    out = {}
    for t in tabs:
        tid = t.get('tableId') or t.get('id'); out[tid] = {}
        for f in t.get('fields', []):
            ch = ((f.get('config') or f.get('options') or {}).get('choices')) or []
            out[tid][f['id']] = {'type': f.get('type'), 'choices': {c.get('name', '').casefold() for c in ch}}
    return out

def diff(live):
    """-> {table: [issue, ...]} comparing schema.py to the live schema."""
    issues = {}
    for t, spec in SCHEMA['tables'].items():
        lt = live.get(spec['id'])
        if lt is None: issues[t] = ['table not returned']; continue
        for name, fs in spec['fields'].items():
            lf = lt.get(fs['id'])
            if lf is None: issues.setdefault(t, []).append(f'{name}: field {fs["id"]} missing'); continue
            if lf['type'] and lf['type'] != fs['type']:
                issues.setdefault(t, []).append(f'{name}: type {fs["type"]} -> {lf["type"]}')
            for opt in fs.get('options', []):
                if lf['choices'] and opt.casefold() not in lf['choices']:
                    issues.setdefault(t, []).append(f"{name}: option '{opt}' no longer exists")
    return issues

def cmd_schema_check(path):
    live = _live(path)
    if live is None: print('schema result not parseable; treat as an error: retry the call once'); raise SystemExit(4)
    issues = diff(live); r = run()
    core = {t: v for t, v in issues.items() if SCHEMA['tables'][t]['role'] != 'source'}
    if core:
        print('FAIL core schema:', core, '-> write nothing more to command_center_tasks; release with status failure.')
        r['schema_fail'] = core; save_run(r); raise SystemExit(2)
    if not issues:
        flagged = [t for t, a in r.get('anomalies', {}).items()]
        print('schema ok' + (f'; anomalies in {flagged} are in the data, not the schema: their closes stay withheld' if flagged else ''))
        return
    from pipeline import mark_unavailable
    for t, v in issues.items():
        mark_unavailable(t, 'schema changed: ' + '; '.join(v)[:180])

def cmd_schema_refresh(path):
    """Write schema_proposed.py from the live schema (types / missing fields / unknown fields) and print the diff.
    Never replaces schema.py."""
    live = _live(path)
    if live is None: print('schema result not parseable'); raise SystemExit(4)
    issues = diff(live); prop = copy.deepcopy(SCHEMA); notes = []
    for t, spec in prop['tables'].items():
        lt = live.get(spec['id'], {})
        known = {fs['id'] for fs in spec['fields'].values()}
        for name, fs in list(spec['fields'].items()):
            lf = lt.get(fs['id'])
            if lf is None: notes.append(f'# {t}.{name} ({fs["id"]}) MISSING in live schema — find the replacement field id'); continue
            if lf['type']: fs['type'] = lf['type']
        extra = sorted(set(lt) - known)
        if extra: notes.append(f'# {t}: live fields not used by Loom: {", ".join(extra)}')
    body = '"""PROPOSED schema from schema-refresh. Review the notes and diff, then copy over schema.py by hand."""\n' \
           + '\n'.join(notes) + '\n\nSCHEMA = ' + pprint.pformat(prop, width=150, sort_dicts=False) + '\n'
    (W / 'schema_proposed.py').write_text(body)
    print('diff vs schema.py:', issues or 'none', '| wrote schema_proposed.py')
