"""Tool-result plumbing: parse saved results, save pages, count-check, build next-page params."""
import json, re, shutil, pathlib
from config import W, F, BASE, TABLES, dump, load, elapsed_min

LINEAR_FIELDS = ["id", "title", "description", "url", "dueDate", "updatedAt", "status", "statusType", "assignee"]

def load_result(path):
    """Saved tool result -> dict. Handles the MCP wrapper (content[0].text / structuredContent) or plain JSON.
    Non-JSON payloads (Attio's text format) come back as {'_text': ...}."""
    raw = open(path).read()
    s = raw.strip()
    if not s.startswith('{'):
        # Plain text (e.g. Attio's tasks[N] format pasted as returned, wrapper or not)
        m = re.search(r'<mcp-tool-result[^>]*>(.*)</mcp-tool-result>', raw, re.S)
        body = m.group(1) if m else raw
        try: return json.loads(body)
        except Exception: return {'_text': body}
    try: d = json.loads(s)
    except Exception: return {'_text': raw}
    if isinstance(d, dict) and ('content' in d or 'structuredContent' in d):
        t = d['content'][0]['text'] if d.get('content') else d.get('structuredContent', '')
        if isinstance(t, dict): return t
        m = re.search(r'<mcp-tool-result[^>]*>(.*)</mcp-tool-result>', t, re.S)
        body = m.group(1) if m else t
        try: return json.loads(body)
        except Exception: return {'_text': body}
    return d

def val(x): return x.get('name') if isinstance(x, dict) else x
def cells(rec, table):
    """Airtable record -> {field_name: value} using schema field IDs (select values by name)."""
    return {k: val(rec.get('cellValuesByFieldId', {}).get(v)) for k, v in F[table].items()}

def parse_attio_text(payload):
    rows = []
    for b in re.split(r'\n\s*-\s*task_id:\s*', payload)[1:]:
        r = {'id': b.split('\n')[0].strip().strip('"')}
        for key in ['content', 'deadline_at', 'is_completed', 'created_at', 'web_url', 'url']:
            m = re.search(r'^\s+' + key + r':\s*(.*)$', b, re.M)
            if m:
                v = m.group(1).strip()
                if v.startswith('"') or v in ('false', 'true', 'null'):
                    try: v = json.loads(v)
                    except Exception: pass
                r[key] = v
        rows.append(r)
    return rows

def is_airtable(src): return src in ('index', 'verify', 'lock') or src.startswith('airtable_')

def page_records(src, path):
    """(records, info) for one saved page. info: next-page hint + the count the source itself reports."""
    d = load_result(path)
    if is_airtable(src):
        recs = d.get('records', [])
        return recs, {'next': d.get('nextCursor'), 'total': (d.get('metadata') or {}).get('totalRecordCount'), 'expect': len(recs)}
    if src == 'linear':
        recs = d.get('issues', [])
        return recs, {'next': d.get('cursor') if d.get('hasNextPage') else None, 'expect': len(recs)}
    if src == 'gcal':
        ev = d.get('events', d.get('items', []))
        exp = d.get('count')
        if exp is None and d.get('perCalendar'): exp = sum(len(c.get('events', [])) for c in d['perCalendar'])
        return ev, {'next': d.get('nextPageToken'), 'expect': exp, 'reported': exp}
    if src == 'attio':
        if '_text' in d:
            m = re.search(r'tasks\[(\d+)\]', d['_text'])
            return parse_attio_text(d['_text']), {'more': bool(re.search(r'has_more:\s*true', d['_text'])), 'expect': int(m.group(1)) if m else None}
        rows = d.get('tasks', d.get('data', []))
        return rows, {'more': bool(d.get('has_more')), 'expect': len(rows)}
    raise SystemExit(f'unknown source {src}')

def pages(src):
    return sorted(W.glob(f'{src}_page_*.json'), key=lambda p: int(re.search(r'_page_(\d+)', p.name).group(1)))

def all_records(src): return [x for p in pages(src) for x in page_records(src, p)[0]]

def cmd_save(src, path, expect=None):
    """Copy a result to <src>_page_<n>.json, count-check, write the next-page params file."""
    n = len(pages(src)) + 1
    dst = W / f'{src}_page_{n}.json'
    if pathlib.Path(path).resolve() != dst.resolve(): shutil.copyfile(path, dst)
    recs, info = page_records(src, dst)
    exp = int(expect) if expect is not None else info.get('expect')
    if src != 'gcal' and exp is not None and exp != len(recs):   # gcal count is checked by integrity_errors
        dst.unlink()
        print(f'COUNT MISMATCH {src} page {n}: parsed {len(recs)} vs reported {exp}. Refetch once; if it repeats: unavailable <source> "count check failed"')
        raise SystemExit(3)
    if src == 'gcal':
        import src_gcal
        errs = src_gcal.integrity_errors(recs, info.get('reported'))
        if errs:
            dst.unlink()
            print(f'INTEGRITY FAIL gcal page {n} ({len(errs)}): ' + ' | '.join(errs[:5])
                  + '. Refetch and save the result again, copying values literally; if it fails again: unavailable gcal "integrity check failed"')
            raise SystemExit(5)
    nxt = None
    if is_airtable(src):
        if info['next']:
            base = load('index_params.json' if src in ('index', 'verify') else f'{src}_params.json')
            base['cursor'] = info['next']; nxt = dump(f'{src}_next.json', base)
        else:
            total = len(all_records(src))
            if info['total'] is not None and total != info['total']:
                print(f'COUNT MISMATCH {src}: {total} rows vs totalRecordCount {info["total"]}'); raise SystemExit(3)
    elif src == 'linear' and info['next']:
        nxt = dump('linear_next.json', {'limit': 250, 'fields': LINEAR_FIELDS, 'cursor': info['next']})
    elif src == 'attio' and info['more']:
        p = load('attio_params.json'); p['offset'] = p['limit'] * n; nxt = dump('attio_next.json', p)
    elif src == 'gcal' and info['next']:
        p = load('gcal_params.json'); p['pageToken'] = info['next']; nxt = dump('gcal_next.json', p)
    if src in ('index', 'verify') and not nxt:
        dump(f'{src}.json', [cells(r, 'command_center_tasks') for r in all_records(src)])
    print(f'{src} page {n}: {len(recs)} records ok.', f'NEXT PAGE paramsFile {nxt}' if nxt else 'ALL PAGES DONE', f'| elapsed {elapsed_min()} min')

def cmd_save_issue(path):
    """Store the full description from a linear__get_issue result."""
    d = load_result(path); iss = d.get('issue', d) if isinstance(d, dict) else {}
    key = iss.get('identifier') or iss.get('id'); desc = iss.get('description')
    full = load('linear_full.json', {}); full[key] = desc; dump('linear_full.json', full)
    print(f'full description stored for {key} ({len(desc or "")} chars)')

def cmd_attio_limit(n):
    """Fallback when attio__list-tasks rejects limit 50: switch page size and restart paging."""
    p = load('attio_params.json'); p['limit'] = int(n); p['offset'] = 0; dump('attio_params.json', p)
    for f in pages('attio'): f.unlink()
    print(f'attio limit {n}; restart with paramsFile attio_params.json')
