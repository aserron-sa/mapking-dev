---
id: automation:evidence-module
type: automation
title: evidence module
summary: Shared module that validates, normalizes and writes evidence records and confirms the write; used by every entry automation.
status: planned
updated: 2026-10-14
confidence: inferred
trigger: called by the evidence entry automations (approval capture and the run-log automations)
produced_by: story:MapMigGon37539
tags: [soc2, evidence]
provenance: [repo:stories/MapMigGon37539/implementation-plan.md]
---

Writes the evidence table. Idempotent on source_type + run_id; marks confirmed only after re-reading the stored record; records skipped and failed runs in the evidence run log.
