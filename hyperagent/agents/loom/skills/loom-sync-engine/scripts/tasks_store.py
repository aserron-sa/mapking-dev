"""Destination command_center_tasks: index, upsert batches, close batches, unavailable marking, single-record retry.
Only upserts on normalized_task_id; never creates or deletes records directly."""
from config import BASE, TABLES, CCT, SOURCE_NAME, load, dump, now, iso

T = TABLES['command_center_tasks']

def index(): return {r['normalized_task_id']: r for r in load('index.json', []) if r.get('normalized_task_id')}

def index_params():
    from config import INDEX_FIELDS
    return {'baseId': BASE, 'tableId': T, 'pageSize': 1000, 'fieldIds': INDEX_FIELDS}

def upsert_params(records):
    return {'baseId': BASE, 'tableId': T,
            'records': [{'fields': {CCT[k]: v for k, v in r.items()}} for r in records],
            'performUpsert': {'fieldIdsToMergeOn': [CCT['normalized_task_id']]}}

def batches(prefix, records, size=50):
    return [dump(f'{prefix}_{i // size + 1}.json', upsert_params(records[i:i + size])) for i in range(0, len(records), size)]

def rows_of(t, idx):
    src = SOURCE_NAME[t]
    return [x for x in idx.values() if x.get('source') == src and (src != 'Airtable' or x.get('source_table') == t)]

def open_rows(t, idx): return [x for x in rows_of(t, idx) if x.get('lifecycle') in ('open', None, '')]

def close_records(rows):
    ts = iso(now())
    return [{'normalized_task_id': x['normalized_task_id'], 'lifecycle': 'not_returned', 'synced_at': ts,
             'category': None, 'tags': [], 'schedulable': False} for x in rows]

def unavailable_records(rows, err):
    ts = iso(now())
    return [{'normalized_task_id': x['normalized_task_id'], 'source_status': 'unavailable', 'sync_error': err[:200], 'synced_at': ts} for x in rows]

def cmd_single(batch_file):
    """Split a rejected batch into one-record files for one-by-one retry."""
    p = load(batch_file); names = []
    for i, rec in enumerate(p['records']):
        q = dict(p); q['records'] = [rec]; names.append(dump(f'{batch_file[:-5]}_r{i + 1}.json', q))
    print(f'{len(names)} single-record files: {names[0]} … {names[-1]}' if names else 'empty batch')
