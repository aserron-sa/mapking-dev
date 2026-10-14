# MapKMigGon39264

*Parte 2 de 2 de Map MigGon37539 · paquete listo para Scrut* · [Abrir en Singular Stories](https://ss-prod-web-internal-804852907406.us-central1.run.app/workflow/2fa1b2b8-1a16-4c17-857f-c7461f78a019)

## Datos

- **Proyecto:** Map King Discovery & Foundation / Max Hanratty
- **Key Project:** SOC 2 Evidence · **Release:** v1 (wide 2026-11-04, planned)
- **Objetivo:** Run the front office on agents to scale from 10 to 1,000 events/year · **Key result:** Automate content ingestion
- **Asignado:** Andres Serron · **QA:** Gonzalo Lucas Ranieri
- **Estado:** Suggested by Resource · **Stage:** Stage Not Assigned
- **Sprint:** 4 (2026-09-21 → 2026-10-21)
- **Story points:** 3 (talent 3 · AA 0) · **Sugerencia IA:** 3 · **Ahorro estimado por IA:** 20 %
- **Work area:** Full Stack · **Techs:** AI, SQL, Full Stack Operations, Java Script, Node JS, TypeScript, Airtable
- **Involucra IA:** sí · **Tecnología de IA:** Airtable AI, Claude
- **Impacto:** — · **Origen:** Internal Portal · **Creada:** 2026-10-14
- **Fechas:** sin fechas
- **Calidad de escritura:** — (sin evaluar)
- **Dependencias:** ninguna · **Links:** 0 · **Evidencia:** 0

## Historia

As a compliance reviewer, I want to browse and export stored SOC 2 evidence by control, so that I can prepare audit-ready evidence packages and quickly identify any evidence types that still need control mapping.

## Historia para el cliente

As a Client, I want the SOC 2 evidence already captured in Map King Hub to be organized by SOC 2 control and ready for export, so that we can prepare for Scrut and audits without additional manual rework or code changes.

## Descripción de IA

Airtable AI and Claude will help design and validate the control-mapping model, interface filters, and export schema, then assist TypeScript/Node.js implementation and QA checks to ensure confirmed evidence is browsed and exported without rewriting records.

Implementation scope: Airtable AI and Claude will help model SOC 2 control mappings, generate interface/filter logic, and validate export columns from Airtable views. TypeScript/Node.js will wire read-only CSV export and traceability checks across the full stack.

## Criterios de aceptación

### Acceptance Criteria

```
Scenario: Browse evidence by SOC 2 control
   Given evidence records in the evidence table with source types approval (Map MigGon37539), loom, ingestion, automation and ticket_review (sources story)
   And soc2_control_mappings assigns one or more active SOC 2 controls to each source type
   When a reviewer opens the per-control evidence page and filters by a control
   Then every confirmed evidence record whose source type is mapped to that control is listed
   And the evidence records themselves are not modified
```

```
Scenario: One source type mapped to several controls
   Given a source type mapped to more than one control
   When a reviewer filters the page by each of those controls
   Then the same evidence records appear under each control
   And each record remains a single record in the evidence table
```

```
Scenario: Mapping changes apply without rewriting evidence
   Given evidence exists for a source type
   When an authorized editor changes the controls or the provisional flag of that source type's mapping
   Then the per-control page and the next export reflect the new mapping with no code changes and no reprocessing
   And the mapping row shows who made the latest change and when
```

```
Scenario: Export evidence for a selected control
   Given a control is selected on the per-control evidence page
   When the reviewer downloads the CSV from the interface
   Then the file contains only the evidence listed for that control
   And its columns are mapped controls, mapping provisional, source type, run_id, source reference, finished_at (approval time for approvals), run status, trigger, counts, actor and AI output state
```

```
Scenario: Exported evidence traces back to its origin
   Given a row in a per-control CSV export
   When an auditor looks up its run_id and source reference in Map King Hub
   Then the matching evidence record is found
   And from it the source row (the approval record, loom_sync_runs or activity_runs)
```

```
Scenario: Only confirmed evidence is listed and exported
   Given evidence records marked confirmed by the evidence module, and runs recorded as skipped or failed in the evidence run log from Map MigGon37539
   And an evidence record whose write confirmation failed (not marked confirmed)
   When a reviewer browses or exports evidence
   Then only evidence records marked confirmed appear
   And skipped and failed runs and unconfirmed records never appear and produce no placeholder records
```

### Technical Implementation

- Airtable only: tables, linked records, lookups, filtered views and interfaces in Map King Hub. No scripts or automations are added by this story.
- New table soc2_controls: control_id, name, description, active.
- New table soc2_control_mappings: source_type (approval, loom, ingestion, automation, ticket_review), linked controls, provisional flag, notes, and Airtable last-modified-by and last-modified-time fields.
- soc2_control_mappings has one row per source type and is the table that evidence.source_type links to. The evidence module fills that link once, when it creates each record (Map MigGon37539); this story does not write to the evidence table.
- Evidence records get their controls through a lookup conditional on active controls, so a mapping change or a deactivated control applies to existing and new evidence without rewriting it.
- Per-control evidence page: Airtable interface filtered to evidence marked confirmed, with a control filter, a heading that shows the selected control, and CSV download enabled on its list, showing only the export columns.
- Unmapped evidence page: confirmed evidence whose source type has no active control, with the source type visible for follow-up.
- The CSV download with the control filter applied is verified in Map King Hub before implementation; if the interface cannot export the filtered list, the story is re-estimated before continuing.
- Story documentation in stories/<story id>/ in the mapking-dev repo, backed up to the story folder under Map King (Map.ai)/stories/ in Google Drive (https://drive.google.com/drive/folders/1ASME3H6NrW590zQeUWQK7J7W56igjrT9): spec with the CSV columns, the provisional mapping and the traceability of the acceptance criteria of Map MigGon37539, the sources story and this story; QA guide for Gonzalo; delivery evidence per criterion.

### Data & Integration Requirements

- Reads the evidence table, the evidence run log, loom_sync_runs and activity_runs; never writes to any of them.
- The mapping key is the evidence source type, the same values used by Map MigGon37539 and the sources story: approval, loom, ingestion, automation, ticket_review.
- Data flow: source row (approval record, loom_sync_runs, activity_runs) -> evidence record marked confirmed -> source_type link -> soc2_control_mappings -> active controls lookup -> per-control page and CSV.
- For approvals, run_id is the approval record id, as defined in Map MigGon37539, so the idempotency key (source_type + run_id) and traceability work the same for every source type.
- The mapped controls column lists every active control mapped to the record's source type; the selected control is the page filter, shown in the page heading.
- The mapping provisional column tells auditors and Scrut that the control assignment is not yet confirmed.
- The provisional mapping is proposed by Singular from the SOC 2 Trust Services Criteria and stays flagged as provisional until Max confirms it or Scrut's evidence requirements are available.
- CSV exports use UTF-8, a header row and ISO 8601 UTC timestamps; AI output state uses the values from the sources story (present, missing, malformed).
- Scrut API integration is out of scope; it will be a separate backlog story once API access is available.

### Edge Cases & Error Handling

```
Scenario: Source type without a mapping
   Given evidence whose source type has no active control in soc2_control_mappings
   When a reviewer uses the per-control page
   Then that evidence appears under no control and is excluded from every per-control export
   And it appears on the unmapped evidence page
```

```
Scenario: Control deactivated
   Given a control marked inactive in soc2_controls
   When a reviewer opens the per-control page
   Then the control is no longer offered in the control filter
   And evidence whose source type was mapped only to that control appears on the unmapped evidence page
```

```
Scenario: Optional field blank in an evidence record
   Given a confirmed evidence record without actor, trigger, counts or AI output state
   When the reviewer downloads the CSV
   Then the record is included with those columns blank
   And the export does not fail
```

### Security & Performance

- Only designated editors can change soc2_controls and soc2_control_mappings; reviewers get read and CSV download access through the interface only, with no access to edit evidence or run logs.
- The documentation names who can read, edit and export evidence and the mapping, and where Map King Hub access is administered; no credentials or secrets in the documentation.
- The interface and the CSV expose only the export columns: ids, statuses, timestamps, trigger, actor, controls and AI output state. No transcripts, ticket bodies, prompts, reports or other content.
- Browsing and export use native Airtable lookups, filters and interface download, so they add no load to the evidence automations.

## Criterios para el cliente

### What you will be able to do
- Browse SOC 2 evidence by control in Airtable.
- Export the evidence for a selected control as a CSV file.
- See which evidence types still do not have a SOC 2 control assigned.
- Update the control mapping later without changing the underlying evidence records.
- Use provisional mappings now, while Scrut requirements and access are still pending.

### How it will work
- Two new Airtable tables will be added:
  - one for the SOC 2 controls
  - one for mapping evidence types to one or more controls
- Evidence will pick up its control assignment from the mapping, so if the mapping changes later, existing evidence will automatically reflect the new control assignment.
- A dedicated Airtable interface will let reviewers:
  - filter evidence by SOC 2 control
  - download the filtered results as CSV
  - review evidence that still has no control mapping
- The CSV export will include only the approved audit fields:
  - control ID
  - control name
  - evidence type
  - source type
  - run ID
  - source reference
  - timestamp
  - status
  - actor
  - AI output state
- Only evidence that is confirmed as stored will appear in the interface or export.
- Failed or skipped runs will not be treated as evidence.

### What to expect
- This work stays entirely inside Airtable.
- No new evidence sources are being added.
- No changes are being made to how evidence is captured.
- No Scrut API connection is included in this story.
- Exports will avoid personal data and content, and will include only IDs, statuses, timestamps, actor, and outcome-related fields.
- Documentation will be provided covering:
  - who can read, edit, and export evidence and mappings
  - where access and credentials are managed
  - how provisional mappings should be used
  - how this work traces back to the earlier SOC 2 evidence stories
  - a QA guide for the QA owner

## Observaciones (revisión 2026-10-14)

- Work area Full Stack y techs SQL / Node JS / Java Script / TypeScript / Full Stack Operations contradicen "Airtable only" de sus criterios.
- La descripción de IA habla de TypeScript/Node.js; la tecnología de IA incluye Airtable AI, que no se usa.
- El cliente-friendly lista las columnas de export viejas.
- Los criterios dicen "the sources story" en vez de MapKMigGon39261.
