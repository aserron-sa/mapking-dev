"""Attio (Sales): open TASKS only — never deals, companies or people."""
from config import TEST_DATA
from text_utils import clean, email

KEYS = ['content']   # anomaly if every task comes back without content

def key_presence(recs):
    if not recs: return []
    return [k for k in KEYS if not any(r.get(k) or r.get('content_plaintext') for r in recs)]

def normalize(r, today=None):
    if r.get('is_completed') not in (False, 'false'): return 'out', None
    title = r.get('content_plaintext') or r.get('content') or ''
    if TEST_DATA.search(title): return 'test', None
    rid = r.get('id'); rid = rid.get('task_id') if isinstance(rid, dict) else rid
    return 'in', {
        'normalized_task_id': 'attio:' + rid, 'source': 'Attio', 'source_record_id': rid, 'source_table': None,
        'source_url': r.get('web_url') or r.get('url') or None, 'title': title, 'description': clean(r.get('description') or title),
        'owner': email(r.get('assignees')), 'due_date': str(r.get('deadline_at') or '')[:10] or None,
        'status_raw': r.get('status') or None, 'domain_tag': 'Sales',
        'last_updated_at': r.get('created_at')}  # the list action exposes no modified timestamp
