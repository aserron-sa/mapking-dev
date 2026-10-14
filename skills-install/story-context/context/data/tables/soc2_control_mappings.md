---
id: table:soc2_control_mappings
type: table
title: soc2_control_mappings
summary: One row per evidence source type with its SOC 2 controls and a provisional flag; the table evidence.source_type links to.
status: planned
updated: 2026-10-14
confidence: inferred
fields: [source_type:text, controls:link, provisional:checkbox, notes:text]
writer: human
produced_by: story:MapMigGon37539
tags: [soc2, mapping]
provenance: [repo:stories/MapMigGon37539/ss-drafts.md]
---

Created in the parent story with one row per source type (approval, loom, ingestion, automation, ticket_review). P02 adds the controls link, the provisional flag and the notes, and the last-modified-by and last-modified-time fields. Edited only by designated editors.
