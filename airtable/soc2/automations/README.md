# SOC 2 evidence automations — MapMigGon37539 / MapKMigGon39261

Airtable "Run a script" automations for SOC 2 evidence capture. Base **Map King Hub** (`appcdpGNTo0DouoqJ`).

Empty on purpose (skeleton, 2026-10-14). Planned, one self-contained script each, built into `airtable/soc2/dist/` (git-ignored) when the build exists:

| Script | Story | Trigger |
|---|---|---|
| `soc2-capture.ts` | 37539 | Hourly safety net; same adapters and idempotency key as the triggered one |
| `soc2-capture-on-run.ts` | P01 (39261) | Record trigger: loom_sync_runs row reaches a terminal status, or a new activity_runs row |

Same rules as `airtable/cct/automations/`: Airtable cannot create or edit a script step by API, so this folder is the source of truth and each script is pasted by hand. Never edit built output.
