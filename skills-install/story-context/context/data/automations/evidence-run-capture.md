---
id: automation:evidence-run-capture
type: automation
title: evidence run capture
summary: Record-triggered automation on terminal run rows plus an hourly safety net, with one adapter per source type.
status: planned
updated: 2026-10-14
confidence: inferred
trigger: record-triggered when a row in loom_sync_runs or activity_runs reaches a terminal status; hourly safety net for missed rows
produced_by: story:MapKMigGon39261
tags: [soc2, evidence]
provenance: [repo:stories/MapMigGon37539/ss-drafts.md]
---

Adapters (loom, ingestion, automation, ticket_review) map a run row to the evidence contract and return qualify or skip with a reason. One run row per execution for the triggered automation; the hourly one uses the batch size and per-run time budget of the evidence module.
