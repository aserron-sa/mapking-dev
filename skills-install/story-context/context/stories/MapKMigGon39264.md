---
id: story:MapKMigGon39264
type: story
title: P02 - SOC 2 evidence by control, ready for Scrut
summary: Airtable-only control mapping, per-control interface and CSV export of confirmed evidence. No scripts or automations.
status: planned
updated: 2026-10-14
confidence: verified
key: MapKMigGon39264
ss_status: Suggested by Resource
concern: airtable data and interfaces: control mapping, per-control page, CSV export
epic: epic:soc2-evidence
parent: story:MapMigGon37539
points: 3
sprint: 4
depends_on: [story:MapMigGon37539@ready_for_qa, story:MapKMigGon39261@ready_for_qa]
consumes: [table:evidence.source_type:link, table:evidence.confirmed:checkbox, table:evidence.ai_output_state:singleSelect, table:soc2_control_mappings.source_type:text]
tags: [soc2, evidence, interface, csv]
provenance: [ss:MapKMigGon39264, repo:stories/MapMigGon37539/ss-drafts.md]
---

Gate before implementation: verify in Map King Hub that an interface list with a filter on a lookup field downloads as CSV with the filter applied; otherwise re-estimate.
The SS record still shows old text (Full Stack, Node JS) until the review items in ss-drafts.md are approved.
