# SOC 2 Evidence · tablas en Map King Hub

Base Map King Hub (appcdpGNTo0DouoqJ). Generado desde soc2-schema.json (snapshot del 2026-10-14). No editar a mano: se regenera junto con el JSON (ver README.md).

## soc2_controls · tblMOPSnkhTsQcANX

SOC 2 Evidence · MapKMigGon39264 (P02), created 2026-10-14. Catalog of SOC 2 controls (AICPA TSC) that evidence event types support; mapping is provisional until Max or Scrut confirm. Writers: designated editors only. Docs: repo mapking-dev stories/MapMigGon37539/data-implementation-plan.md §1.4.

| Campo | ID | Tipo | Opciones | Descripción |
|---|---|---|---|---|
| control_code | fldKfWGKNt9OZUzvJ | singleLineText |  | Primary. TSC criterion code, e.g. CC7.2. Stable; never reused. |
| name | fld4UFUjVTZFh0Aox | singleLineText |  | Control name (AICPA TSC 2017 wording, short). |
| description | fldOqH3zBuiSVNmCz | multilineText |  | What the control requires and what evidence supports it. |
| category | fldvjJ4aftZeuvW6l | singleSelect |  | Evidence category used to group controls and events. |
| scrut_task | fldLBZ8RebcMSZGZq | singleLineText |  | Scrut evidence task that receives this control's CSV, when known. |
| recurrence | fldbCTcdOA18OMFp1 | singleSelect |  | Recurrence of the Scrut evidence task; defines the CSV export period. |
| active | fldjk38LYTM1XHKoe | checkbox |  | Control in use. Inactive controls drop out of the event lookups (via active_code) without rewriting evidence. |
| active_code | fldL5VBaFJig6RRCy | formula |  | control_code when active, empty otherwise. Looked up from soc2_event_types to get only active controls (replaces a conditional lookup, which the API cannot create). |
| last_modified | fldQDJ14YBURGJaQs | lastModifiedTime |  | When the control definition last changed (audit of the mapping). |
| last_modified_by | fld3PNuylVAnGGawz | lastModifiedBy |  | Who last changed the control definition (audit of the mapping). |
| event_types | fldzpPIdAlkaYcOIz | multipleRecordLinks |  | Inverse of soc2_event_types.controls: event types that support this control. Edit the mapping from soc2_event_types. |

## soc2_event_types · tbl2PJOE4M4JdcCL7

SOC 2 Evidence · Map MigGon37539 (structure) + MapKMigGon39261 (P01 events), created 2026-10-14. Catalog and documentation of studied events: one row per event_code. status (enabled, trace, paused, disabled) switches capture without code; detection rules live in airtable/soc2/soc2-capture.ts and must match version. Writers: designated editors only. Docs: stories/MapMigGon37539/soc2-event-catalog.md.

| Campo | ID | Tipo | Opciones | Descripción |
|---|---|---|---|---|
| event_code | fldeAXkfLta3SCJI6 | singleLineText |  | Primary. Stable code source.object.action, e.g. loom.sync.init. Never reused. |
| name | fldZbVq35jhySxwH8 | singleLineText |  | Readable short name. |
| description | fldbFzBQ14IcbUypj | multilineText |  | What the event is and why it is SOC 2 evidence. |
| source | fld7uya0FyxXiMI0i | singleSelect |  | Producer family of the event. |
| source_table | fld8UURsZs8byhfNP | singleLineText |  | Map King Hub table where the event is detected (name and id). |
| source_workflow | fldahEvg0z7XDpruq | singleLineText |  | For automation events: the source automation name and id (wfl...). |
| detection | fldc6u464XqJB7YCG | multilineText |  | Detection rule in words. Documents the rule coded in soc2-capture.ts. |
| detection_config | fldkDYQGV2cHfTyTv | multilineText |  | Detection rule as JSON. Documents the coded rule; must match it. |
| outcome | fldNVamvRiCggchyb | singleSelect |  | Outcome the event assigns. |
| category | fld6vsmEQQOn4ky0A | singleSelect |  | SOC 2 evidence category. |
| tsc_refs | fldSSVyKJE4PAfes2 | singleLineText |  | Tentative TSC criteria, e.g. CC7.2 (provisional). |
| qualifies | fldRTjP2v4JrDQmOW | checkbox |  | Passed the qualification checklist (attributable, maps to a control, clear outcome, integrity). |
| qualification_notes | fldCzZX2H8jCAYjZG | multilineText |  | Why it qualifies or what it lacks. |
| status | fldPygZEpRVn3TyIU | singleSelect |  | enabled: captured. trace: detected and logged in soc2_capture_runs, not written. paused: not captured for a while, no backfill. disabled: defined, not captured. |
| version | fldd2xXl70BziEl7u | number |  | Version of the detection rule. Must match the version in soc2-capture.ts; a mismatch is reported as a config issue. |
| mapping_provisional | fldQhLgRNeSKwopYp | checkbox |  | Control mapping not yet confirmed by Max or Scrut. Exported in the CSV. |
| owner | fldMTmQER9AiBvIJB | singleCollaborator |  | Person responsible for this event definition. |
| doc_url | fldbhWSBvGsvE8y0t | url |  | Documentation link. |
| controls | fld7pY2pEmiat2Ab3 | multipleRecordLinks |  | SOC 2 controls this event type supports (P02 mapping, by event type). Flag mapping_provisional until confirmed. |
| last_modified | fldP54jgr6k3CmJwI | lastModifiedTime |  | When the event definition last changed. |
| last_modified_by | fldbZjwtyJRkKDquT | lastModifiedBy |  | Who last changed the event definition. |
| active_control_codes | fldVGPfhHiaxt72cL | multipleLookupValues |  | Codes of the linked controls that are active (lookup of soc2_controls.active_code; inactive ones come back empty). |
| events | fldogCK6iJL2AVN6S | multipleRecordLinks |  | Inverse of soc2_events.event_type: captured occurrences of this event type. Written only by soc2-capture. |

## soc2_capture_runs · tblpmfB65pfWCnu2k

SOC 2 Evidence · Map MigGon37539, created 2026-10-14. One row per run of the soc2-capture script (record-triggered or hourly): counts, skip reasons, errors, trace detail and config issues. status running doubles as the lock for the hourly run. Writer: soc2-capture automations only. Docs: stories/MapMigGon37539/data-implementation-plan.md §1.3.

| Campo | ID | Tipo | Opciones | Descripción |
|---|---|---|---|---|
| run_id | fld9Y8cHWM9eApqlv | singleLineText |  | Primary. cap-YYYYMMDD-HHMMSS-<input> (UTC start). |
| mode | fldusbR0AcZBcR9SW | singleSelect |  | record: triggered by one source row. hourly: safety net over all sources. |
| trigger_table | fldKA5fG5fuejjhLy | singleLineText |  | Source table that triggered the run (record mode). |
| trigger_record_id | fldkbBYwN7epgQaex | singleLineText |  | Source record id that triggered the run (record mode). |
| status | fldaaVdlldKhwrdxr | singleSelect |  | running (lock), success, partial (some events failed), failure (run could not complete), abandoned (running too long, closed by the next run). |
| dry_run | fldKjMc0jwqxRmswU | checkbox |  | Run with dryRun = yes: evaluated everything, wrote no evidence. |
| started_at | fldKFv5R6B9xWtGam | dateTime |  | Run start (UTC). |
| finished_at | fldjgi0TgQKuj2a8W | dateTime |  | Run end (UTC). |
| evaluated | fldBTpOsHdc8D0krb | number |  | Source rows evaluated. |
| captured | fldq4ki1cBJfkCYwE | number |  | Events written and confirmed. |
| existing | fldpW4GvXsFobNHHd | number |  | Events already captured (same event_key): no-op. |
| skipped | fldBaQcrIS8Gar26v | number |  | Rows that matched no enabled event or failed validation; reasons in skip_reasons. |
| traced | fldxwUgsgNofGPkYz | number |  | Events detected for types in trace status (not written). |
| failed | fldo2lCu7H2Cyv2Lj | number |  | Events whose write failed after bounded retries. |
| skip_reasons | flduoBw6iFr2y9YFs | multilineText |  | JSON: reason -> count (e.g. missing_fields, test_data, status_paused). |
| trace | fldonwzoV4JfWmRgv | multilineText |  | JSON list of what trace-status events would have written (event_key, source record, outcome), capped per run. |
| errors | fldTtBT8SCJgA2bLp | multilineText |  | JSON list: kind (validation, rate_limit, transient), record, short message, attempts. No payloads. |
| config_issues | fldn0miE97YJP2GFT | multilineText |  | Differences between the script registry and soc2_event_types (missing rows, version mismatch, unknown codes). |
| script_version | fld2q49lc2LYCSsY7 | singleLineText |  | Version of soc2-capture that ran. |
| created | fldoL1I0bcmE0AtMF | createdTime |  | Server time the run row was created. |
| events | fldc7WVRBflD1HHXy | multipleRecordLinks |  | Inverse of soc2_events.capture_run: events captured by this run. |

## soc2_events · tblBlVgex266Mqhea

SOC 2 Evidence · Map MigGon37539, created 2026-10-14. The evidence: one row per captured occurrence of an enabled event type, idempotent on event_key, confirmed after re-read. Only ids, statuses, times, actor and counts; no task, file or report content. Writer: soc2-capture automations only; reviewers read through interfaces. Docs: stories/MapMigGon37539/data-implementation-plan.md §1.2 and soc2-event-catalog.md §4.

| Campo | ID | Tipo | Opciones | Descripción |
|---|---|---|---|---|
| event_key | fld8qK6JaKB7pFf1P | singleLineText |  | Primary. event_code:source_record_id:produced_at (ISO UTC). Idempotency key: a key that already exists is a no-op, never an update. |
| source_table | fldA4jA0tdsQfzePb | singleLineText |  | Source table (name and id). |
| source_record_id | fldF6TYCw7iqYbqEj | singleLineText |  | Source record id (traceability). |
| source_url | fldapDVLiUanUU2JM | url |  | Link to the source row in Map King Hub. |
| run_ref | fld4WYdHwx8Vb5Iyl | singleLineText |  | The source's own id: Loom run_id, ingestion source_file, automation workflow id. |
| produced_at | fldwe4JlNKFOPOWCh | dateTime |  | When the event happened according to the source (written by the producer). |
| source_recorded_at | fld2uY8B5FOE5aUmj | dateTime |  | Server time of the source row (Airtable created or last-modified time). |
| actor | fldLuQz2Q3xf3nlJ3 | singleLineText |  | Who acted: agent:Loom, agent:Ingestion Agent, automation:<name>, plus the requester when known. |
| trigger | flddpEaHhEeQJGxvW | singleLineText |  | How the source run started: schedule, slack:#ingestion <person>, record, hourly. |
| outcome | fld9bkv18tg1D29ph | singleSelect |  | Outcome of the event. |
| summary | fldxQX7I54qARX85W | singleLineText |  | One line without content: counts, short reason. |
| details | fldn2HwYoubz23z7h | multilineText |  | JSON with counts and codes only. Never task text, file contents or reports. |
| ai_output_state | fld4ihNwgp1mVKI0v | singleSelect |  | present, missing, malformed, not_applicable (parent criteria D4, E6). AI text is never copied. |
| confirmed | fldw9ELcuRiTMt6DY | checkbox |  | Set by the capture module after re-reading the stored record. Unconfirmed rows are never shown as evidence and stay for reprocessing. |
| is_test | fld9AkZAPVhQxAkkB | checkbox |  | Test data (before go-live, TEST/QA-TEST, sample files, dry runs). Kept for QA, never exported. |
| integrity_hash | fldtecjJL5YhEX9LT | singleLineText |  | Optional hash of the observed fields at capture time. |
| event_type | fldsOHw8pVSl9AvEn | multipleRecordLinks |  | The studied event this row is an occurrence of. Filled once, at creation. |
| capture_run | fldgsg4W8Bk7jiqdR | multipleRecordLinks |  | The soc2_capture_runs row that captured this event. |
| recorded_at | fldYupMq4hl6VaDSx | createdTime |  | Server time of capture. This is the evidence timestamp (exported as recorded_at, ISO UTC). |
| last_modified | fldPAfudWshafVCb3 | lastModifiedTime |  | Last change to any field. Used by modified_after_capture to detect edits after capture. |
| event_code | fldxst50uGMsV1CCL | multipleLookupValues |  | Lookup of the event type code (for views and the CSV). |
| event_name | flda5MHe6els2aIB2 | multipleLookupValues |  | Lookup of the event type name (CSV column event_name). |
| category | fldAN153VxbsRklbN | multipleLookupValues |  | Lookup of the event type SOC 2 category. |
| control_codes | flddAnPVVYeNW8th4 | multipleLookupValues |  | Active SOC 2 control codes mapped to the event type (lookup of soc2_event_types.active_control_codes). Empty = unmapped evidence. |
| mapping_provisional | fldYhmYeQ0w9hEruI | multipleLookupValues |  | Lookup of the event type mapping_provisional flag (CSV column). |
| modified_after_capture | flddSQI55lmcgsq64 | formula |  | 1 when the row changed more than 2 minutes after capture (the module's own confirmation falls inside the margin). Such rows leave the export until reviewed. |
| event_status | fldXkJCVFb3ZMqgua | multipleLookupValues |  | Current status of the event type (enabled, trace, paused, disabled). Informative: what is exported depends on export_ok. |
| export_ok | fldkWKTVqDo8a2oGg | formula |  | 1 when the row is exportable evidence: confirmed, not test data, not modified after capture. The per-control page and the CSV show only these. |
