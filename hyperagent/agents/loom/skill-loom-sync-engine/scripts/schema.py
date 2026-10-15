"""Airtable schema used by Loom — DATA ONLY (no logic).

Snapshot of base appcdpGNTo0DouoqJ taken 2026-10-15 with airtable__get_table_schema.
Every field Loom reads or writes is listed here; no other module hard-codes an ID.

Per field: id, Airtable type, and (for selects) the options Loom's rules depend on.
`key: True` marks fields that must be filled in at least one record when a source table
returns rows; if they come back empty in every record, the engine treats it as a schema
anomaly (likely deleted or re-created field) and withholds closes for that table.

To change: run `loom.py schema-refresh <get_table_schema result>`. It writes
schema_proposed.py plus a diff. A human reviews it and copies it over this file, never automatically.
"""

SCHEMA = {
    'base': 'appcdpGNTo0DouoqJ',
    'tables': {
        # ---------------- destination ----------------
        'command_center_tasks': {
            'id': 'tblX61yfIFroyhMTj', 'role': 'destination',
            'fields': {
                'normalized_task_id': {'id': 'fldmSHhnTbC1Go3Dw', 'type': 'singleLineText'},  # upsert merge key
                'source':             {'id': 'fldceaJIeHpA3Tdae', 'type': 'singleSelect', 'options': ['Attio', 'Linear', 'Airtable', 'Google Calendar', 'Manual']},
                'source_record_id':   {'id': 'fld23q8i9yP86zQMT', 'type': 'singleLineText'},
                'source_table':       {'id': 'fldzYRdrxSjCpSQsk', 'type': 'singleLineText'},
                'source_url':         {'id': 'fldqoka4e1FLKxJ6x', 'type': 'url'},
                'title':              {'id': 'fld4JRaVYnwttmi4P', 'type': 'singleLineText'},
                'description':        {'id': 'fldEh4HYNFW9tzRTK', 'type': 'multilineText'},   # source text, max 2,000 chars
                'owner':              {'id': 'fldECSTk2LFWGIS6V', 'type': 'singleLineText'},  # email
                'due_date':           {'id': 'fldld41zIqgdNXeyn', 'type': 'date'},
                'status_raw':         {'id': 'fldaxkMZkAAjQOWgQ', 'type': 'singleLineText'},  # source status verbatim
                'domain_tag':         {'id': 'fldejhIOeD3YCFRRP', 'type': 'singleSelect', 'options': ['Sales', 'Delivery', 'Product', 'QA', 'Revenue', 'Ops']},
                'lifecycle':          {'id': 'fldzqG2oVnK93COcW', 'type': 'singleSelect', 'options': ['open', 'closed', 'not_returned']},
                'last_updated_at':    {'id': 'fldG6wphuQyvtHSIy', 'type': 'dateTime'},
                'synced_at':          {'id': 'fldrha5LN1fKNSeuK', 'type': 'dateTime'},
                'source_status':      {'id': 'fldXpO4TchBQJVkhm', 'type': 'singleSelect', 'options': ['ok', 'stale', 'unavailable']},
                'sync_error':         {'id': 'fldi3MM9W3w9nIWXJ', 'type': 'multilineText'},
                'category':           {'id': 'fldTamXky2fjceS9C', 'type': 'singleSelect', 'options': ['Sales', 'Delivery', 'Product', 'QA', 'Revenue', 'Ops', 'Uncategorized']},
                'tags':               {'id': 'fldYqQehpEy918bve', 'type': 'multipleSelects', 'options': ['needs-max', 'waiting-on-external', 'client-facing', 'bug', 'approval', 'billing', 'meeting', 'follow-up', 'content', 'deadline-risk']},
                'schedulable':        {'id': 'fldfxuYNvITcMIlFu', 'type': 'checkbox'},
                'starts_at':          {'id': 'fldrlnSKq9mvoDRLu', 'type': 'dateTime'},  # Calendar rows only
                'ends_at':            {'id': 'fldIIcqQnllCLko5c', 'type': 'dateTime'},  # Calendar rows only
                'all_day':            {'id': 'fldPHaq4WRruW6SbL', 'type': 'checkbox'},  # Calendar rows only
            },
        },
        # ---------------- run log / lock ----------------
        'loom_sync_runs': {
            'id': 'tblLnaOIEzNbIWp9S', 'role': 'log',
            'fields': {
                'run_id':               {'id': 'fldHYSy1I12QKEueS', 'type': 'singleLineText'},
                'status':               {'id': 'fldYvWnWj7QkqY8yy', 'type': 'singleSelect', 'options': ['running', 'success', 'partial', 'failure', 'rejected_busy', 'abandoned']},
                'mode':                 {'id': 'fld8ss1ZPPtFAmBHo', 'type': 'singleSelect', 'options': ['sync', 'rebuild']},
                'trigger':              {'id': 'fldcr355Dd5DdYHHr', 'type': 'singleLineText'},
                'started_at':           {'id': 'fldzIMcCyDHB4Nf29', 'type': 'dateTime'},
                'finished_at':          {'id': 'fldIFihI2ZLrcqLDf', 'type': 'dateTime'},
                'created':              {'id': 'fldIBH3pllV0WXiUk', 'type': 'number'},
                'updated':              {'id': 'fldKtr8dPMGlZEbak', 'type': 'number'},
                'closed':               {'id': 'fldF0xbzp6xThJv0A', 'type': 'number'},
                'skipped':              {'id': 'fldiluTV6mm05svcf', 'type': 'number'},
                'failed':               {'id': 'fldPXlrFEJ5Il4NUD', 'type': 'number'},
                'enrichment_fallbacks': {'id': 'fldlHQ7LI2bm35M9O', 'type': 'number'},
                'source_counts':        {'id': 'fldkVPM5dadSfSoxz', 'type': 'multilineText'},
                'failed_ids':           {'id': 'fldfZd8Lw4nJZHj3B', 'type': 'multilineText'},
                'fallback_ids':         {'id': 'fld9n0yuam7Q4w8y1', 'type': 'multilineText'},
                'report':               {'id': 'fld5oRXfCOAa2FWJs', 'type': 'multilineText'},
            },
        },
        # ---------------- sources (read-only) ----------------
        'approvals': {
            'id': 'tblRilIMAIEiUSFof', 'role': 'source',
            'fields': {
                'name':            {'id': 'fldceR7w2wnrHwCh0', 'type': 'singleLineText', 'key': True},
                'context_notes':   {'id': 'flda6q15WVjLqkSYG', 'type': 'multilineText'},
                'approved_by':     {'id': 'fldy0QFQIhf1gNBzV', 'type': 'singleCollaborator'},
                'approval_status': {'id': 'fldKZsgbuyt6bdIxm', 'type': 'singleSelect', 'options': ['Pending'], 'key': True},  # in scope: Pending
                'created':         {'id': 'fldpnLJuLjCL0eZib', 'type': 'createdTime'},
                'last_modified':   {'id': 'fld0xNzIOc6pusopD', 'type': 'lastModifiedTime'},
                # approval_date exists in the table but is a decision date, never a due date: not read.
            },
        },
        'follow_ups': {
            'id': 'tblX0mTj3SFLGOgRs', 'role': 'source',
            'fields': {
                'name':                    {'id': 'fldAPL7HDqbA0V3dW', 'type': 'singleLineText', 'key': True},
                'draft_content_ai':        {'id': 'fldycZw1KgQ8mQyFu', 'type': 'multilineText'},
                'approved_by':             {'id': 'fld3d2xTEqPRr78UH', 'type': 'singleCollaborator'},
                'approval_status':         {'id': 'fldhhrBy1CdObOmWE', 'type': 'singleSelect', 'options': ['Draft']},  # in scope: empty or Draft (empty is legit, so not key)
                'days_since_last_contact': {'id': 'fldo1It1chToe22Ue', 'type': 'formula', 'key': True},  # in scope: >= 3
                'created':                 {'id': 'fldKprOChhII8wcXV', 'type': 'createdTime'},
                'last_modified':           {'id': 'fldHZ6qym08JmeVd0', 'type': 'lastModifiedTime'},
            },
        },
        'ticket_candidates': {
            'id': 'tbl5TcDUfxG9JRoIo', 'role': 'source',
            'fields': {
                'finding_title':   {'id': 'fldlyPZjh0ybMnLqo', 'type': 'singleLineText', 'key': True},
                'finding_summary': {'id': 'fldpCRwz6HnJWoEIL', 'type': 'multilineText'},
                'reviewed_by':     {'id': 'fldNkFRUq2cK4wCpT', 'type': 'singleCollaborator'},
                'review_status':   {'id': 'fldN3DbBjMSSbxNTT', 'type': 'singleSelect', 'options': ['pending'], 'key': True},  # in scope: pending
                'created_at':      {'id': 'fldpJorjNV1cbyPkT', 'type': 'createdTime'},  # no last-modified field in this table
            },
        },
        'dev_tickets': {
            'id': 'tblSWc1WrL5qjzTzs', 'role': 'source',
            'fields': {
                'title':       {'id': 'fldM15PrTz3K7bbtO', 'type': 'singleLineText', 'key': True},
                'description': {'id': 'fldtBrcPGXEFEvA0X', 'type': 'multilineText'},
                'status':      {'id': 'fldtjwsLVIC4W02mC', 'type': 'singleSelect', 'options': ['New', 'Needs Max Input'], 'key': True},  # in scope: these two
                # no timestamp field: last_updated_at = the record's createdTime from the API
            },
        },
        'invoices': {
            'id': 'tblcQ0tJXn7eB9kjw', 'role': 'source',
            'fields': {
                'name':            {'id': 'fldJdq1kQLIC8xDd3', 'type': 'singleLineText', 'key': True},
                'invoice_notes':   {'id': 'fldxejSq3oDOLSHoe', 'type': 'multilineText'},
                'approved_by':     {'id': 'fldHxrRdQdsRXjn48', 'type': 'singleCollaborator'},
                'approval_status': {'id': 'fldk0ls0YiwEYKVIG', 'type': 'singleSelect', 'options': ['Paid'], 'key': True},  # in scope: not Paid
                'due_date':        {'id': 'fldxPhAPXH9RNJ8Tr', 'type': 'date', 'key': True},  # in scope: before today
                'created':         {'id': 'fldmDZ70VddvaX9Ae', 'type': 'createdTime'},
                'last_modified':   {'id': 'fldovDhNmeL4b7aMO', 'type': 'lastModifiedTime'},
            },
        },
    },
}
