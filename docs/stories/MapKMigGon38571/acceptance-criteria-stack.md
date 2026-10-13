# MapKMigGon38571 — Acceptance criteria, stack reading

| | |
|---|---|
| Story | MapKMigGon38571 · Triage lanes by domain, owner and source |
| Version | 1.1 · 2026-10-12 · triage output in its own table `command_center_triages` (1:1) |
| Source | AC text in Singular Stories (open implementation) |
| Stack | Airtable (base Map King Hub, `appcdpGNTo0DouoqJ`) + Hyperagent agents. "Backend" = Airtable tables, fields, automations and the Loom agent. "Triage view" = the Airtable interface **Work · Queue** (custom extension) |
| Plan | `implementation-plan.md` v2 |

## How to read this document

The original AC is written for a generic backend service with a request/response API. On this stack there is no separate service:

- **Ingestion and normalization** already exist: Loom reads Attio, Linear, Google Calendar and Airtable tables, and writes one row per task to `command_center_tasks` (story MapKMigGon38532).
- **The triage contract** is the Airtable schema (documented fields) plus a pure module in the Work · Queue extension (`cct-triage-contract.ts`) that builds the triage row the page shows.
- **Configurable rules** live in Airtable tables (`cct_triage_configs`, `team_members`) and are applied by an hourly automation script (`cct-triage-compute.ts`) built on a tested rules module (`cct-triage-rules.ts`).
- **"Request" / "response"** become: the filter state the user sets in Work · Queue, and the set of triage rows the page renders.
- **No new AI** is introduced. The only AI values are the ones Loom already writes (`category`, `tags`, `schedulable`).

Each criterion below keeps the original order. Tags: **[Kept]** same meaning, made concrete. **[Reinterpreted]** same intent, different mechanism. **[Covered by 38532]** already delivered by Loom. **[N/A]** does not apply on this stack, with the reason.

---

## Functional Requirements

1. **[Kept]** Every open task in `command_center_tasks` can be filtered in Work · Queue by **domain**, **owner** and **source**, and has a lane. Domain = the user's `domain_override` in `task_lanes` if set, else Loom's `domain_tag`. Owner = the user's `owner_override` if set, else `owner_canonical`. Source = `source`.
2. **[Kept]** Lane values are exactly `on_fire`, `this_week`, `waiting_on`, `queued`, `icebox` (shown as On Fire, This Week, Waiting On, Queued, Icebox).
3. **[Kept]** Work · Queue filters by any single dimension or any combination of domain, owner, source and lane, across all sources Loom syncs (Attio, Linear, Google Calendar, Airtable).
4. **[Reinterpreted]** The unified triage data is `command_center_tasks` (one normalized row per source task, maintained by Loom) plus its 1:1 triage row in `command_center_triages` (written by `cct-triage-compute.ts`), plus the signed-in user's decisions in `task_lanes`. The page builds one triage row per task with the same shape regardless of source.
5. **[Reinterpreted]** Stale is computed by `cct-triage-compute.ts` from thresholds in `cct_triage_configs` and written to `command_center_triages.stale_state` (`stale` / `fresh` / `unknown`) and `stale_reason`. Changing a threshold in `cct_triage_configs` changes the result on the next hourly run, with no code change.
6. **[Reinterpreted]** Delegation eligibility is computed by `cct-triage-compute.ts` from the rule in `cct_triage_configs` and the roster in `team_members`, and written to `command_center_triages` (`delegate_eligible`, `delegate_reason` and `delegate_suggested_to`).
7. **[Kept]** Given filters for domain, owner, source and/or lane, Work · Queue shows only the tasks that match every active filter.
8. **[Kept]** Given a task with `stale_state` = `stale`, Work · Queue shows it with a stale badge and its `stale_reason`.
9. **[Kept]** Given a task with `delegate_eligible` = true, Work · Queue shows a "Delegate to …?" prompt, using `delegate_suggested_to` when there is one. Accepting writes `delegated_to` in the user's `task_lanes` row and logs a `triage_action` event.
10. **[Reinterpreted]** Lane membership is kept per user and per normalized task identity (`normalized_task_id`), whatever the source:
    - **Manual lane:** the user's `task_lanes` row, when one exists (basis `manual`).
    - **Rule lane:** otherwise `lane_suggested` (basis `rule`). The rule never assigns `on_fire`; On Fire stays manual and capped at 3 (story 38570).
    - Loom re-syncs never change a manual lane, because Loom does not write `task_lanes`.

## Technical Implementation

1. **[Covered by 38532]** Ingestion from Airtable tables, Attio, Linear and Google Calendar into a common task shape is done by Loom into `command_center_tasks`. This story does not re-ingest sources.
2. **[Reinterpreted]** Field-mapping validation happens in two places:
   - **Work · Queue** checks on load that every field it needs (domain, owner, source, lane, last activity, identity, triage fields) exists and is visible to the extension. If one is missing, the page shows which field and does not render partial data as complete.
   - **`cct-triage-compute.ts`** checks its fields and config before writing. If something is missing, it stops and logs `triage_data_issue`.
3. **[Reinterpreted]** No new AI is used to infer metadata. The existing AI values from Loom (`category`, `tags`, `schedulable`) are shown in Work · Queue with an "AI" marker, separate from source values (title, status, owner, due date, link) and from the user's overrides.
4. **[Reinterpreted]** AI values never overwrite source values: Loom writes AI output only to its own AI fields. User decisions (lane, domain or owner override, delegation) are stored only in `task_lanes`, never in `command_center_tasks`, so a Loom sync cannot overwrite them and they never overwrite source data.
5. **[Reinterpreted]** The stable contract is documented in `docs/stories/MapKMigGon38571/schema.md`:
   - field IDs and allowed values for domain, owner, source, lane, `stale_state`, `delegate_*` and `identity_*`;
   - the triage row shape produced by `cct-triage-contract.ts`.

   Field IDs are used everywhere, so renaming a field in Airtable does not break anything.
6. **[Reinterpreted]** Filter options come from closed lists, so an unsupported value cannot be entered from the UI. Values restored from saved page state or a URL are validated by `cct-triage-contract.ts`: an unknown lane, domain, source or owner is dropped, the user sees which filter was ignored, and a `triage_filter_invalid` event is logged.
7. **[Reinterpreted]** Logging:
   - **Ingestion and source failures:** `loom_sync_runs`, written by Loom.
   - **Mapping and data issues:** `priority_events` (`triage_data_issue`), e.g. owner not in `team_members`, invalid date, missing config.
   - **Triage runs:** `priority_events` (`triage_compute`, with counts).
   - **Partial results:** shown in the page and taken from `loom_sync_runs` and `source_status`.
   - **AI inference failures:** Loom (fallback values, `fallback_ids` in `loom_sync_runs`).
8. **[Covered by 38532]** Retries on transient source failures are done by Loom (rate-limit retries; a failed source is marked `unavailable` and the run is partial). Work · Queue and `cct-triage-compute.ts` read Airtable natively and do not call external sources.
9. **[Kept]** Stale detection is deterministic: same inputs and config give the same result, with no AI involved. Covered by unit tests on `cct-triage-rules.ts`.

## Data & Integration Requirements

1. **[Reinterpreted]** Each triage row contains:
   - task identifier (`normalized_task_id`), title, source and source link;
   - domain, owner, lane and lane basis (manual / rule);
   - last activity (`last_updated_at`), when available;
   - `stale_state` and `stale_reason`;
   - `delegate_eligible`, `delegate_reason` and `delegate_suggested_to`;
   - `identity_key` and `identity_status`;
   - provenance markers (source / AI / user override).
2. **[Kept]** Canonical values keep traceability:
   - `status_raw`, `owner` (raw), `source_record_id` and `source_url` stay next to the canonical values;
   - `owner_canonical` comes from `team_members` and keeps the raw owner, with `owner_match` = matched / unmatched / empty;
   - `lane_rule` says which rule assigned a rule lane.
3. **[Kept]** Missing values:
   - **Domain:** always set by Loom per source. If empty, the task shows under "No domain" and matches no domain filter.
   - **Owner:** if empty, `owner_canonical` is empty, `owner_match` = `empty`, the task shows under "Unassigned", and it matches only the "Unassigned" owner filter.
   - **Source:** always set; a row without a source is skipped and logged.
   - **Last activity:** if missing or invalid, `stale_state` = `unknown`. It is never treated as stale.
4. **[Covered by 38532]** Airtable record retrieval and field extraction from the source tables (approvals, follow_ups, ticket_candidates, dev_tickets, invoices) is done by Loom.
5. **[N/A]** No AI is called by this story, so there is no task context sent to AI. Loom's existing enrichment is out of scope and documented in 38532.
6. **[Reinterpreted]** Cross-source duplicates are flagged by `cct-triage-compute.ts` using documented identity rules:
   - a `dev_tickets` row whose `linear_issue_id` matches an open Linear task;
   - an approval and the invoice or follow-up it references.

   Matches get the same `identity_key` and `identity_status` = `duplicate_candidate`, and Work · Queue groups them so the task is not shown twice as separate work.
7. **[Reinterpreted]** Completeness: Work · Queue shows a "Partial results" banner, naming the affected source, when any of these is true:
   - the latest `loom_sync_runs` row is `partial` or `failure`;
   - any shown row has `source_status` = `unavailable`;
   - the last triage computation is older than 2 hours.

   Otherwise the results count as complete.
8. **[Reinterpreted]** Where each decision is stored:
   - **Manual lanes and overrides:** `task_lanes`, per user. This is the source of record for decisions.
   - **Stale flags, delegate eligibility and suggested lanes:** `command_center_triages` (one row per task), written only by `cct-triage-compute.ts`.
   - **Source data:** written only by Loom.
   - **Never written back to the source systems** (Attio, Linear, Calendar): Loom is read-only there by design.

## Edge Cases & Error Handling

1. **[Kept]** Tasks missing a filter attribute are still shown:
   - with no filter, they appear in their lane;
   - they appear under the explicit "No domain" or "Unassigned" option;
   - they are excluded from filters for a specific value.
2. **[Reinterpreted]** Malformed rows are skipped by `cct-triage-compute.ts`, without stopping the run: no `normalized_task_id`, no source, or a date it cannot parse. Each one is logged as `triage_data_issue`. If more than 10% of open rows are invalid, the run writes nothing and logs one `triage_data_issue` with status `validation_failed`.
3. **[Kept]** If a required field is renamed, deleted or hidden from the extension:
   - Work · Queue shows a clear message naming the field instead of an empty or partial list;
   - `cct-triage-compute.ts` stops and logs the field ID.
4. **[N/A]** There is no AI inference in this story. If Loom's enrichment fails, Loom already writes fallback values and the task is still shown.
5. **[Kept]** Without activity data, `stale_state` = `unknown` with reason "No activity date". It is never inferred.
6. **[Kept]** Duplicates that cannot be resolved with confidence (more than one match) get `identity_status` = `ambiguous`. No rows are merged or deleted, and each row keeps its source link.
7. **[Reinterpreted]** An invalid filter (see Technical Implementation 6) is dropped. The page names the invalid parameter and value, and an event is logged. No error page is shown.
8. **[Kept]** A valid filter with no matches shows an empty state ("Nothing matches these filters" plus "Clear filters"), not an error.

## Security & Performance

1. **[Reinterpreted]** Access control:
   - access to Work · Queue and the base is controlled by Airtable's base and interface permissions;
   - lane decisions are stored per user (`task_lanes.user`), and the page reads only the signed-in user's rows.
2. **[N/A]** No task data is sent to AI by this story.
3. **[Kept]** Credentials:
   - source credentials live in Hyperagent's OAuth integrations, used only by Loom;
   - the extension and automation scripts run inside Airtable and hold no credentials.
4. **[Kept]** Performance:
   - Work · Queue renders the open task set (about 150 tasks today) in memory with no extra network calls;
   - filtering is instant;
   - nothing in the page depends on AI response time.
5. **[Kept]** Reads and writes:
   - `cct-triage-compute.ts` reads each table once per run and writes only fields whose value changed, in batches of 50, so a second run with no data changes writes nothing;
   - the page uses Airtable's live record queries, with no polling.
6. **[Kept]** Logs avoid task content:
   - `priority_events` stores IDs, counts, rule names and short reasons;
   - it does not store titles or descriptions beyond the existing `summary` convention (task ID plus action).

---

## Summary of changes against the original AC

| Original idea | On this stack |
|---|---|
| Backend service with a request/response API | Airtable schema + `cct-triage-compute.ts` + `cct-triage-contract.ts` in Work · Queue |
| Ingestion and normalization | Already done by Loom (38532) |
| AI inference of missing metadata | Not used; existing Loom AI fields are labeled as AI |
| Structured error responses | Field-level messages in the page + `priority_events` |
| Retry policy | Loom (sources); not applicable to native Airtable reads |
| Lane assignment for every task | Manual lane in `task_lanes`, or `lane_suggested` computed by rule |
| Configurable rules | `cct_triage_configs` and `team_members` tables |
| Complete vs partial response | Banner from `loom_sync_runs`, `source_status` and triage freshness |

## Open items that change wording, not structure

- **Thresholds and rules:** pending Max (D1–D3). The AC states that they are configurable; the defaults are in `implementation-plan.md`.
- **Max's identity in the sources:** pending (D4). It affects only the delegation rule.
