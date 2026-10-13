# MapKMigGon38571 — Airtable schema changes

Base: **Map King Hub** (`appcdpGNTo0DouoqJ`) · Status: **applied 2026-10-12** (step 2, approved by Andrés) · Owner: Andrés Serrón

All changes are additive. No field or table is renamed or deleted. Loom (v3.9) writes only its own fields and is not affected. `task_lanes` (shared with 38570) has no schema change. `command_center_tasks` gets only the inverse link field `triage`, created by Airtable when `command_center_triages.task` is added.

Code (scripts and extension) always uses the IDs below, never names.

| Table | ID |
|---|---|
| `triage_configs` | `tblGZaFBg7KLbcuf7` (active row `recEPlvRzBf0UUtKB`) |
| `team_members` | `tblA658S9otgj9p3n` |
| `command_center_triages` | `tblaG64QpuRInrm5X` |
| `command_center_tasks` | `tblX61yfIFroyhMTj` (new field `triage` = `fld0pXalwYvckZmQE`) |
| `priority_events` | `tbl0k4YFnduwhMJG2` |

## Writers

| Writer | Table | Fields it writes |
|---|---|---|
| Loom (Hyperagent) | `command_center_tasks`, `loom_sync_runs` | Its own fields only (see `claude/spec-MapKMigGon38532.md`) |
| `triage-compute.js` (automation, hourly) | `command_center_triages` | Every field (creates and updates rows, marks closed and orphan rows; never deletes) |
| `triage-compute.js` | `priority_events` | `triage_compute`, `triage_data_issue` |
| Work · Queue (extension) | `task_lanes` | lane, overrides, `delegated_to`, `action_status` (existing fields) |
| Work · Queue | `priority_events` | `triage_action`, `triage_filter_invalid` |
| Andrés / Max (by hand) | `triage_configs`, `team_members` | Everything (configuration) |

## New table `triage_configs`

One active row. The script reads the first row with `active` = true; none or more than one → the run stops and logs `triage_data_issue`.

| Field | ID | Type | Default | Meaning |
|---|---|---|---|---|
| `name` | `fldMarnRXhQIb1898` | single line text (primary) | `default` | Label |
| `active` | `fld9TdaRYZ0RqDoYi` | checkbox | ✔ | The row the script uses |
| `timezone` | `fldbeKikUZMGaeamo` | single line text | `America/Chicago` | Time zone for "today" (due dates, day counts) |
| `stale_inactive_days` | `fldYi5Zf1P1AQq6pg` | number (integer) | 7 | Days without source activity (`last_updated_at`) → stale |
| `stale_overdue_days` | `fldiZDW8iY83QkEhm` | number (integer) | 2 | Days past `due_date` → stale |
| `stale_exclude_sources` | `fld9BwUH18MCo3Th0` | multiple select (Attio, Linear, Airtable, Google Calendar, Manual) | Google Calendar | Sources never marked stale (calendar events are not work items) |
| `this_week_horizon_days` | `fldiRwMC7U06E71Oo` | number (integer) | 7 | Due within N days (or overdue) → `this_week` |
| `icebox_inactive_days` | `fldvkqfTjlbYp0izV` | number (integer) | 30 | No due date and N days without activity → `icebox` |
| `waiting_on_tags` | `fld0smX0xKbmYJZaE` | multiple select (Loom tag list) | waiting-on-external | Tags that send a task to `waiting_on` |
| `delegate_exclude_tags` | `fldLfGTM3ytpZ3Ubt` | multiple select (Loom tag list) | needs-max | Tags that make a task not delegable |
| `delegate_require_schedulable` | `fldf3J0NdBvqfirKq` | checkbox | ✔ | Only tasks with `schedulable` = true are delegable |
| `delegate_empty_owner_is_ceo` | `fldSgrMAML9QoBSf2` | checkbox | ✔ | Treat tasks without owner as the CEO's (decision D4) |
| `invalid_rows_max_pct` | `fldjXNwk0KSQXo8i8` | number (integer) | 10 | Above this % of invalid open rows, the run writes nothing |
| `notes` | `fldA2SKjXsMEmhlai` | long text | | What was decided, by whom, when |

The tag lists reuse Loom's fixed tag list: needs-max, waiting-on-external, client-facing, bug, approval, billing, meeting, follow-up, content, deadline-risk.

## New table `team_members`

| Field | ID | Type | Meaning |
|---|---|---|---|
| `name` | `fldeTXTbJVJnKmWzh` | single line text (primary) | Canonical name shown in Work · Queue |
| `aliases` | `fldTG4itOjWus9IYo` | long text | One alias per line, as the sources write it (e.g. `SERGIO GONGORA`). Matching ignores case, accents and extra spaces |
| `email` | `fldMtIk99zcWwVPqT` | email | Also matched against owners that are emails |
| `is_ceo` | `fldP5jwpZCJ91EFLm` | checkbox | Max. Exactly one row should have it |
| `receives_delegation` | `fldkOiONCO7r1l3mM` | checkbox | Can be suggested in "Delegate to …?" |
| `domains` | `fldDQwk79VEfJwHAf` | multiple select (Sales, Delivery, Product, QA, Revenue, Ops) | Domains this person can receive |
| `active` | `flduiUrc076re9UCr` | checkbox | Inactive rows are ignored |
| `notes` | `fldh3fWU1lLaAVTAQ` | long text | Who confirmed the row and when |

Seeded 2026-10-12 (step 2), from owners seen in `command_center_tasks` on 2026-10-12. `is_ceo`, `receives_delegation` and `domains` stay empty until Max/Andrés confirm (D3, D4):

| name | aliases | email | record |
|---|---|---|---|
| Sergio Góngora | Sergio Góngora · SERGIO GONGORA | | `recY34Le9SPlYbkOl` |
| Kyle | | kyle@mapking.ai | `recOj60vJnRweFbZJ` |
| Carlos Olivares | Carlos Olivares | colivares@singularagency.co | `recWiDSEPtHwtYfBO` (former developer; matching only, never suggested) |
| Map King (shared) | | singular@mapking.ai | `recIj6KbCpqXdDNya` (who it represents: D4) |

## New table `command_center_triages` (1:1 with `command_center_tasks`)

Decided 2026-10-12: the triage output lives in its own table instead of 12 new fields in `command_center_tasks`, which already has about 35 fields from three owners (Loom, 38570, links). Each table has one writer: Loom → `command_center_tasks`, `triage-compute.js` → `command_center_triages`, people → `task_lanes`.

Airtable has no native 1:1 relation. The script enforces it:

- **Upsert by `normalized_task_id`:** one row per task, created on the first run after Loom adds the task (up to 1 hour later).
- **Duplicate check every run:** two rows with the same key → keep the oldest, update only that one, log `triage_data_issue`. Never deletes.
- **Closed tasks:** `row_status` = `closed`; `stale_*`, `delegate_*` and `lane_suggested` cleared.
- **Orphans:** the task row no longer exists (e.g. removed by Loom's duplicate guard) → `row_status` = `orphan`, link empty. Never deleted by the script.

| Field | ID | Type | Values |
|---|---|---|---|
| `normalized_task_id` | `fldiFf8TT66Cr9EHF` | single line text (primary) | Same key as the task (e.g. `linear:MAPKING-1037`) |
| `task` | `fldQD8DWx6I4wzpg6` | link to `command_center_tasks` (one record) | The task. Airtable adds the inverse link field `triage` in `command_center_tasks` (the only change to that table) |
| `row_status` | `fldKSj0WnXERwtYru` | single select | `active` · `closed` · `orphan` |
| `owner_canonical` | `fldW59XTy9PPKHS5M` | single line text | `team_members.name`, else the raw owner trimmed, else empty |
| `owner_match` | `fldmlDSJYktdRQdeE` | single select | `matched` · `unmatched` · `empty` |
| `stale_state` | `fldY5SrXInz4k7umK` | single select | `stale` · `fresh` · `unknown` · `excluded` |
| `stale_reason` | `fldX2gyYPzFdk0Vnk` | single line text | e.g. `9 days without activity (limit 7)`, `overdue 3 days (limit 2)`, `No activity date`, `Source excluded (Google Calendar)` |
| `delegate_eligible` | `fldyj9poKbR6Wjw5q` | checkbox | |
| `delegate_reason` | `fldzjFQYIvse8OPkg` | single line text | e.g. `CEO-owned, schedulable, no needs-max tag` or `Not delegable: tag needs-max` |
| `delegate_suggested_to` | `fldxWbxEz73BmzTPc` | single line text | `team_members.name` or empty |
| `lane_suggested` | `fldqnNhGlHehSXVQa` | single select | `this_week` · `waiting_on` · `queued` · `icebox` (never `on_fire`) |
| `lane_rule` | `fldw1TT44d9GR6ejY` | single line text | `waiting_on_tag:<tag>` · `due_within:<n>d` · `overdue` · `inactive_no_due:<n>d` · `default` |
| `identity_key` | `fld0CsVqOkhYnxr9h` | single line text | Shared key for cross-source matches (e.g. `linear:MAPKING-478`); empty when unique |
| `identity_status` | `fldu7Xjtn1T1r0mfT` | single select | `unique` · `duplicate_candidate` · `ambiguous` |
| `computed_at` | `fldns5wX8gp8UEOlZ` | date-time (UTC) | Last run that evaluated the row |

No lookups are added to `command_center_tasks` by default. If a grid view needs a triage value (e.g. `stale_state`), add a lookup through `triage` then.

## `priority_events` (`tbl0k4YFnduwhMJG2`): new `event_type` choices

| Choice | ID | Written by | Meaning |
|---|---|---|---|
| `triage_compute` | `selbkgNBCzPSgxrcu` | script | One per run: counts (evaluated, changed, by lane, stale, delegable, duplicates, issues), `dryRun` |
| `triage_data_issue` | `selQj3lHGUQMbQwsU` | script | Invalid row, owner without match, missing config or field. One event per run per issue type, with IDs in `message` |
| `triage_filter_invalid` | `sel19PC96M4hzi6yI` | extension | A restored filter value was not valid and was dropped |
| `triage_action` | `selsqFD9DID9zwUME` | extension | Delegate accepted, retag, reassign, lane move from Work · Queue |

Existing `status` (`ok`, `validation_failed`, `dependency_failed`) and `source` (`extension`, `automation`) choices are reused.

The choices were registered by creating one setup event per type (2026-10-12, summary `setup · event type registered: …`, records `rec0HfxMs8H6nhNsA`, `recLNi2QS2dNerJic`, `recEebVn32HhsOOmR`, `recxhvqPgrFXyTHuk`). The API cannot add choices to an existing select directly, and `priority_events` is append-only, so they stay.

## Unchanged, read by this story

| Table | Fields read | By |
|---|---|---|
| `command_center_tasks` | `triage` (inverse link, new), `normalized_task_id`, `title`, `source`, `source_table`, `source_record_id`, `source_url`, `domain_tag`, `owner`, `due_date`, `status_raw`, `last_updated_at`, `lifecycle`, `source_status`, `category`, `tags`, `schedulable` | script, extension |
| `task_lanes` | `user`, `task`, `lane`, `rank_position`, `action_status`, `delegated_to`, `domain_override`, `owner_override` | extension |
| `loom_sync_runs` | `status`, `started_at`, `finished_at`, `source_counts` | extension |
| `dev_tickets` | `linear_issue_id` (format `MAPKING-123`) | script (identity) |
| `approvals` | `linked_invoice`, `linked_follow_up` | script (identity) |

## Manual follow-up in Airtable (optional, Andrés)

- ~~`command_center_triages.task` and `command_center_tasks.triage`: turn off "Allow linking to multiple records"~~ Done by Andrés 2026-10-12 (verified: `prefersSingleRecordLink` = true on both). The script still enforces one link.
- Expose the new tables and fields in the Work · Queue page's Data panel when step 7b is published.
