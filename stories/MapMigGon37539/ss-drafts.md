# Map MigGon37539 · SS drafts — 2 stories adyacentes

Fuente: `MapMigGon37539-plan-y-reestimacion.pdf` (Drive, 13 oct 2026).
Reparto acordado: **8 + 3 + 2 = 13 SP**. Última actualización: 14 oct 2026 (run logs, captura disparada, mapeo por source_type, requisitos para la 37539 al final).

| Story | Alcance | Criterios (de los 35) | Horas | SP |
|---|---|---|---|---|
| Map MigGon37539 (existente, sin cambios en SS) | A completo + resiliencia de B | F1 (aprobaciones), F3–F7, T1–T8, D1–D7, E1–E5, E7, S1–S6 | ≈17,5 | 8 |
| **Nueva 1** · Cobertura de fuentes | `activity_runs` (nueva) + `loom_sync_runs`; captura disparada por fila + red horaria; paso de registro en Ingestion Agent y automatizaciones; adaptadores loom / ingestion / automation / ticket_review; salida IA ausente o malformada | F1 extendido, E6 | ≈8–9 | 3 (⚠️ por horas serían 5) |
| **Nueva 2** · Paquete listo para Scrut | `soc2_controls` + `soc2_control_mappings`, lookup condicional, página por control + CSV desde la interfaz, página sin mapeo, docs, guía de QA | F2, docs de S2/S3 | ≈5 | 2 (⚠️ por horas serían 3) |
| D · API de Scrut | Sin crear (backlog, cuando haya acceso) | — | — | — |

Campos comunes de ambas (igual que la 37539): proyecto Map King Discovery & Foundation · Key Project **SOC 2 Evidence** · release **v1** · sprint **5** (el PM la mueve si se adelanta a esta semana) · Work area **Backend** · Tech: Nueva 1 **AI, Airtable, TypeScript**; Nueva 2 **Airtable** · IA: **Hyperagent, Claude** · QA Gonzalo Lucas Ranieri · asignada a Andrés. Sin fechas (las decide el PM junto con el adelanto). Como los SP los fija Andrés, se envía también `aiSuggestedSps` con la estimación propia por horas: 5 para la Nueva 1 (≈8–9 h) y 3 para la Nueva 2 (≈5 h), así SS no registra el 2 como sugerencia de IA.

---

## Item 1 · create-story · Nueva 1 (3 SP)

**Name:** SOC 2 evidence capture — agent and automation sources (Loom, Ingestion, automation events, ticket reviews)

**Written story:** As a Backend Engineer, I want to extend the SOC 2 evidence capture built in Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews, so that all agent activity in Map King Hub produces audit-ready evidence, even when the AI output is missing or malformed.

- asAn: Backend Engineer
- iWantTo: extend the SOC 2 evidence capture from Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews
- soThat: all agent activity in Map King Hub produces audit-ready evidence, even when the AI output is missing or malformed

**Business story (cliente):** As a Client, I want evidence to be collected from every agent and automation in the operation, not only from approvals, so that audits cover the full picture of how the agents work.

**Acceptance criteria:**

## Acceptance Criteria

```
Scenario: Finished Loom runs produce evidence
   Given Loom writes its run to loom_sync_runs
   When the row reaches a terminal status (success, partial, failure or abandoned)
   Then the evidence automation is triggered for that row
   And one evidence record is created with source type "loom", run_id, status, trigger, started_at, finished_at and the created/updated/closed/failed counts
   And the record links back to the loom_sync_runs row
```

```
Scenario: Loom runs still in progress are not evidenced yet
   Given a loom_sync_runs row with status "running"
   When an evidence automation evaluates it
   Then no evidence is created for that run
   And it is evidenced once its status becomes terminal
```

```
Scenario: Ingestion Agent runs produce evidence
   Given the Ingestion Agent writes one row to activity_runs with source_type "ingestion" when a run finishes
   And the row matches the Ingestion qualifying rule
   When the row is created
   Then the evidence automation is triggered for that row
   And one evidence record is created with source type "ingestion", run_id, status, trigger, started_at, finished_at, counts and AI output state
   And the record links back to the activity_runs row
```

```
Scenario: Automation runs produce evidence
   Given a qualifying automation writes one row to activity_runs with source_type "automation" when it finishes
   When the row is created
   Then the evidence automation is triggered for that row
   And one evidence record is created with source type "automation", automation name, run_id, status, timestamps and outcome
```

```
Scenario: Ticket reviews produce evidence
   Given the ticket review flow writes one row to activity_runs with source_type "ticket_review" when a review is completed
   When the row is created
   Then the evidence automation is triggered for that row
   And one evidence record is created with the review outcome, reviewer, timestamps and the ticket id (no ticket content)
```

```
Scenario: Non-qualifying runs are skipped with a reason
   Given a run row that does not match its source type's qualifying rule (for example a loom_sync_runs row with status "rejected_busy")
   When an evidence automation evaluates it
   Then no evidence is created
   And the evidence run log records the row as skipped with the rule that excluded it
```

## Technical Implementation

- Two run logs feed evidence capture: loom_sync_runs (existing, written by Loom) and activity_runs (new, append-only), where the Ingestion Agent, each qualifying automation and the ticket review flow add one row per finished run.
- Producers only log their run: the Ingestion Agent prompt gets a final step that writes its activity_runs row, and each qualifying automation gets a final script step that does the same. Producers never write evidence.
- A record-triggered Airtable automation runs the evidence script when a loom_sync_runs row reaches a terminal status or a new activity_runs row is created, so evidence is created within seconds of the run finishing.
- The hourly evidence automation from Map MigGon37539 stays as the safety net: it picks up terminal rows without evidence (failed trigger, missed event) using the same idempotency key.
- One adapter per source type (loom, ingestion, automation, ticket_review) maps the run row to the evidence contract from Map MigGon37539 and returns qualify or skip with a reason; both the triggered and the hourly automation use the same adapters and evidence module.
- Qualifying rules per source type live in the evidence rules table and can be changed without code.
- Adapters and the logging step are written in TypeScript under airtable/cct/ and built into paste-ready automation scripts; unit tests per adapter with fixtures.

## Data & Integration Requirements

- Evidence sources are two run logs in Map King Hub: loom_sync_runs (existing, written only by Loom) and activity_runs (new), where the Ingestion Agent, each qualifying automation and the ticket review flow add one row per finished run.
- activity_runs is append-only: each producer writes one row per run, once, when the run finishes (always with a terminal status), and never edits or deletes rows; the evidence automations only read it.
- activity_runs fields: run_id, source_type (ingestion, automation, ticket_review), source_name, source_record_id, ticket_id (ticket reviews only), status (success, partial, failure), outcome, actor, trigger, started_at, finished_at, counts, ai_output_state.
- Each evidence record stores source_type (as a link to the source-types table defined in Map MigGon37539, filled once at creation), run_id, the source run row and, when available, the related ticket or automation reference, so it traces back to its origin.
- Loom evidence keeps the trigger exactly as Loom records it ("schedule" for the daily run, "slack:#ingestion <requester>" for Slack runs, and the panel's value), so evidence shows whether a run was scheduled or requested and by whom.
- AI output state is one of: present, missing, malformed. AI content stays in the AI fields, separated from observed metadata.
- Evidence status per run (evidenced, skipped, failed) is kept in the evidence run log from Map MigGon37539, not in the source run logs, so each table keeps a single kind of writer.
- The triggered and the hourly evidence automation use the idempotency key (source_type + run_id), the validation, retry policy, terminal-failure state and reprocessing from Map MigGon37539; a run already evidenced is a no-op, never an update.
- A run is recorded as evidenced, and its evidence record marked confirmed, only after the record is confirmed by re-reading it, on both the triggered and the hourly path.

## Edge Cases & Error Handling

```
Scenario: AI output missing
   Given a qualifying run row with valid core metadata and no AI output
   When the evidence automation processes it
   Then the evidence record is created from the observed metadata
   And its AI output state is "missing"
```

```
Scenario: AI output malformed
   Given a qualifying run row with valid core metadata and unparseable AI output
   When the evidence automation processes it
   Then the evidence record is created without the invalid AI fields
   And its AI output state is "malformed" and the parse error is logged
```

```
Scenario: Required core metadata missing
   Given a run row without run_id, source_type, finished_at or status
   When the adapter evaluates it
   Then no evidence is created
   And the evidence run log records a validation failure listing the missing fields
```

```
Scenario: Evidence write rejected or failing
   Given a qualifying run row
   When Airtable rejects the evidence write or keeps failing after the bounded retries from Map MigGon37539
   Then the run is not recorded as evidenced
   And the evidence run log records a terminal failure with the rejection details, available for reprocessing
```

```
Scenario: Triggered capture fails and is recovered
   Given a terminal run row without evidence because the triggered automation failed or did not fire
   When the hourly evidence automation runs
   Then the evidence record is created once, using the same idempotency key
```

```
Scenario: Triggered and hourly automations process the same run
   Given the triggered and the hourly evidence automation pick up the same run row
   When both evaluate it
   Then only one evidence record exists for that run and it is not modified by the second
```

```
Scenario: Producer logs the same run twice
   Given two activity_runs rows with the same source_type and run_id
   When the evidence automations process them
   Then one evidence record is created and the duplicate row is logged as skipped (duplicate)
```

```
Scenario: Producer fails to log its run
   Given a producer (Ingestion Agent, automation or ticket review flow) cannot write its activity_runs row
   When its run finishes
   Then the producer's own run is not blocked or failed by the logging step
   And the failure is visible in that producer's own log or report
```

## Security & Performance

- Run logs and evidence store only ids, statuses, timestamps, trigger, actor, counts and outcome; no transcripts, meeting content, ticket bodies, prompts or Loom reports.
- Credentials are not hardcoded or logged; logs carry ids and error reasons, not payloads.
- The logging step added to producers is a single record write and must not noticeably lengthen or block their runs.
- Retries on evidence writes are bounded as defined in Map MigGon37539.
- The triggered automation processes one run row per execution; the hourly safety net uses the existing batch size and per-run time budget, so every evidence automation run stays within the Airtable automation script limit.
- Only the Ingestion Agent, the listed automations and the ticket review flow write to activity_runs; editors who are not producers get read-only interface access.
- No test data is written to production tables; testing uses fixtures and a controlled sample.

**Client-friendly AC:**
- Evidence is collected from Loom, ingestion, automations and ticket reviews, not only approvals.
- Repeated runs never create duplicate evidence.
- If an AI result is missing or broken, the evidence is still saved with the operational details.
- Activities that don't count as evidence are skipped and the reason is recorded.

---

## Item 2 · create-story · Nueva 2 (2 SP)

**Name:** SOC 2 evidence — Scrut-ready control mapping and CSV export

**Written story:** As a Backend Engineer, I want to map each SOC 2 evidence type to configurable SOC 2 controls and provide a per-control view and CSV export, so that the evidence captured in Map King Hub can be loaded into Scrut and reviewed by auditors without a direct API integration.

- asAn: Backend Engineer
- iWantTo: map each SOC 2 evidence type to configurable SOC 2 controls and provide a per-control view and CSV export
- soThat: the evidence captured in Map King Hub can be loaded into Scrut and reviewed by auditors without a direct API integration

**Business story (cliente):** As a Client, I want the collected evidence organized by SOC 2 control and downloadable, so that it can be handed to Scrut and the auditors without extra preparation.

**Acceptance criteria:**

## Acceptance Criteria

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

## Item 3 · comment · Map MigGon37539

> Scope update (Oct 13), per the re-estimation plan. This story keeps its 8 SP and covers evidence capture for human approvals of AI outputs, plus resilience: bounded retries, terminal failure state and reprocessing without duplicates. Two adjacent stories in SOC 2 Evidence complete the scope: MapKMigGon39261 extends capture to Loom, Ingestion Agent, automation events and ticket reviews, including missing or malformed AI output (4 SP); MapKMigGon39264 maps evidence to SOC 2 controls with a per-control view and CSV export ready for Scrut (3 SP). Direct Scrut API integration will be a separate backlog story once API access is available.

(En inglés porque SS lo lee el cliente. `<KEY-1>`/`<KEY-2>` se reemplazan por los business keys al crear las stories.)

---

## Item 4 · add-story-link · MapKMigGon39264

- Title: Map King (Map.ai) · Drive (story docs)
- URL: https://drive.google.com/drive/folders/1ASME3H6NrW590zQeUWQK7J7W56igjrT9?usp=sharing

---

## Requirements for Map MigGon37539's implementation plan (from Nueva 1 and Nueva 2)

Not SS items: these go into stories/MapMigGon37539/implementation-plan.md (repo) and its Drive backup. 37539's acceptance criteria in SS do not change.

1. **evidence.source_type is a link**, not text, to a source-types table with one row per type: approval, loom, ingestion, automation, ticket_review. The evidence module fills it once, at creation. Nueva 2 turns that table into soc2_control_mappings (adds controls, provisional flag, notes), so it is created in 37539 under that name.
2. **evidence.confirmed** (checkbox), set by the evidence module after the re-read confirms the write. Pages and exports in Nueva 2 show only confirmed records. An unconfirmed record stays for reprocessing and is never shown as evidence.
3. **Approvals use source_type "approval" and run_id = approval record id**, so the idempotency key (source_type + run_id) and traceability work the same for every source.
4. Evidence fields used by Nueva 2's export: run_id, source reference, finished_at (approval time for approvals), run status, trigger, counts, actor, ai_output_state (present, missing, malformed).
5. Before Nueva 2 starts: verify in Map King Hub that an interface list with a user filter on a lookup field can be downloaded as CSV with the filter applied.

---

## Item 5 · update-story-details · MapKMigGon39264 (created 14 oct, review)

Created in SS as **MapKMigGon39264** (sprint 4, 3 SP, Suggested by Resource). Its acceptance criteria match item 2 exactly. These fields don't:

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

## Item 6 · update-story-details · MapKMigGon39264 · acceptance criteria

Replace "the sources story" with "MapKMigGon39261" in the acceptance criteria (3 places: Browse scenario, Data & Integration mapping key line, and AI output state line). No other change.

## Item 7 · update-story-details · name · MapKMigGon39261 and MapKMigGon39264

Part prefix with two digits, so the parent and the order read at a glance in lists, sprints and QA:

- MapKMigGon39261 → `[37539 · P01] SOC 2 evidence capture — agent and automation sources`
- MapKMigGon39264 → `[37539 · P02] SOC 2 evidence — Scrut-ready control mapping and CSV export`

Client-facing alternative (no internal key): `[SOC 2 Evidence · P01] …` / `[SOC 2 Evidence · P02] …`.

## Decisions for the PM (not SS items)

- **Points:** 37539 (8) + MapKMigGon39261 (4) + MapKMigGon39264 (3) = **15 SP**, not the 13 in the plan. Hours support it (≈17,5 + 8–9 + 5 h). 4 is not on the Fibonacci scale.
- **Sprint order:** both new stories are in sprint 4 (ends 21 oct); 37539 is in sprint 5. Both depend on 37539 (evidence table, evidence module, source_type link, confirmed field), so either 37539 moves to sprint 4 or they move to sprint 5.
- **Dependencies:** SS has no dependency set between the three stories; the PM can add 37539 → 39261 → 39264.
