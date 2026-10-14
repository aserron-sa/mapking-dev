# MapKMigGon39264 · P02 paquete listo para Scrut · SS drafts

Sub-story de Map MigGon37539 (SOC 2 Evidence). Creada en SS el 14 oct 2026 (sprint 4, 3 SP, Suggested by Resource). Partido de `ss-drafts.md` el 14 oct 2026; los items se renumeran 1–5 (entre paréntesis, el número que tenían).

Hermano: `ss-drafts-MapKMigGon39261.md` (P01). Lo que es de la 37539 (comentario de alcance, requisitos para su plan, decisiones del PM) sigue en `ss-drafts.md`.

Flujo (working agreement): Andrés revisa cada item y lo postea, o dice "post item N" para uno puntual. Claude no escribe en SS sin esa aprobación.

Campos comunes de ambas (igual que la 37539): proyecto Map King Discovery & Foundation · Key Project **SOC 2 Evidence** · release **v1** · sprint **5** (el PM la mueve si se adelanta a esta semana) · Work area **Backend** · Tech: Nueva 1 **AI, Airtable, TypeScript**; Nueva 2 **Airtable** · IA: **Hyperagent, Claude** · QA Gonzalo Lucas Ranieri · asignada a Andrés. Sin fechas (las decide el PM junto con el adelanto). Como los SP los fija Andrés, se envía también `aiSuggestedSps` con la estimación propia por horas: 5 para la Nueva 1 (≈8–9 h) y 3 para la Nueva 2 (≈5 h), así SS no registra el 2 como sugerencia de IA.

---

## Item 1 · create-story · Nueva 2 (2 SP) — ya creada en SS como MapKMigGon39264; texto de referencia (era Item 2)

**Name:** SOC 2 evidence — Scrut-ready control mapping and CSV export

**Written story:** As a Backend Engineer, I want to map each SOC 2 evidence type to configurable SOC 2 controls and provide a per-control view and CSV export, so that the evidence captured in Map King Hub can be loaded into Scrut and reviewed by auditors without a direct API integration.

- asAn: Backend Engineer
- iWantTo: map each SOC 2 evidence type to configurable SOC 2 controls and provide a per-control view and CSV export
- soThat: the evidence captured in Map King Hub can be loaded into Scrut and reviewed by auditors without a direct API integration

**Business story (cliente):** As a Client, I want the collected evidence organized by SOC 2 control and downloadable, so that it can be handed to Scrut and the auditors without extra preparation.

**Acceptance criteria:**

## Acceptance Criteria

Scenario: Browse evidence by SOC 2 control
   Given evidence records in the evidence table with source types approval (Map MigGon37539), loom, ingestion, automation and ticket_review (sources story)
   And soc2_control_mappings assigns one or more active SOC 2 controls to each source type
   When a reviewer opens the per-control evidence page and filters by a control
   Then every confirmed evidence record whose source type is mapped to that control is listed
   And the evidence records themselves are not modified

Scenario: One source type mapped to several controls
   Given a source type mapped to more than one control
   When a reviewer filters the page by each of those controls
   Then the same evidence records appear under each control
   And each record remains a single record in the evidence table

Scenario: Mapping changes apply without rewriting evidence
   Given evidence exists for a source type
   When an authorized editor changes the controls or the provisional flag of that source type's mapping
   Then the per-control page and the next export reflect the new mapping with no code changes and no reprocessing
   And the mapping row shows who made the latest change and when

Scenario: Export evidence for a selected control
   Given a control is selected on the per-control evidence page
   When the reviewer downloads the CSV from the interface
   Then the file contains only the evidence listed for that control
   And its columns are mapped controls, mapping provisional, source type, run_id, source reference, finished_at (approval time for approvals), run status, trigger, counts, actor and AI output state

Scenario: Exported evidence traces back to its origin
   Given a row in a per-control CSV export
   When an auditor looks up its run_id and source reference in Map King Hub
   Then the matching evidence record is found
   And from it the source row (the approval record, loom_sync_runs or activity_runs)

Scenario: Only confirmed evidence is listed and exported
   Given evidence records marked confirmed by the evidence module, and runs recorded as skipped or failed in the evidence run log from Map MigGon37539
   And an evidence record whose write confirmation failed (not marked confirmed)
   When a reviewer browses or exports evidence
   Then only evidence records marked confirmed appear
   And skipped and failed runs and unconfirmed records never appear and produce no placeholder records

## Technical Implementation

- Airtable only: tables, linked records, lookups, filtered views and interfaces in Map King Hub. No scripts or automations are added by this story.
- New table soc2_controls: control_id, name, description, active.
- New table soc2_control_mappings: source_type (approval, loom, ingestion, automation, ticket_review), linked controls, provisional flag, notes, and Airtable last-modified-by and last-modified-time fields.
- soc2_control_mappings has one row per source type and is the table that evidence.source_type links to. The evidence module fills that link once, when it creates each record (Map MigGon37539); this story does not write to the evidence table.
- Evidence records get their controls through a lookup conditional on active controls, so a mapping change or a deactivated control applies to existing and new evidence without rewriting it.
- Per-control evidence page: Airtable interface filtered to evidence marked confirmed, with a control filter, a heading that shows the selected control, and CSV download enabled on its list, showing only the export columns.
- Unmapped evidence page: confirmed evidence whose source type has no active control, with the source type visible for follow-up.
- The CSV download with the control filter applied is verified in Map King Hub before implementation; if the interface cannot export the filtered list, the story is re-estimated before continuing.
- Story documentation in stories/<story id>/ in the mapking-dev repo, backed up to the story folder under Map King (Map.ai)/stories/ in Google Drive (https://drive.google.com/drive/folders/1ASME3H6NrW590zQeUWQK7J7W56igjrT9): spec with the CSV columns, the provisional mapping and the traceability of the acceptance criteria of Map MigGon37539, the sources story and this story; QA guide for Gonzalo; delivery evidence per criterion.

## Data & Integration Requirements

- Reads the evidence table, the evidence run log, loom_sync_runs and activity_runs; never writes to any of them.
- The mapping key is the evidence source type, the same values used by Map MigGon37539 and the sources story: approval, loom, ingestion, automation, ticket_review.
- Data flow: source row (approval record, loom_sync_runs, activity_runs) -> evidence record marked confirmed -> source_type link -> soc2_control_mappings -> active controls lookup -> per-control page and CSV.
- For approvals, run_id is the approval record id, as defined in Map MigGon37539, so the idempotency key (source_type + run_id) and traceability work the same for every source type.
- The mapped controls column lists every active control mapped to the record's source type; the selected control is the page filter, shown in the page heading.
- The mapping provisional column tells auditors and Scrut that the control assignment is not yet confirmed.
- The provisional mapping is proposed by Singular from the SOC 2 Trust Services Criteria and stays flagged as provisional until Max confirms it or Scrut's evidence requirements are available.
- CSV exports use UTF-8, a header row and ISO 8601 UTC timestamps; AI output state uses the values from the sources story (present, missing, malformed).
- Scrut API integration is out of scope; it will be a separate backlog story once API access is available.

## Edge Cases & Error Handling

Scenario: Source type without a mapping
   Given evidence whose source type has no active control in soc2_control_mappings
   When a reviewer uses the per-control page
   Then that evidence appears under no control and is excluded from every per-control export
   And it appears on the unmapped evidence page

Scenario: Control deactivated
   Given a control marked inactive in soc2_controls
   When a reviewer opens the per-control page
   Then the control is no longer offered in the control filter
   And evidence whose source type was mapped only to that control appears on the unmapped evidence page

Scenario: Optional field blank in an evidence record
   Given a confirmed evidence record without actor, trigger, counts or AI output state
   When the reviewer downloads the CSV
   Then the record is included with those columns blank
   And the export does not fail

## Security & Performance

- Only designated editors can change soc2_controls and soc2_control_mappings; reviewers get read and CSV download access through the interface only, with no access to edit evidence or run logs.
- The documentation names who can read, edit and export evidence and the mapping, and where Map King Hub access is administered; no credentials or secrets in the documentation.
- The interface and the CSV expose only the export columns: ids, statuses, timestamps, trigger, actor, controls and AI output state. No transcripts, ticket bodies, prompts, reports or other content.
- Browsing and export use native Airtable lookups, filters and interface download, so they add no load to the evidence automations.

**Client-friendly AC:**
- Evidence is organized by SOC 2 control.
- Each control's evidence can be downloaded as a CSV ready for Scrut.
- The control assignments can be adjusted without development work.
- Evidence not yet assigned to a control is shown separately.

---

## Item 2 · add-story-link · MapKMigGon39264

- Title: Map King (Map.ai) · Drive (story docs)
- URL: https://drive.google.com/drive/folders/1ASME3H6NrW590zQeUWQK7J7W56igjrT9?usp=sharing
(Era Item 4.)

## Item 3 · update-story-details · MapKMigGon39264 (created 14 oct, review)

Created in SS as **MapKMigGon39264** (sprint 4, 3 SP, Suggested by Resource). Its acceptance criteria match item 1 exactly. These fields don't:

- Work area: Full Stack → **Backend** (sets the stage to Back-End, like MapKMigGon39261)
- Tech: AI, SQL, Full Stack Operations, Java Script, Node JS, TypeScript, Airtable → **Airtable** only
- Primary AI technology: Airtable AI, Claude → **Claude**
- AI description (replace):

> Claude helps design the control-mapping model, the conditional lookups, the interface filters and the CSV column contract, and drafts the spec, the provisional mapping and the QA guide. Everything is built natively in Airtable (tables, lookups, interfaces); no scripts, automations or code are added by this story.

- Client-friendly acceptance criteria (replace; the current one lists the old export columns):

> ## What you will be able to do
> - Browse the SOC 2 evidence by control in Airtable.
> - Download the evidence for a selected control as a CSV file.
> - See which evidence types still have no SOC 2 control assigned.
> - Change the control assignments later, without development work and without touching the evidence.
>
> ## How it will work
> - Two new Airtable tables: SOC 2 controls, and the assignment of each evidence type to one or more controls.
> - Evidence picks up its controls from that assignment, so a change applies to all evidence at once.
> - The CSV includes: mapped controls, whether the mapping is provisional, source type, run id, source reference, finish time, run status, trigger, counts, actor and AI output state.
> - Only evidence confirmed as stored appears; skipped or failed runs are not evidence.
>
> ## What to expect
> - Everything stays inside Airtable; no Scrut API connection in this story.
> - The control assignments start as provisional until Scrut's requirements are confirmed.
> - Exports contain only ids, statuses, times and actors; no personal content.
> - Documentation covers access, the provisional mapping, traceability to the earlier SOC 2 stories and a QA guide.
(Era Item 5.)

## Item 4 · update-story-details · MapKMigGon39264 · acceptance criteria

Replace "the sources story" with "MapKMigGon39261" in the acceptance criteria (3 places: Browse scenario, Data & Integration mapping key line, and AI output state line). No other change.
(Era Item 6.)

## Item 5 · update-story-details · name · MapKMigGon39264

Part prefix with two digits, so the parent and the order read at a glance in lists, sprints and QA:

- MapKMigGon39264 → [37539 · P02] SOC 2 evidence — Scrut-ready control mapping and CSV export

Client-facing alternative (no internal key): [SOC 2 Evidence · P02] …
(Era parte del Item 7.)

## Item 6 · update-story-details · MapKMigGon39264 · todos los campos (versión 2, mapeo por tipo de evento)

Reemplaza los items 3 a 5. Texto completo, campo por campo, en MapKMigGon39264-final.md (versión 2 del 14 oct). Campos que cambian respecto de lo que hoy está en SS: Name, Work area (Full Stack a Backend), Tech (solo Airtable), Primary AI technology (Claude), Written story, Business story, AI description, Acceptance criteria y Client-friendly acceptance criteria.

Motivo: el mapeo pasa de source type a tipo de evento (soc2_event_types.controls), las tablas soc2_events y soc2_controls ya existen, el CSV sigue el formato de scrut-soc2-evidence-format.md §3.3 con filtro por período, y se aplican las correcciones de la validación (MapKMigGon39261 en lugar de "the sources story", sin encabezado con el control filtrado, carpeta de docs).
