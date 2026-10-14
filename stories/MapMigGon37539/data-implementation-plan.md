# SOC 2 Evidence · plan de implementación de datos en Airtable

Map MigGon37539 (base) · MapKMigGon39261 (P01) · MapKMigGon39264 (P02). Versión 1.0 · 14 oct 2026 · para aprobación de Andrés.

Base: Map King Hub (appcdpGNTo0DouoqJ). Todo es aditivo: no se modifica ni se borra nada existente. Cada fase arranca con el OK de Andrés (working agreement).

Referencias: soc2-event-catalog.md (eventos, status, script único), scrut-soc2-evidence-format.md (formato de salida), validation-MapKMigGon39261-39264.md (trazabilidad contra la story padre). Los IDs F/T/D/E/S son los 35 criterios de la story padre (estimation-report.md §3).

## 0. Alcance

Incluye la capa de datos completa: tablas, campos, vínculos, campos calculados, datos iniciales, vistas, permisos, la estructura de las automatizaciones y las páginas de interfaz de la P02. No incluye el código del script de captura (soc2-capture.ts), que es un frente aparte con sus tests; acá solo se define dónde se pega y con qué entradas.

Principio: cada tabla, campo y vista existe porque lo pide un criterio. La sección 8 traza criterio → elemento → cómo se verifica.

Aviso: los criterios de P01 y P02 en SS todavía describen activity_runs y el mapeo por source type. La fase 0 prepara los borradores para alinearlos con el catálogo de eventos antes de construir, así QA prueba lo mismo que se construye.

## 1. Tablas nuevas

Cuatro tablas, un escritor cada una. "API" significa que se crea con la herramienta de Airtable desde la sesión; "UI", que la hace Andrés en Airtable.

### 1.1 soc2_event_types · catálogo (37539 estructura, P01 eventos)

Escribe: editores designados. Lee: soc2-capture.

| Campo | Tipo | Creación | Contenido | Criterio |
|---|---|---|---|---|
| event_code | Texto (primario) | API | loom.sync.init, etc. Estable, no se reutiliza | D2 |
| name | Texto | API | Nombre legible | — |
| description | Texto largo | API | Qué es el evento y por qué es evidencia | F1, F2 |
| source | Single select | API | loom, ingestion, automation | D2 |
| source_table | Texto | API | Tabla de origen | F6, D3 |
| source_workflow | Texto | API | Automatización de origen (nombre e id) | F6 |
| detection | Texto largo | API | Regla en palabras (documenta la del script) | D3, E7 |
| detection_config | Texto largo | API | Regla en JSON (documenta la del script) | D3 |
| outcome | Single select | API | started, success, partial, failure, abandoned, fixed | F3 |
| category | Single select | API | Change Management, Access Control, Operations & Monitoring, Risk & Compliance | F2 |
| tsc_refs | Texto | API | TSC tentativos | F2 |
| qualifies | Checkbox | API | Pasó el checklist | E7 |
| qualification_notes | Texto largo | API | Por qué califica o qué falta | E7 |
| status | Single select | API | enabled, trace, paused, disabled | F1, E7 |
| version | Número | API | Versión de la regla; debe coincidir con el script | T8 |
| controls | Link a soc2_controls | API | Controles que soporta (P02) | F2 |
| mapping_provisional | Checkbox | API | Mapeo sin confirmar por Max o Scrut | F2 |
| active_control_codes | Lookup de soc2_controls.active_code | API | Códigos de controles activos | F2 |
| owner | Colaborador | API | Responsable | S2 |
| doc_url | URL | API | Documentación | — |
| last_modified | Última modificación | API | Cuándo cambió la definición | S2 |
| last_modified_by | Modificado por | API | Quién | S2 |

### 1.2 soc2_events · evidencia (37539)

Escribe: solo soc2-capture. Lee: interfaces de la P02 (solo lectura).

| Campo | Tipo | Creación | Contenido | Criterio |
|---|---|---|---|---|
| event_key | Texto (primario) | API | event_code:record id de la fuente:produced_at ISO | F5, E5, D7 |
| event_type | Link a soc2_event_types | API | Se llena al crear | D2, F2 |
| source_table | Texto | API | Tabla de origen | F6 |
| source_record_id | Texto | API | Record id de origen | F6 |
| source_url | URL | API | Link a la fila de origen | F6 |
| run_ref | Texto | API | Id propio de la fuente (run_id de Loom, archivo, workflow) | F6, D2 |
| produced_at | Fecha y hora (UTC) | API | Hora según la fuente | F3, T2 |
| source_recorded_at | Fecha y hora (UTC) | API | Hora de servidor de la fila de origen | F3 |
| recorded_at | Creación | API | Hora de servidor de la captura; hora de la evidencia | F3, D5 |
| actor | Texto | API | agent:Loom, automation:…, más solicitante | D2, S1 |
| trigger | Texto | API | schedule, slack:#ingestion <persona>, record, hourly | D2 |
| outcome | Single select | API | started, success, partial, failure, abandoned, fixed | F3, D2 |
| summary | Texto | API | Una línea sin contenido | D2, S1 |
| details | Texto largo | API | JSON con conteos y códigos; sin contenido | D2, S1 |
| ai_output_state | Single select | API | present, missing, malformed, not_applicable | D4, E6, T4 |
| capture_run | Link a soc2_capture_runs | API | Corrida que lo capturó | F7 |
| confirmed | Checkbox | API | Marcado tras releer | F4, D5, D6 |
| is_test | Checkbox | API | Dato de prueba; no se exporta | S1 |
| integrity_hash | Texto | API | Opcional | — |
| last_modified | Última modificación | API | Cualquier cambio posterior | S1 |
| modified_after_capture | Fórmula | API | Marca si last_modified es posterior a la confirmación (margen de 2 min) | integridad |
| event_code, category, event_status | Lookups del tipo | API | Para vistas y CSV | F2 |
| control_codes, provisional | Lookups del tipo | API | Controles y flag para la P02 | F2 |
| export_ok | Fórmula | API | confirmed y no is_test y no modified_after_capture | F4, D6 |

Nota sobre ai_output_state: lo pide la story padre (D4, E6). En v1, Loom usa enriquecimiento con IA (enrichment_fallbacks cuenta los casos sin IA): present, o missing si hubo fallbacks. Ingestion y automatizaciones: not_applicable. Nunca se copia texto de IA (T4).

### 1.3 soc2_capture_runs · log de corridas (37539)

Escribe: solo soc2-capture.

| Campo | Tipo | Creación | Contenido | Criterio |
|---|---|---|---|---|
| run_id | Texto (primario) | API | cap-YYYYMMDD-HHMMSS-<entrada> | F7 |
| mode | Single select | API | record, hourly | T1 |
| trigger_table, trigger_record_id | Texto | API | Qué la disparó | F7 |
| status | Single select | API | running, success, partial, failure, abandoned (hace de lock en la horaria) | T6, E4 |
| dry_run | Checkbox | API | Corrida sin escritura | — |
| started_at, finished_at | Fecha y hora | API | Duración | S5 |
| evaluated, captured, existing, skipped, traced, failed | Números | API | Conteos | F7, T7 |
| skip_reasons | Texto largo | API | JSON: motivo y cantidad | E1, E7 |
| trace | Texto largo | API | JSON de lo trazado, con tope de entradas | — |
| errors | Texto largo | API | JSON: tipo (validación, tasa, transitorio), registro, mensaje corto, intentos | E2, E3, E4, T6 |
| config_issues | Texto largo | API | Diferencias entre registro del script y catálogo | T8 |
| script_version | Texto | API | Versión del script | T8 |
| events | Link a soc2_events (inverso) | API | Lo capturado | F7 |
| created | Creación | API | Hora de servidor | — |

### 1.4 soc2_controls · controles (P02)

Escribe: editores designados.

| Campo | Tipo | Creación | Contenido | Criterio |
|---|---|---|---|---|
| control_code | Texto (primario) | API | CC7.2, CC7.3, PI1.2… | F2 |
| name | Texto | API | Nombre del control | F2 |
| description | Texto largo | API | Qué exige | F2 |
| category | Single select | API | Mismas cuatro categorías | F2 |
| scrut_task | Texto | API | Evidence task de Scrut que lo recibe (cuando se sepa) | F2 |
| recurrence | Single select | API | monthly, quarterly, annual | F2 |
| active | Checkbox | API | Control vigente | F2 |
| active_code | Fórmula | API | IF({active}, {control_code}, "") | F2 |
| event_types | Link (inverso) | API | Tipos de evento que lo soportan | F2 |
| last_modified, last_modified_by | Automáticos | API | Auditoría del mapeo | S2 |

El "lookup condicional a controles activos" se resuelve sin función condicional: active_code queda vacío si el control no está activo, y el lookup de event_types lo levanta. Así funciona por API y no depende de la UI.

## 2. Campos aditivos en tablas existentes

| Tabla | Campo | Tipo | Para qué | Criterio |
|---|---|---|---|---|
| loom_sync_runs | last_modified | Última modificación de status y finished_at | Hora de servidor de cada cambio de estado | F3 |
| ingestion_runs | last_modified | Última modificación de run_status y run_at | Idem; también detecta reemplazos | F3 |

No cambian a los productores (Loom, Ingestion Agent) ni a sus prompts. priority_events ya tiene created_at.

## 3. Datos iniciales

### 3.1 soc2_event_types (9 filas)

| event_code | status inicial | Motivo |
|---|---|---|
| loom.sync.init | trace | Se valida contra corridas reales y después pasa a enabled |
| loom.sync.completed | trace | Idem |
| loom.sync.error | trace | Idem |
| ingestion.run.init | disabled | No observable hoy |
| ingestion.run.completed | trace | Idem |
| ingestion.run.error | trace | Idem |
| automation.triage_compute.completed | trace | Decidir volumen antes de enabled |
| automation.triage_compute.error | trace | Idem |
| automation.lanes_integrity.fixed | trace | Idem |

Descripción, detección, categoría y TSC: de soc2-event-catalog.md §5.

### 3.2 soc2_controls (provisional)

| control_code | Nombre | Categoría | Eventos | Provisional |
|---|---|---|---|---|
| CC7.2 | Monitoreo de componentes del sistema y anomalías | Operations & Monitoring | loom.sync.*, automation.triage_compute.* | Sí |
| CC7.3 | Evaluación y respuesta a eventos detectados | Operations & Monitoring | loom.sync.error, ingestion.run.error, automation.triage_compute.error, automation.lanes_integrity.fixed | Sí |
| PI1.2 | Controles sobre entradas del sistema | Operations & Monitoring | ingestion.run.* | Sí |

Los nombres siguen los TSC 2017 de la AICPA; quedan marcados provisionales hasta que Max o Scrut confirmen.

## 4. Vistas

| Tabla | Vista | Filtro | Para |
|---|---|---|---|
| soc2_events | Evidence | export_ok, orden recorded_at desc | P02, auditor |
| soc2_events | Unconfirmed | no confirmed | Reproceso (D7) |
| soc2_events | Modified after capture | modified_after_capture | Integridad |
| soc2_events | Test data | is_test | QA |
| soc2_events | By event type | agrupado por event_code | Revisión |
| soc2_capture_runs | Failures | status failure o failed > 0 | E4 |
| soc2_capture_runs | Running | status running | Lock y corridas colgadas |
| soc2_capture_runs | Trace | traced > 0 | Validar eventos en trace |
| soc2_event_types | By status | agrupado por status | Operación |
| soc2_controls | Active | active | P02 |

## 5. Automatizaciones (estructura)

Todas pegan el mismo script soc2-capture (build en airtable/soc2/dist/). Arrancan con dryRun = yes.

| Automatización | Disparador | Entradas |
|---|---|---|
| soc2 · capture · loom_sync_runs created | Registro creado en loom_sync_runs | table, recordId, mode=record |
| soc2 · capture · loom_sync_runs terminal | Registro coincide con status en success, partial, failure, abandoned | table, recordId, mode=record |
| soc2 · capture · ingestion_runs | Registro coincide con run_status no vacío (creado o reemplazado) | table, recordId, mode=record |
| soc2 · capture · priority_events | Registro creado con source = automation | table, recordId, mode=record |
| soc2 · capture · hourly | Cada hora | mode=hourly |

El paso "Run a script" se pega a mano (la API no lo crea). El trigger y la automatización vacía se pueden crear por API y se completan en la UI.

## 6. Interfaces (P02)

Compuerta primero: verificar en una página de prueba que la descarga CSV de una lista respeta un filtro de usuario sobre un lookup y un filtro de fecha. Si no, se usa una vista filtrada por control y período.

| Página | Contenido |
|---|---|
| Evidence by control | Lista de soc2_events con export_ok; filtro de usuario por control_codes y por período de recorded_at; columnas del CSV en el orden del formato; descarga CSV habilitada |
| Unmapped evidence | soc2_events con export_ok y control_codes vacío |
| Capture operations | soc2_capture_runs (failures, running, trace) y soc2_event_types por status; solo lectura salvo status del catálogo |

## 7. Permisos

- Escriben soc2_events y soc2_capture_runs solo las automatizaciones (por convención y documentado; Airtable no restringe por automatización).
- Editan soc2_event_types y soc2_controls: Andrés y quien designe Max.
- Revisores y auditor: acceso solo a las páginas de interfaz, lectura y descarga.
- Verificar si el plan de Airtable de Map King permite restringir edición por tabla; si permite, aplicar en soc2_events y soc2_capture_runs.

## 8. Trazabilidad criterio → elemento → verificación

| Criterio | Elemento | Verificación |
|---|---|---|
| F1 captura automática | Automatizaciones §5 + soc2_event_types status | Una corrida real de Loom genera loom.sync.init y loom.sync.completed sin intervención |
| F2 mapeable a Scrut | soc2_controls, controls, provisional, página por control, CSV | CSV de CC7.2 para el período con las columnas del formato |
| F3 registro al punto de captura | produced_at, source_recorded_at, recorded_at | Latencia recorded_at − source_recorded_at < 1 min en modo record |
| F4 disponible tras persistir | confirmed, export_ok | Un registro sin confirmed no aparece en Evidence |
| F5, E5, D7 sin duplicados | event_key, existing en capture_runs | Re-ejecutar la horaria sobre lo ya capturado: captured 0, existing N |
| F6 trazabilidad | source_table, source_record_id, source_url, run_ref | Desde una fila del CSV se abre la fila de origen |
| F7, T7 log | soc2_capture_runs | Cada corrida tiene conteos y motivos |
| T2, E1 validación | skip_reasons | Fila de origen sin campo requerido: no hay evento y figura el motivo |
| T6, E2, E3, E4 respuestas y reintentos | errors, status, vista Failures | Error simulado de campo inválido: registrado como validación, sin reintento |
| T8 contrato estable | version, config_issues | Cambiar version en el catálogo produce un config_issue |
| D4, E6, T4 IA | ai_output_state | Corrida de Loom con fallbacks: missing; ingestion: not_applicable |
| D6 nunca evidenciado sin persistir | confirmed + relectura | Revisión del log del script en una corrida |
| E7 no califica | status trace/disabled, skip_reasons | ingestion.run.init no genera nada; triage en dry run se saltea |
| S1, S4 solo lo necesario | details, summary | Revisión de 10 filas: sin contenido de tareas, archivos ni reportes |
| S2 autorización | Permisos §7, last_modified_by | Documentado en el schema |
| S5 no bloquear | Captura desde las tablas, sin tocar agentes | Duración de Loom igual antes y después |

## 9. Fases

| Fase | Qué | Quién | Horas |
|---|---|---|---|
| 0 | Borradores de SS para alinear criterios de P01 y P02 con el catálogo; prueba de la compuerta CSV en una página de prueba | Claude prepara, Andrés postea y prueba | 1,5 |
| 1 | Crear las cuatro tablas con sus campos (sección 1) | Claude por API, con OK | 1,5 |
| 2 | Campos aditivos en loom_sync_runs e ingestion_runs | Claude por API, con OK | 0,25 |
| 3 | Datos iniciales (sección 3) | Claude por API | 0,5 |
| 4 | Vistas (sección 4) | Andrés en UI (la API no crea vistas filtradas) | 0,5 |
| 5 | Automatizaciones en dry run con el script (cuando el código esté) | Andrés pega el script | 0,5 |
| 6 | Páginas de interfaz (sección 6) | Claude por API donde se pueda, Andrés completa | 1,5 |
| 7 | Validación: eventos en trace contra datos reales, después enabled; pruebas de la sección 8 | Claude y Andrés | 1,5 |
| 8 | schema.md con IDs, guía de QA, evidencia por criterio | Claude | 1 |

Total de la capa de datos: unas 8,5 horas, más el script de captura como frente aparte.

## 10. Decisiones que necesita este plan

1. Fecha de go-live de la captura (corte de datos de prueba): propuesta, el día que se pasa el primer evento a enabled.
2. Volumen de automation.triage_compute.completed: cada corrida o resumen diario.
3. Quién edita el catálogo y los controles del lado de Max.
4. OK para crear las tablas en Map King Hub (fase 1) y los campos aditivos (fase 2).
