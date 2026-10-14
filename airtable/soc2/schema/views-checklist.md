# Fase 4 · vistas a crear en la UI de Airtable

La API no crea vistas filtradas, así que se hacen a mano. Unos 20 minutos. Al terminar, anotar en CHANGELOG.md una línea por vista (origen UI) con su id (viw…, visible en la URL).

Antes de las vistas: en soc2_events (recorded_at, last_modified), soc2_capture_runs (created), soc2_event_types y soc2_controls (last_modified), y en loom_sync_runs e ingestion_runs (last_modified nuevos), editar el formato del campo: fecha ISO, hora 24 h, "Use the same time zone for all collaborators" = GMT.

## soc2_events

| Vista | Tipo | Filtro | Orden | Campos visibles (en orden) |
|---|---|---|---|---|
| Evidence | Grilla | export_ok = 1 | recorded_at desc | control_codes, mapping_provisional, category, event_code, event_name, event_key, recorded_at, produced_at, outcome, actor, trigger, summary, source_table, source_record_id, source_url |
| Unconfirmed | Grilla | confirmed sin marcar | recorded_at asc | event_key, event_code, recorded_at, capture_run, source_url |
| Modified after capture | Grilla | modified_after_capture = 1 | last_modified desc | event_key, event_code, recorded_at, last_modified, source_url |
| Test data | Grilla | is_test marcado | recorded_at desc | event_key, event_code, recorded_at, summary |
| By event type | Grilla agrupada por event_code | ninguno | recorded_at desc | todos |

## soc2_capture_runs

| Vista | Tipo | Filtro | Orden |
|---|---|---|---|
| Failures | Grilla | status es failure o abandoned, o failed > 0 | created desc |
| Running | Grilla | status = running | started_at asc |
| Trace | Grilla | traced > 0 | created desc |
| Config issues | Grilla | config_issues no vacío | created desc |

## soc2_event_types

| Vista | Tipo | Filtro | Orden |
|---|---|---|---|
| By status | Grilla agrupada por status | ninguno | event_code asc |

## soc2_controls

| Vista | Tipo | Filtro | Orden |
|---|---|---|---|
| Active | Grilla | active marcado | control_code asc |

Nota: "Config issues" no estaba en el plan; se agrega porque el script reporta ahí las diferencias entre su registro y el catálogo.
