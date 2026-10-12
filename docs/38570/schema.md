# MapKMigGon38570 — Airtable schema changes

Base: **Map King Hub** (`appcdpGNTo0DouoqJ`) · Applied: 2026-10-11 · Owner: Andrés Serrón

All changes are additive: no field or table was renamed or deleted. Loom (v3.9) writes only its own fields and is not affected; `source_labels` is reserved for Loom v3.10.

## `task_lanes` (`tblZhorxkVfKdsW3Z`) — shared with 38571

Existing fields used by 38570:

| Field | ID | Notes |
|---|---|---|
| user | `fldv531mBAE9KL2Yk` | Owner of the ranking (collaborator) |
| task | `fldXRxxIcIxWbZ7ai` | Link to `command_center_tasks` |
| lane | `fldHBsnLRIT7RrGv0` | `on_fire` / `this_week` / `waiting_on` / `queued` / `icebox` |
| rank_position | `fld1PKtXTsBK17pxD` | 1–3, only meaningful for `on_fire` |
| ranked_at | `fld15soq5jo4j3jxC` | When the task entered the ranking |

New fields:

| Field | ID | Type | Purpose |
|---|---|---|---|
| user_task_key | `fldlHAfQIp20jsfLx` | formula | `user name | normalized_task_id`; key for the dedupe automation |
| needs_you_manual | `fldo0KraIpsDzzgZj` | checkbox | Needs-You signal 5 (Max marks it in Today) |
| needs_you_manual_at | `fldLG8JroDCqtIkyS` | last modified time (of `needs_you_manual`) | Exact time of the mark → `waiting_since` with basis `manual` |

## `command_center_tasks` (`tblX61yfIFroyhMTj`)

New fields:

| Field | ID | Type | Written by |
|---|---|---|---|
| source_labels | `fld5nWUCSFKgkFJlu` | single line text | Loom v3.10 (empty until then) |
| needs_you_manual_any | `fld7prhq7tn7vMyCE` | rollup of `task_lanes.needs_you_manual` → 1/0 | computed |
| needs_you_signals | `fld7byISqz2gObpzl` | formula | computed |
| waiting_since | `fldyg45qTxIIhESfp` | date-time (America/Montevideo) | Needs-You automation |
| waiting_since_basis | `fldi2U965ciOBxxws` | single select: `manual`, `first_seen`, `estimated` | Needs-You automation |

### Needs-You rule (decided 2026-10-11)

A task is in Needs-You when `lifecycle = open` and `needs_you_signals` is not empty. Any one signal is enough:

| Signal value | Source | Condition |
|---|---|---|
| `approval_pending` | `approvals` via Loom | `source_table = approvals` and `status_raw = Pending` |
| `ticket_needs_max` | `dev_tickets` via Loom | `source_table = dev_tickets` and `status_raw = Needs Max Input` |
| `linear_label` | Linear via Loom v3.10 | `source_labels` contains `needs-max` |
| `ai_tag` | Loom enrichment | `tags` contains `needs-max` |
| `manual` | Today | any linked `task_lanes.needs_you_manual` checked |

Status comparisons are case-insensitive. Snapshot on 2026-10-11: 113 open tasks, 7 in Needs-You (all `approval_pending`); no open task carries the `needs-max` tag and no open `dev_tickets` are in "Needs Max Input".

### `waiting_since` rules

- Stamped when the task first shows any signal; never overwritten while at least one signal remains.
- Cleared when all signals disappear or the task closes; a later signal starts a new wait.
- Basis: `manual` = `needs_you_manual_at` (exact); `first_seen` = when Airtable first saw an automatic signal (precision = Loom sync frequency, today once per business day); `estimated` = initial backfill from `last_updated_at` for tasks already waiting at rollout.
- Days waiting = now − `waiting_since`. Missing or invalid → end of the list and a `needs_you_data_issue` event.
- Manual mark (Today, block 3b): Max marks or unmarks any open task. If he already has a `task_lanes` row for it, only `needs_you_manual` changes (lane and rank untouched); otherwise a row is created in lane `waiting_on` (prototype: Waiting On · Blocked on you). Marking a task with no `waiting_since` stamps it immediately (basis `manual`); the hourly automation remains the reconciler. Both actions are logged as `needs_you_mark`.

## New table `priority_events` (`tbl0k4YFnduwhMJG2`)

Event log for the daily priority list. Never delete rows.

| Field | ID | Type |
|---|---|---|
| summary (primary) | `fldxNmEoRpB4SRouZ` | single line text |
| event_type | `fldu8UXkQBfrIHvZe` | single select: promote, demote, reorder, validation_failed, airtable_error, compensation, guard_fix, dedupe, needs_you_data_issue, power_hour_update, needs_you_mark (added by hand: the API cannot add select options) |
| status | `fldL2k5qUjcOasDxU` | single select: ok, demotion_required, validation_failed, dependency_failed |
| source | `fldIj7BNfY7f13atJ` | single select: extension, automation |
| user | `fldzCkpn3zNyG6Ehm` | collaborator |
| task | `fldxIN69YVqXAWn0e` | link to `command_center_tasks` (inverse `fldvWcIFk99FcS6ag`) |
| lane_record_ids | `fldZTy7U9ktOaIB7L` | single line text |
| before | `fldiVSNDCHL5lHjTd` | long text (compact JSON, no task content) |
| after | `fldxLPzLdJMIP5LoR` | long text (compact JSON, no task content) |
| message | `fldBZdiRQ4ThpYEgX` | long text |
| created_at | `fldGECjVvMvaTiqnT` | created time |

## New table `power_hour_items` (`tblwFsPqbejWWYPmf`)

Persisted Power Hour checklist (order + completion). Never written back to the source system; linked tasks store only the link.

| Field | ID | Type |
|---|---|---|
| item_key (primary) | `fld1uNujJmPLYGMdp` | single line text: `<YYYY-MM-DD> · <position>` |
| user | `fldRsb0SvtZRsl9DI` | collaborator |
| date | `fldfPO5yng5qoz5gB` | date |
| position | `fldYkzdKbVee1UqJL` | number |
| done | `fldLie1uMaPVSG5C4` | checkbox |
| task | `fldfuzhbRFcdSjdkM` | link to `command_center_tasks` (inverse `fldFZBAdIdgBcI98F`) |
| manual_text | `fldSY9AxNxlOECBK3` | single line text |
| done_at | `fldGUZLB1bxB2wTlc` | date-time (America/Montevideo) |

## Automations (deployed 2026-10-12)

| Automation | ID | Script | State |
|---|---|---|---|
| `task_lanes · integrity · on create` | `wflzX39Z0Wl4xQLel` | `airtable/cct/automations/task_lanes-integrity.js` | On |
| `task_lanes · integrity · on update` | `wflvV2l7S9rBYzVFS` | same | On |
| `command_center_tasks · needs-you waiting_since · hourly` | `wflVp0Z1DfU0JtHSW` | `airtable/cct/automations/needs-you-waiting-since.js` | On |
| `command_center_tasks · needs-you backfill (one-time)` | `wflwiT6PlijHTwYkM` | `airtable/cct/automations/needs-you-backfill.js` | Run once 2026-10-12; keep off |

First runs (2026-10-12): the integrity guard renumbered Carlos's three fires (1,1,1 → 1,2,3), cleared ranks on 16 `this_week` rows and removed 7 duplicate rows (20 → 13), all logged in `priority_events`. The backfill dated the 7 pending approvals already in Needs-You (`estimated`, Jul 29 – Aug 7).

## Side effects to know

- Linking the two new tables added inverse link fields to `command_center_tasks` (`fldvWcIFk99FcS6ag`, `fldFZBAdIdgBcI98F`). Loom reads `command_center_tasks` with a fixed `fieldIds` list, so it is unaffected.
- The Needs You tile of the CEO dashboard (38569) should read the same rule (`needs_you_signals` + `waiting_since`).
