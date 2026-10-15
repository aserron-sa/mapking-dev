"""Airtable SOURCE tables (read-only): scope rules + normalization. Writing to the destination is tasks_store.py."""
from config import BASE, TABLES, F, KEY_FIELDS, TEST_DATA
from results import cells
from text_utils import clean, email

DOMAIN = {'approvals': 'Ops', 'follow_ups': 'Sales', 'ticket_candidates': 'QA', 'dev_tickets': 'QA', 'invoices': 'Revenue'}
TITLE = {'approvals': 'name', 'follow_ups': 'name', 'ticket_candidates': 'finding_title', 'dev_tickets': 'title', 'invoices': 'name'}
DESC = {'approvals': 'context_notes', 'follow_ups': 'draft_content_ai', 'ticket_candidates': 'finding_summary', 'dev_tickets': 'description', 'invoices': 'invoice_notes'}
STATUS = {'approvals': 'approval_status', 'follow_ups': 'approval_status', 'ticket_candidates': 'review_status', 'dev_tickets': 'status', 'invoices': 'approval_status'}
OWNER = {'approvals': 'approved_by', 'follow_ups': 'approved_by', 'ticket_candidates': 'reviewed_by', 'invoices': 'approved_by'}  # dev_tickets: none

def in_scope(t, d, today):
    st = (d.get(STATUS[t]) or '').casefold().strip()
    return {'approvals': st == 'pending',
            'follow_ups': (d.get('days_since_last_contact') or 0) >= 3 and st in ('', 'draft'),
            'ticket_candidates': st == 'pending',
            'dev_tickets': st in ('new', 'needs max input'),
            'invoices': bool(d.get('due_date')) and str(d['due_date'])[:10] < today and st != 'paid'}[t]

def key_presence(t, recs):
    """Key fields (schema `key: True`) that are empty in EVERY record -> anomaly list."""
    if not recs: return []
    return [f for f in KEY_FIELDS[t] if not any(cells(r, t).get(f) not in (None, '', []) for r in recs)]

def normalize(t, rec, today):
    """-> ('test'|'out'|'in', normalized dict or None)"""
    d = cells(rec, t)
    title = d.get(TITLE[t]) or ''
    if TEST_DATA.search(title): return 'test', None
    if not in_scope(t, d, today): return 'out', None
    status = d.get(STATUS[t]) or None
    owner_f = OWNER.get(t)
    lu = d.get('last_modified') or d.get('created') or d.get('created_at') or (rec.get('createdTime') if t == 'dev_tickets' else None)
    return 'in', {
        'normalized_task_id': f'airtable:{t}:{rec["id"]}', 'source': 'Airtable', 'source_record_id': rec['id'], 'source_table': t,
        'source_url': f'https://airtable.com/{BASE}/{TABLES[t]}/{rec["id"]}', 'title': title, 'description': clean(d.get(DESC[t])),
        'owner': email(rec.get('cellValuesByFieldId', {}).get(F[t][owner_f])) if owner_f else None,
        'due_date': str(d['due_date'])[:10] if t == 'invoices' and d.get('due_date') else None,
        'status_raw': status, 'domain_tag': DOMAIN[t], 'last_updated_at': lu}
