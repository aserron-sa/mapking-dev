"""Shared constants, maps derived from schema.SCHEMA, run state and tiny helpers.

Importing this module validates the schema; a malformed schema.py fails here, before any API call.
"""
import os, json, re, pathlib, datetime
from zoneinfo import ZoneInfo
from schema import SCHEMA

PROMPT_VERSION = 'v3.14'
W = pathlib.Path(os.environ.get('LOOM_W', '/agent/workspace')); W.mkdir(parents=True, exist_ok=True)
TZ = ZoneInfo('America/Montevideo')
SLACK_CHANNEL = 'C0BRF6AHDJQ'
CALENDAR_ACCOUNT = 'singular@mapking.ai'   # owner of the 'primary' calendar Loom reads; second token of every htmlLink eid
LOCK_STALE_MIN = 35
ENRICH_CAP = {'sync': 60, 'rebuild': 150}
CLOSE_GUARD = {'min_rows': 5, 'max_ratio': 0.5}   # anomaly if a source would close > 50% of its open rows (and >= 5)

# ---- schema validation (fails at import) ----
def _validate(s):
    assert re.fullmatch(r'app\w{14}', s['base']), 'bad base id'
    seen = set()
    for t, spec in s['tables'].items():
        assert re.fullmatch(r'tbl\w{14}', spec['id']), f'{t}: bad table id'
        assert spec['role'] in ('source', 'destination', 'log'), f'{t}: bad role'
        for f, fs in spec['fields'].items():
            assert re.fullmatch(r'fld\w{14}', fs['id']), f'{t}.{f}: bad field id'
            assert fs['id'] not in seen, f'{t}.{f}: duplicate field id'
            seen.add(fs['id'])
        if spec['role'] == 'source':
            assert any(fs.get('key') for fs in spec['fields'].values()), f'{t}: source table needs a key field'
    for t in ('command_center_tasks', 'loom_sync_runs'):
        assert t in s['tables'], f'missing table {t}'
_validate(SCHEMA)

BASE = SCHEMA['base']
TABLES = {t: spec['id'] for t, spec in SCHEMA['tables'].items()}
F = {t: {f: fs['id'] for f, fs in spec['fields'].items()} for t, spec in SCHEMA['tables'].items()}
KEY_FIELDS = {t: [f for f, fs in spec['fields'].items() if fs.get('key')] for t, spec in SCHEMA['tables'].items() if spec['role'] == 'source'}
CCT, RUNS = F['command_center_tasks'], F['loom_sync_runs']
AIRTABLE_SOURCES = [t for t, spec in SCHEMA['tables'].items() if spec['role'] == 'source']
ORDER = AIRTABLE_SOURCES + ['attio', 'gcal', 'linear']
SOURCE_NAME = {'attio': 'Attio', 'gcal': 'Google Calendar', 'linear': 'Linear', **{t: 'Airtable' for t in AIRTABLE_SOURCES}}
ID_PREFIX = {'Airtable': 'airtable:', 'Attio': 'attio:', 'Google Calendar': 'gcal:', 'Linear': 'linear:'}
INDEX_FIELDS = [CCT[k] for k in ('normalized_task_id', 'source', 'source_table', 'lifecycle', 'last_updated_at', 'category')]
CATEGORIES = set(SCHEMA['tables']['command_center_tasks']['fields']['category']['options'])
TAGS = set(SCHEMA['tables']['command_center_tasks']['fields']['tags']['options'])
TEST_DATA = re.compile(r'^\s*(\[test\]|test(\s*\d+)?\s*[-—–:])|dummy|\(demo\)', re.I)

# ---- time + files ----
def now(): return datetime.datetime.now(datetime.timezone.utc)
def iso(d): return d.astimezone(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
def today(): return now().astimezone(TZ).date()
def parse_ts(s):
    try: return datetime.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except Exception: return None
def dump(name, d): json.dump(d, open(W / name, 'w'), ensure_ascii=False); return name
def load(name, default=None):
    p = W / name
    return json.load(open(p)) if p.exists() else default

# ---- run state (run.json) ----
def run(): return load('run.json', {})
def save_run(r): dump('run.json', r)
def elapsed_min():
    r = run()
    return round((now() - parse_ts(r['started_at'])).total_seconds() / 60, 1) if r.get('started_at') else 0.0
def counts(t): return load(f'{t}_counts.json')
def save_counts(t, c): dump(f'{t}_counts.json', c)
