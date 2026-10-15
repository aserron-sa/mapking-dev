# loom-sync-engine — runbook for a Loom sync (prompt v3.14)

`loom.py` is the only entry point. It does every mechanical step of a Loom run. You make the tool calls, decide enrichment, and deliver the report. Never reimplement anything, and never read or patch the engine's code during a run: if a command fails, follow the error handling below.

**Setup each run:** FetchSkillScripts("loom-sync-engine") (it fetches all modules into one folder) → `L` = `python3 <folder>/loom.py`. All run files go to `/agent/workspace`. Every printed line ends with the next step and the elapsed minutes.

## Modules (one responsibility each; for maintainers)
| File | Responsibility |
|---|---|
| schema.py | Airtable schema as data: table and field IDs, types, the select options the rules rely on, and `key` fields. No logic. |
| config.py | Constants (incl. CALENDAR_ACCOUNT) and maps derived from schema.py (validated on import), run state, helpers |
| results.py | Parse and save tool results (JSON, MCP-wrapped or plain text), count checks, Calendar integrity gate, next-page params |
| text_utils.py | Text cleaning, emails, cut-description detection |
| src_airtable.py / src_attio.py / src_linear.py | Scope rules and normalization for each source |
| src_gcal.py | Calendar window, identity and timing invariants, scope rules, normalization |
| enrichment.py | Enrichment cap, validation, applying decisions |
| tasks_store.py | command_center_tasks: index, upsert, close and unavailable batches, single-record retry |
| lock.py | Run lock and run log on loom_sync_runs |
| schema_tools.py | schema-check (on error, anomaly or rebuild) and schema-refresh proposals |
| pipeline.py | Per-source flow: init, prep, batch, complete, failed, unavailable |
| report.py | Verify, 7-line report, release and Slack params |
| test_loom.py | Offline tests (9 scenarios) — run `python3 test_loom.py` after ANY change; it must print PASS |

## Saving results
A large result saved under `/large_tool_results/…` → `L save <source> <that path>`. An inline result → Write it verbatim to `/agent/workspace/inline.json`, exactly as returned (JSON, MCP-wrapped or plain text such as Attio's `tasks[N]:` format — all are accepted) → `L save <source> /agent/workspace/inline.json`.
Sources for `save`: `index`, `verify`, `airtable_approvals`, `airtable_follow_ups`, `airtable_ticket_candidates`, `airtable_dev_tickets`, `airtable_invoices`, `attio`, `gcal`, `linear`.
`save` count-checks each page and prints `NEXT PAGE paramsFile <file>` or `ALL PAGES DONE`. `COUNT MISMATCH` (exit 3) → refetch once; if it repeats → `L unavailable <table|attio|gcal|linear> "count check failed"`.

### Google Calendar: compact copy + integrity gate
GoogleCalendarFindEvents has no field-selection parameter, so the full result arrives. When it comes back inline, write `{"count": N, "events": [ ... ]}` where:
- **N is the number of events the tool reported** — never computed from what you wrote.
- **Each event copies these keys literally from the result:** id, summary, description, status, start, end, updated, organizer, htmlLink.
- **Every value is written out per event.** Never generate events with functions, loops, templates, f-strings or shared constants — not even for recurring instances.

`L save gcal` then enforces the invariants (src_gcal.integrity_errors). If any fails, the page is not kept and it exits 5 with `INTEGRITY FAIL`:
1. `count` present and equal to the number of events saved.
2. The htmlLink `eid` decodes to `"<id> <email>"`: id equals the event id, and email equals the organizer email or CALENDAR_ACCOUNT (singular@mapking.ai).
3. A recurring-instance suffix in the id (`_YYYYMMDDTHHMMSSZ`, all-day `_YYYYMMDD`) equals the start in UTC (or the start date).
4. start and end are the same kind, and end > start.

`INTEGRITY FAIL` → refetch, save again with a literal copy. If it fails again → `L unavailable gcal "integrity check failed"`. Never write Calendar rows that failed the gate. Descriptions are not self-verifiable (cosmetic; capped at 2,000 chars).

## Sequence
| Step | Tool call (always `paramsFile`) | Engine command |
|---|---|---|
| 1 Init | — | `L init sync schedule` / `L init sync "slack:#ingestion <requester>"` / `L init rebuild "<trigger>"` |
| 2 Lock list | airtable__list_records_for_table `lock_list.json` (5 rows; rejected → `lock_list_nosort.json`) | `L lock-check <result>` → STALE: run `lock_abandon.json` (update). BUSY: create `lock_rejected.json`, stop. PROCEED ↓ |
| 3 Lock create | airtable__create_records_for_table `lock_create.json` | `L lock-created <result>` |
| 4 Lock confirm | list `lock_list.json` again | `L lock-confirm <result>` → BUSY: update `lock_selfreject.json`, stop. LOCK HELD ↓ |
| 4b Acknowledge (Slack runs only) | SlackBotSendMessage channel C0BRF6AHDJQ, thread_ts = triggering message ts, text "On it — syncing now." | — (the engine reminds you at init and at LOCK HELD) |
| 5 Schema (rebuild only) | airtable__get_table_schema `schema_params.json` | `L schema-check <result>` |
| 6 Index | list `index_params.json` (+ `index_next.json`) | `L save index <result>` per page |
| 7 Airtable × 5 | list `airtable_<t>_params.json` (+ `airtable_<t>_next.json`) | `L save airtable_<t> …` → `L prep <t>` → enrich → `L batch <t>` → writes → closes → `L complete <t>` |
| 8 Attio | attio__list-tasks `attio_params.json` (limit 10) (+ `attio_next.json`) | `L save attio …` → `L prep attio` → enrich → batch → writes → closes → `L complete attio` |
| 9 Calendar | GoogleCalendarFindEvents `gcal_params.json` (+ `gcal_next.json`) | `L save gcal …` (integrity gate) → `L prep gcal` → … → `L complete gcal` |
| 10 Linear | linear__list_issues `linear_params.json` (+ `linear_next.json`) | `L save linear …` → `L prep linear` → enrich → for each id in `linear_full_needed.json`: linear__get_issue {"id": "<key>"} → `L save-issue <result>` → `L batch linear` → writes → closes → `L complete linear` |
| 11 Verify | list `index_params.json` (+ `verify_next.json`) | `L save verify <result>` → `L report` |
| 12 Release | airtable__update_records_for_table `release_params.json` | — |
| 13 Deliver | scheduled: SlackBotSendMessage `slack_report_params.json` · Slack run: final reply = `report.txt` | — |

Writes: `L batch` prints `<src>_write_N.json` and `<src>_close_N.json` → airtable__update_records_for_table for each. Run all writes first, then the closes only if every write succeeded. Then `L complete <src>`, or `L complete <src> no` if any write failed.

## Schema validation — only when needed
No schema check at the start of a sync (the IDs come from schema.py). Validate with airtable__get_table_schema `schema_params.json` → `L schema-check <result>` only when:
1. **An Airtable call is rejected** for a field or value reason (unknown field, invalid select option, invalid value) — after one plain retry.
2. **`L prep` prints ANOMALY** for an Airtable table (its key fields came back empty in every record).
3. **It is a rebuild** (always, at step 5).

What schema-check does:
- **Core table changed** (command_center_tasks or loom_sync_runs): exits 2 with FAIL. Write nothing more, run `L report`, release (status failure), report "❌ Failure".
- **Source table changed:** marks it unavailable and prints the `<t>_unavail_N.json` batches to run.
- **Schema OK after an anomaly:** the anomaly is in the data; closes stay withheld for that table and the report says so.

## Anomaly guards (automatic)
- **Key fields empty:** `prep` flags a source whose key fields (schema `key: True`; for Linear title/statusType, Attio content, Calendar status/start) are empty in every returned record.
- **Mass close:** `batch` flags a source (not Calendar) that would close at least 5 rows and more than 50% of its open rows.
- **Effect of either guard:** close batches are NOT produced (`CLOSES WITHHELD`), upserts still run, and the report shows "⚠️ Partial success" with "<source>: closes withheld — <reason>". Never work around a guard.

## schema-refresh (maintenance, not part of a sync)
`L schema-refresh <get_table_schema result>` writes `schema_proposed.py` (types updated, missing fields and unused live fields noted) and prints the diff against schema.py. A human reviews it and copies it over schema.py, adds comments back, then runs `test_loom.py`. Never applied automatically.

## Enrichment
`L prep` prints `enrich K` and writes `<src>_enrich_todo.json` (normalized_task_id, title, description, status_raw, domain_tag), already capped (60 for a sync, 150 for a rebuild, spent in processing order). Decide each task using the prompt's enrichment rules, then merge into `enrichments.json` with one command:
`python3 -c 'import json,pathlib;p=pathlib.Path("/agent/workspace/enrichments.json");e=json.loads(p.read_text()) if p.exists() else {};e.update({...});p.write_text(json.dumps(e))'`
Value: `{"category": Sales|Delivery|Product|QA|Revenue|Ops, "tags": [≤3 from the allowed list], "schedulable": bool}`. A missing or invalid decision is written as Uncategorized / [] / false and counted as a fallback. Tasks outside the todo list keep their stored enrichment, because the fields are omitted.

## Failure handling
- **Engine command fails** (Python error, unexpected parse): run it once more; if it fails again, `L unavailable <src> "<short error>"` and continue. Do not read or patch the engine.
- **Calendar INTEGRITY FAIL** (exit 5): refetch and save again with a literal copy; if it fails again, `L unavailable gcal "integrity check failed"`.
- **Rejected write batch:** retry once → (field or value error: schema-check) → `L single <batch.json>` → run each `<batch>_rN.json` → for each record that still fails, `L failed <src> <normalized_task_id> "<error>"`.
- **Source error, timeout or unauthorized:** `L unavailable <src> "<error>"` → run the `<src>_unavail_N.json` batches it prints. These set source_status and sync_error only; lifecycle is unchanged and nothing is closed.
- **Budget:** `L elapsed` shows minutes spent. Over 20 before a source → skip to verify; skipped sources are reported as "skipped — budget".

## What the engine guarantees
- All IDs come from schema.py.
- Upserts on normalized_task_id only, at most 50 records per call; never creates or deletes `command_center_tasks` records.
- Calendar rows are written only after the identity and timing invariants pass.
- Calendar fields (starts_at, ends_at, all_day) are written only on Calendar rows.
- Linear descriptions are sent only for new or changed issues: full text when fetched, max 2,000 characters.
- Closed rows get lifecycle not_returned with category null, tags [] and schedulable false, and are never closed under an anomaly.
- The report uses the exact 7-line format, with "Daily sync · " on scheduled runs.
- The run row is filled with totals, failed_ids, fallback_ids and the verbatim report.

## Future rework (decided 2026-10-15, not implemented)
Replace inline copies with direct API reads from a credentialed skill script, so no result is ever retyped:
- **Google Calendar API:** request only the 9 fields via the `fields` parameter. Needs OAuth credentials; an API key is not enough.
- **Same idea for Airtable (personal access token), Attio and Linear (API keys):** the script fetches, count-checks, normalizes and upserts, and the agent keeps only lock, enrichment and report.
- **Trade-off:** extra credentials to store and maintain. An Airtable token cannot be limited to single tables, so the write guardrails would live in the script.
- **Expected effect:** removes about 50K characters of copied results per run, and the Calendar fidelity risk altogether.