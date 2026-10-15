"""Text helpers shared by the source modules."""
import re, html

def clean(x):
    """Source text -> plain text, tool hints and markup removed, max 2,000 chars, None if empty."""
    if not x: return None
    x = re.sub(r'\s*[.…]*\s*\(truncated[^)]*\)\s*$', '', x, flags=re.I)
    x = re.sub(r'<linear-image>.*?</linear-image>', '', x, flags=re.S)
    x = re.sub(r'<[^>]+>', '', x)
    return html.unescape(x).rstrip()[:2000] or None

def is_cut(x): return bool(x) and ('truncated' in x.lower() or x.rstrip().endswith('…'))

def email(x):
    """Collaborator / assignee / organizer -> email string (comma-joined for lists)."""
    if isinstance(x, dict): return x.get('email')
    if isinstance(x, list): return ', '.join(filter(None, (email(y) for y in x))) or None
    return x if isinstance(x, str) and '@' in x else None
