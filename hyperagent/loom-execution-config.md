# Loom — Execution Configuration (MapKMigGon38532)

Prompt version: **v3.9.1** · Updated: October 15, 2026 · Owner: Andrés Serrón (Singular)

This document describes how the Loom agent that feeds `command_center_tasks` is configured and how it runs. Loom's behavior lives in its system prompt (`agents/loom/loom.agent.md`), the single source of truth for what Loom does. Architecture and execution model: `agents/loom/README.md`. Version history: `agents/loom/loom.changelog.md`.

---

## 1. Hyperagent agent

| Setting | Value |
|---|---|
| Name | Loom 🧵 |
| Agent ID | `cmu1q1bq7009p07adrlnq0ff6` |
| System prompt | `agents/loom/loom.agent.md` (v3.9.1), pasted as plain text from the first line after the front matter |
| Model | Variable, **Balanced** profile, **mid** reasoning |
| Turn limit | `turnTimeoutMinutes` = 30. Past that, the platform kills the run with no report |
| Allowed integrations | `airtable`, `attio`, `linear`, `googlecalendar`, `slack` |
| Subagents (Task) | Forbidden by the prompt (section 7) |
| `execute-script` | `false` in the settings, but Loom still runs Bash/Python in its workspace. Do not rely on this flag |
| Scheduled runs | Live schedule, every day; runs at the time of day it was enabled (enabled 2026-10-11 ≈ 17:20 America/Chicago) — section 3 |
| Memory / auto-save | Auto-save of memories, skills and prompts is off |

---

## 2. Slack

| Setting | Value |
|---|---|
| Connection | Slack connected through Andrés's account |
| Default permission | Read only (unconfigured channels) |
| `#ingestion` | Read, write and respond · responds to **@mentions only** |
| `#daily-recap` | Read, write and respond · responds to **@mentions only** |
| `#ingestion` channel ID | `C0BRF6AHDJQ` (used by the scheduled run to post its report) |

### Accepted commands (only in `#ingestion`)

| Message | What it does |
|---|---|
| `@Loom sync now` / `@Loom sync` / `@Loom refresh tasks` | Normal sync: fetch, normalize, enrich new or changed tasks, upsert, and close what is no longer open |
| `@Loom rebuild` | One-time clean-up: re-enriches every open task and fetches full Linear descriptions. Not for routine use |

### Invocations rejected without running

| Case | Reply | Effect |
|---|---|---|
| Mention in another channel | "Syncs run from #ingestion." | Nothing is read or written |
| Mention in `#ingestion` without a command | "I only run syncs. Use '@Loom sync now'…" | Nothing is read or written |
| Another sync already running | "A sync is already running (started HH:MM UTC)…" | Only a `rejected_busy` row is logged |

### What Loom posts

- **Slack-triggered run:** exactly two messages in the thread: the acknowledgement ("On it — syncing now.") and the final report.
- **Scheduled run:** one new message in `#ingestion` (no acknowledgement), prefixed "Daily sync · ".

Report format (seven lines, all mandatory; the first ends with the prompt version):

```
✅ Success · run loom-20261011-220319 · prompt v3.9
• Airtable: fetched 44 / in scope 10 / created 0 / updated 10 / closed 0 / failed 0 / ok
• Attio: fetched 23 / in scope 23 / created 0 / updated 23 / closed 0 / failed 0 / ok
• Google Calendar: fetched 16 / in scope 16 / created 0 / updated 16 / closed 0 / failed 0 / ok
• Linear: fetched 1015 / in scope 68 / created 33 / updated 35 / closed 29 / failed 0 / ok / excluded (Ready for QA) 842
• Enrichment: done 33 / fallbacks 0 / backlog 0
• Verify: 790 rows read (= totalRecordCount 790) · open 117 · duplicates 0 · empty lifecycle 0
```

First line: `✅ Success` (everything processed, nothing failed, Verify clean) · `⚠️ Partial success` (a source unavailable or skipped, a record failed, budget exceeded, or Verify found a problem) · `❌ Failure` (nothing written).

---

## 3. Scheduled daily run

### How Hyperagent Live schedules work

The schedule is a Hyperagent **Live** schedule (Loom → Live → Create a schedule). Three behaviors matter for Loom:

- **No time or time-zone field.** The dialog offers only a frequency ("Check every": day, hour…). A daily schedule repeats every 24 hours from the moment it is enabled, so **the run time is the time of day you click Enable**. The time zone shown in other agents' exported config (e.g. America/Caracas for Marrowback) comes from the account, not from the dialog.
- **A cheap heartbeat decides whether the agent runs.** Each check reads "Things to check" and only starts Loom if something "needs attention" ("Only when something needs attention" is always on for Live). The instruction therefore states that the condition is always true; without that, the heartbeat may skip the sync. The heartbeat costs ~$0.21/day; the sync itself is billed separately.
- **Each schedule continues its own thread** ("New thread (created on Save)"), separate from the Slack-triggered threads.

### Current schedule (enabled 2026-10-11)

| Field | Value |
|---|---|
| Things to check | Instruction below, copied exactly |
| Check every | **day** |
| Run time | ≈ **17:20 America/Chicago** (= 22:20 UTC, 19:20 Montevideo), the time it was enabled. Target is 03:00 Chicago: see "Set or change the running time" |
| Deliver alerts to | Run thread only (Loom posts its own report to `#ingestion`) |
| Continues thread | New thread (created on Save) |
| Only when something needs attention | On (always on for Live) |
| Integration writes | **Allow** (Loom writes `command_center_tasks` and `loom_sync_runs`) |
| Estimated cost | ~$0.21/day · ~$6.23/month for the heartbeat |

Instruction text (required — the heartbeat needs the first sentence to always run, and section 7a of the prompt recognizes a scheduled run only by the rest):

```
This always needs attention: every daily check must run the sync. Scheduled daily sync: run a full sync cycle (mode "sync", never "rebuild") exactly as defined in your instructions. Trigger = "schedule". This is an unattended run: use telemetry run_type "scheduled", do not post an acknowledgement, and do not ask questions. Post only the final report, as a new message in #ingestion (channel C0BRF6AHDJQ), prefixed "Daily sync · ".
```

Note: the dialog captured on 2026-10-11 shows the instruction without the first sentence ("This always needs attention…"). If the saved schedule lacks it and a daily run is ever skipped with no `loom_sync_runs` row, edit the schedule and add it.

### Set or change the running time

Because Live has no time field, the running time is set by **when** the schedule is enabled:

1. Decide the target time in Max's time zone (**America/Chicago**). Target: **03:00 Chicago** = 08:00 UTC during US daylight time (until Nov 1) and 09:00 UTC after; = 05:00 / 06:00 Montevideo.
2. At that time (within a few minutes), open Hyperagent → Loom → **Live**.
3. If a schedule exists, open it and **disable or delete** it, then **Create a schedule** with the values in the table above and the instruction copied exactly. Click **Enable**.
   - Do not delete the old schedule until the new one is saved: other agents hit an orphaned-schedule error after deleting a Live schedule (open Support case). If deleting is blocked, disable the old one and create the new one.
4. Record the new time in this document ("Run time" row) and in the CHANGELOG notes.
5. The next day, verify (below) that the run happened within a few minutes of that time.

Notes:

- **Daylight saving time:** if the schedule repeats every 24 h in UTC, the local run time moves one hour when Chicago changes clocks (Nov 1, 2026 and Mar 14, 2027): 03:00 CDT becomes 02:00 CST. If that matters, re-enable at 03:00 after each change.
- **Avoid 07:00–10:00 Chicago:** that is when manual syncs are most likely; a collision is safe (the scheduled run logs `rejected_busy` and posts nothing) but that day's scheduled report is lost.
- **Collisions are safe in general:** the run lock in `loom_sync_runs` prevents two syncs from running at once.

Note: the v3.9 wording "weekdays" in section 7a was fixed in v3.9.1 ("daily").

### How a scheduled run differs from a Slack run

| | Slack run | Scheduled run |
|---|---|---|
| Started by | `@Loom sync now` in `#ingestion` | Hyperagent schedule |
| Invocation check | Yes | Skipped |
| Acknowledgement | "On it — syncing now." | None |
| Report | Final reply in the thread | New message in `#ingestion`, "Daily sync · " prefix |
| Lock busy | Replies "already running" | Logs `rejected_busy`, posts nothing |
| Mode | sync or rebuild | sync only |
| Telemetry `run_type` | interactive | scheduled |
| `loom_sync_runs.trigger` | `slack:#ingestion <requester>` | `schedule` |

### Verify the schedule works

1. After saving, export the agent and confirm `scheduledInvocations` has one entry with the instruction above.
2. Wait for the next run time (no "Run now" in the Live dialog).
3. Check: a new message in `#ingestion` starting with "Daily sync · ✅", and a row in `loom_sync_runs` with trigger `schedule` and status `success`, started within a few minutes of the run time.
4. If there is no `loom_sync_runs` row: the heartbeat skipped the run (check the instruction's first sentence) or the schedule did not fire (open the schedule's thread in Hyperagent).
5. If there is a row but no Slack message: if the report says Slack is read-only, check Loom → Slack → Channels (`#ingestion` must be "Read, write and respond").

Status on 2026-10-11: schedule enabled ≈ 22:20 UTC; first scheduled run expected 2026-10-12 ≈ 22:20 UTC. Until then, all runs in `loom_sync_runs` are Slack-triggered.

---

## 4. Run flow

1. Telemetry (silent) → invocation check (Slack runs) → **take the lock** in `loom_sync_runs` → acknowledgement (Slack runs) → integration preflight.
2. Read the `command_center_tasks` index (all pages, only 6 fields).
3. Per source, in this order, each one complete before the next: **Airtable (5 tables) → Attio → Google Calendar → Linear**. For each: fetch all pages → filter → normalize → enrich → write → close.
4. Verify: re-read the index and count rows by source and lifecycle, duplicates, and empty lifecycle.
5. **Release the lock** (update the run row with totals, failed ids and the report) → post the report.

### Budget and performance

| Rule | Value |
|---|---|
| Target per run | 20 min (hard platform limit: 30 min) |
| Past 20 min | No new sources start; finishes what is in flight and reports ⚠️ |
| Writes | Batches of 50 records, upsert, built by script and sent with `paramsFile` |
| Large results | Processed with Python from `/large_tool_results`, never read into the conversation |
| Enrichment | Max 60 tasks per run (150 in rebuild); the rest is backlog for the next run |
| Observed duration (Oct 11) | 7 min, 790 rows, 1,015 Linear issues |

### Paging per source

| Source | Action | Parameters |
|---|---|---|
| Index | `airtable__list_records_for_table` | `pageSize` 1000, `cursor`/`nextCursor` until exhausted; checked against `totalRecordCount` |
| Airtable (sources) | `airtable__list_records_for_table` | `pageSize` 1000, only the fields needed for filter and mapping |
| Attio | `attio__list-tasks` | `is_completed` false, `limit` 10, `offset` 0, 10, 20… until `has_more` is false. Tasks only, never deals |
| Linear | `linear__list_issues` | `limit` 250, fixed fields (no labels in v3.9), `cursor` until `hasNextPage` is false. State filtered in script |
| Linear (detail) | `linear__get_issue` | Only for new or changed in-scope issues, to get the full description |
| Google Calendar | `GoogleCalendarFindEvents` | `primary`, today 00:00 to today + 14 days (America/Montevideo), `maxResults` 250, `pageToken`. Recurring events = one task per instance |

Known issue: the lock read with `sort` on `loom_sync_runs` returns an Airtable 400; Loom retries without sorting and continues (seen on 2026-10-11).

### Scope rules

| Source | `domain_tag` | Open when… |
|---|---|---|
| Attio (tasks) | Sales | `is_completed` = false |
| Linear | Product | `statusType` in triage / backlog / unstarted / started, **except status "Ready for QA"** |
| Google Calendar | Ops | Confirmed event not yet ended, 14-day window |
| Airtable · approvals | Ops | `approval_status` = Pending |
| Airtable · follow_ups | Sales | `days_since_last_contact` ≥ 3 and `approval_status` empty or Draft |
| Airtable · ticket_candidates | QA | `review_status` = pending |
| Airtable · dev_tickets | QA | status = New or Needs Max Input |
| Airtable · invoices | Revenue | Overdue and not paid |

Test data, never written: a title that starts with "test" + a separator or "[test]", or contains "dummy" or "(demo)" (case-insensitive).

---

## 5. Concurrency: two runs at the same time

| Layer | Where it is configured | What it does |
|---|---|---|
| **Run lock** | `loom_sync_runs` table + prompt section 7b | Before reading anything, Loom looks for a `running` row younger than 35 min. If one exists, it replies "already running" (Slack) or stays silent (schedule), logs `rejected_busy` and stops. Otherwise it creates its own `running` row, re-reads, and backs off if another run started seconds earlier. `running` rows older than 35 min are marked `abandoned` |
| **Upsert by key** | Prompt section 3 | Every write is an upsert on `normalized_task_id`; a second write of the same task updates, never duplicates |
| **Duplicate guard** | Airtable automation "Guard - command_center_tasks duplicate normalized_task_id → remove new copy" (`wfletTuP3cF7pZjWV`, **ON**) | Deletes the new copy when a row is created with an existing id (keeps the one linked to `task_lanes`, then the oldest) |

---

## 6. Airtable objects (Map King Hub base, `appcdpGNTo0DouoqJ`)

### `command_center_tasks` (`tblX61yfIFroyhMTj`) — fields Loom writes

| Field | ID | Notes |
|---|---|---|
| normalized_task_id | `fldmSHhnTbC1Go3Dw` | Upsert key: `attio:<id>`, `linear:<KEY>`, `gcal:<id>`, `airtable:<table>:<rec>` |
| source / source_table / source_record_id / source_url | `fldceaJIeHpA3Tdae` / `fldzYRdrxSjCpSQsk` / `fld23q8i9yP86zQMT` / `fldqoka4e1FLKxJ6x` | Traceability |
| title / description | `fld4JRaVYnwttmi4P` / `fldEh4HYNFW9tzRTK` | Description from the source, max 2,000 characters, never generated |
| owner / due_date / status_raw / domain_tag | `fldECSTk2LFWGIS6V` / `fldld41zIqgdNXeyn` / `fldaxkMZkAAjQOWgQ` / `fldejhIOeD3YCFRRP` | `status_raw` = the source's status text, verbatim |
| lifecycle | `fldzqG2oVnK93COcW` | open / closed / not_returned |
| last_updated_at / synced_at / created_at | `fldG6wphuQyvtHSIy` / `fldrha5LN1fKNSeuK` / `fldwGzaA9WfhYa3on` | |
| source_status / sync_error | `fldXpO4TchBQJVkhm` / `fldi3MM9W3w9nIWXJ` | ok / stale / unavailable |
| category / tags / schedulable | `fldTamXky2fjceS9C` / `fldYqQehpEy918bve` / `fldfxuYNvITcMIlFu` | AI enrichment; cleared when a row is closed |
| starts_at / ends_at / all_day | `fldrlnSKq9mvoDRLu` / `fldIIcqQnllCLko5c` / `fldPHaq4WRruW6SbL` | Google Calendar rows only (v3.9) |

Fields on this table that Loom does **not** write (MapKMigGon38570, see `docs/38570/schema.md`): `source_labels` (reserved for Loom v3.10), `needs_you_manual_any`, `needs_you_signals`, `waiting_since`, `waiting_since_basis`, and the link fields to `task_lanes`, `priority_events` and `power_hour_items`.

View **"Daily — open"**: filter lifecycle = open, grouped by due_date.

### `loom_sync_runs` (`tblLnaOIEzNbIWp9S`)

One row per run; lock and log. Fields: `run_id`, `status` (running / success / partial / failure / rejected_busy / abandoned), `mode` (sync / rebuild), `trigger`, `started_at`, `finished_at`, `created`, `updated`, `closed`, `skipped`, `failed`, `enrichment_fallbacks`, `source_counts`, `failed_ids`, `fallback_ids`, `report`. Written only by Loom; do not delete rows.

### Source tables (read-only)

`approvals` (`tblRilIMAIEiUSFof`), `follow_ups` (`tblX0mTj3SFLGOgRs`), `ticket_candidates` (`tbl5TcDUfxG9JRoIo`), `dev_tickets` (`tblSWc1WrL5qjzTzs`), `invoices` (`tblcQ0tJXn7eB9kjw`).

---

## 7. Operations

| Task | How |
|---|---|
| Update the prompt | Hyperagent → Loom → edit system prompt → paste `agents/loom/loom.agent.md` **from the first line after the front matter** (`## Telemetry …`) as plain text → save → export the agent and confirm the text matches → add a CHANGELOG entry. The next report's first line must end with the new version |
| Normal sync | `@Loom sync now` in `#ingestion` |
| Full clean-up | `@Loom rebuild` in `#ingestion` (once, after changing enrichment rules) |
| See what happened in a run | The run's row in `loom_sync_runs` and the thread in Hyperagent |
| Daily run did not post | Check the latest `loom_sync_runs` row: `rejected_busy` = a manual sync was running; no row = the schedule did not fire (check Live) |
| Stuck run | A row left `running` for more than 35 min is marked `abandoned` by the next run |
| "read-only access" error in Slack | Check channel permissions in Loom → Slack → Channels |

## 8. Open items

- Deploy v3.9.1 to Hyperagent (procedure in section 7), export and compare, and confirm the next report ends with "· prompt v3.9.1".
- Scheduled runs confirmed: `loom-20261015-040834` posted "Daily sync · ✅ Success" with trigger `schedule` (started 04:08 UTC, i.e. the schedule was re-enabled around 23:08 Chicago).
- Move the run time to 03:00 Chicago with the procedure in section 3 (re-enable at 03:00).
- Next prompt version (v3.10): Linear labels into `source_labels` (MapKMigGon38570, Needs-You signal 3).
- Confirm that `C0BRF6AHDJQ` is `#ingestion`.
- Clean test records in Max's source tables (needs his OK).
