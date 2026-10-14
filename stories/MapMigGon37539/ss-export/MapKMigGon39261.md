# MapKMigGon39261

*Parte 1 de 2 de Map MigGon37539 · cobertura de fuentes* · [Abrir en Singular Stories](https://ss-prod-web-internal-804852907406.us-central1.run.app/workflow/74626398-f738-4a58-aef1-49704114f1d0)

## Datos

- **Proyecto:** Map King Discovery & Foundation / Max Hanratty
- **Key Project:** SOC 2 Evidence · **Release:** v1 (wide 2026-11-04, planned)
- **Objetivo:** Run the front office on agents to scale from 10 to 1,000 events/year · **Key result:** Automate content ingestion
- **Asignado:** Andres Serron · **QA:** Gonzalo Lucas Ranieri
- **Estado:** Suggested by Resource · **Stage:** Back-End
- **Sprint:** 4 (2026-09-21 → 2026-10-21)
- **Story points:** 4 (talent 4 · AA 0) · **Sugerencia IA:** 5 · **Ahorro estimado por IA:** 20 %
- **Work area:** Backend · **Techs:** AI, Airtable
- **Involucra IA:** sí · **Tecnología de IA:** Claude, Other, Hyperagent, Claude, Claude Code, Claude
- **Impacto:** — · **Origen:** Internal Portal · **Creada:** 2026-10-14
- **Fechas:** sin fechas
- **Calidad de escritura:** — (sin evaluar)
- **Dependencias:** ninguna · **Links:** 0 · **Evidencia:** 0

## Historia

As a compliance reviewer, I want all agent activity to produce usable evidence records, so that I can verify work was performed even when some generated output is incomplete or incorrect.

## Historia para el cliente

As a Client, I want SOC 2 evidence capture extended to Loom runs, Ingestion Agent runs, automation events, and ticket reviews, so that all activity in Map King Hub produces reliable audit-ready evidence for compliance.

## Descripción de IA

Claude will draft and refine Airtable automation logic, adapters, and evidence-mapping scripts; Claude Code will generate TypeScript and tests. Hyperagent/Other will orchestrate run-log evaluation, idempotency, and terminal-status capture for loom_sync_runs and activity_runs.

## Criterios de aceptación

### Acceptance Criteria

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

### Technical Implementation

- Two run logs feed evidence capture: loom_sync_runs (existing, written by Loom) and activity_runs (new, append-only), where the Ingestion Agent, each qualifying automation and the ticket review flow add one row per finished run.
- Producers only log their run: the Ingestion Agent prompt gets a final step that writes its activity_runs row, and each qualifying automation gets a final script step that does the same. Producers never write evidence.
- A record-triggered Airtable automation runs the evidence script when a loom_sync_runs row reaches a terminal status or a new activity_runs row is created, so evidence is created within seconds of the run finishing.
- The hourly evidence automation from Map MigGon37539 stays as the safety net: it picks up terminal rows without evidence (failed trigger, missed event) using the same idempotency key.
- One adapter per source type (loom, ingestion, automation, ticket_review) maps the run row to the evidence contract from Map MigGon37539 and returns qualify or skip with a reason; both the triggered and the hourly automation use the same adapters and evidence module.
- Qualifying rules per source type live in the evidence rules table and can be changed without code.
- Adapters and the logging step are written in TypeScript under airtable/cct/ and built into paste-ready automation scripts; unit tests per adapter with fixtures.

### Data & Integration Requirements

- Evidence sources are two run logs in Map King Hub: loom_sync_runs (existing, written only by Loom) and activity_runs (new), where the Ingestion Agent, each qualifying automation and the ticket review flow add one row per finished run.
- activity_runs is append-only: each producer writes one row per run, once, when the run finishes (always with a terminal status), and never edits or deletes rows; the evidence automations only read it.
- activity_runs fields: run_id, source_type (ingestion, automation, ticket_review), source_name, source_record_id, ticket_id (ticket reviews only), status (success, partial, failure), outcome, actor, trigger, started_at, finished_at, counts, ai_output_state.
- Each evidence record stores source type, run_id, the source run row and, when available, the related ticket or automation reference, so it traces back to its origin.
- Loom evidence keeps the trigger exactly as Loom records it ("schedule" for the daily run, "slack:#ingestion <requester>" for Slack runs, and the panel's value), so evidence shows whether a run was scheduled or requested and by whom.
- AI output state is one of: present, missing, malformed. AI content stays in the AI fields, separated from observed metadata.
- Evidence status per run (evidenced, skipped, failed) is kept in the evidence run log from Map MigGon37539, not in the source run logs, so each table keeps a single kind of writer.
- The triggered and the hourly evidence automation use the idempotency key (source_type + run_id), the validation, retry policy, terminal-failure state and reprocessing from Map MigGon37539; a run already evidenced is a no-op, never an update.
- A run is recorded as evidenced only after the evidence record is confirmed by re-reading it, on both the triggered and the hourly path.

### Edge Cases & Error Handling

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

### Security & Performance

- Run logs and evidence store only ids, statuses, timestamps, trigger, actor, counts and outcome; no transcripts, meeting content, ticket bodies, prompts or Loom reports.
- Credentials are not hardcoded or logged; logs carry ids and error reasons, not payloads.
- The logging step added to producers is a single record write and must not noticeably lengthen or block their runs.
- Retries on evidence writes are bounded as defined in Map MigGon37539.
- The triggered automation processes one run row per execution; the hourly safety net uses the existing batch size and per-run time budget, so every evidence automation run stays within the Airtable automation script limit.
- Only the Ingestion Agent, the listed automations and the ticket review flow write to activity_runs; editors who are not producers get read-only interface access.
- No test data is written to production tables; testing uses fixtures and a controlled sample.

## Criterios para el cliente

### What you will be able to do
- Capture audit-ready evidence for Loom runs.
- Capture audit-ready evidence for Ingestion Agent runs.
- Capture audit-ready evidence for automation events.
- Capture audit-ready evidence for ticket reviews.
- Rely on evidence being created even when AI-generated details are missing or unusable.
- Trace each evidence record back to the original activity for audit review.

### How it will work
- The same evidence approach already used for the existing SOC 2 workflow will be extended to these additional activity types.
- Each supported activity will create a consistent evidence record with the key details needed for compliance review.
- Available AI-generated details can be included as supporting information, but they will not be required for evidence to be created.
- The system will keep records aligned and consistent across Map King Hub and the evidence destination.
- Duplicate evidence for the same activity will be prevented.

### What to expect
- Evidence will still be captured when AI output is missing.
- Evidence will still be captured when AI output is malformed, using the valid activity details that are available.
- Unsupported activity types will not be added accidentally.
- Missing required activity details will prevent incomplete evidence from being stored.
- Temporary downstream failures will be handled with retry behavior to improve reliability.
- The solution will protect sensitive information and support audit needs without slowing down normal operations.

## Observaciones (revisión 2026-10-14)

- Falta TypeScript en las techs (los adaptadores y el paso de registro son .ts).
- La tecnología de IA quedó con valores repetidos ("Claude, Other, Hyperagent, Claude, Claude Code, Claude").
- Los criterios en SS son la versión anterior a la última actualización: faltan source_type como link y el campo confirmed en Data & Integration.
- El cliente-friendly menciona "Unsupported activity types" y "evidence destination", términos del texto anterior.
