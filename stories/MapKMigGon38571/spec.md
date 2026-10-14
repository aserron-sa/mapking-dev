# MapKMigGon38571 — Triage lanes · Solution spec

| | |
|---|---|
| Story | MapKMigGon38571 · Map King Discovery & Foundation / Max Hanratty |
| Sprint / Epic | Sprint 4 (closes 2026-10-20) · Front-Office Workflows |
| Story points | 8 |
| Owner | Andrés Serrón (replacing Carlos Olivares) |
| QA | Gonzalo Lucas Ranieri |
| Version | 2.0 · 2026-10-13 · **as built** (section 11 added; AC statuses and open items updated) · 1.1 was the 2026-10-12 design · replaces Carlos Olivares's 2026-09-17 docx (written against CC4, not this AC) |
| Status | Implemented and verified end to end on the published page. Ready for QA once the commits are pushed and the hourly automation is enabled (see section 11.7) |
| Related docs | `acceptance-criteria-stack.md` (AC on the stack, IDs F/T/D/E/S) · `schema.md` (fields and IDs) · `implementation-plan.md` (steps, dates) · `CHANGELOG.md` · `evidence.md` (AC by AC) · `qa-guide.md` (how QA tests it) · `MapKMigGon38571-work-queue-qa-report-v7.pdf` (screenshots) |

---

## 1. Goal

> As Map King's CEO, I want to sort all my tasks into clear priority lanes by domain, owner and source, so that I can quickly triage work from every source in one place and know what needs attention, what can wait, and what should be delegated.

In the Work · Queue interface, every open task from every source:

- has a lane (On Fire, This Week, Waiting On, Queued, Icebox), chosen by Max or suggested by a rule;
- can be filtered by domain, owner, source and lane, in any combination;
- shows whether it is stale, and why;
- shows whether it could be delegated, and to whom;
- shows which values come from the source, from AI, or from Max's own overrides;
- tells Max when the data is incomplete.

## 2. Architecture

```
Loom (daily 07:47 CT + Slack)  ──>  command_center_tasks   (Loom fields, unchanged)
                                          │
cct_triage_configs + team_members ──┐          │
                               ▼          ▼
            cct-triage-compute.ts  (Airtable automation, hourly)
              · rules: airtable/cct/cct-triage-rules.ts (pure, unit-tested, inlined at build)
              · writes only command_center_triages (one row per task, 1:1)
              · logs to priority_events
                                          │
                                          ▼
Work · Queue extension
  · cct-triage-contract.ts (pure, unit-tested): builds triage rows, applies and validates filters,
    provenance, completeness
  · reads command_center_tasks + command_center_triages (joined by normalized_task_id)
    + the signed-in user's task_lanes + loom_sync_runs
  · writes only task_lanes (decisions) and priority_events
```

| Component | Role | Location |
|---|---|---|
| Loom | Ingestion, normalization, AI enrichment (`category`, `tags`, `schedulable`) | Hyperagent · 38532 |
| `cct_triage_configs`, `team_members` | Configurable rules and roster | Airtable |
| `cct-triage-rules.ts` | Pure rule functions: lane, stale, delegate, owner, identity | `airtable/cct/` |
| `cct-triage-compute.ts` | Hourly automation: read, evaluate, upsert triage rows, log | `airtable/cct/automations/` (+ built copy to paste) |
| `command_center_triages` | Triage output, one row per task (1:1), written only by the script | Airtable, new |
| `cct-triage-contract.ts` | Pure triage-row and filter logic for the page | `airtable/cct/interfaces/` |
| `WorkQueuePage.tsx` | The Work · Queue page | `airtable/cct/interfaces/` |
| `task_lanes` | Per-user manual decisions; shared with 38570 (Today, On Fire top 3) | Airtable, unchanged |
| `priority_events` | Event log | Airtable |

Why a scheduled script and not formulas: an Airtable formula cannot read another table without a link on every row, so formulas cannot read `cct_triage_configs`. The hourly-script pattern is already in production for 38570 (`needs-you-waiting-since.js`).

Why `lane_suggested` instead of creating `task_lanes` rows: rule lanes are recomputed every hour and must not trigger 38570's `task_lanes` integrity automations or create hundreds of rows per user. `task_lanes` keeps only what a person decided.

## 3. Data model

See `schema.md` for every field, type, default and ID. Summary:

- **New tables:** `cct_triage_configs` (one active row of thresholds) and `team_members` (canonical names, aliases, CEO flag, delegation roster by domain).
- **New table `command_center_triages`** (1:1 with `command_center_tasks`): `normalized_task_id`, `task` (link), `row_status`, `owner_canonical`, `owner_match`, `stale_state`, `stale_reason`, `delegate_eligible`, `delegate_reason`, `delegate_suggested_to`, `lane_suggested`, `lane_rule`, `identity_key`, `identity_status`, `computed_at`. Kept separate so `command_center_tasks` (about 35 fields, three owners) gets only the inverse link field `triage`.
- **Join:** script and page match the two tables by `normalized_task_id`; the link field gives navigation and optional lookups in Airtable.
- **New `priority_events` types:** `triage_compute`, `triage_data_issue`, `triage_filter_invalid`, `triage_action`.
- **`task_lanes`:** unchanged.

## 4. Rules (`cct-triage-rules.ts`)

All rules are pure functions of (task row, config, roster, today in `timezone`). Same inputs → same output. No AI.

### 4.1 Owner

1. Owner empty → `owner_match` = `empty`, `owner_canonical` empty.
2. Normalize the raw owner (lowercase, strip accents, collapse spaces). Compare with each active member's `name`, `aliases` and `email`.
3. One match → `matched`, canonical = member `name`. No match → `unmatched`, canonical = raw owner trimmed (logged once per run as a data issue). More than one match → `unmatched` + data issue.

### 4.2 Lane suggested (first rule that applies wins)

| # | Condition | `lane_suggested` | `lane_rule` |
|---|---|---|---|
| 1 | Task has a tag in `waiting_on_tags` | `waiting_on` | `waiting_on_tag:<tag>` |
| 2 | `due_date` < today | `this_week` | `overdue` |
| 3 | `due_date` ≤ today + `this_week_horizon_days` | `this_week` | `due_within:<n>d` |
| 4 | No `due_date` and days since `last_updated_at` ≥ `icebox_inactive_days` | `icebox` | `inactive_no_due:<n>d` |
| 5 | Otherwise | `queued` | `default` |

`on_fire` is never suggested. On Fire stays manual (top 3, story 38570).

### 4.3 Stale

| Order | Condition | `stale_state` | `stale_reason` |
|---|---|---|---|
| 1 | Source in `stale_exclude_sources` | `excluded` | `Source excluded (<source>)` |
| 2 | `due_date` valid and today − `due_date` ≥ `stale_overdue_days` | `stale` | `Overdue <n> days (limit <m>)` |
| 3 | `last_updated_at` missing or invalid | `unknown` | `No activity date` |
| 4 | Days since `last_updated_at` ≥ `stale_inactive_days` | `stale` | `<n> days without activity (limit <m>)` |
| 5 | Otherwise | `fresh` | `Active <n> days ago` |

`excluded` is a fourth state not named in the AC: calendar events are appointments, not work that can go stale. Marking them `fresh` would hide that the rule does not apply; `unknown` would suggest missing data.

### 4.4 Delegation

Eligible when all are true:

- `lifecycle` = open;
- the owner is the CEO (`owner_canonical` = the `team_members` row with `is_ceo`), or the owner is empty and `delegate_empty_owner_is_ceo` is on;
- no tag in `delegate_exclude_tags`;
- `schedulable` = true, if `delegate_require_schedulable` is on.

`delegate_reason` names the rule that passed or the first one that failed. `delegate_suggested_to` = the first active member with `receives_delegation` whose `domains` include the task's `domain_tag` (alphabetical, so the result is stable). Empty roster → eligible tasks get no suggestion; the page then asks "Delegate to whom?".

### 4.5 Cross-source identity

| Rule | Match | `identity_key` |
|---|---|---|
| I1 | `airtable:dev_tickets:<rec>` whose `dev_tickets.linear_issue_id` = KEY, and an open `linear:<KEY>` | `linear:<KEY>` |
| I2 | `airtable:approvals:<rec>` whose `linked_invoice` or `linked_follow_up` points to an open `airtable:invoices:<rec>` or `airtable:follow_ups:<rec>` | the invoice / follow-up `normalized_task_id` |

- Exactly one counterpart → both rows `duplicate_candidate` with the same key.
- More than one counterpart → `ambiguous`.
- Otherwise `unique`.
- Nothing is merged, hidden or deleted. Work · Queue groups rows that share a key.

## 5. Triage contract (`cct-triage-contract.ts`)

### 5.1 Triage row

```ts
type Provenance = 'source' | 'ai' | 'override' | 'rule' | 'manual';

type TriageRow = {
  recordId: string;                 // command_center_tasks record
  triageRecordId: string | null;    // command_center_triages row (null until the first run after Loom adds the task)
  taskId: string;                   // normalized_task_id
  title: string;
  source: string;                   // Attio | Linear | Airtable | Google Calendar | Manual
  sourceTable: string | null;
  sourceUrl: string | null;
  statusRaw: string | null;
  dueDate: string | null;
  lastActivityAt: string | null;
  sourceStatus: 'ok' | 'stale' | 'unavailable' | null;
  domain: { value: string | null; from: 'source' | 'override' };
  owner: { value: string | null; raw: string | null; match: 'matched' | 'unmatched' | 'empty'; from: 'source' | 'override' };
  lane: { value: Lane; basis: 'manual' | 'rule'; rule: string | null; rank: number | null };
  stale: { state: 'stale' | 'fresh' | 'unknown' | 'excluded'; reason: string | null };
  delegate: { eligible: boolean; reason: string | null; suggestedTo: string | null; delegatedTo: string | null };
  identity: { key: string | null; status: 'unique' | 'duplicate_candidate' | 'ambiguous' };
  ai: { category: string | null; tags: string[]; schedulable: boolean };   // shown with an "AI" marker
  actionStatus: string;             // task_lanes.action_status: none | done | dropped | rescheduled
  laneRecordId: string | null;      // the user's task_lanes row, if any
};
```

Lane rule: the user's `task_lanes` row has a lane → `{value, basis: 'manual'}`. Otherwise `lane_suggested` → `basis: 'rule'`. Neither (e.g. the script has not run yet) → `queued`, `basis: 'rule'`, `rule: 'fallback'`, and the completeness check reports it.

### 5.2 Filters

```ts
type Filters = { domain?: string[]; owner?: string[]; source?: string[]; lane?: Lane[] };
```

- OR inside a dimension, AND across dimensions.
- Special values: `__none__` matches an empty domain or owner ("No domain", "Unassigned").
- Allowed values: domain, source and lane = the field's choice lists; owner = the set of owners present in the rows plus `__none__`.
- `validateFilters(filters)` returns `{ valid: Filters, issues: { param, value, reason }[] }`. Invalid values are dropped. The page shows each issue and logs one `triage_filter_invalid` event per page load.
- A valid filter with no matches → empty list and the "Nothing matches these filters" state. Never an error.

### 5.3 Completeness

`completeness = { status: 'complete' | 'partial', reasons: string[] }`. Partial when any is true:

| Reason | Check |
|---|---|
| Last Loom run not clean | Latest `loom_sync_runs` row with status `success`, `partial` or `failure` is `partial` or `failure` (`running`, `rejected_busy` and `abandoned` are skipped) |
| Source unavailable | Any open row with `source_status` = `unavailable` (named by source) |
| Triage not computed | Any open task without a `command_center_triages` row, or `cct_triage_configs.last_run_at` older than 2 hours, or `last_run_status` ≠ ok |

The page shows a banner listing every reason. Data still renders.

### 5.4 Required fields

On load, the page checks that every field it uses exists and is visible to the extension (same pattern as Today's `REQUIRED_FIELDS`). Missing fields → a message naming each field and the table; the list is not rendered as if it were complete.

### 5.5 Existing Work · Queue behavior to keep

Built by Carlos Olivares (2026-09-17, docx "Work · Queue (Triage por Lanes)", same file as the SS evidence) and confirmed by him manually. Source recovered 2026-10-12: `airtable/cct/interfaces/WorkQueuePage.tsx` (Airtable code-editor project: `frontend/index.tsx` + `style.css`; template files in `extension-template/`). Not part of this AC, but it must keep working (regression R2):

- Queue / Delivery toggle (Delivery = "Coming soon — CC9" placeholder).
- Lane tabs with live counts; single-select filter pills with "Clear filters".
- Detail panel: tags, date, actions, Move to, Open in {source}, Delegate.
- Done / Drop / Reschedule actions in `task_lanes.action_status` (+ `rescheduled_date`). `synced_to_source` = true only for Airtable tasks; other sources show "not synced to source". No write-back to the source record (Airtable "Done" semantics per table were never defined; out of scope).
- Bulk actions (retag domain, reassign owner, push to next week) written to `task_lanes` overrides, never to `command_center_tasks`, per item with partial-failure reporting.
- Moving a task to On Fire shows in Today (same `task_lanes` store).

Changes this story makes to that behavior:

| Carlos's version | This story |
|---|---|
| Stale = past due + `last_updated_at` unchanged ≥ 2 days + no action, hard-coded in the page | `stale_state` from `cct-triage-compute.ts` and `cct_triage_configs` (4.3). The page hides the stale badge and the forced Done/Drop/Reschedule buttons when the user already took an action (`action_status` ≠ none), as Carlos's rule did |
| Filters: one value per dimension | Same pills, plus combined values, lane filter, "No domain" / "Unassigned" and validation (5.2) |
| Tasks without a `task_lanes` row appear only in "All" | Every task has a lane: manual or rule (5.1) |
| Owner as written by the source | `owner_canonical` (4.1); the raw owner stays visible in the detail panel |
| Bulk actions and Delegate not logged | Logged as `triage_action` |
| Missing fields → "Nothing matches these filters" with every count at 0 (the bug Carlos fixed by exposing fields in the Data panel) | Required-field check names the missing field (5.4) |
| Shows every row with `source_status` = ok, **including closed tasks** (`lifecycle` closed / not_returned: 691 rows on 2026-10-12 vs 146 open) | Only open tasks (`lifecycle` = open) |
| Hides tasks whose source is `stale` or `unavailable` | Shows them, with the partial banner (5.3) |
| Fields looked up by name (`getFieldIfExists('title')`), so a rename breaks the page silently | Field IDs, like Today (5.4) |
| Writes skipped silently without permission | Error shown and `triage_action` logged with `dependency_failed` |

## 6. Error handling

| Case | Behavior | Log |
|---|---|---|
| No active `cct_triage_configs` row, or more than one | Script stops before writing | `triage_data_issue`, `validation_failed` |
| A required field missing or renamed (script) | Script stops before writing; message names the field ID | `triage_data_issue`, `validation_failed` |
| A required field missing or hidden (page) | Page shows the field list instead of the triage list | Shown in the page |
| Invalid row (no `normalized_task_id`, no `source`, unparsable date) | Row skipped; others processed | `triage_data_issue` with record IDs |
| Invalid rows > `invalid_rows_max_pct` of open rows | Run writes nothing | `triage_data_issue`, `validation_failed` |
| Two `command_center_triages` rows for one task | Keep the oldest, update only that one; nothing deleted | `triage_data_issue` with both record IDs |
| Triage row whose task no longer exists | `row_status` = `orphan`; kept | Counted in `triage_compute` |
| New task without a triage row yet | Page shows it in `queued` (basis rule, `fallback`) and the partial banner says triage is pending | — |
| Owner without match | Raw owner kept, `owner_match` = `unmatched` | One `triage_data_issue` per run listing owners |
| Airtable write fails for a batch | Retry the batch once; then record by record; continue | `triage_compute` with failed IDs |
| Script exceeds time budget (30 s target, Airtable limit) | Stops after the batch in flight; next run continues | `triage_compute` status `dependency_failed` |
| Loom run partial / source unavailable | Page renders data with the partial banner | From `loom_sync_runs` |
| Invalid restored filter | Value dropped, page shows which | `triage_filter_invalid` |
| Write to `task_lanes` fails (page) | Change reverted in the page, error shown | `triage_action`, `dependency_failed` |
| AI enrichment failed in Loom | Not handled here: Loom writes fallback values (`Uncategorized`) | Loom's `loom_sync_runs` |

Idempotency: the script compares each computed value with the stored one and writes only differences (batches of 50). A second run with no data changes writes nothing. Rows are created only for tasks that have none. `computed_at` is therefore "values last changed at"; run freshness is the heartbeat `cct_triage_configs.last_run_at` / `last_run_status` / `last_run_summary`, stamped by every live run.

## 7. Security and performance

- Access: base and interface permissions in Airtable. `task_lanes` rows are per user; the page reads only the signed-in user's rows.
- Credentials: none in scripts or the extension. Source credentials live in Hyperagent's OAuth integrations (Loom only).
- No data is sent to AI by this story.
- Logs store IDs, counts, rule names and short reasons, not titles or descriptions.
- Size: about 150 open tasks and 700 total rows today. The script reads each table once per run; the page computes everything in memory.

## 8. Acceptance-criteria traceability

IDs refer to `acceptance-criteria-stack.md`. Status as of 2026-10-13, after implementation. Evidence for each criterion (tests, record IDs, screenshots) is in `evidence.md`.

| AC | Where | Status (2026-10-13) |
|---|---|---|
| F1 Filter by domain/owner/source, every task has a lane | 4.1, 4.2, 5.1, 5.2 | Met |
| F2 Five lane values | `task_lanes.lane`, `lane_suggested` | Met |
| F3 Combined filters across sources | 5.2 | Met |
| F4 Unified triage data | 5.1 | Met |
| F5 Configurable stale | 4.3, `cct_triage_configs` | Met (unit; live threshold change not run) |
| F6 Delegation eligibility | 4.4, `team_members` | Met |
| F7 Only matching tasks returned | 5.2 | Met |
| F8 Stale badge + reason | 5.1, UI | Met |
| F9 Delegate prompt | 4.4, UI | Met (suggestion path unit-tested; roster empty) |
| F10 Lane kept per user and identity | 5.1 (manual / rule) | Met |
| T1 Ingestion into a common contract | Loom (38532) | Met (38532) |
| T2 Field validation before use | 5.4, 6 | Met |
| T3 AI values separated | 5.1 (`ai`, provenance) | Met |
| T4 AI never overwrites source | Loom; decisions only in `task_lanes` | Met |
| T5 Stable contract | `schema.md`, 5.1, 5.2 | Met |
| T6 Filter validation | 5.2 | Met (unit; not run from a URL) |
| T7 Logging | 6, `priority_events` | Met |
| T8 Retries on transient failures | Loom (38532) | Met (38532) |
| T9 Deterministic stale | 4.3, unit tests | Met |
| D1 Minimum row fields | 5.1 | Met |
| D2 Traceability to source values | 4.1, 4.2 (`lane_rule`), 5.1 | Met |
| D3 Missing values | 4.1, 4.3, 5.2 (`__none__`) | Met (live empty-activity case: QA guide 1) |
| D4 Airtable retrieval | Loom (38532) | Met (38532) |
| D5 Minimal AI context | No AI in this story | N/A |
| D6 No duplicates across sources | 4.5 | Met |
| D7 Complete vs partial | 5.3 | Met (Loom partial not simulated) |
| D8 Source-of-record consistency | 2, `schema.md` writers | Met |
| E1 Missing filter attributes | 5.2 | Met |
| E2 Malformed records | 6 | Met |
| E3 Renamed/missing fields | 5.4, 6 | Met |
| E4 AI failure | Loom fallback | N/A |
| E5 Stale without activity → unknown | 4.3 | Met (unit; live case: QA guide 1) |
| E6 Ambiguous duplicates | 4.5 | Met |
| E7 Invalid filter | 5.2 | Met (unit; not run from a URL) |
| E8 Empty result | 5.2 | Met |
| S1 Access control | 7 | Met |
| S2 AI data minimization | No AI | N/A |
| S3 Credentials | 7 | Met |
| S4 Latency | 7 | Met |
| S5 Avoid repeated reads/writes | 6 (idempotency), 7 | Met |
| S6 Logs without task content | 7 | Met |

## 9. Test plan

### Unit (`node --test`, run locally)

| # | Test | Expected |
|---|---|---|
| U1 | Owner: exact, alias, accent/case variants, email, no match, two matches, empty | `matched` / `unmatched` / `empty` as defined in 4.1 |
| U2 | Lane: each rule in order; tag + due date (tag wins); due today; overdue; no due + 29/30 days inactive | Exact `lane_suggested` and `lane_rule` |
| U3 | Stale: excluded source; overdue 1/2 days; inactive 6/7 days; missing and invalid `last_updated_at` | Exact state and reason; never `stale` without data |
| U4 | Delegate: CEO owner, empty owner with flag on/off, `needs-max` tag, not schedulable, closed task; roster by domain; empty roster | Eligibility, reason and suggestion as in 4.4 |
| U5 | Identity: dev_ticket ↔ Linear; approval ↔ invoice; two counterparts; counterpart closed | `duplicate_candidate`, `ambiguous`, `unique` |
| U6 | Determinism: same input twice; config change | Same output; output follows the config |
| U7 | Contract: lane manual vs rule vs fallback; overrides; provenance | Row shape as in 5.1 |
| U8 | Filters: single, combined, `__none__`, unknown values, empty result | Exact rows; issues listed; empty list without error |
| U9 | Completeness: each reason alone and together | `partial` with the right reasons; `complete` otherwise |
| U10 | 1:1 upsert plan: new task, existing row, closed task, orphan row, two rows for one key | create / update / `closed` / `orphan` / keep oldest + issue; never delete |

### Automation (Airtable)

| # | Test | Expected |
|---|---|---|
| A1 | Run with `dryRun` = yes | Counts logged; 0 writes |
| A2 | Run live twice | Second run: 0 changes |
| A3 | Change `stale_inactive_days` 7 → 3, run | Stale count rises; reasons show the new limit; set back to 7 |
| A4 | Deactivate the config row, run | Run stops; `triage_data_issue`; no writes; reactivate |
| A5 | First live run | One `command_center_triages` row per task in `command_center_tasks`; second run creates 0 rows |

### End-to-end (Work · Queue)

| # | Test | Expected |
|---|---|---|
| E2E-1 | Filter domain + owner + source | Only matching tasks |
| E2E-2 | Task with no manual lane | Shown in `lane_suggested` with a "rule" badge |
| E2E-3 | Move a task to another lane | Badge changes to "manual"; Today and On Fire unaffected unless On Fire is involved |
| E2E-4 | Stale task; task without activity date | Badge with reason; `unknown` without a stale badge |
| E2E-5 | Accept "Delegate to X?" | `delegated_to` written; `triage_action` logged |
| E2E-6 | Simulate partial: latest Loom run `partial` (test row in a copy of the data, or wait for a real one) | Partial banner names the reason |
| E2E-7 | Hide a required field from the page | Message naming the field |
| E2E-8 | Filter with no results | Empty state, no error |
| E2E-9 | Duplicate candidate pair | Grouped and marked, both visible |
| R1 | Regression 38570 | Today: top 3, Needs-You, Power Hour unchanged |
| R2 | Regression Work · Queue (5.5) | Detail panel, Done/Drop/Reschedule with "not synced to source", bulk retag/reassign/push, Delivery placeholder and On Fire → Today all still work |

Results (2026-10-13): unit 64 of 64 pass (`npm run cct:test`); automation A1, A2 and A5 pass (dry run, live load, idempotent third run with 0 writes; A3 and A4 not run live); end to end 20 of 20 pass in the QA report v7 (E2E-1 to E2E-5, E2E-7 to E2E-9, R1, R2; E2E-6 only partly, see `evidence.md`). Evidence for SS ("delivery", one per criterion group) is prepared in `ss-drafts.md` and posted only after Andrés reviews each item.

## 10. Out of scope and open items

- **D1–D3 (Max):** thresholds, default-lane rules, delegation roster. Defaults in `cct_triage_configs`; changes need no code.
- **Roster (D3, Max):** `team_members` has no delegation roster yet, so "Delegate to someone else?" shows a free-text field and no suggested person. Names, emails and domains per person are pending.
- **Test data in production (F4 of the QA report):** three `TEST - QA 38571 · …` tasks in `command_center_tasks` (source Manual, "SAFE TO DELETE") with their `task_lanes` rows, kept on purpose for regression until QA accepts the story. `priority_events` is append-only, so the test events stay.
- **D4 (Max / Andrés):** resolved 2026-10-13 in `team_members`: Max Hanratty (`max@mapking.ai`) is the CEO row. 70 tasks have no owner, so `delegate_empty_owner_is_ceo` stays on. Max is to confirm that he also appears under other names or emails.
- **D5 (Andrés):** the 18 test rows in `task_lanes` (Carlos / Andrés). Kept; they are per user and do not affect Max.
- **Write-back of Done / Drop / Reschedule to the sources:** out of scope. Loom is read-only against Attio, Linear and Calendar by design; Airtable write-back semantics were never defined (see the 2026-09-17 docx).
- **Work · Delivery tab (CC9):** a separate story.
- **Two values set by Claude, pending Andrés's OK:** invalid-row threshold 10 %, triage freshness 2 hours.

---

## 11. As built (2026-10-13)

### 11.1 Components delivered

| Component | What | Where |
|---|---|---|
| Rules module | Pure functions: owner, lane, stale, delegate, identity, config and task validation | `airtable/cct/cct-triage-rules.ts` |
| Sync planner | Pure 1:1 upsert plan: create, update, closed, orphan, duplicate guard | `airtable/cct/cct-triage-sync.ts` |
| Automation script | `command_center_triages · compute · hourly` (id `wflFoOYmzWHZEcHPA`), input `dryRun` (anything but `no` is a dry run); batches of 50, writes only differences, heartbeat in `cct_triage_configs` | `airtable/cct/automations/cct-triage-compute.ts` (+ `cct-triage-compute.config.json`) |
| Build | Inlines the pure modules into the pasteable script and the page | `airtable/cct/tools/cct-build.ts` → `airtable/cct/dist/` (git-ignored) |
| Triage contract | Pure: triage rows, lane basis, filters and validation, completeness, required fields, identity groups | `airtable/cct/interfaces/cct-triage-contract.ts` |
| Page | Work · Queue custom component | `airtable/cct/interfaces/WorkQueuePage.tsx` |
| Tables | `cct_triage_configs`, `team_members`, `command_center_triages` (IDs in `schema.md`) | Airtable |
| Tests | 64 tests: rules 13, sync 10, compute smoke 4 (runs the generated JS against a simulated base), contract 37 | `airtable/cct/tests/` |
| Scripts | `npm run cct:build`, `npm run cct:test`, `npm run typecheck:dist` (`tsconfig.dist.json`) | `package.json` |

### 11.2 Page behavior as built

- **Data:** open tasks only (`lifecycle` = open), from every source, joined with `command_center_triages` by `normalized_task_id` and the signed-in user's `task_lanes` rows.
- **Lanes:** tabs All / On Fire / This Week / Waiting On / Queued / Icebox with live counts. A task shows MANUAL LANE (the user's `task_lanes` row) or SUGGESTED (rule lane); with no triage row yet it falls back to Queued.
- **Filters:** pills for domain, owner and source; OR inside a dimension, AND across; "No domain" and "Unassigned"; "Clear filters"; empty state "Nothing matches these filters".
- **Badges:** AI category (provenance marker), DELEGABLE, DELEGATED · name, POSSIBLE DUPLICATE, AMBIGUOUS MATCH, "Stale · reason" (hidden when the state is `unknown` or `excluded`, and when the user already took an action), and action tags such as "done · local only", "dropped · local only" and "rescheduled · local only" for sources without write-back.
- **Banner:** "This list may be incomplete or out of date" with one line per reason (Loom run not clean, source unavailable, triage pending or older than 2 hours).
- **Detail panel:** tags, due date, raw owner, lane and basis, stale reason, Done / Drop / +7d, Move to…, Open in source, Delegate.
- **Bulk:** select tasks, then Retag domain (select), Reassign owner (prompt) or Push to next week; per item, with partial-failure reporting.
- **Required fields:** if any field the page uses is missing or hidden, the page lists each as `table.field (id)` and does not render the list.

### 11.3 Events written by the page (`priority_events`, source `extension`, status `ok`)

| Action | `event_type` | Summary | Message |
|---|---|---|---|
| Move to lane | `triage_action` | `move · <task> → <lane>` | `Lane <old> (<manual or rule>) → <new>` |
| Delegate | `triage_action` | `delegate · <task> → <name>` | `Delegated to <name> (no suggestion)` |
| Done / Drop | `triage_action` | `done · <task>` / `dropped · <task>` | `Action none → done; local only, not synced to source` |
| +7d | `triage_action` | `rescheduled +7d · <task> → <date>` | `Action none → rescheduled; pushed to <date>; local only, not synced to source` |
| Bulk retag / reassign / push | `triage_action` | `bulk <op> · <ok> of <total>` | `<op>: <n> written, <m> failed` |
| Invalid filter | `triage_filter_invalid` | Dropped parameter and value | Reason |

The automation writes `triage_compute` (run summary) and `triage_data_issue`.

### 11.4 Airtable configuration the page needs

1. **Data panel, every field the page reads.** The component reads six tables (`command_center_tasks`, `task_lanes`, `command_center_triages`, `loom_sync_runs`, `cct_triage_configs`, `priority_events`). Besides the fields it uses, the Airtable SDK requires the **primary field of each of the six tables** to be exposed: `command_center_tasks.normalized_task_id`, `task_lanes.rank_id`, `command_center_triages.normalized_task_id`, `loom_sync_runs.run_id`, `cct_triage_configs.name`, `priority_events.summary`. Without them the first write or the first render fails with "No field with ID … in table …". The required-field message of 5.4 lists anything missing.
2. **User actions.** "Edit records inline" and "Add records inline" must be **ON**. For a custom component these toggles grant the SDK write permission: with them OFF, `hasPermissionToUpdateRecords()` / `hasPermissionToCreateRecords()` return false, actions fail with "No permission to update task_lanes" (bulk: "N of N items failed…") and no event is written. "Delete records inline" is not used by Work · Queue and may stay OFF; "Click into record details" OFF.
3. **Automation.** Enable `command_center_triages · compute · hourly` with `dryRun = no` (verified: dry run 837 to create, 0 errors; live load 837 created; third run 0 writes).
4. **Publish** the interface after any of the above (the designer preview does not change the published page).

### 11.5 Differences from the 1.1 design

| Topic | 1.1 | As built | Why |
|---|---|---|---|
| Done / Drop / +7d events | Not specified (only move, delegate, bulk) | Each writes a `triage_action` event (11.3) | QA run 1 found that Carlos's actions were not logged; the AC asks for logging |
| Required fields | "Same pattern as Today" | Message lists `table.field (id)` and hides the list | Verified by hiding fields in the designer (QA report test 20) |
| Primary fields and User actions | Not known | Requirements in 11.4 | Found during testing: SDK constraints, not in the AC |
| Stale `excluded` | Fourth state | Unchanged; the badge is hidden for it | — |
| Completeness freshness | Heartbeat | `cct_triage_configs.last_run_at` / `last_run_status`; older than 2 hours counts as not computed | Because `computed_at` only changes when values change (6) |

### 11.6 Known limits

- No write-back of Done / Drop / Reschedule to Attio, Linear or Calendar (Loom is read-only against them; Airtable write-back semantics were never defined). `synced_to_source` is true only for source Airtable, and the page says "local only" otherwise.
- Delegation suggests no person until the roster in `team_members` is filled in (D3).
- Work · Delivery is a placeholder (CC9).
- UI tests are screenshot-based: the component runs in a cross-origin iframe, so DOM tools cannot read it.

### 11.7 Before sending to QA

1. Push the commits (automation and config; contract and tests; page, build and `package.json`; docs).
2. Enable the automation with `dryRun = no`.
3. Keep the User actions as in 11.4 (Edit and Add ON) and the interface published.
4. Review `ss-drafts.md` with the developer before anything is written in Singular Studio or `send-to-qa` is called.
