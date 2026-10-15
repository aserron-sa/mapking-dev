"""Linear (Product): open issues except status "Ready for QA" (Map King decision, Oct 2026)."""
from config import TEST_DATA
from text_utils import clean, email, is_cut

OPEN_TYPES = ('triage', 'backlog', 'unstarted', 'started')
EXCLUDED_STATUS = 'ready for qa'   # matched by status NAME (its statusType is "started")
KEYS = ['title', 'statusType']

def key_presence(recs):
    if not recs: return []
    return [k for k in KEYS if not any(r.get(k) for r in recs)]

def normalize(r, today=None):
    """-> ('qa'|'out'|'test'|'in', dict). '_cut' marks a listed description cut at ~500 chars."""
    if (r.get('status') or '').strip().casefold() == EXCLUDED_STATUS: return 'qa', None
    if r.get('statusType') not in OPEN_TYPES: return 'out', None
    title = r.get('title') or ''
    if TEST_DATA.search(title): return 'test', None
    return 'in', {
        'normalized_task_id': 'linear:' + r['id'], 'source': 'Linear', 'source_record_id': r['id'], 'source_table': None,
        'source_url': r.get('url'), 'title': title, 'description': clean(r.get('description')), 'owner': email(r.get('assignee')),
        'due_date': r.get('dueDate'), 'status_raw': r.get('status'), 'domain_tag': 'Product', 'last_updated_at': r.get('updatedAt'),
        '_cut': is_cut(r.get('description'))}
