# SOC 2 evidence automations — MapMigGon37539 / MapKMigGon39261

One Airtable "Run a script" script for SOC 2 evidence capture, pasted identically into 5 automations. Base **Map King Hub** (`appcdpGNTo0DouoqJ`). Field and table IDs: `airtable/soc2/schema/tables.md` (soc2_ tables) and `schema/sources.md` (sources).

| File | What |
|---|---|
| `soc2-capture.ts` | The entry (source of truth). Exports `main(env)`; runs it by itself only when the global `base` exists |
| `../dist/automations/soc2-capture.js` | The built file you paste (git-ignored; rebuild before pasting, never edit by hand) |
| `../dist/automations/soc2-capture.compact.js` | Same code without comments (`node airtable/soc2/tools/soc2-build.ts --compact`). Paste it only if Airtable rejects or truncates the full file (review R8) |

## Build and paste

Airtable only accepts one self-contained JavaScript file per script step, so the build inlines `soc2-evidence-contract.ts` + `soc2-registry.ts` + `soc2-evidence.ts` + `automations/soc2-capture.ts` and strips the TypeScript types.

```
npm run soc2:test     # 4 test files; the last one (smoke) also builds and runs the built file
npm run soc2:build    # same as: node airtable/soc2/tools/soc2-build.ts
```

Then open `airtable/soc2/dist/automations/soc2-capture.js`, copy all of it and paste it as the code of the "Run a script" action of each automation below (replace what was there). The header of the built file lists the source files with their SHA-256: after a change in the repo, rebuild and paste again in all 5.

## The 5 automations

Input variables are typed text. `dryRun`: `yes` (default; anything but `no` counts as yes; `no` is not case sensitive and surrounding spaces are ignored, so `No` and ` NO ` also run live) evaluates everything and writes no evidence, but the run row is still created in `soc2_capture_runs` with `dry_run` checked. `no` writes and confirms evidence for the event types in `enabled`; types in `trace` are only logged in `soc2_capture_runs.trace`.

| # | Automation | Trigger | Input variables |
|---|---|---|---|
| 1 | `soc2 · capture · loom_sync_runs created` | Record created in `loom_sync_runs` | `mode` = `record`, `tableId` = `tblLnaOIEzNbIWp9S`, `recordId` = trigger record ID, `dryRun` = `yes` |
| 2 | `soc2 · capture · loom_sync_runs terminal` | Record matches `status` in success, partial, failure, abandoned | same as 1 |
| 3 | `soc2 · capture · ingestion_runs` | Record matches `run_status` is not empty. Check that it also fires when a replacement changes `run_at`; if not, the hourly run covers it (it watches `last_modified`) | `mode` = `record`, `tableId` = `tbl2EiVoOt6fEAId6`, `recordId` = trigger record ID, `dryRun` = `yes` |
| 4 | `soc2 · capture · priority_events` | Record created, with `source` = automation | `mode` = `record`, `tableId` = `tbl0k4YFnduwhMJG2`, `recordId` = trigger record ID, `dryRun` = `yes` |
| 5 | `soc2 · capture · hourly` | At a scheduled time, every hour | `mode` = `hourly`, `dryRun` = `yes` |

Start every automation with `dryRun = yes`. Switching to `no` is a decision in the log (gate G3, one event type or group at a time).

Output of every run: `result` (`success`, `partial`, `failure` or `locked`), `captured`, `existing`, `traced`, `skipped`, `failed`, `message`. The message ends with `queries <n> · timers: yes|no`: `timers: no` means the runtime has no `setTimeout` and retry waits spin on the clock (review R5).

If the `mode` variable is missing, the run ends in `failure` with only the output (no `soc2_capture_runs` row): check that every variable of the table is set.

## What a run does

Order and rules: `stories/MapMigGon37539/execution-spec.md` §2.7 (the header of `soc2-capture.ts` has the same list).

- Checks every field ID it uses first. A missing field ends the run in `failure` with `config_issues` = `missing_field:<id>` and no evidence.
- Hourly: a `soc2_capture_runs` row in `running` (mode hourly) younger than 30 minutes means `result = locked` and nothing is written. An older one is marked `abandoned` and the run goes on.
- Reads the catalog (with `status_changed_at`), the source rows (record mode: that row; hourly: rows of the last 48 hours, except those stamped in the last 10 minutes, which belong to the record trigger) and `soc2_events` (only `event_key`, `recorded_at` and `confirmed`).
- An occurrence of an `enabled` type produced before the type's `status_changed_at` is skipped with reason `before_enabled`: switching `paused` or `trace` back to `enabled` never backfills (D1 is met this way; there is no go-live constant to edit).
- Writes evidence in batches of 50 with bounded retries (1 s, 2 s, 4 s; a validation error is never retried; before retrying a create after a timeout or 5xx it re-reads `event_key` and drops what is already stored), re-reads what it wrote and sets `confirmed` only if the re-read matches. A key that already exists is never written again.
- Just before confirming it re-reads `event_key`, `recorded_at` and `confirmed`: only the winner of each key (oldest `recorded_at`, then smaller record id) is confirmed. A duplicate row stays unconfirmed and is reported in `errors` with kind `duplicate` (the run is `partial`); the hourly run reports every key stored more than once. Unconfirming a duplicate that is already confirmed is Andrés's decision.
- Closes the run row: counts, `skip_reasons`, `trace`, `errors`, `config_issues`, `status`.

Writes ONLY `soc2_events` and `soc2_capture_runs`. Never writes `loom_sync_runs`, `ingestion_runs`, `priority_events` or `soc2_event_types`. No credentials and no network calls: it runs inside Airtable.

## Limits

Airtable documents (support.airtable.com/docs/run-a-script-action): script timeout 30 s (temporarily 120 s), 12 s per scripting API call, 512 MB, 30 `selectRecords` queries, 15 mutations per second, 50 records per mutation. The script stops starting write batches 20 s after it starts (`WRITE_BUDGET_MS`), leaves 3 s to confirm what it already wrote and 6 s to close the run row. If a run is cut off, its row stays `running` and the next hourly run marks it `abandoned` after 30 minutes (record and hourly rows; a record row never locks).

Queries per run (counted; never more than 30): record 5 when something is confirmed (catalog, source row, `soc2_events` keys, re-read, key read before confirming), 3 when nothing is; hourly 8 for up to 50 events to confirm (lock, catalog, 3 sources, keys, re-read, key read), 6 when nothing is. Each create retry after a timeout adds 1. What does not fit is left unconfirmed for the next hourly run.

Size of the built file (WP-R, 1.1.0): `soc2-capture.js` 104,330 bytes; `soc2-capture.compact.js` 60,310 bytes. Airtable documents no size limit for the script step; note the size accepted when pasting (WP-F).

## Checklist (WP-F, per automation)

1. Create the automation with the trigger of the table above. For the hourly one, pick a minute far from the one of `command_center_triages · compute · hourly` (wflFoOYmzWHZEcHPA), which writes `priority_events` every hour (review R1.4).
2. Add the "Run a script" action, create every input variable of the table (name and value; `dryRun` = `yes`) and paste `soc2-capture.js` (or the compact file if the paste fails; note which one and its size).
3. Test with the trigger record: a row appears in `soc2_capture_runs` with `dry_run` checked and no new row in `soc2_events`; the output message starts with `dry run` and ends with `timers: yes` or `timers: no` (note which).
4. Turn it on. Note the `wfl…` ID in `airtable/soc2/schema/CHANGELOG.md` and in `schema/design.md` §4.

Do not paste the `.ts` file. Do not edit built output: change the source here, rebuild, paste again.
