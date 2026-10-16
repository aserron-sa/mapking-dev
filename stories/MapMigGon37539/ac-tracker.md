# SOC 2 Evidence · seguimiento de criterios de aceptación

Map MigGon37539 (padre) · MapKMigGon39261 (P01) · MapKMigGon39264 (P02). Se actualiza cada vez que algo avanza; la última fila del log dice qué cambió.

## Cómo se usa

Estados, en orden:

- ❌ Pendiente: nada hecho.
- 🟡 Estructura: tablas o campos creados en Map King Hub; falta la lógica o la configuración que lo hace funcionar.
- 🟡 Implementado: código, automatización o página lista, sin prueba propia.
- ✅ Verificado: probado por nosotros, con evidencia (link, captura, fila o salida de test) en la columna Evidencia.
- ✅ Aceptado: QA (Gonzalo) lo dio por bueno.

Un criterio solo sube de estado con evidencia. "Dónde" apunta al elemento que lo cumple (tabla, campo, script, automatización, página). Referencias: data-implementation-plan.md (fases), airtable/soc2/schema/ (diseño y CHANGELOG), validation-MapKMigGon39261-39264.md (trazabilidad).

Aviso (14 oct): en SS siguen publicados los textos v1 de P01 y P02. Este seguimiento mide contra la v2 (MapKMigGon39261-final.md y MapKMigGon39264-final.md). Hasta que la v2 esté en SS, QA no puede usar este documento como referencia. Detalle en ss-vs-final-gap.md.

## Resumen

| Story | Criterios | ❌ Pendiente | 🟡 Estructura | 🟡 Implementado | ✅ Verificado | ✅ Aceptado |
|---|---|---|---|---|---|---|
| Map MigGon37539 (35 del padre) | 35 | 4 | 5 | 26 | 0 | 0 |
| MapKMigGon39261 (P01 v2) | 21 | 3 | 0 | 18 | 0 | 0 |
| MapKMigGon39264 (P02 v2) | 15 | 11 | 4 | 0 | 0 | 0 |

## Map MigGon37539 · criterios del padre

IDs de estimation-report.md §3. Los criterios que se cumplen a través de P01 o P02 lo indican en Dónde.

| ID | Criterio | Estado | Dónde | Evidencia | Notas |
|---|---|---|---|---|---|
| F1 | Captura automática de operaciones que califican | ❌ Pendiente | soc2-capture + automatizaciones (P01) |  |  |
| F2 | Formato mapeable a Scrut | 🟡 Estructura | soc2_controls, soc2_event_types.controls (P02) | schema/CHANGELOG 2026-10-14 | Falta página y CSV |
| F3 | Registro con metadata al punto de captura | 🟡 Estructura | soc2_events: produced_at, source_recorded_at, recorded_at | schema/tables.md |  |
| F4 | Disponible para auditoría solo tras persistir | 🟡 Implementado | soc2_events.confirmed, export_ok | schema/tables.md; soc2-evidence.test.ts: D6 F4 only rows re-read and matching are confirmed; a mismatch or a missing row is an integrity error; soc2-capture.smoke.test.ts: record, dryRun = no, events enabled: writes, re-reads and confirms | Relectura y confirmed en el script (WP-D). R2 resuelto en esquema (content_modified_at): el reproceso queda exportable; falta verificarlo en WP-G. Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| F5 | Sin duplicados (idempotencia determinista) | 🟡 Implementado | soc2_events.event_key | schema/tables.md; soc2-evidence.test.ts: F5 E5 a key that exists and is confirmed is an existing hit, never a write; soc2-capture.smoke.test.ts: hourly: dry run traces, live run writes, the repeated run captures 0 and finds N existing; soc2-capture.smoke.test.ts: R1 two interleaved runs (record + hourly) over the same row: one confirmed row and one duplicate error | Caso simultáneo (R1) corregido en WP-R: un ganador por event_key, duplicados reportados. Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| F6 | Trazabilidad al origen | 🟡 Estructura | source_table, source_record_id, source_url, run_ref | schema/tables.md |  |
| F7 | Log de éxito, fallo o salteado | 🟡 Implementado | soc2_capture_runs | schema/tables.md; soc2-evidence.test.ts: F7 T7 summarizeRun: counts, skip_reasons, trace, errors and config issues as JSON; soc2-capture.smoke.test.ts: record, dryRun = no, events enabled: writes, re-reads and confirms | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| T1 | Workflow disparado por actividad o eventos, con límites claros | 🟡 Implementado | automatizaciones + soc2-capture | soc2-capture.smoke.test.ts: hourly with an active lock: result locked, nothing written; hourly with an expired lock: the old run is marked abandoned and the run goes on; hourly: dry run traces, live run writes, the repeated run captures 0 and finds N existing | Falta crear las automatizaciones (WP-F). Límite de Airtable: 30 s (temporalmente 120 s), ver execution-log. |
| T2 | Validar entradas requeridas | 🟡 Implementado | soc2-capture (validación) | soc2-evidence.test.ts: E1 T2 P01-E1 missing required field: no evidence for it, skipped as missing_fields with the list in errors | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| T3 | Payload normalizado sin detalles transitorios | 🟡 Implementado | soc2-capture (registro de eventos) | soc2-registry.test.ts: T3 registry has the 9 events at version 1, each once | Solo detección y mapeo (WP-B). |
| T4 | De la IA, solo contexto relevante | 🟡 Estructura | soc2_events.ai_output_state | schema/tables.md | Nunca se copia texto de IA |
| T5 | Mapeo de campos y validación antes de escribir | 🟡 Implementado | soc2-capture (chequeo de esquema) | soc2-evidence.test.ts: T5 buildFields maps a real draft to soc2_events field IDs | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| T6 | Manejo explícito de respuestas de Airtable | 🟡 Implementado | soc2-capture (clasificación de errores) | soc2-evidence.test.ts: T6 classifyError: 422, INVALID_*, unknown field and "cannot accept" are validation | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| T7 | Logs estructurados | 🟡 Implementado | soc2_capture_runs.errors, skip_reasons | soc2-evidence.test.ts: F7 T7 summarizeRun: counts, skip_reasons, trace, errors and config issues as JSON | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| T8 | Contrato interno estable | 🟡 Implementado | soc2-evidence-contract.ts, version | npm run soc2:test (165 tests, WP-R); soc2-evidence.test.ts: T8 P01-E6 checkConfig: version_mismatch disables the event (P01-DI4); soc2-capture.smoke.test.ts: catalog out of sync: a version mismatch disables the event and is reported as a config issue | Contrato v0.3 (WP-R); version 1 en registro y catálogo. Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| D1 | Flujo actividad → evaluación → normalización → persistencia → registro | 🟡 Implementado | soc2-capture | soc2-evidence.test.ts: D1 F4 D6 full flow with an in-memory soc2_events: plan, build, write, re-read, confirm, summarize; soc2-capture.smoke.test.ts: record, dryRun = no, events enabled: writes, re-reads and confirms | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| D2 | Payload mínimo | 🟡 Implementado | soc2_events | schema/tables.md; soc2-capture.smoke.test.ts: record, dryRun = no, events enabled: writes, re-reads and confirms (la base falsa rechaza campos no pedidos y campos calculados); soc2-evidence.test.ts: S1 buildFields keeps details free of forbidden keys | El script lee de las fuentes solo los IDs de execution-context.md §2. Falta revisar filas reales (WP-G). |
| D3 | Mapeo fuente → evidencia definido y aplicado | 🟡 Implementado | registro del script + soc2_event_types.detection_config | soc2-registry.test.ts: D3 every fixture row has a recSYN prefix when synthetic and a derived_from real id; P01-AC1 loom.sync.init from real success row | Registro puro probado (WP-B); falta soc2_event_types.detection_config alineado. |
| D4 | Distinguir observado de IA | 🟡 Estructura | ai_output_state | schema/tables.md |  |
| D5 | Validación y confirmación en el límite con Airtable | 🟡 Implementado | soc2-capture (relectura) | soc2-evidence.test.ts: D5 verifyReadBack: each compared field that differs is reported; soc2-capture.smoke.test.ts: record, dryRun = no, events enabled: writes, re-reads and confirms | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| D6 | Nunca evidenciado sin persistencia confirmada | 🟡 Implementado | confirmed + export_ok | soc2-evidence.test.ts: D6 a stored row whose re-read does not match stays unconfirmed and the run is partial; soc2-capture.smoke.test.ts: record, dryRun = no, events enabled: writes, re-reads and confirms | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| D7 | Reproceso sin duplicados | 🟡 Implementado | corrida horaria + event_key | soc2-evidence.test.ts: D7 F5 E5 hourly run repeated over captured rows: captured 0, existing N, nothing written; soc2-capture.smoke.test.ts: hourly: dry run traces, live run writes, the repeated run captures 0 and finds N existing | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| E1 | Faltan campos: rechazar y registrar | 🟡 Implementado | skip_reasons | soc2-evidence.test.ts: E1 T2 P01-E1 missing required field: no evidence for it, skipped as missing_fields with the list in errors | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| E2 | Airtable rechaza: capturar detalle | 🟡 Implementado | errors | soc2-evidence.test.ts: E2 a validation error is not retried and keeps its reason; soc2-capture.smoke.test.ts: a validation error on create is not retried: that event fails, the other is captured, status partial | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| E3 | Dependencia caída: reintentar | 🟡 Implementado | soc2-capture (reintentos) | soc2-evidence.test.ts: E3 a transient error is retried and recovers, waiting 1 s first; soc2-capture.smoke.test.ts: a transient error is retried with a 1 s wait and recovers | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| E4 | Reintentos agotados: fallo terminal reprocesable | 🟡 Implementado | errors, vista Failures | soc2-evidence.test.ts: E4 S6 retries run out after 3 retries (1 s, 2 s, 4 s): 4 attempts, kind kept | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| E5 | Evento repetido: sin duplicado | 🟡 Implementado | event_key | soc2-evidence.test.ts: F5 E5 a key that exists and is confirmed is an existing hit, never a write; soc2-capture.smoke.test.ts: hourly: dry run traces, live run writes, the repeated run captures 0 and finds N existing | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| E6 | IA malformada, ausente o no relevante: conservar metadata | ❌ Pendiente | ai_output_state + script |  |  |
| E7 | No califica: saltear con motivo | 🟡 Implementado | status del catálogo + skip_reasons | soc2-evidence.test.ts: E7 P01-AC7 trace status: the event is detected and listed in traced, never written; soc2-capture.smoke.test.ts: record, dryRun = yes (also the default): no evidence, a run row with dry_run, traced events | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| S1 | Solo datos necesarios | 🟡 Implementado | summary, details, actor, trigger (sin contenido) | descripciones de campos; soc2-evidence.test.ts: S1 buildFields keeps details free of forbidden keys, with primitive values and short strings only; soc2-registry.test.ts: S1 R4 P01-AC4 ingestion actor: free-text run_by (real row recOPCUimHKLtCgPm) gives no requested_by; S1 R4 Loom trigger with extra text: actor keeps only the requester id, trigger is normalized and capped; S1 R14 priority_events summary is copied only when it looks like a template; soc2-evidence.test.ts: S1 R4 validateDraft: actor over ACTOR_MAX or trigger over TRIGGER_MAX is rejected before writing | R4 y R14 corregidos en WP-R: requested_by solo si es identificador, trigger normalizado con tope 100, summary de automatizaciones solo si es plantilla. Verificar con filas reales (WP-G). Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| S2 | Autorización según prácticas existentes | ❌ Pendiente | permisos (fase 7), last_modified_by |  |  |
| S3 | Credenciales fuera del código y logs | 🟡 Implementado | el script corre dentro de Airtable, sin fetch ni credenciales | soc2-capture.smoke.test.ts: S3 built file: no credentials, tokens or network calls | El dist no tiene fetch, Authorization, Bearer, tokens ni claves (regex en el test). Se confirma al pegar el script (WP-F). |
| S4 | Logs sin contenido sensible | 🟡 Implementado | errors sin payloads | soc2-evidence.test.ts: S4 error messages are one line, at most 200 characters, without payloads | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| S5 | No bloquear a los agentes | ❌ Pendiente | captura desde las tablas, sin tocar agentes |  | Medir duración de Loom antes y después |
| S6 | Reintentos acotados | 🟡 Implementado | soc2-capture | soc2-evidence.test.ts: S6 no retry wait starts past the deadline (time budget) | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |

## MapKMigGon39261 · P01 (texto v2)

| ID | Criterio | Estado | Dónde | Evidencia | Notas |
|---|---|---|---|---|---|
| P01-AC1 | Loom sync start produces evidence | 🟡 Implementado | loom.sync.init | soc2-registry.test.ts: P01-AC1 loom.sync.init from real success row | Tipo cargado en trace. Detección; falta captura y escritura (WP-C/D). |
| P01-AC2 | Loom sync completion produces evidence | 🟡 Implementado | loom.sync.completed | soc2-registry.test.ts: P01-AC2 loom.sync.completed from real success row | Detección; falta captura y escritura (WP-C/D). |
| P01-AC3 | Loom sync error produces evidence | 🟡 Implementado | loom.sync.error | soc2-registry.test.ts: P01-AC3 loom.sync.error from synthetic failure row | Detección; falta captura y escritura (WP-C/D). |
| P01-AC4 | Ingestion run completion produces evidence | 🟡 Implementado | ingestion.run.completed | soc2-registry.test.ts: P01-AC4 ingestion.run.completed from real Completed with errors row | Detección; falta captura y escritura (WP-C/D). |
| P01-AC5 | Ingestion run error produces evidence | 🟡 Implementado | ingestion.run.error | soc2-registry.test.ts: P01-AC5 ingestion.run.error from synthetic Failed row | Detección; falta captura y escritura (WP-C/D). |
| P01-AC6 | Automation events produce evidence | 🟡 Implementado | automation.triage_compute.*, automation.lanes_integrity.fixed | soc2-registry.test.ts: P01-AC6 automation.triage_compute.completed from real ok row | Detección; falta captura y escritura (WP-C/D). |
| P01-AC7 | Event types in trace are detected but not written | 🟡 Implementado | status trace + soc2_capture_runs.trace | soc2-evidence.test.ts: E7 P01-AC7 trace status: the event is detected and listed in traced, never written; soc2-capture.smoke.test.ts: record, dryRun = yes (also the default): no evidence, a run row with dry_run, traced events | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-AC8 | Paused and disabled are not captured | 🟡 Implementado | status + status_changed_at + skip_reasons | soc2-evidence.test.ts: E7 P01-AC8 paused and disabled: skipped with status_<status>, once per row; R3 P01-AC8 paused → enabled does not backfill: occurrences produced before status_changed_at are skipped (before_enabled); R3 trace → enabled does not backfill the 48 h already traced; R3 enabledSince null (status never changed) or missing: no restriction; soc2-capture.smoke.test.ts: R3 P01-AC8 the catalog status_changed_at stops the backfill | ingestion.run.init cargado disabled. Sin backfill al volver a enabled (R3, WP-R). Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-AC9 | Non-qualifying rows are skipped with a reason | 🟡 Implementado | skip_reasons | soc2-registry.test.ts: P01-AC9 dry run is skipped with dry_run, not stored as test (real row) |  |
| P01-E1 | Source row missing required data | 🟡 Implementado | validación | soc2-evidence.test.ts: E1 T2 P01-E1 missing required field: no evidence for it, skipped as missing_fields with the list in errors | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-E2 | Triggered and hourly process the same row | 🟡 Implementado | event_key | soc2-evidence.test.ts: P01-E2 F5 triggered and hourly process the same row: one record, the second run changes nothing; soc2-capture.smoke.test.ts: hourly: dry run traces, live run writes, the repeated run captures 0 and finds N existing | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-E3 | Evidence write keeps failing | 🟡 Implementado | reintentos + errors | soc2-evidence.test.ts: P01-E3 E4 a write that keeps failing: error with kind, event and record; not confirmed; run partial and reprocessable | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-E4 | Loom run killed before closing its row | 🟡 Implementado | loom.sync.error (abandoned) | soc2-registry.test.ts: P01-E4 loom.sync.error from abandoned row without finished_at uses last_modified |  |
| P01-E5 | Ingestion file replaced | 🟡 Implementado | event_key con run_at | soc2-registry.test.ts: P01-E5 ingestion file replaced: same row with another run_at gives another event_key |  |
| P01-E6 | Catalog and script out of sync | 🟡 Implementado | config_issues | soc2-evidence.test.ts: P01-E6 checkConfig: a registry code without catalog row is missing_in_catalog and disabled; soc2-capture.smoke.test.ts: catalog out of sync: a version mismatch disables the event and is reported as a config issue | Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-TI | Un solo script, mismas automatizaciones, tests por evento | 🟡 Implementado | airtable/soc2 | npm run soc2:test: 165 pass, 0 fail (contract 7, registry 68, evidence 68, capture.smoke 22; WP-R); dist/automations/soc2-capture.js (1.1.0) | Un script, tests por evento (registro) y smoke del entry. Falta crear las 5 automatizaciones (WP-F). |
| P01-DI1 | Fuentes en solo lectura; campos last_modified agregados | 🟡 Implementado | loom_sync_runs.last_modified, ingestion_runs.last_modified; el script solo lee las fuentes | schema/CHANGELOG fases 2 y 3; soc2-capture.smoke.test.ts: cada test termina con assertNoProtectedWrites (la base falsa lanza ante cualquier escritura en las tres fuentes y en soc2_event_types) | Campos creados (schema/CHANGELOG fases 2 y 3). Falta confirmar en Airtable que no hay escrituras (WP-G). |
| P01-DI2 | event_key, campos de la evidencia, actor, ai_output_state | ❌ Pendiente | soc2_events |  |  |
| P01-DI3 | Datos de prueba con is_test, nunca exportados | ❌ Pendiente | is_test + export_ok |  |  |
| P01-DI4 | version del script igual a la del catálogo | 🟡 Implementado | version + config_issues | soc2-evidence.test.ts: T8 P01-E6 checkConfig: version_mismatch disables the event (P01-DI4) | Catálogo en version 1. Lógica pura probada (WP-C); Entrada soc2-capture probada con una base falsa (WP-D); falta la prueba en Airtable (WP-F/G). |
| P01-SP | Seguridad y performance | ❌ Pendiente | ver S1 a S6 |  |  |

## MapKMigGon39264 · P02 (texto v2)

| ID | Criterio | Estado | Dónde | Evidencia | Notas |
|---|---|---|---|---|---|
| P02-AC1 | Browse evidence by SOC 2 control | ❌ Pendiente | página Evidence by control |  | Espera compuerta CSV |
| P02-AC2 | Filter by period | ❌ Pendiente | filtro de usuario sobre recorded_at |  |  |
| P02-AC3 | One event type mapped to several controls | 🟡 Estructura | soc2_event_types.controls | seed-v1.json: loom.sync.error → CC7.2, CC7.3 |  |
| P02-AC4 | Mapping changes apply without rewriting evidence | 🟡 Estructura | lookups + last_modified_by | schema/tables.md |  |
| P02-AC5 | Export evidence for a control and period | ❌ Pendiente | descarga CSV |  | Compuerta CSV |
| P02-AC6 | Exported evidence traces back to its origin | ❌ Pendiente | source_url, event_key |  |  |
| P02-AC7 | Only exportable evidence is listed | 🟡 Estructura | export_ok | schema/tables.md |  |
| P02-E1 | Event type without a mapping | ❌ Pendiente | página Unmapped evidence |  |  |
| P02-E2 | Control deactivated | 🟡 Estructura | soc2_controls.active_code | schema/tables.md |  |
| P02-E3 | Optional field blank | ❌ Pendiente | CSV |  |  |
| P02-E4 | Period with no evidence | ❌ Pendiente | CSV |  |  |
| P02-TI | Solo Airtable nativo; mapeo provisional inicial | ❌ Pendiente | soc2_controls con CC7.2, CC7.3, PI1.2 | seed-v1.json | Mapeo cargado; faltan páginas |
| P02-DI | Formato CSV (columnas, UTF-8, ISO UTC, nombre por control y período) | ❌ Pendiente | página + formato de fechas |  | Falta GMT/ISO en la UI |
| P02-SP | Permisos, documentación, sin contenido | ❌ Pendiente | fase 7 |  |  |
| P02-DOC | Spec, guía de QA, evidencia por criterio | ❌ Pendiente | stories/MapMigGon37539 |  | Spec y guía de QA escritas (parte 1): spec.md, qa-guide.md. Faltan evidence.md y borradores de SS (parte 2, tras WP-G y WP-H) |

## Log

| Fecha | Qué cambió |
|---|---|
| 2026-10-14 | Documento creado. Estado inicial después de las fases 0 a 3: tablas soc2_ creadas, campos last_modified en fuentes, catálogo y controles cargados. Ningún criterio verificado todavía. |
| 2026-10-14 | Comparación con SS: la v2 no está publicada; SS describe activity_runs y soc2_control_mappings, que no existen. Ver ss-vs-final-gap.md. |
| 2026-10-14 | Íconos de estado: ❌ falta, 🟡 en camino (estructura o implementado sin probar), ✅ hecho (verificado o aceptado). |
| 2026-10-14 | WP-B: contrato v0.2 y registro de los 9 eventos con 68 tests (node --test: 7 + 61, 0 fallos). Pasan a 🟡 Implementado: T3, D3, P01-AC1 a AC6, AC9, E4, E5. D2, E1 y E5 del padre quedan como están: WP-B solo cubre detección, falta el plan y la escritura (WP-C/D). |
| 2026-10-14 | WP-C: módulo de evidencia (soc2-evidence.ts) con 57 tests; is_test por palabra suelta en el registro (+3 tests). node --test de los tres archivos: 128 pass, 0 fail. Pasan a 🟡 Implementado: F4, F5, F7, T2, T5, T6, T7, T8, D1, D5, D6, D7, E1 a E5, E7, S1, S4, S6 y P01-AC7, AC8, E1, E2, E3, E6, DI4. Falta la entrada soc2-capture (WP-D) y la verificación en Airtable (WP-G). |
| 2026-10-14 | WP-D: entrada soc2-capture.ts, build (dist/automations/soc2-capture.js) y smoke con base falsa (14 tests). npm run soc2:test: 142 pass, 0 fail. Pasan a 🟡 Implementado: T1, D2, S3, P01-TI, P01-DI1. Las filas ya 🟡 suman la prueba del smoke (F4, F5, F7, D1, D5, D6, D7, E2, E3, E5, E7, T8, P01-AC7, P01-E2, P01-E6). Siguen sin crearse las automatizaciones (WP-F) y sin verificar en Airtable (WP-G). |
| 2026-10-14 | WP-E (revisión, review-soc2-capture.md): bajan de 🟡 Implementado a 🟡 Estructura S1 (actor y trigger guardan texto libre del Ingestion Agent en una fila real, R4) y P01-AC8 (la horaria con lookback de 48 h recupera lo ocurrido mientras el tipo estaba paused, R3). El resto de las filas no cambia; F4, F5, E5, D7 y P01-E2 no pasan a ✅ hasta corregir R1 y R2. |
| 2026-10-14 | WP-R (correcciones de la revisión): vuelven a 🟡 Implementado S1 (R4 y R14 corregidos, tests con la fila real recOPCUimHKLtCgPm y con un trigger con texto de más) y P01-AC8 (R3: status_changed_at y skip before_enabled, tests paused → enabled, trace → enabled y sin status_changed_at). F5, E5 y P01-E2 suman el smoke de dos corridas intercaladas (R1). Notas desactualizadas de F4, F5 y T8 corregidas (R15). npm run soc2:test: 165 pass, 0 fail. |
| 2026-10-14 | WP-I (parte 1): spec.md y qa-guide.md escritas (19 casos de P01 y 11 de P02). P02-DOC sin cambio de estado: faltan evidence.md y los borradores de SS (parte 2, tras WP-G y WP-H). |
