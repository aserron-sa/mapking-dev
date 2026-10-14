# Map MigGon37539

*Story original (padre)* · [Abrir en Singular Stories](https://ss-prod-web-internal-804852907406.us-central1.run.app/workflow/e0d4e200-d292-4244-8baf-141d025d86b1)

## Datos

- **Proyecto:** Map King Discovery & Foundation / Max Hanratty
- **Key Project:** SOC 2 Evidence · **Release:** v1 (wide 2026-11-04, planned)
- **Objetivo:** Run the front office on agents to scale from 10 to 1,000 events/year · **Key result:** Automate content ingestion
- **Asignado:** Andres Serron · **QA:** Gonzalo Lucas Ranieri
- **Estado:** In Progress (desde 2026-08-13) · **Stage:** Stage Not Assigned
- **Sprint:** 5 (2026-10-22 → 2026-11-20)
- **Story points:** 8 (talent 8 · AA 0) · QA SP 1 · **Sugerencia IA:** 7 · **Ahorro estimado por IA:** 20 %
- **Work area:** Backend · **Techs:** AI, Airtable
- **Involucra IA:** sí · **Tecnología de IA:** Claude, Hyperagent
- **Impacto:** medium · **Origen:** Singular Stories · **Creada:** 2026-07-22
- **Fechas:** start 2026-08-13 · due 2026-08-14 · approved 2026-07-24
- **Calidad de escritura:** 97 · Ready for implementation
- **Dependencias:** ninguna · **Links:** 0 · **Evidencia:** 0

## Historia

As a Backend Engineer, I want to implement automatic SOC 2 evidence capture within Scrut-aligned backend workflows, so that agent activity produces consistent, audit-ready records with minimal manual follow-up.

## Historia para el cliente

As a Client, I want SOC 2 evidence to be collected automatically during agent operations, so that the business has reliable audit support without running a separate documentation effort.

## Descripción de IA

Claude will normalize agent activity into Scrut-ready evidence payloads, extract only audit-relevant context, and flag validation issues. Hyperagent will orchestrate capture workflows, idempotency, retries, and Airtable writes with structured logging and persistence checks.

## Criterios de aceptación

### Functional Requirements
- The backend shall capture evidence automatically from qualifying agent operations relevant to SOC 2 control support, without requiring a separate manual documentation step.
- The backend shall create evidence records in a format that can be mapped into Scrut's framework for audit review.
- Given an agent operation that produces evidence-worthy activity, when the operation completes or reaches the configured capture point, then the system shall generate an evidence record containing the required metadata and supporting context.
- Given evidence generation succeeds, when the record is persisted, then it shall be marked as available for downstream audit use.
- Given the same source operation is received more than once, when the backend evaluates the event, then it shall prevent duplicate evidence creation using a deterministic idempotency rule.
- The system shall support traceability from each evidence record back to the originating agent activity.
- The system shall log whether evidence capture succeeded, failed, or was skipped based on validation rules.

### Technical Implementation
- The backend shall implement evidence capture as a service-level workflow triggered by agent activity or backend events, with clear boundaries between agent execution, evidence transformation, and persistence.
- The implementation shall validate required inputs before evidence creation, including presence of a source identifier, event timestamp, operation outcome/status, and sufficient context to support audit review.
- The backend shall transform raw agent activity into a normalized evidence payload suitable for Scrut-aligned storage and review, without exposing internal transient processing details that are not needed for audit evidence.
- Where AI-generated outputs are used as part of agent operations, the backend shall capture only the relevant evidence context and outcome metadata needed for auditability, not arbitrary model output by default.
- If Airtable is used as the persistence or operational evidence store, the backend shall write evidence records using a defined field mapping and validate that required Airtable fields are populated before submission.
- The backend shall handle Airtable integration responses explicitly, including success, validation failure, rate limiting, and transient service errors.
- The implementation shall emit structured logs for evidence creation attempts, validation failures, external write attempts, retries, and final status.
- The backend shall expose stable internal contracts for evidence creation so that agent services can submit evidence consistently across workflows.

### Data & Integration Requirements
- The data flow shall be: agent activity occurs -> backend evaluates whether the activity qualifies as SOC 2 evidence -> backend normalizes the event into an evidence payload -> backend persists the evidence record -> backend records the persistence result for traceability.
- The evidence payload shall include, at minimum, a unique source reference, event type/category, timestamp, operation status, and enough contextual metadata to support audit review within Scrut's framework.
- The backend shall define and enforce the mapping between source agent activity fields and the target evidence fields stored in Airtable or the designated evidence repository.
- If AI-derived content is included, the backend shall distinguish between source event metadata and AI-produced content so downstream reviewers can identify what was system-generated versus operationally observed.
- The integration boundary with Airtable shall include field-level validation, response handling, and persistence confirmation so the system can determine whether evidence is actually stored.
- The backend shall preserve data consistency by ensuring that a source event cannot be marked as successfully evidenced unless the target evidence record has been confirmed as persisted.
- The system shall support reprocessing of failed evidence submissions without creating inconsistent duplicate records.

### Edge Cases & Error Handling
- If a source event is missing required fields, the backend shall reject evidence creation for that event, log the reason, and mark it as failed or skipped according to configured validation behavior.
- If Airtable rejects a record because of schema or field validation issues, the backend shall capture the rejection details and not mark the evidence as successfully stored.
- If Airtable or another dependency is temporarily unavailable, the backend shall retry according to configured retry rules for transient failures.
- If retries are exhausted, the backend shall record a terminal failure state that can be monitored or reprocessed later.
- If the same event is delivered multiple times or retried after a timeout, the backend shall avoid duplicate evidence creation through idempotent processing.
- If AI output is malformed, unavailable, or not relevant to evidence capture, the backend shall still preserve the underlying operational event metadata when possible rather than failing the entire evidence workflow unnecessarily.
- If an event does not meet the criteria for SOC 2 evidence capture, the backend shall explicitly skip it and log the skip reason.

### Security & Performance
- The backend shall ensure evidence records contain only data necessary for audit support and operational traceability.
- Access to evidence creation and persistence workflows shall follow existing backend authorization and secret-management practices for external integrations such as Airtable.
- Integration credentials and sensitive configuration values shall not be hardcoded or written to application logs.
- The system shall use structured logging that supports audit troubleshooting without exposing unnecessary sensitive content.
- Evidence capture shall execute within normal backend operational tolerances and shall not materially block or degrade core agent processing beyond acceptable service limits.
- For transient external failures, retry behavior shall be bounded to prevent runaway load against Airtable or other dependent services.

## Criterios para el cliente

### Acceptance Criteria
- Evidence is collected automatically from relevant activities without needing manual documentation.
- Records are created in a format suitable for audit reviews.
- Each activity generates a unique evidence record with necessary details.
- Duplicate records are prevented for repeated activities.
- Evidence records can be traced back to the original activities.
- The system logs the success or failure of evidence collection.

## Observaciones (revisión 2026-10-14)

- El due date (2026-08-14) está vencido; el plan propone corregirlo.
- Los puntos (8) no los puede editar el talento; el plan pide 13 en total, repartidos con las dos partes.
