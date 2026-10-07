# Loom System Prompt — Changelog

Agent: Loom (Hyperagent, `cmu1q1bq7009p07adrlnq0ff6`) · Story: MapKMigGon38532 · Maintainer: Andrés Serrón (Singular)

Every version is a full replacement of the system prompt, pasted as plain text and checked by exporting the agent. Each entry lists the problem seen in a real run that triggered it.

---

## v3.9 — 2026-10-07

**Why:** the Command Center's Right Now tile could not show today's events. `due_date` is date-only, so the dashboard had no start or end time, read the date as midnight UTC (the previous day in the Americas), and could not hide events that had already ended.

### Added
- Calendar timing fields on `command_center_tasks`, written only for Google Calendar rows:
  - `starts_at` (`fldrlnSKq9mvoDRLu`) and `ends_at` (`fldIIcqQnllCLko5c`): exact start and end, ISO 8601 in UTC; empty for all-day events.
  - `all_day` (`fldPHaq4WRruW6SbL`): true for all-day events.
- Calendar mapping made explicit: `owner` = organizer email, `source_url` = htmlLink, `status_raw` = event status. Recurring events are one task per instance.

### Changed
- Calendar `due_date` = start date in America/Montevideo for timed events; `start.date` for all-day events.
- "Not ended" is now defined per event type: timed events by `ends_at`; all-day events by Google's exclusive `end.date`.
- Every calendar upsert writes `starts_at`, `ends_at`, `all_day` and `due_date`, so rescheduled events are corrected on the next run.
- Report first line ends with " · prompt v3.9", so Slack and `loom_sync_runs.report` show which prompt version produced each run.

**Requires:** the three new fields in Airtable (created 2026-10-07) and the CEO Command Center extension v3.1, which reads them.

---

## v3.8 — 2026-10-06

**Why:** syncs only ran when someone triggered them from Slack.

### Added
- Section 7a "Scheduled daily run": behavior for runs started by the Hyperagent schedule.
  - Mode is always `sync`; a schedule never runs `rebuild`.
  - No acknowledgement. The report is posted once as a new message in `#ingestion` (`C0BRF6AHDJQ`), prefixed "Daily sync · ".
  - If the lock is busy, the run logs `rejected_busy` and posts nothing.
  - No questions, no waiting for input.
- `loom_sync_runs.trigger` = `schedule` for scheduled runs.

### Changed
- Workflow step 1: the invocation check and the acknowledgement apply to Slack runs only.
- Workflow step 10: the report goes to the thread (Slack run) or to a new `#ingestion` message (scheduled run).
- Lock step 3: the "already running" reply is sent on Slack runs only.

**Requires:** the "Daily Command Center sync" schedule in Hyperagent (weekdays 07:47, America/Chicago).

---

## v3.7 — 2026-10-06

**Why:** nothing stopped two syncs from running at once; the report sometimes skipped the Verify line; the story's record-level log was missing.

### Added
- Section 7b "Run lock and run log", backed by the new Airtable table `loom_sync_runs` (`tblLnaOIEzNbIWp9S`).
  - Acquire: mark `running` rows older than 35 min as `abandoned`. If another run is `running`, log `rejected_busy`, reply "A sync is already running…" and stop. Otherwise create own `running` row, re-read, and back off if an earlier run started seconds before.
  - Release: always update the run row with status, totals, `source_counts`, `failed_ids`, `fallback_ids` and the report verbatim.
- Invocation check in section 7:
  - another channel → "Syncs run from #ingestion.";
  - `#ingestion` without a command → "I only run syncs…".
  - Neither case reads or writes anything.
- Created vs updated counts: in scope and not in the index = created, otherwise updated. Skipped = test data + excluded.
- "no open items" note for a source with zero in scope.

### Changed
- Report template is now fixed and every line is mandatory, including `• Verify: N rows read (= totalRecordCount N) · open N · duplicates N · empty lifecycle N`. The first line carries the run id.
- Source lines report `created / updated` instead of `written`.
- Guardrails: write targets are `command_center_tasks` (upsert only) and `loom_sync_runs` (own row only); never start while the lock is held.
- Preflight: Attio reads `tasks` only (removed the old "deals/tasks" wording); Airtable also writes `loom_sync_runs`.
- Mission: write targets updated to include the run log.

---

## v3.6 — 2026-10-06

**Why:** `schedulable` was true on 67 of 68 open tasks, so it carried no signal; closed rows kept stale AI values from older runs.

### Changed
- `schedulable` rule rewritten as the story's "scheduling metadata": can the task be placed as a work block on the Command Center calendar?
  - True only for concrete work the team can do now, in one or a few sittings.
  - False for approvals, anything waiting on others (incl. Linear "In Review" / "Blocked"), booked meetings, vague goals and reminders.
  - Self-check if more than ~80% of a run comes out true.
- Closing a row (workflow step 6) now also clears `category`, `tags` and `schedulable`. A task that comes back is re-enriched because its category is empty.

**Result after rebuild:** schedulable on 28 of 68 open tasks.

---

## v3.5 — 2026-10-06

**Why:** Linear descriptions were cut at ~500 characters and carried the tool hint "(truncated, use `get_issue`…)"; a "Test — …" record slipped through because the rule only matched uppercase "TEST"; tags from earlier runs piled up.

### Added
- Section 5c "Full Linear descriptions": fetch `linear__get_issue` for new or changed in-scope issues whose listed description is cut off. Never for excluded issues.
- Section 6b "Rebuild mode" (`@Loom rebuild`): re-enrich every in-scope task ignoring stored values (cap 150), fetch full Linear descriptions, leave closed rows alone, report "(rebuild)".

### Changed
- Description clean-up: strip tool-appended text and trailing whitespace before writing.
- Test-data rule is now case-insensitive, with an explicit regex: `^\s*(\[test\]|test(\s*\d+)?\s*[-—–:])|dummy|\(demo\)`. Normal uses of "test" in a title still pass.
- Enrichment always writes all three fields, including `tags` as an empty list, so old tags are replaced instead of accumulating.

---

## v3.4 — 2026-10-06

**Why:** with the variable model, Loom started Task subagents ("Quill", "Tally"). Quill's raw COUNTS / IN_SCOPE_JSON block reached the Slack thread instead of Loom's report, and Tally's verification was counted by hand.

### Added
- Rule: no subagents. Loom does the whole run itself with Bash scripts and never uses the Task tool.
- Rule: the last message of the run is the report. Nothing after it, no tool call, no note about Slack permissions.
- Rule: if a direct Slack post fails, do not retry and do not mention it.
- Guardrail: never print raw data (JSON, id lists) as a message.

---

## v3.3 — 2026-10-06

**Why:** about 740 of 881 Linear issues were in "Ready for QA" (finished work waiting for QA). They buried the real open work and pushed runs past the time budget. Max's decision: exclude them.

### Added
- Section 5b "Linear scope decision — Ready for QA is excluded":
  - match on the status name, case-insensitive;
  - excluded issues are never written or enriched, and existing rows for them are closed as `not_returned`;
  - an issue that leaves Ready for QA is back in scope.
- Linear report line shows "excluded (Ready for QA) N".

---

## v3.2 — 2026-10-06

**Why:** the 10:01 and 12:01 runs were killed by the 30-minute platform limit and by the context limit, with nothing reported.

### Changed
- Body rewritten into numbered sections.

### Added
- **Run budget:** target 20 minutes; past that, start no new source, finish the batch in flight and report "⚠️ Partial success". Write as you go, source by source.
- **Context hygiene:** large tool results are processed only with Python from `/large_tool_results`. Scripts print counts and short samples only. Never infer rules from rows already in the table.
- **Parsing helper** `load_result()` for MCP result files.
- **Paging contract** with exact parameters:
  - index: `pageSize` 1000 + `nextCursor`, checked against `totalRecordCount`;
  - Attio: `limit` 10 + `offset` until `has_more` is false;
  - Linear: `limit` 250 + `cursor`, fixed field list, state filtered in script;
  - Calendar: 14-day window.
- **Writes:** 50-record upsert batches via `paramsFile`.
- **Enrichment cap:** 60 tasks per run (priority Attio → Airtable → Calendar → Linear), with the rest reported as backlog. Every tag must be justified by the task's own text.
- **Source order:** Airtable → Attio → Calendar → Linear, each completed (fetch, write, close) before the next.

---

## v3.1 — 2026-10-06

**Why:** the first v3 run created 188 duplicate row pairs (it used `create_records` instead of upsert), read Attio deals instead of tasks, and wrote composed text into `status_raw`.

### Changed
- Writes only through `airtable__update_records_for_table` with `performUpsert` on `normalized_task_id`; never create or delete in `command_center_tasks`.
- Attio: tasks only via `attio__list-tasks`, never deals. If it fails, the source is unavailable; never fall back to deals.
- `status_raw` = the source's status verbatim.
- Linear closed state spelled "canceled" (one L).

### Added
- Test data (TEST / Dummy / (Demo)) is never written.
- No progress narration in Slack.
- Verify step: re-read the index and count before reporting. Report counts come from the verify step.

---

## v3 — 2026-10-06

**Why:** v2 covered aggregation and the Slack trigger only. Closing, AI enrichment and the description field from the story's acceptance criteria were never designed.

### Added
- `lifecycle` (open / closed / not_returned) and closing per source: rows no longer returned as open are marked `not_returned`, never deleted.
- AI enrichment step between normalizing and writing:
  - `category` from a fixed list;
  - `tags` (0–3) from 10 fixed tags;
  - `schedulable`;
  - fallback "Uncategorized".
- `description` from the source (max 2,000 characters, never generated).
- `source_status` / `sync_error` handling for unavailable sources; one failing source never blocks the others.
- Report with "✅ Success / ⚠️ Partial success / ❌ Failure" and per-source counts.

**Requires:** new Airtable fields description, lifecycle, category, tags, schedulable, created_at on `command_center_tasks`.

---

## v2 — 2026-09-17 (Carlos Olivares)

- Added a Slack trigger: "@Loom sync now" in `#ingestion` runs the same workflow as a scheduled invocation.
- Story 38532 was closed as redundant with CC1 (MapKMigGon38568) on this basis, without checking its acceptance criteria.