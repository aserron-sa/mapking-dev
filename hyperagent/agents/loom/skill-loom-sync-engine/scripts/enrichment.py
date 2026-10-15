"""Enrichment bookkeeping: which tasks need it (with the cap), validation, applying decisions.
The decisions themselves (category / tags / schedulable) are made by the agent into enrichments.json."""
from config import CATEGORIES, TAGS, ENRICH_CAP, run, save_run, load

TODO_FIELDS = ('normalized_task_id', 'title', 'description', 'status_raw', 'domain_tag')

def needs_enrichment(n, idx, rebuild):
    i = idx.get(n['normalized_task_id'])
    return rebuild or i is None or i.get('last_updated_at') != n.get('last_updated_at') or not i.get('category')

def take(candidates):
    """Spend the run's cap in processing order. Returns (todo, backlog_count)."""
    r = run(); cap = r.get('enrich_cap', ENRICH_CAP.get(r.get('mode', 'sync'), 60))
    room = max(0, cap - r.get('enrich_spent', 0)); todo = candidates[:room]
    r['enrich_spent'] = r.get('enrich_spent', 0) + len(todo); save_run(r)
    return todo, len(candidates) - len(todo)

def valid(e):
    if not isinstance(e, dict): return False
    tags = e.get('tags') if e.get('tags') is not None else []
    return (e.get('category') in CATEGORIES and isinstance(tags, list) and len(tags) <= 3
            and all(t in TAGS for t in tags) and isinstance(e.get('schedulable'), bool))

def apply(n, decisions):
    """Writes all three fields. Returns True if the agent's decision was used, False if the fallback was."""
    e = decisions.get(n['normalized_task_id'])
    if valid(e):
        n.update(category=e['category'], tags=list(e.get('tags') or []), schedulable=e['schedulable']); return True
    n.update(category='Uncategorized', tags=[], schedulable=False); return False

def decisions(): return load('enrichments.json', {})
