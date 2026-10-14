# MapKMigGon39264 · final story text

Texto final para Singular Stories, campo por campo, listo para pegar. Versión 2 · 2026-10-14: alineada con el catálogo de eventos, las tablas ya creadas en Map King Hub (airtable/soc2/schema/) y el formato Scrut (scrut-soc2-evidence-format.md §3). Reemplaza la versión 1. Cada sección con título de nivel 1 es un campo de SS; se pega lo que está debajo del título, sin el título.

# Name

[37539 · P02] SOC 2 evidence — Scrut-ready control mapping and CSV export

# Work area

Backend

# Tech

Airtable

# Primary AI technology

Claude

# Written story

As a Backend Engineer, I want to map each SOC 2 evidence event type to configurable SOC 2 controls and provide a per-control, per-period view with CSV export, so that the evidence captured in Map King Hub can be loaded into Scrut and reviewed by auditors without a direct API integration.

# Business story

As a Client, I want the collected evidence organized by SOC 2 control and period and downloadable, so that it can be handed to Scrut and the auditors without extra preparation.

# AI description

Claude helps design the control-mapping model, the lookups, the interface filters and the CSV column contract, and drafts the spec, the provisional mapping and the QA guide. Everything is built natively in Airtable (tables, lookups, formulas, interfaces); no scripts, automations or code are added by this story.

# Acceptance criteria

## Acceptance Criteria

Scenario: Browse evidence by SOC 2 control
   Given evidence records in soc2_events captured by Map MigGon37539 and MapKMigGon39261
   And soc2_event_types maps each event type to one or more SOC 2 controls in soc2_controls
   When a reviewer opens the per-control evidence page and filters by a control
   Then every exportable evidence record (confirmed, not test data, not modified after capture) whose event type is mapped to that active control is listed
   And the evidence records themselves are not modified

Scenario: Filter by period
   Given a control is selected on the per-control evidence page
   When the reviewer sets a period (for example a quarter) on recorded_at
   Then only evidence recorded in that period is listed

Scenario: One event type mapped to several controls
   Given an event type mapped to more than one control
   When a reviewer filters the page by each of those controls
   Then the same evidence records appear under each control
   And each record remains a single record in soc2_events

Scenario: Mapping changes apply without rewriting evidence
   Given evidence exists for an event type
   When an authorized editor changes the controls or the provisional flag of that event type, or deactivates a control
   Then the per-control page and the next export reflect the change with no code changes and no reprocessing
   And the event type and the control show who made the latest change and when

Scenario: Export evidence for a control and period
   Given a control and a period are selected on the per-control evidence page
   When the reviewer downloads the CSV from the interface
   Then the file contains only the evidence listed for that control and period
   And its columns, in order, are control, mapping_provisional, category, event_code, event_name, event_key, recorded_at, produced_at, outcome, actor, trigger, summary, source_table, source_record_id, source_url

Scenario: Exported evidence traces back to its origin
   Given a row in a per-control CSV export
   When an auditor opens its source_url or looks up its event_key in Map King Hub
   Then the matching soc2_events record is found
   And from it the source row (loom_sync_runs, ingestion_runs or priority_events)

Scenario: Only exportable evidence is listed
   Given evidence records that are unconfirmed, marked as test data, or modified after capture
   When a reviewer browses or exports evidence
   Then those records never appear
   And event types in trace, paused or disabled produce no evidence to show

## Technical Implementation

- Airtable only: tables, linked records, lookups, formulas and interfaces in Map King Hub. No scripts or automations are added by this story.
- soc2_controls (created 2026-10-14): control_code, name, description, category, scrut_task, recurrence, active, and active_code (the code only while active), plus last-modified time and user.
- The mapping lives on soc2_event_types: controls (link to soc2_controls), mapping_provisional, and active_control_codes (lookup of active_code, so inactive controls drop out without rewriting evidence).
- soc2_events reads the mapping through lookups (control_codes, mapping_provisional, category, event_code, event_name) and decides what is shown with export_ok (confirmed, not test data, not modified after capture).
- Per-control evidence page: Airtable interface list of soc2_events with export_ok, user filters on control_codes and on recorded_at period, the CSV columns in order, and CSV download enabled.
- Unmapped evidence page: exportable evidence whose control_codes is empty, with the event code visible for follow-up.
- Before building the pages, the CSV download with both filters applied is verified in Map King Hub; if the interface cannot export the filtered list, a filtered grid view per control and period is used instead.
- Initial provisional mapping: CC7.2 (monitoring), CC7.3 (response to detected events) and PI1.2 (input controls), assigned to the event types of MapKMigGon39261.
- Story documentation in stories/MapMigGon37539/ in the mapking-dev repo and airtable/soc2/schema/ for the Airtable design, backed up to the story folder under Map King (Map.ai)/stories/ in Google Drive (https://drive.google.com/drive/folders/1ASME3H6NrW590zQeUWQK7J7W56igjrT9): spec with the CSV columns, the provisional mapping and the traceability of the acceptance criteria of Map MigGon37539, MapKMigGon39261 and this story; QA guide for Gonzalo; delivery evidence per criterion.

## Data & Integration Requirements

- Reads soc2_events, soc2_event_types and soc2_capture_runs; never writes to them except the mapping fields of soc2_event_types (controls, mapping_provisional), maintained by authorized editors.
- The mapping key is the event type (event_code), so different events from the same source can support different controls.
- Data flow: source row -> soc2_events (confirmed) -> event_type -> controls -> active control codes lookup -> per-control page and CSV.
- The control column lists every active control mapped to the record's event type; the selected control and period are the page filters.
- mapping_provisional tells auditors and Scrut that the control assignment is not yet confirmed.
- The provisional mapping is proposed by Singular from the SOC 2 Trust Services Criteria and stays provisional until Max confirms it or Scrut's evidence requirements are available.
- CSV exports use UTF-8, a header row and ISO 8601 UTC timestamps; recorded_at (server time of capture) is the evidence time.
- One CSV per control and period of the Scrut evidence task recurrence, named soc2_<control>_<period>.csv; on upload to Scrut the evidence date is the last day of the period.
- Scrut API integration is out of scope; upload is manual or from Google Drive.

## Edge Cases & Error Handling

Scenario: Event type without a mapping
   Given exportable evidence whose event type has no active control
   When a reviewer uses the per-control page
   Then that evidence appears under no control and is excluded from every per-control export
   And it appears on the unmapped evidence page

Scenario: Control deactivated
   Given a control marked inactive in soc2_controls
   When a reviewer opens the per-control page
   Then the control is no longer offered in the control filter
   And evidence whose event type was mapped only to that control appears on the unmapped evidence page

Scenario: Optional field blank in an evidence record
   Given an exportable evidence record without actor, trigger or summary
   When the reviewer downloads the CSV
   Then the record is included with those columns blank
   And the export does not fail

Scenario: Period with no evidence
   Given a control and a period with no exportable evidence
   When the reviewer downloads the CSV
   Then the file has only the header row

## Security & Performance

- Only designated editors can change soc2_controls and the mapping fields of soc2_event_types; reviewers get read and CSV download access through the interface only, with no access to edit evidence or run logs.
- The documentation names who can read, edit and export evidence and the mapping, and where Map King Hub access is administered; no credentials or secrets in the documentation.
- The interface and the CSV expose only the export columns: ids, statuses, timestamps, trigger, actor, controls and outcome. No task text, file contents, prompts or reports.
- Browsing and export use native Airtable lookups, formulas, filters and interface download, so they add no load to the capture automations.

# Client-friendly acceptance criteria

## What you will be able to do
- Browse the SOC 2 evidence by control and by period in Airtable.
- Download the evidence for a selected control and period as a CSV file ready for Scrut.
- See which evidence still has no SOC 2 control assigned.
- Change the control assignments later, without development work and without touching the evidence.

## How it will work
- A table of SOC 2 controls, and an assignment of each kind of evidence to one or more controls.
- Evidence picks up its controls from that assignment, so a change applies to all evidence at once.
- The CSV includes the control, whether the assignment is provisional, the kind of event, when it was recorded and happened, its outcome, who acted, and a link to the original record.
- Only evidence confirmed as stored, and not test data, appears.

## What to expect
- Everything stays inside Airtable; no Scrut API connection in this story.
- The control assignments start as provisional until Scrut's requirements are confirmed.
- Exports contain only ids, times, outcomes and who acted; no task, file or report content.
- Documentation covers access, the provisional mapping, traceability to the earlier SOC 2 stories and a QA guide.
