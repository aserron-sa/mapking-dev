#!/usr/bin/env python3
"""Loom sync engine — the ONLY entry point the agent calls: `python3 loom.py <command> [args]`.

Modules (one responsibility each):
  schema.py        Airtable schema as data (IDs, types, options, key fields)
  config.py        constants + maps derived from schema (validated on import), run state, helpers
  results.py       parse/save tool results, count checks, paging params
  text_utils.py    clean text, emails, cut-description detection
  src_airtable.py  scope + normalization for the 5 Airtable source tables
  src_attio.py     scope + normalization for Attio tasks
  src_gcal.py      window + scope + normalization for Google Calendar
  src_linear.py    scope (Ready for QA excluded) + normalization for Linear
  enrichment.py    enrichment cap, validation, applying the agent's decisions
  tasks_store.py   command_center_tasks: index, upsert/close/unavailable batches, single-record retry
  lock.py          run lock + run log on loom_sync_runs
  schema_tools.py  schema-check (on error / anomaly / rebuild) and schema-refresh proposals
  pipeline.py      per-source flow: init, prep, batch, complete, failed, unavailable
  report.py        verify + 7-line report + release + Slack params
  test_loom.py     offline tests with sample data — run after any change
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pipeline, results, lock, schema_tools, report, tasks_store
from config import elapsed_min

COMMANDS = {
    'init': pipeline.cmd_init,                 # init <sync|rebuild> <trigger>
    'lock-check': lock.cmd_lock_check,         # lock-check <lock list result>
    'lock-created': lock.cmd_lock_created,     # lock-created <create result>
    'lock-confirm': lock.cmd_lock_confirm,     # lock-confirm <lock list result>
    'schema-check': schema_tools.cmd_schema_check,      # schema-check <get_table_schema result>
    'schema-refresh': schema_tools.cmd_schema_refresh,  # schema-refresh <get_table_schema result>
    'save': results.cmd_save,                  # save <source> <result path> [expected count]
    'save-issue': results.cmd_save_issue,      # save-issue <linear__get_issue result>
    'attio-limit': results.cmd_attio_limit,    # attio-limit <n>
    'prep': pipeline.cmd_prep,                 # prep <table|attio|gcal|linear>
    'batch': pipeline.cmd_batch,               # batch <source>
    'complete': pipeline.cmd_complete,         # complete <source> [yes|no]
    'failed': pipeline.cmd_failed,             # failed <source> <normalized_task_id> <error>
    'unavailable': pipeline.cmd_unavailable,   # unavailable <source> <error>
    'single': tasks_store.cmd_single,          # single <batch file>
    'report': report.cmd_report,               # report
    'elapsed': lambda: print(f'elapsed {elapsed_min()} min (budget 20)'),
}

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in COMMANDS:
        print(__doc__ + '\nCommands: ' + ', '.join(COMMANDS)); sys.exit(0 if not a else 1)
    COMMANDS[a[0]](*a[1:])
