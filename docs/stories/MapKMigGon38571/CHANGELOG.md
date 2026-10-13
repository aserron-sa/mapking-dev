# MapKMigGon38571 — Changelog

Story: Triage lanes by domain, owner and source (Work · Queue). Sprint 4, closes 2026-10-20. Format: newest first; one entry per document or build version. Dates are 2026 (YYYY-MM-DD).

## 2.0 — 2026-10-13 · Implemented and verified (as built)

### Added

- **Triage output table** `command_center_triages` (1:1 with `command_center_tasks`), written only by the hourly automation. Fields: owner canonical and match, stale state and reason, delegation eligibility and suggestion, suggested lane and rule, cross-source identity, `computed_at`.
- **Configuration tables** `cct_triage_configs` (one active row of thresholds, plus run heartbeat) and `team_members` (canonical names, aliases, email, CEO flag, delegation roster by domain). Max Hanratty (`max@mapking.ai`) loaded as CEO (D4).
- **Rules module** `cct-triage-rules.ts`: owner matching, lane suggestion, deterministic stale (stale / fresh / unknown / excluded), delegation eligibility and suggestion, cross-source identity (duplicate candidate / ambiguous / unique).
- **Hourly automation** `command_center_triages · compute · hourly` (`cct-triage-compute.ts`, id `wflFoOYmzWHZEcHPA`): dry-run mode, batches of 50, writes only differences, retries, never deletes, logs to `priority_events`, stamps a heartbeat. Verified: dry run 837 to create, 0 errors; live load 837 created; third run 0 writes.
- **Triage contract** `cct-triage-contract.ts`: triage rows with lane basis (manual / rule / fallback), field provenance, multi-value filters with validation and `__none__`, completeness (Loom run, unavailable sources, triage pending or older than 2 hours), required-field check, identity groups.
- **Work · Queue page rewritten** on the contract: open tasks only, lane tabs with live counts, manual vs suggested lane, stale badge with reason, delegation prompt, provenance markers, duplicate and ambiguous-match badges, incomplete-data banner, filters with "No domain" and "Unassigned", empty state, required-field message.
- **Event logging for every action:** Move, Delegate, bulk retag / reassign / push (as before for Move and Delegate; bulk and Delegate were not logged in the 2026-09-17 version) and, new in this version, **Done, Drop and +7d** (`triage_action`, source `extension`).
- **Build and tests:** `npm run cct:build` (pure modules inlined into the pasteable script and page, output in git-ignored `airtable/cct/dist/`), `npm run cct:test` (64 tests: rules 13, sync 10, compute smoke 4, contract 37), `npm run typecheck:dist` with `tsconfig.dist.json`.
- **Documents:** `spec.md` 2.0, `evidence.md` (every AC with its proof), `qa-guide.md` (step by step for QA), this changelog, QA report v7 (PDF with screenshots).

### Changed

- **Behavior versus the 2026-09-17 page (Carlos Olivares):** only open tasks are shown (the old page showed closed tasks too: 691 vs 146 open on 2026-10-12); tasks from sources that are `stale` or `unavailable` are shown with the partial banner instead of hidden; every task has a lane (manual or rule) instead of appearing only in "All"; stale comes from `cct_triage_configs` instead of being hard-coded; fields are looked up by ID instead of name; a write failure shows an error and logs the event.
- **Completeness freshness** uses the heartbeat `cct_triage_configs.last_run_at` / `last_run_status` (older than 2 hours counts as not computed) because `computed_at` only changes when values change.

### Fixed (found during QA runs, 2026-10-13)

- **"No field with ID … in table …" alert on Move** and a render crash: the Airtable SDK requires the primary field of every table the component reads to be exposed in the Data panel. Exposed for `task_lanes.rank_id`, `cct_triage_configs.name`, `command_center_triages.normalized_task_id` and `loom_sync_runs.run_id`.
- **Done, Drop and +7d left no event:** each now writes a `triage_action` event with the previous and new status, the target date for +7d, and whether the action was synced to the source.
- **Detail panel crash** after the first fix of the Move bug (QA report test 6).
- **Writes failing after the User actions toggles were switched OFF:** "Edit records inline" and "Add records inline" grant the SDK write permission to a custom component and must be ON (documented in the spec, 11.4). With them ON, writes and events work again.

### Verification

- Unit tests 64 of 64; automation A1, A2, A5; end to end 20 of 20 in QA report v7 (3 runs on the published page plus the designer preview, with server-side checks of every write).
- Required-field message verified by hiding fields in the designer preview and restoring them.
- Not covered: simulated partial Loom run, live open task with an empty last-activity date (unit-tested; procedure in `qa-guide.md`), automation tests A3 (threshold change) and A4 (inactive config).

### Data left in production

- Three `TEST - QA 38571 · …` tasks in `command_center_tasks` (source Manual, "SAFE TO DELETE") and their `task_lanes` rows, kept for regression until QA accepts the story. Test events in `priority_events` stay (append-only).
- Reverted on 2026-10-13: lane row of task `attio:d7507ef4…` back to `on_fire`; lane row of the VISIT Milwaukee task `attio:de31c6ef…` emptied (lane, action, date and delegate cleared; the empty row remains).

### Known limits

- No write-back of Done / Drop / Reschedule to Attio, Linear or Calendar; shown as "local only".
- No delegation suggestion until the roster is filled in (D3, pending with Max).
- Work · Delivery is a placeholder (CC9).

---

## 1.1 — 2026-10-12 · Design (spec and plan)

### Changed

- Triage output moved to its own table `command_center_triages` (one writer per table) instead of new fields in `command_center_tasks`.
- Rules computed by an hourly automation script instead of Airtable formulas (a formula cannot read `cct_triage_configs`).
- Rule lane as `lane_suggested` instead of creating `task_lanes` rows; `task_lanes` keeps only user decisions and is unchanged.
- Estimate 29.5 h → 26 h (`implementation-plan.md` 2.2).

### Added

- `spec.md`, `schema.md`, `acceptance-criteria-stack.md` (41 criteria: 8 met, 3 N/A, 10 partial, 19 planned, 1 unverified at that date), `implementation-plan.md`.

## 1.0 — 2026-09-17 · Original Work · Queue (Carlos Olivares)

- Work · Queue page and docx "Work · Queue (Triage por Lanes)" written against CC4: lane tabs, single-select filters, stale badge hard-coded in the page, Done / Drop / Reschedule into `task_lanes`, bulk retag / reassign / push, Delivery placeholder. Source recovered into the repo on 2026-10-12.
- QA report 2026-09-18 (Gonzalo Ranieri): combined filter confirmed; last-activity default not confirmed; records older than 7 days not flagged stale. The last point is fixed in 2.0.
