# MapKMigGon39261 · P01 cobertura de fuentes · SS drafts

Sub-story de Map MigGon37539 (SOC 2 Evidence). Creada en SS el 14 oct 2026 (sprint 4, 4 SP, Suggested by Resource). Partido de `ss-drafts.md` el 14 oct 2026; los items se renumeran 1–6 (entre paréntesis, el número que tenían).

Hermano: `ss-drafts-MapKMigGon39264.md` (P02). Lo que es de la 37539 (comentario de alcance, requisitos para su plan, decisiones del PM) sigue en `ss-drafts.md`.

Flujo (working agreement): Andrés revisa cada item y lo postea, o dice "post item N" para uno puntual. Claude no escribe en SS sin esa aprobación.

Campos comunes de ambas (igual que la 37539): proyecto Map King Discovery & Foundation · Key Project **SOC 2 Evidence** · release **v1** · sprint **5** (el PM la mueve si se adelanta a esta semana) · Work area **Backend** · Tech: Nueva 1 **AI, Airtable, TypeScript**; Nueva 2 **Airtable** · IA: **Hyperagent, Claude** · QA Gonzalo Lucas Ranieri · asignada a Andrés. Sin fechas (las decide el PM junto con el adelanto). Como los SP los fija Andrés, se envía también `aiSuggestedSps` con la estimación propia por horas: 5 para la Nueva 1 (≈8–9 h) y 3 para la Nueva 2 (≈5 h), así SS no registra el 2 como sugerencia de IA.

---

## Item 1 · create-story · Nueva 1 (3 SP) — ya creada en SS como MapKMigGon39261; texto de referencia (era Item 1)

**Name:** SOC 2 evidence capture — agent and automation sources (Loom, Ingestion, automation events, ticket reviews)

**Written story:** As a Backend Engineer, I want to extend the SOC 2 evidence capture built in Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews, so that all agent activity in Map King Hub produces audit-ready evidence, even when the AI output is missing or malformed.

- asAn: Backend Engineer
- iWantTo: extend the SOC 2 evidence capture from Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews
- soThat: all agent activity in Map King Hub produces audit-ready evidence, even when the AI output is missing or malformed

**Business story (cliente):** As a Client, I want evidence to be collected from every agent and automation in the operation, not only from approvals, so that audits cover the full picture of how the agents work.

**Acceptance criteria:**

## Acceptance Criteria

Scenario: Finished Loom runs produce evidence
   Given Loom writes its run to loom_sync_runs
   When the row reaches a terminal status (success, partial, failure or abandoned)
   Then the evidence automation is triggered for that row
   And one evidence record is created with source type "loom", run_id, status, trigger, started_at, finished_at and the created/updated/closed/failed counts
   And the record links back to the loom_sync_runs row

Scenario: Loom runs still in progress are not evidenced yet
   Given a loom_sync_runs row with status "running"
   When an evidence automation evaluates it
   Then no evidence is created for that run
   And it is evidenced once its status becomes terminal

Scenario: Ingestion Agent runs produce evidence
   Given the Ingestion Agent writes one row to activity_runs with source_type "ingestion" when a run finishes
   And the row matches the Ingestion qualifying rule
   When the row is created
   Then the evidence automation is triggered for that row
   And one evidence record is created with source type "ingestion", run_id, status, trigger, started_at, finished_at, counts and AI output state
   And the record links back to the activity_runs row

Scenario: Automation runs produce evidence
   Given a qualifying automation writes one row to activity_runs with source_type "automation" when it finishes
   When the row is created
   Then the evidence automation is triggered for that row
   And one evidence record is created with source type "automation", automation name, run_id, status, timestamps and outcome

Scenario: Ticket reviews produce evidence
   Given the ticket review flow writes one row to activity_runs with source_type "ticket_review" when a review is completed
   When the row is created
   Then the evidence automation is triggered for that row
   And one evidence record is created with the review outcome, reviewer, timestamps and the ticket id (no ticket content)

Scenario: Non-qualifying runs are skipped with a reason
   Given a run row that does not match its source type's qualifying rule (for example a loom_sync_runs row with status "rejected_busy")
   When an evidence automation evaluates it
   Then no evidence is created
   And the evidence run log records the row as skipped with the rule that excluded it

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

Scenario: AI output missing
   Given a qualifying run row with valid core metadata and no AI output
   When the evidence automation processes it
   Then the evidence record is created from the observed metadata
   And its AI output state is "missing"

Scenario: AI output malformed
   Given a qualifying run row with valid core metadata and unparseable AI output
   When the evidence automation processes it
   Then the evidence record is created without the invalid AI fields
   And its AI output state is "malformed" and the parse error is logged

Scenario: Required core metadata missing
   Given a run row without run_id, source_type, finished_at or status
   When the adapter evaluates it
   Then no evidence is created
   And the evidence run log records a validation failure listing the missing fields

Scenario: Evidence write rejected or failing
   Given a qualifying run row
   When Airtable rejects the evidence write or keeps failing after the bounded retries from Map MigGon37539
   Then the run is not recorded as evidenced
   And the evidence run log records a terminal failure with the rejection details, available for reprocessing

Scenario: Triggered capture fails and is recovered
   Given a terminal run row without evidence because the triggered automation failed or did not fire
   When the hourly evidence automation runs
   Then the evidence record is created once, using the same idempotency key

Scenario: Triggered and hourly automations process the same run
   Given the triggered and the hourly evidence automation pick up the same run row
   When both evaluate it
   Then only one evidence record exists for that run and it is not modified by the second

Scenario: Producer logs the same run twice
   Given two activity_runs rows with the same source_type and run_id
   When the evidence automations process them
   Then one evidence record is created and the duplicate row is logged as skipped (duplicate)

Scenario: Producer fails to log its run
   Given a producer (Ingestion Agent, automation or ticket review flow) cannot write its activity_runs row
   When its run finishes
   Then the producer's own run is not blocked or failed by the logging step
   And the failure is visible in that producer's own log or report

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

## Item 2 · update-story-details · name · MapKMigGon39261

Part prefix with two digits, so the parent and the order read at a glance in lists, sprints and QA:

- MapKMigGon39261 → [37539 · P01] SOC 2 evidence capture — agent and automation sources

Client-facing alternative (no internal key): [SOC 2 Evidence · P01] …
(Era parte del Item 7.)

## Item 3 · update-story-details · MapKMigGon39261 · fields

Los textos de SS salieron antes de cerrar el modelo de datos de la 37539. Estos campos no coinciden con lo que se construye:

- Tech: AI, Airtable → **AI, Airtable, TypeScript** (los adaptadores y el paso de registro son TypeScript, compilados a scripts de Airtable)
- Primary AI technology: Claude, Other, Hyperagent, Claude, Claude Code, Claude → **Claude, Claude Code, Hyperagent** (cada valor una vez, sin Other)
- AI description (replace; the current one says Hyperagent runs the evaluation, but Hyperagent only runs the Ingestion Agent, which logs its run):

> Claude helps design and refine the Airtable automation logic, the source adapters and the evidence mapping, and drafts the spec and the QA guide. Claude Code generates the TypeScript adapters, the logging step and the unit tests with fixtures. Hyperagent runs the Ingestion Agent, whose prompt gets a final step that logs its run to activity_runs. Run evaluation, idempotency and terminal-status capture are done by the Airtable scripts, not by AI.
(Era Item 8.)

## Item 4 · update-story-details · MapKMigGon39261 · acceptance criteria

Tres cambios en el texto de los criterios. Los escenarios Given / When / Then no cambian: la línea de Data & Integration define el link de source type.

**Technical Implementation** · replace the last bullet:

> - Adapters and the logging step are written in TypeScript under airtable/soc2/ and built into paste-ready automation scripts; unit tests per adapter with fixtures.

**Data & Integration Requirements** · replace the bullet that starts "Each evidence record stores source type" with these two bullets:

> - Each evidence record links to its source type row (loom, ingestion, automation, ticket_review) in the source-types table defined in Map MigGon37539, filled once at creation, and stores run_id, the source run row and, when available, the related ticket or automation reference, so it traces back to its origin.
> - The adapter resolves the source type of each run (the source_type of the activity_runs row, or loom for loom_sync_runs rows) to the matching row of the source-types table; a value with no matching row is a validation failure, never a new type.

**Data & Integration Requirements** · replace the bullet that starts "A run is recorded as evidenced only after":

> - The evidence module marks the evidence record as confirmed only after re-reading it confirms the write, on both the triggered and the hourly path. A record that is not confirmed is kept for reprocessing, is never shown as evidence and does not count as the run being evidenced.
(Era Item 9.)

## Item 5 · update-story-details · MapKMigGon39261 · client-friendly acceptance criteria

Replace the whole client-friendly text. Cambian tres viñetas (marcadas abajo en la lista de cambios); el resto queda igual. Quedan fuera "evidence destination" (no hay destino externo en esta story; la API de Scrut es backlog) y "Unsupported activity types" (lo que se construye es omitir con razón, no rechazar).

> ## What you will be able to do
> - Capture audit-ready evidence for Loom runs.
> - Capture audit-ready evidence for Ingestion Agent runs.
> - Capture audit-ready evidence for automation events.
> - Capture audit-ready evidence for ticket reviews.
> - Rely on evidence being created even when AI-generated details are missing or unusable.
> - Trace each evidence record back to the original activity for audit review.
>
> ## How it will work
> - The same evidence approach already used for the existing SOC 2 workflow will be extended to these additional activity types.
> - Each supported activity will create a consistent evidence record with the key details needed for compliance review.
> - Available AI-generated details can be included as supporting information, but they will not be required for evidence to be created.
> - Evidence is stored in Map King Hub with a consistent structure and only counts once it is confirmed as saved, ready to be organized by SOC 2 control in a following story.
> - Duplicate evidence for the same activity will be prevented.
>
> ## What to expect
> - Evidence will still be captured when AI output is missing.
> - Evidence will still be captured when AI output is malformed, using the valid activity details that are available.
> - Only the listed activities create evidence; any other run is skipped and the reason is recorded.
> - Missing required activity details will prevent incomplete evidence from being stored.
> - Temporary failures when saving evidence are retried a limited number of times; if they persist, the run is flagged for reprocessing and is never counted as evidence.
> - The solution will protect sensitive information and support audit needs without slowing down normal operations.

Changed bullets: "How it will work" 4th (was "keep records aligned ... evidence destination"); "What to expect" 3rd (was "Unsupported activity types") and 5th (was "Temporary downstream failures").
(Era Item 10.)

## Item 6 · update-story-details · MapKMigGon39261 · story text

El texto de historia que tiene SS (generado por la herramienta Generate Story) no es el del borrador del Item 1. Se vuelve al del borrador, que dice qué se construye: extender la captura de la 37539 a las cuatro fuentes y cubrir salida de IA ausente o malformada. El nombre no se toca aquí: lo cubre el Item 2.

- Written story (technical), replace:

> As a Backend Engineer, I want to extend the SOC 2 evidence capture built in Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews, so that all agent activity in Map King Hub produces audit-ready evidence, even when the AI output is missing or malformed.

- asAn: Backend Engineer
- iWantTo: extend the SOC 2 evidence capture from Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews
- soThat: all agent activity in Map King Hub produces audit-ready evidence, even when the AI output is missing or malformed

- Business story (client), replace:

> As a Client, I want evidence to be collected from every agent and automation in the operation, not only from approvals, so that audits cover the full picture of how the agents work.

Para quién cambia: la historia actual ("As a compliance reviewer…") describe al revisor, no a quien construye, y la del cliente repite el nombre de las cuatro fuentes sin decir por qué importa. Si Generate Story vuelve a regenerar estos campos, hay que pegar este texto después, no antes.
(Era Item 11.)

## Item 7 · update-story-details · MapKMigGon39261 · todos los campos (versión 2, catálogo de eventos)

Reemplaza los items 2 a 6. Texto completo, campo por campo, en MapKMigGon39261-final.md (versión 2 del 14 oct). Campos que cambian respecto de lo que hoy está en SS: Name, Tech, Primary AI technology, Written story, Business story, AI description, Acceptance criteria (todas las secciones) y Client-friendly acceptance criteria (hoy vacío).

Motivo: el alcance pasa del diseño con activity_runs al catálogo de eventos (soc2-event-catalog.md) y a las tablas ya creadas en Map King Hub. Salen activity_runs, las revisiones de tickets y el paso de registro en los agentes.
