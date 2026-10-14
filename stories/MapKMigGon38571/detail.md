---
points: 4
---

# Story MapKMigGon38571

URL : https://ss-prod-web-internal-804852907406.us-central1.run.app/workflow/52b318c6-34f7-40e7-a1b9-2b374e664ef3

| Field          | Value                    |
|----------------|--------------------------|
| Points         | 8 SP                     |
| Chapter        | Backend                  |
| Delivery date  | Oct 9, 2026 · Overdue    |
| Talent         | AS Andres Serron         |
| QA responsible | GR Gonzalo Lucas Ranieri |

## Functional Requirements

* The backend must support filtering and lane assignment for tasks using the following dimensions where available: domain, owner, and source.
* The backend must support the following lane values for each task: On Fire, This Week, Waiting On, Queued, and Icebox.
* The system must return a task set that can be filtered by any single dimension or combination of dimensions across all connected task sources.
* The system must support a unified triage view data response that normalizes tasks from multiple sources into a consistent structure for downstream consumption.
* The system must identify stale tasks based on configurable inactivity criteria and include a stale status indicator in the returned task data.
* The system must provide delegate prompt eligibility for tasks that meet configured conditions for reassignment or follow-up.
* Given a task has matching domain, owner, source, and lane metadata, when a filtered request is made, then the response must include only tasks matching the requested filters.
* Given a task is stale according to configured rules, when the task is returned in the triage response, then the response must mark the task as stale.
* Given a task qualifies for delegation, when the task is returned, then the response must include a delegate prompt flag or prompt payload for downstream use.
* The backend must preserve lane membership even when a task originates from different upstream systems, provided the task can be mapped to a known task identity.

## Technical Implementation

* The backend must implement service logic that ingests task records from Airtable and any other configured task sources, then maps them into a common task contract used by the triage workflow.
* Airtable field mappings for domain, owner, source, lane, last activity date, and task identity must be validated before records are included in the unified response.
* If AI is used to infer missing metadata such as domain, owner, source classification, stale reasoning, or delegate suggestions, the backend must clearly separate inferred values from source-of-record values in the returned contract.
* AI-generated classifications or prompts must not overwrite persisted source values unless explicitly approved by the configured workflow.
* The backend must expose a stable contract for requesting filtered triage results, including supported filter parameters, lane values, stale status, and delegate prompt data.
* Validation must reject unsupported lane names, malformed filter values, or invalid combinations that cannot be processed.
* Logging must capture ingestion failures, mapping failures, AI inference failures, and partial-source response conditions with enough context for operational debugging.
* Where external reads fail transiently, the backend should retry according to configured retry policy before returning a partial or failed response.
* The implementation must support deterministic stale detection rules even when AI is used for supplemental prompting.

## Data & Integration Requirements

* The system must normalize task data from Airtable and any connected sources into a consistent data model containing at minimum: task identifier, title or summary, source, domain, owner, lane, last activity timestamp if available, stale indicator, and delegate prompt indicator or content.
* Source-specific values must be transformed into canonical lane and filter values without losing traceability to the original source.
* The backend must define how missing or null values are handled for domain, owner, source, and last activity date.
* Airtable integration must handle record retrieval, field extraction, and transformation into the unified task model.
* If AI is used, the backend must pass only the minimum required task context for classification or prompt generation and must persist or return the AI output in a way that distinguishes it from original source data.
* The backend must maintain data consistency so that the same task is not duplicated in the unified response when it appears across multiple synchronized sources and can be matched by configured identity rules.
* The response contract must indicate when returned results are complete versus partial due to source unavailability or transformation failure.
* Any persisted lane updates, stale flags, or delegate prompt states must remain consistent with the source-of-record strategy defined for the workflow.

## Edge Cases & Error Handling

* Tasks missing one or more filter attributes must still be processable; the backend must either return them with null canonical values or exclude them according to documented filter behavior.
* If a task source returns malformed or incomplete records, the backend must skip or quarantine invalid records without failing the entire triage response unless the failure exceeds configured thresholds.
* If Airtable fields required for normalization are renamed, missing, or incompatible, the backend must return a clear integration error and log the field-level issue.
* If AI inference fails or times out, the backend must still return the task using available source data and omit inferred stale reasoning or delegate prompt content.
* If stale detection cannot be calculated because activity data is missing, the backend must return an unknown or non-stale default state according to configured rules rather than silently fabricating a result.
* If duplicate tasks cannot be confidently resolved across sources, the backend must avoid destructive merging and return traceable source-specific records or a flagged ambiguity state.
* Invalid filter requests must return a structured error response describing the invalid parameter or unsupported value.
* Empty result sets for valid filters must return a successful response with no tasks rather than an error.

## Security & Performance

* The backend must enforce access controls appropriate to task and ownership data so only authorized consumers can request unified triage results.
* Sensitive task metadata sent to AI services, if any, must be minimized to only what is necessary for classification or delegate prompt generation.
* Integration credentials for Airtable and any AI provider must be stored and accessed securely through approved secret management practices.
* The service should return filtered triage responses within acceptable operational latency for expected dataset sizes, including graceful degradation if AI enrichment is slow or unavailable.
* The implementation should avoid unnecessary repeated reads from Airtable by using appropriate caching, batching, or pagination strategies where supported and safe.
* Audit or operational logs must avoid leaking sensitive task content beyond what is required for troubleshooting.
