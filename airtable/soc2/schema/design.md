# SOC 2 Evidence · diseño de datos en Airtable

Versión 1.0 · 2026-10-14. Detalle de campos e IDs: tables.md. Plan completo y trazabilidad a criterios: stories/MapMigGon37539/data-implementation-plan.md.

## 1. Tablas y roles

| Tabla | ID | Capa | Escribe | Rol |
|---|---|---|---|---|
| soc2_event_types | tbl2PJOE4M4JdcCL7 | Captura | Editores designados | Catálogo y documentación de eventos estudiados; status por evento |
| soc2_events | tblBlVgex266Mqhea | Captura | Solo soc2-capture | Evidencia: una fila por ocurrencia |
| soc2_capture_runs | tblpmfB65pfWCnu2k | Captura | Solo soc2-capture | Log de corridas, lock de la horaria, trace y errores |
| soc2_controls | tblMOPSnkhTsQcANX | Salida (P02) | Editores designados | Controles SOC 2 y su evidence task en Scrut |

Vínculos: soc2_event_types.controls ↔ soc2_controls.event_types; soc2_events.event_type ↔ soc2_event_types.events; soc2_events.capture_run ↔ soc2_capture_runs.events.

## 2. Reglas del modelo

- Un escritor por tabla. Las tablas de evidencia las escribe solo el script; nadie edita evidencia a mano.
- event_key = event_code:source_record_id:produced_at (ISO UTC). Si ya existe, la captura es un no-op; nunca se actualiza una evidencia.
- status del tipo: enabled (se captura), trace (se detecta y se registra en soc2_capture_runs.trace, sin escribir), paused (no se captura, sin recuperación), disabled (definido, no se captura).
- La regla de detección vive en soc2-capture.ts; detection y detection_config en la tabla la documentan. version debe coincidir con el script; si no, config_issues.
- Hora de la evidencia: recorded_at (creación, servidor). produced_at es la hora de la fuente; source_recorded_at, la hora de servidor de la fila de origen.
- ai_output_state: present, missing, malformed, not_applicable. Nunca se copia texto de IA.

## 3. Fórmulas y trucos

| Campo | Fórmula o mecanismo | Por qué |
|---|---|---|
| soc2_controls.active_code | IF({active}, {control_code}, "") | La API no crea lookups condicionales. Con esto, el lookup de controles solo trae activos |
| soc2_event_types.active_control_codes | Lookup de controls → active_code | Códigos de controles activos del tipo |
| soc2_events.control_codes | Lookup de event_type → active_control_codes | Vacío = evidencia sin mapeo (página Unmapped) |
| soc2_events.modified_after_capture | IF(DATETIME_DIFF(last_modified, recorded_at, 'seconds') > 120, 1, 0) | Detecta ediciones posteriores. El margen de 2 min cubre la marca de confirmed que hace el propio módulo |
| soc2_events.export_ok | IF(AND(confirmed, NOT(is_test), modified_after_capture = 0), 1, 0) | Única condición para exportar y mostrar como evidencia |

## 4. Estado de construcción

| Elemento | Estado | Origen |
|---|---|---|
| Cuatro tablas con campos y descripciones | Hecho 2026-10-14 | API |
| Nombres de los links inversos (event_types, events) | Hecho 2026-10-14 | API |
| Zona horaria GMT y formato ISO en recorded_at, created y los last_modified (incluidos los de loom_sync_runs e ingestion_runs) | Pendiente | UI |
| last_modified en loom_sync_runs (fldn0Hiwc8Y0fPra1) e ingestion_runs (fldLk5V39UiQJ7lQK) (fase 2) | Hecho 2026-10-14 | API (Haiku) |
| Datos iniciales desde seed-v1.json: 9 eventos (trace, salvo ingestion.run.init disabled) y controles CC7.2, CC7.3, PI1.2 provisionales (fase 3) | Hecho 2026-10-14 | API (Haiku) |
| Vistas (fase 4): Evidence, Unconfirmed, Modified after capture, Test data, By event type, Failures, Running, Trace, By status, Active | Pendiente | UI |
| Automatizaciones (fase 5): capture loom created, loom terminal, ingestion_runs, priority_events, hourly; todas con el mismo script y dryRun = yes | Pendiente | API la estructura, UI el paso de script |
| Interfaces (fase 6): Evidence by control (filtro control y período, CSV), Unmapped evidence, Capture operations | Pendiente; antes, la prueba de la compuerta CSV | API y UI |
| Permisos (fase 7): escritura por convención; revisores por interfaz | Pendiente | UI |

## 5. Pendientes de diseño

- Fecha de go-live de la captura (corte de datos de prueba).
- Volumen de automation.triage_compute.completed.
- Quién edita catálogo y controles del lado de Max.
- Si el plan de Airtable permite restringir edición por tabla.
