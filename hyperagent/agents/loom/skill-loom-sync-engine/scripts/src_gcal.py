"""Google Calendar (Ops): confirmed events in the 14-day window that have not ended."""
import base64, datetime, re
from config import TZ, TEST_DATA, CALENDAR_ACCOUNT, iso, today
from text_utils import clean, email

KEYS = ['status', 'start']

def window_params():
    d0 = today()
    a = datetime.datetime.combine(d0, datetime.time(0), TZ)
    b = datetime.datetime.combine(d0 + datetime.timedelta(days=14), datetime.time(23, 59), TZ)
    return {'calendarIds': ['primary'], 'timeMin': a.isoformat(), 'timeMax': b.isoformat(), 'maxResults': 250}

INSTANCE_SUFFIX = re.compile(r'_(\d{8}(T\d{6}Z)?)$')

def _eid_tokens(link):
    """htmlLink ...?eid=<base64url("<event id> <calendar email>")> -> [id, email] or None."""
    m = re.search(r'[?&]eid=([A-Za-z0-9_-]+)', link or '')
    if not m: return None
    raw = m.group(1)
    try: return base64.urlsafe_b64decode(raw + '=' * (-len(raw) % 4)).decode('utf-8').split()
    except Exception: return None

def _when(v):
    """start/end (dict or string) -> ('date', date) | ('dateTime', aware datetime) | None"""
    if isinstance(v, str): v = {'date': v} if len(v) == 10 else {'dateTime': v}
    if not isinstance(v, dict): return None
    try:
        if v.get('dateTime'): return 'dateTime', datetime.datetime.fromisoformat(v['dateTime'].replace('Z', '+00:00'))
        if v.get('date'): return 'date', datetime.date.fromisoformat(v['date'])
    except Exception: return None
    return None

def integrity_errors(events, reported_count):
    """Identity + timing invariants. Any error -> Calendar unavailable for this run (never write unverifiable rows).
    1) count: the number the tool reported must equal the events saved.
    2) identity: htmlLink eid decodes to "<id> <email>" with id == event id and email == organizer or the calendar account.
    3) recurring instance: an id suffix _YYYYMMDDTHHMMSSZ must equal the start in UTC (all-day: _YYYYMMDD == start date).
    4) timing: end > start (same kind: both timed or both all-day)."""
    errs = []
    if reported_count is None: errs.append('count missing: save {"count": N, "events": [...]} with N as reported by the tool')
    elif int(reported_count) != len(events): errs.append(f'count {reported_count} reported vs {len(events)} events saved')
    for e in events:
        eid = e.get('id') or '?'
        tok = _eid_tokens(e.get('htmlLink'))
        org = ((e.get('organizer') or {}).get('email') or '').lower() if isinstance(e.get('organizer'), dict) else ''
        if not tok or len(tok) < 2: errs.append(f'{eid}: htmlLink eid not decodable')
        else:
            if tok[0] != eid: errs.append(f'{eid}: eid id {tok[0]} differs')
            if tok[1].lower() not in {org, CALENDAR_ACCOUNT.lower()}: errs.append(f'{eid}: eid calendar {tok[1]} matches neither organizer nor {CALENDAR_ACCOUNT}')
        s, en = _when(e.get('start')), _when(e.get('end'))
        if not s or not en: errs.append(f'{eid}: start/end missing or invalid'); continue
        if s[0] != en[0]: errs.append(f'{eid}: start and end of different kinds'); continue
        if not en[1] > s[1]: errs.append(f'{eid}: end is not after start')
        m = INSTANCE_SUFFIX.search(eid)
        if m:
            want = s[1].astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') if s[0] == 'dateTime' else s[1].strftime('%Y%m%d')
            if m.group(1) != want: errs.append(f'{eid}: instance suffix {m.group(1)} vs start {want}')
    return errs

def key_presence(recs):
    if not recs: return []
    return [k for k in KEYS if not any(r.get(k) for r in recs)]

def normalize(r, today_iso, now):
    if r.get('status') != 'confirmed': return 'out', None
    title = r.get('summary') or ''
    if TEST_DATA.search(title): return 'test', None
    start, end = r.get('start') or {}, r.get('end') or {}
    if isinstance(start, str):
        k = 'date' if r.get('isAllDay') or len(start) == 10 else 'dateTime'; start, end = {k: start}, {k: end}
    if 'date' in start and 'dateTime' not in start:          # all-day; Google's end.date is exclusive
        if (end.get('date') or '') <= today_iso: return 'out', None
        sa = ea = None; due = start['date']; allday = True
    else:
        a = datetime.datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
        b = datetime.datetime.fromisoformat(end['dateTime'].replace('Z', '+00:00'))
        if b < now: return 'out', None
        sa, ea, due, allday = iso(a), iso(b), a.astimezone(TZ).date().isoformat(), False
    return 'in', {
        'normalized_task_id': 'gcal:' + r['id'], 'source': 'Google Calendar', 'source_record_id': r['id'], 'source_table': None,
        'source_url': r.get('htmlLink'), 'title': title, 'description': clean(r.get('description')), 'owner': email(r.get('organizer')),
        'due_date': due, 'status_raw': r.get('status'), 'domain_tag': 'Ops', 'last_updated_at': r.get('updated'),
        'starts_at': sa, 'ends_at': ea, 'all_day': allday}
