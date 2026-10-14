---
id: table:activity_runs
type: table
title: activity_runs
summary: New append-only run log for the Ingestion Agent, qualifying automations and the ticket review flow, one row per finished run.
status: planned
updated: 2026-10-14
confidence: inferred
fields: [run_id:text, source_type:singleSelect, source_name:text, source_record_id:text, ticket_id:text, status:singleSelect, outcome:text, actor:text, trigger:text, started_at:dateTime, finished_at:dateTime, counts:text, ai_output_state:singleSelect]
writer: agent:ingestion-agent
produced_by: story:MapKMigGon39261
populated_by: [agent:ingestion-agent]
tags: [run-log]
provenance: [repo:stories/MapMigGon37539/ss-drafts.md]
---

Append-only: each producer creates its own rows and never edits or deletes. The producers are the Ingestion Agent (final step in its prompt), each qualifying automation and the ticket review flow; they are added here as writer nodes when they are modeled (then set append_only: true).
source_type values: ingestion, automation, ticket_review. ai_output_state values: present, missing, malformed. status values: success, partial, failure.
