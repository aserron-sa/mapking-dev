# MapKMigGon39261 · final story text

Texto final para Singular Stories, campo por campo, listo para pegar. Versión 2 · 2026-10-14: alineada con el catálogo de eventos (soc2-event-catalog.md) y las tablas ya creadas en Map King Hub (airtable/soc2/schema/). Reemplaza la versión 1. Cada sección con título de nivel 1 es un campo de SS; se pega lo que está debajo del título, sin el título.

# Name

[37539 · P01] SOC 2 evidence capture — Loom, Ingestion Agent and automation events

# Work area

Backend

# Tech

AI, Airtable, TypeScript

# Primary AI technology

Claude, Claude Code

# Written story

As a Backend Engineer, I want to capture a defined catalog of Loom, Ingestion Agent and automation events as SOC 2 evidence, so that agent and automation activity in Map King Hub produces audit-ready records, and new events can be added to the catalog without changing the agents.

# Business story

As a Client, I want the agents and automations to leave audit-ready evidence of their work, starting with the Loom and ingestion runs and the system's own integrity checks, so that audits can see how the operation is monitored.

# AI description

Claude helps define the event catalog, the detection rules and the evidence mapping, and drafts the spec and the QA guide. Claude Code writes the TypeScript capture script, with one unit test per event built from real source rows. No agent prompt changes: evidence is written only by Airtable automations.

# Acceptance criteria

## Acceptance Criteria

Scenario: Loom sync start produces evidence
   Given Loom creates a loom_sync_runs row with status "running"
   And the event type loom.sync.init is enabled in soc2_event_types
   When the capture automation processes that row
   Then one soc2_events record is created for loom.sync.init with run_ref = run_id, produced_at = started_at, trigger and actor "agent:Loom" (plus the requester for Slack runs)
   And the record links to its event type and to the loom_sync_runs row

Scenario: Loom sync completion produces evidence
   Given a loom_sync_runs row whose status changes to "success" or "partial"
   And loom.sync.completed is enabled
   When the capture automation processes that row
   Then one soc2_events record is created for loom.sync.completed with outcome success or partial, produced_at = finished_at and the created, updated, closed, skipped and failed counts
   And its AI output state is "present", or "missing" when the run had enrichment fallbacks

Scenario: Loom sync error produces evidence
   Given a loom_sync_runs row whose status changes to "failure" or "abandoned"
   And loom.sync.error is enabled
   When the capture automation processes that row
   Then one soc2_events record is created for loom.sync.error with outcome failure or abandoned

Scenario: Ingestion run completion produces evidence
   Given the Ingestion Agent writes an ingestion_runs row with run_status "Completed" or "Completed with errors"
   And ingestion.run.completed is enabled
   When the capture automation processes that row
   Then one soc2_events record is created for ingestion.run.completed with outcome success or partial, run_ref = source_file, produced_at = run_at and the row counts
   And its AI output state is "not_applicable"

Scenario: Ingestion run error produces evidence
   Given an ingestion_runs row with run_status "Failed"
   And ingestion.run.error is enabled
   When the capture automation processes that row
   Then one soc2_events record is created for ingestion.run.error with outcome failure

Scenario: Automation events produce evidence
   Given a priority_events row with source "automation"
   And its event_type is "triage_compute" (from the hourly triage automation) or "guard_fix" or "dedupe" (from the task_lanes integrity automations)
   When the capture automation processes that row
   Then a triage_compute row with status "ok" produces automation.triage_compute.completed, any other status produces automation.triage_compute.error, and guard_fix or dedupe produces automation.lanes_integrity.fixed
   And each record names the source automation as actor and has AI output state "not_applicable"

Scenario: Event types in trace are detected but not written
   Given an event type with status "trace"
   When a matching source row is processed
   Then no soc2_events record is created
   And the capture run records in its trace detail the event_key, the source row and the outcome that would have been written

Scenario: Paused and disabled event types are not captured
   Given an event type with status "paused" or "disabled" (ingestion.run.init starts disabled because the agent does not log its start)
   When a matching source row is processed
   Then no evidence is created and the capture run counts it as skipped with the status as reason
   And switching a paused type back to enabled does not backfill what happened while it was paused

Scenario: Non-qualifying rows are skipped with a reason
   Given a source row that matches no enabled event (for example a loom_sync_runs row with status "rejected_busy", a priority_events row written by the extension, or a triage run in dry run)
   When the capture automation processes it
   Then no evidence is created
   And the capture run records the row as skipped with the reason

## Technical Implementation

- One capture script, airtable/soc2/soc2-capture.ts, holds the registry of every studied event: source table, detection rule, field mapping (produced_at, actor, outcome, summary, counts), test-data rule and rule version.
- The same script is pasted in every capture automation: loom_sync_runs created, loom_sync_runs terminal status, ingestion_runs created or replaced, priority_events created with source automation, and an hourly safety net. Each passes the triggering table and record, or runs in hourly mode.
- The script reads soc2_event_types and acts only on event types whose status allows it: enabled writes, trace only records, paused and disabled skip.
- Writes go through the evidence module from Map MigGon37539: event_key idempotency, validation, bounded retries, terminal failure state and confirmation by re-reading.
- The hourly run picks up source rows whose event was missed (failed or skipped trigger) using the same event_key.
- Producers are not changed: Loom and the Ingestion Agent keep writing only their own run logs, and the selected automations already log to priority_events.
- Unit tests per event with fixtures taken from real loom_sync_runs, ingestion_runs and priority_events rows; the automations start with dryRun = yes and the event types in trace.

## Data & Integration Requirements

- Sources, read only: loom_sync_runs (Loom), ingestion_runs (Ingestion Agent) and priority_events (automations), all existing in Map King Hub.
- Targets, created in Map MigGon37539: soc2_event_types (catalog: event_code, description, source, detection, status, version, category, controls), soc2_events (evidence) and soc2_capture_runs (run log).
- event_key = event_code + source record id + produced_at in ISO UTC. A key that already exists is a no-op, never an update.
- Each evidence record stores event type, source table, source record id and URL, run_ref, produced_at (source time), source_recorded_at (server time of the source row), recorded_at (server time of capture, the evidence time), actor, trigger, outcome, a one-line summary and counts.
- A last-modified field is added to loom_sync_runs and ingestion_runs (additive, no producer change) to get server time for status changes.
- Actor is "agent:Loom", "agent:Ingestion Agent" or "automation:<name>", plus the requester when the source records one; Slack requesters are normalized.
- AI output state is present, missing, malformed or not_applicable; AI text is never copied.
- Rows before the capture go-live date, rows marked TEST or QA-TEST, sample files and dry runs are stored with is_test and never exported.
- The rule version in the script must match soc2_event_types.version; a mismatch is reported as a config issue and that event is not captured.

## Edge Cases & Error Handling

Scenario: Source row missing required data
   Given a source row without record id, timestamp or status
   When the capture script evaluates it
   Then no evidence is created
   And the capture run records a validation failure listing the missing fields

Scenario: Triggered and hourly capture process the same row
   Given the triggered automation and the hourly run pick up the same source row
   When both evaluate it
   Then only one soc2_events record exists for that event_key and it is not modified by the second

Scenario: Evidence write keeps failing
   Given a qualifying source row
   When Airtable rejects the write or keeps failing after the bounded retries from Map MigGon37539
   Then the event is not marked confirmed
   And the capture run records the failure with its kind and the record, available for reprocessing

Scenario: Loom run killed before closing its row
   Given a Loom run that stopped before updating its loom_sync_runs row
   When the next Loom run marks that row "abandoned"
   Then loom.sync.error is captured with outcome abandoned and produced_at = the time it was marked

Scenario: Ingestion file replaced
   Given the Ingestion Agent replaces the data of a file and updates its ingestion_runs row in place
   When the capture automation processes the updated row
   Then a new event is created for the new run_at and the earlier event is kept

Scenario: Catalog and script out of sync
   Given an event in the script with no row in soc2_event_types, or with a different version
   When the capture script starts
   Then that event is not captured
   And the capture run records a config issue naming the event

## Security & Performance

- Evidence stores only ids, statuses, timestamps, trigger, actor, counts and outcome; no task text, file contents, prompts or Loom reports.
- Only the capture automations write soc2_events and soc2_capture_runs; editors maintain soc2_event_types; reviewers read through interfaces.
- The script runs inside Airtable with no credentials; logs carry ids and error reasons, not payloads.
- Agents are not changed and capture runs after their writes, so it never blocks or slows them.
- Each triggered run processes one row; the hourly run uses batches and a time budget within the Airtable script limit.
- No test data is exported; testing uses fixtures and trace mode before enabling.

# Client-friendly acceptance criteria

## What you will be able to do
- See audit-ready evidence of every Loom sync: when it started, how it ended and what it processed.
- See evidence of every content ingestion run and of any run that failed.
- See evidence that the system checks itself: the hourly triage run and the automatic fixes to the priority lists.
- Add new kinds of evidence later by extending a catalog, without changing the agents.

## How it will work
- A catalog lists each event that counts as evidence, with a description of what it is and why it matters.
- When one of those events happens, an automation records it within seconds, with an hourly check that catches anything missed.
- New events can be tested in a trace mode that shows what would be recorded before it counts as evidence.

## What to expect
- Each record can be traced back to the original run.
- The same event is never recorded twice.
- Test runs and sample data are kept apart and never count as evidence.
- Records contain only ids, times, outcomes and who acted; no task, file or report content.
- The agents keep working exactly as today.
