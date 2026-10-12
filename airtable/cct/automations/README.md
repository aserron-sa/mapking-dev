# Command Center automations — MapKMigGon38570

Airtable automation scripts for the daily priority list (Today). Base **Map King Hub** (`appcdpGNTo0DouoqJ`). Field and table IDs are in `docs/38570/schema.md`.

Airtable's API cannot create or edit a "Run a script" step, so each script is pasted by hand into the automation. This folder is the source of truth: change the file here first, then paste it again.

| Script | Automation(s) | Trigger | Input variables |
|---|---|---|---|
| `task_lanes-integrity.js` | **A.** `task_lanes · integrity · on create` (`wflzX39Z0Wl4xQLel`) | When a record is created in `task_lanes` | `recordId` = trigger record ID |
| | **B.** `task_lanes · integrity · on update` (`wflvV2l7S9rBYzVFS`) | When a record is updated in `task_lanes`, watching `lane`, `rank_position`, `user`, `task` | `recordId` = trigger record ID |
| `needs-you-backfill.js` | `command_center_tasks · needs-you backfill (one-time)` (`wflwiT6PlijHTwYkM`) — run once on 2026-10-12 (7 tasks dated `estimated`); keep **off** with `dryRun = yes` | At a scheduled time (never fires while off) | `dryRun` = `yes` / `no` (typed text) |
| `needs-you-waiting-since.js` | **C.** `command_center_tasks · needs-you waiting_since · hourly` (`wflVp0Z1DfU0JtHSW`) | At a scheduled time, every hour | none |

## What each one guarantees

- **Integrity (A, B):** one `task_lanes` row per user and task; at most 3 `on_fire` rows per user; ranks 1..n with no duplicates or gaps; rank cleared outside `on_fire`. The newcomer over the cap goes to `this_week`; rows are never deleted except duplicates. Every correction is logged to `priority_events` (`dedupe` / `guard_fix`, source `automation`). Idempotent: its own writes re-trigger B and end in a no-op.
- **waiting_since (C):** stamps `waiting_since` and `waiting_since_basis` when a task first gets a Needs-You signal, keeps it while any signal remains, clears it when none remain. A future `waiting_since` is logged as `needs_you_data_issue`.
- **Backfill:** dates tasks that were already waiting when the feature shipped: `estimated` from `last_updated_at`, or `manual` from the mark time.

The Today extension validates before writing (it rejects a 4th fire without a demote). These automations are the safety net for writes from any other surface (Work Queue, grid edits, concurrent tabs), which is how the AC's "compensating logic" and "concurrent ranking updates" requirements are met in Airtable.

## Setup order

1. Create automations **A** and **B** with `task_lanes-integrity.js`. Map the input `recordId` to the trigger's *Airtable record ID*. Test each with an existing row (it should end in `done` and write nothing if the state is valid). Turn both on.
2. Run `needs-you-backfill.js` once with `dryRun = yes`, check the counts, then once with `dryRun = no`.
3. Create automation **C** with `needs-you-waiting-since.js` (every hour). Test once: `stamped` and `cleared` should be 0 right after the backfill. Turn it on.
4. Record the automation IDs (`wfl…`) in `docs/38570/schema.md`.

## Notes

- Scripts run as the automation owner; logs show `source = automation` in `priority_events`.
- `first_seen` precision = Loom's sync (daily schedule + manual syncs) plus up to 1 hour for C.
- The duplicate guard on `command_center_tasks` (`wfletTuP3cF7pZjWV`, Loom) is unrelated and stays on.
