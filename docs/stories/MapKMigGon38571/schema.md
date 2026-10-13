# MapKMigGon38571 — Airtable schema changes

Base: **Map King Hub** (`appcdpGNTo0DouoqJ`) · Status: **planned, not applied** (step 2 of the plan, needs Andrés's OK) · Owner: Andrés Serrón

All changes are additive. No field or table is renamed or deleted. Loom (v3.9) writes only its own fields and is not affected. `task_lanes` (shared with 38570) has no schema change. `command_center_tasks` gets only the inverse link field `triage`, created by Airtable when `command_center_triage.task` is added.

Field and table IDs are filled in after step 2 runs. Code (scripts and extension) always uses IDs, never names.

## Writers

| Writer | Table | Fields it writes |
|---|---|---|
| Loom (Hyperagent) | `command_center_tasks`, `loom_sync_runs` | Its own fields only (see `claude/spec-MapKMigGon38532.md`) |
| `triage-compute.js` (automation, hourly) | `command_center_triage` | Every field (creates and updates rows, marks closed and orphan rows; never deletes) |
| `triage-compute.js` | `priority_events` | `triage_compute`, `triage_data_issue` |
| Work · Queue (extension) | `task_lanes` | lane, overrides, `delegated_to`, `action_status` (existing fields) |
| Work · Queue | `priority_events` | `triage_action`, `triage_filter_invalid` |
| Andrés / Max (by hand) | `triage_config`, `team_members` | Everything (configuration) |

## New table `triage_config`

One active row. The script reads the first row with `active` = true; none or more than one → the run stops and logs `triage_data_issue`.

| Field | ID | Type | Default | Meaning |
|---|---|---|---|---|
| `name` | | single line text (primary) | `default` | Label |
| `active` | | checkbox | ✔ | The row the script uses |
| `timezone` | | single line text | `America/Chicago` | Time zone for "today" (due dates, day counts) |
| `stale_inactive_days` | | number (integer) | 7 | Days without source activity (`last_updated_at`) → stale |
| `stale_overdue_days` | | number (integer) | 2 | Days past `due_date` → stale |
| `stale_exclude_sources` | | multiple select (Attio, Linear, Airtable, Google Calendar, Manual) | Google Calendar | Sources never marked stale (calendar events are not work items) |
| `this_week_horizon_days` | | number (integer) | 7 | Due within N days (or overdue) → `this_week` |
| `icebox_inactive_days` | | number (integer) | 30 | No due date and N days without activity → `icebox` |
| `waiting_on_tags` | | multiple select (Loom tag list) | waiting-on-external | Tags that send a task to `waiting_on` |
| `delegate_exclude_tags` | | multiple select (Loom tag list) | needs-max | Tags that make a task not delegable |
| `delegate_require_schedulable` | | checkbox | ✔ | Only tasks with `schedulable` = true are delegable |
| `delegate_empty_owner_is_ceo` | | checkbox | ✔ | Treat tasks without owner as the CEO's (decision D4) |
| `invalid_rows_max_pct` | | number (integer) | 10 | Above this % of invalid open rows, the run writes nothing |
| `notes` | | long text | | What was decided, by whom, when |

The tag lists reuse Loom's fixed tag list: needs-max, waiting-on-external, client-facing, bug, approval, billing, meeting, follow-up, content, deadline-risk.

## New table `team_members`

| Field | ID | Type | Meaning |
|---|---|---|---|
| `name` | | single line text (primary) | Canonical name shown in Work · Queue |
| `aliases` | | long text | One alias per line, as the sources write it (e.g. `SERGIO GONGORA`). Matching ignores case, accents and extra spaces |
| `email` | | email | Also matched against owners that are emails |
| `is_ceo` | | checkbox | Max. Exactly one row should have it |
| `receives_delegation` | | checkbox | Can be suggested in "Delegate to …?" |
| `domains` | | multiple select (Sales, Delivery, Product, QA, Revenue, Ops) | Domains this person can receive |
| `active` | | checkbox | Inactive rows are ignored |

Seed (step 2), from owners seen in `command_center_tasks` on 2026-10-12. `is_ceo`, `receives_delegation` and `domains` stay empty until Max/Andrés confirm (D3, D4):

| name | aliases | email |
|---|---|---|
| Sergio Góngora | Sergio Góngora · SERGIO GONGORA | |
| Kyle | | kyle@mapking.ai |
| Carlos Olivares | Carlos Olivares | colivares@singularagency.co |
| Map King (shared) | | singular@mapking.ai |

## New table `command_center_triage` (1:1 with `command_center_tasks`)

Decided 2026-10-12: the triage output lives in its own table instead of 12 new fields in `command_center_tasks`, which already has about 35 fields from three owners (Loom, 38570, links). Each table has one writer: Loom → `command_center_tasks`, `triage-compute.js` → `command_center_triage`, people → `task_lanes`.

Airtable has no native 1:1 relation. The script enforces it:

- **Upsert by `normalized_task_id`:** one row per task, created on the first run after Loom adds the task (up to 1 hour later).
- **Duplicate check every run:** two rows with the same key → keep the oldest, update only that one, log `triage_data_issue`. Never deletes.
- **Closed tasks:** `row_status` = `closed`; `stale_*`, `delegate_*` and `lane_suggested` cleared.
- **Orphans:** the task row no longer exists (e.g. removed by Loom's duplicate guard) → `row_status` = `orphan`, link empty. Never deleted by the script.

| Field | ID | Type | Values |
|---|---|---|---|
| `normalized_task_id` | | single line text (primary) | Same key as the task (e.g. `linear:MAPKING-1037`) |
| `task` | | link to `command_center_tasks` (one record) | The task. Airtable adds the inverse link field `triage` in `command_center_tasks` (the only change to that table) |
| `row_status` | | single select | `active` · `closed` · `orphan` |
| `owner_canonical` | | single line text | `team_members.name`, else the raw owner trimmed, else empty |
| `owner_match` | | single select | `matched` · `unmatched` · `empty` |
| `stale_state` | | single select | `stale` · `fresh` · `unknown` · `excluded` |
| `stale_reason` | | single line text | e.g. `9 days without activity (limit 7)`, `overdue 3 days (limit 2)`, `No activity date`, `Source excluded (Google Calendar)` |
| `delegate_eligible` | | checkbox | |
| `delegate_reason` | | single line text | e.g. `CEO-owned, schedulable, no needs-max tag` or `Not delegable: tag needs-max` |
| `delegate_suggested_to` | | single line text | `team_members.name` or empty |
| `lane_suggested` | | single select | `this_week` · `waiting_on` · `queued` · `icebox` (never `on_fire`) |
| `lane_rule` | | single line text | `waiting_on_tag:<tag>` · `due_within:<n>d` · `overdue` · `inactive_no_due:<n>d` · `default` |
| `identity_key` | | single line text | Shared key for cross-source matches (e.g. `linear:MAPKING-478`); empty when unique |
| `identity_status` | | single select | `unique` · `duplicate_candidate` · `ambiguous` |
| `computed_at` | | date-time (UTC) | Last run that evaluated the row |

No lookups are added to `command_center_tasks` by default. If a grid view needs a triage value (e.g. `stale_state`), add a lookup through `triage` then.

## `priority_events` (`tbl0k4YFnduwhMJG2`): new `event_type` choices

| Choice | Written by | Meaning |
|---|---|---|
| `triage_compute` | script | One per run: counts (evaluated, changed, by lane, stale, delegable, duplicates, issues), `dryRun` |
| `triage_data_issue` | script | Invalid row, owner without match, missing config or field. One event per run per issue type, with IDs in `message` |
| `triage_filter_invalid` | extension | A restored filter value was not valid and was dropped |
| `triage_action` | extension | Delegate accepted, retag, reassign, lane move from Work · Queue |

Existing `status` (`ok`, `validation_failed`, `dependency_failed`) and `source` (`extension`, `automation`) choices are reused.

## Unchanged, read by this story

| Table | Fields read | By |
|---|---|---|
| `command_center_tasks` | `triage` (inverse link, new), `normalized_task_id`, `title`, `source`, `source_table`, `source_record_id`, `source_url`, `domain_tag`, `owner`, `due_date`, `status_raw`, `last_updated_at`, `lifecycle`, `source_status`, `category`, `tags`, `schedulable` | script, extension |
| `task_lanes` | `user`, `task`, `lane`, `rank_position`, `action_status`, `delegated_to`, `domain_override`, `owner_override` | extension |
| `loom_sync_runs` | `status`, `started_at`, `finished_at`, `source_counts` | extension |
| `dev_tickets` | `linear_issue_id` (format `MAPKING-123`) | script (identity) |
| `approvals` | `linked_invoice`, `linked_follow_up` | script (identity) |
