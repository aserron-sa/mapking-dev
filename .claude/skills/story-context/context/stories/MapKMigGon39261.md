---
id: story:MapKMigGon39261
type: story
title: P01 - SOC 2 evidence source coverage
summary: Run logs and adapters so Loom, Ingestion Agent, automations and ticket reviews produce evidence through triggered capture plus an hourly safety net.
status: planned
updated: 2026-10-14
confidence: verified
key: MapKMigGon39261
ss_status: Suggested by Resource
concern: source coverage: activity_runs, evidence adapters, triggered capture
epic: epic:soc2-evidence
parent: story:MapMigGon37539
points: 4
sprint: 4
depends_on: [story:MapMigGon37539@ready_for_qa]
consumes: [table:evidence, automation:evidence-module, table:loom_sync_runs]
tags: [soc2, evidence, ingestion]
provenance: [ss:MapKMigGon39261, repo:stories/MapMigGon37539/ss-drafts.md]
---

Adds the activity_runs table (append-only run log), the final logging step in the producers, one adapter per source type, and the record-triggered evidence automation with the hourly safety net.
SS points are 4, not on the Fibonacci scale; the PM decides (see decision:2026-10-14-points-and-sprint-order).
