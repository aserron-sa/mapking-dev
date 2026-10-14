---
id: table:evidence
type: table
title: evidence
summary: One record per qualifying run or approval, created once by the evidence module and traceable to its source row.
status: planned
updated: 2026-10-14
confidence: inferred
fields: [source_type:link, run_id:text, source_reference:text, finished_at:dateTime, status:singleSelect, trigger:text, counts:text, actor:text, ai_output_state:singleSelect, confirmed:checkbox]
writer: automation:evidence-module
produced_by: story:MapMigGon37539
populated_by: [automation:evidence-run-capture]
tags: [soc2, evidence]
provenance: [repo:stories/MapMigGon37539/implementation-plan.md]
---

source_type is a link to soc2_control_mappings (one row per source type); the evidence module fills it once, at creation. confirmed is set by the module after it re-reads the stored record; pages and exports show only confirmed records.
Idempotency key: source_type + run_id. For approvals run_id is the approval record id.
Final field list is defined in the 37539 spec; this node lists what P01 and P02 rely on.
