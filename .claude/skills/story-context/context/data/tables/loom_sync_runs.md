---
id: table:loom_sync_runs
type: table
title: loom_sync_runs
summary: Existing run log written only by Loom, one row per sync run with status, trigger, timestamps and counts.
status: existing
updated: 2026-10-14
confidence: inferred
fields: [status:singleSelect, trigger:text, started_at:dateTime, finished_at:dateTime, created:number, updated:number, closed:number, failed:number]
writer: agent:loom
tags: [run-log, loom]
provenance: [repo:stories/MapMigGon37539/ss-drafts.md]
---

Field list comes from the acceptance criteria of P01, not from the base schema: verify against the base before relying on a name.
trigger values: "schedule" (daily run), "slack:#ingestion <requester>" (Slack runs), the panel's own value. A row with status "rejected_busy" is not evidence.
Terminal statuses: success, partial, failure, abandoned. Running rows are not evidenced yet.
