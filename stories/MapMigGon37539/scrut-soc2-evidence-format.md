# Scrut y SOC 2: formato compatible y decisiones de implementación

Map MigGon37539 (base) · MapKMigGon39261 (P01, fuentes) · MapKMigGon39264 (P02, paquete para Scrut). Versión 1.1 · 14 oct 2026 (sección 3 alineada con el catálogo de eventos) · Andrés Serrón con Claude. Documento interno; lo que va a SS o a Max se prepara aparte.

## 1. Qué es Scrut

Scrut (Scrut Automation) es la plataforma de cumplimiento que usa Max para SOC 2. Automatiza la recolección de evidencia, las pruebas de controles y el monitoreo continuo. Soporta más de 60 frameworks (SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS y personalizados) y más de 80 integraciones (nube, identidad, RR. HH., repositorios, Jira, Slack, Google Workspace). No tiene integración con Airtable.

### Cómo organiza la evidencia

- Framework → requisitos → controles. En SOC 2, los requisitos son los Trust Services Criteria de la AICPA (CC1 a CC9 y los criterios de disponibilidad, confidencialidad, integridad de procesamiento y privacidad).
- Evidence task: la unidad de trabajo que junta prueba para uno o más controles. Scrut trae más de 400 tareas ya mapeadas y permite crear tareas propias ("Custom"). Cada tarea tiene responsables, recurrencia (por ejemplo, trimestral), departamento o entidad, y un texto de requisito.
- Evidencia: archivos o links adjuntos a una tarea, cada uno con fecha y nota. Scrut los agrupa en carpetas por período según la recurrencia de la tarea; un archivo con fecha anterior cae en el período que le corresponde.
- Carga manual: hasta 100 MB por archivo, varios a la vez, en formatos comunes (PDF, Office, CSV, JSON, XML, imágenes, entre otros). También desde Google Drive.
- Automatización: integraciones y "Scrut Monitors" llenan tareas solas (estados Fully Automated, Partially Automated, Automation Ready, Manual). Aun así, una persona tiene que verificar y marcar la tarea como completa: la automatización nunca la cierra.
- Auditores: entran al Audit Center con acceso de solo lectura acotado a una auditoría, comentan y registran hallazgos. Su acceso queda auditado.

### Vías para hacer llegar evidencia

| Vía | Qué permite | Estado para Map King |
|---|---|---|
| Carga manual en la evidence task | Subir un archivo (por ejemplo, nuestro CSV) con fecha y nota | Disponible si Max da acceso o la sube él |
| Google Drive | Elegir archivos de Drive y adjuntarlos a la tarea | Disponible; tenemos carpeta de Drive del proyecto |
| Scrut MCP (anunciado el 20 jul 2026) | Desde un agente: leer frameworks, controles, evidencia y tests; subir un archivo y adjuntarlo a una evidencia con nota y fecha. Solo agrega, no borra ni sobrescribe, y queda en el log de Scrut con el usuario autenticado | Nuevo. Requiere cuenta de Scrut y permisos; no está confirmado para el plan de Max |
| API pública | La documentación pública no describe una API para cargar evidencia | No disponible según lo publicado; se pidió a Max el 25 ago y el 3 sep sin respuesta |
| Integración nativa | Más de 80 conectores, ninguno con Airtable | No aplica |

Consecuencia: "Scrut-aligned" en v1 significa evidencia guardada en Map King Hub con un formato que se puede subir tal cual a la evidence task correcta, sin integración directa. El MCP de Scrut abre un camino a automatizar la subida más adelante sin esperar una API.

## 2. Qué significa "compatible con Scrut" para nosotros

Cuatro condiciones, todas verificables en QA:

1. Cada evidencia apunta a uno o más controles SOC 2 (por código TSC) y, cuando se conoce, a la evidence task de Scrut que la recibe.
2. La evidencia se puede exportar por control (o por evidence task) y por período, en un CSV que se adjunta a la tarea con la fecha de fin del período.
3. Cada fila del CSV se puede rastrear hasta el registro de origen en Map King Hub.
4. Solo se exporta evidencia confirmada y que pasa la regla de calificación (sección 4).

## 3. Nuestro formato

La captura y el formato para Scrut son capas separadas. La captura (soc2-capture.ts y el catálogo de eventos, ver soc2-event-catalog.md) no sabe nada de Scrut: registra eventos con hora de servidor, actor, resultado y trazabilidad. El formato para Scrut es la capa de salida (P02): toma esos eventos, les agrega los controles y los entrega como un archivo por control y período. Si mañana Scrut pide otro formato o se integra por MCP, cambia solo la capa de salida.

### 3.1 Tablas en Map King Hub

| Tabla | Capa | Story | Escribe | Para qué |
|---|---|---|---|---|
| soc2_event_types | Captura | 37539 (estructura), P01 (eventos v1) | Editores designados | Catálogo y documentación de eventos; status enabled, trace, paused, disabled |
| soc2_events | Captura | 37539 | Solo soc2-capture | Una fila por ocurrencia; es la evidencia |
| soc2_capture_runs | Captura | 37539 | Solo soc2-capture | Log de corridas y detalle de trace |
| soc2_controls | Salida | P02 | Editores designados | Controles SOC 2: código TSC, nombre, categoría, evidence task de Scrut que lo recibe, activo |
| Link soc2_event_types ↔ soc2_controls | Salida | P02 | Editores designados | Qué controles soporta cada tipo de evento, con flag provisional |

El mapeo a controles se hace por tipo de evento, no por fuente: loom.sync.error y loom.sync.completed pueden apuntar a controles distintos.

### 3.2 Campos

Los campos de soc2_event_types y soc2_events están en soc2-event-catalog.md (secciones 3 y 4). Para Scrut importan:

- Del evento: event_key, source_table, source_record_id, source_url, run_ref, actor, trigger, outcome, summary, produced_at, recorded_at, confirmed, is_test.
- Del tipo (lookup): event_code, name, category, tsc_refs.
- De los controles (lookup a través del tipo): códigos de control, evidence task de Scrut, flag provisional.

### 3.3 Archivo que se sube a Scrut

- Qué entra: eventos con confirmed marcado, is_test sin marcar y status del tipo enabled en el momento de la captura. Nada en trace, paused o disabled.
- Un CSV por control (o por evidence task de Scrut) y por período de la recurrencia de la tarea, por ejemplo trimestral.
- Nombre: soc2_<código de control>_<período>.csv, por ejemplo soc2_CC7.2_2026-Q4.csv.
- UTF-8, una fila de encabezado, fechas en ISO 8601 UTC.
- Columnas, en este orden: control, mapping_provisional, category, event_code, event_name, event_key, recorded_at, produced_at, outcome, actor, trigger, summary, source_table, source_record_id, source_url.
- recorded_at es la hora de la evidencia (servidor). produced_at queda como dato de la fuente.
- Al subirlo a Scrut, la fecha de la evidencia es el último día del período y la nota dice el período, la cantidad de filas, que proviene de Map King Hub y si el mapeo es provisional.

Cómo se genera: página de interfaz por control con filtro de período y descarga CSV de la lista (P02). La compuerta sigue siendo verificar que la descarga respeta los filtros; si no, una vista filtrada por control y período cumple lo mismo.

Cómo llega a Scrut: en v1, carga manual o desde Google Drive en la evidence task. Más adelante, Scrut MCP (sección 1). Ninguna de las dos cambia el formato.

## 4. Qué califica como evidencia

### 4.1 Checklist

Una actividad califica si cumple las cuatro condiciones:

| Condición | Cómo la cumplimos |
|---|---|
| Atribuible | actor y captured_at con valor |
| Mapea a un control | su source_type tiene al menos un control activo; si no, va a la página sin mapeo |
| Resultado claro | outcome con un cambio de estado definitivo, no una consulta o una vista |
| Íntegra | se copia al capturar y no se edita después (sección 5) |

Si falta alguna, la actividad se registra como salteada con el motivo (insufficient_evidence y cuál falló). Un registro de interfaz que el usuario puede manipular, o un evento sin cambio de estado (un reorden de prioridades), no califica.

### 4.2 Fuentes, categoría y fuerza

Nota (v1.1): el arranque de la captura usa los eventos de Loom, Ingestion Agent y dos automatizaciones definidos en soc2-event-catalog.md §5. La tabla siguiente es el análisis previo de fuentes y queda como referencia para eventos futuros.

| Fuente | Categoría | Control TSC tentativo | Actor | Resultado | Fuerza |
|---|---|---|---|---|---|
| approvals | Gestión de cambios / integridad de procesamiento | CC8.1, PI1 | approved_by (colaborador) | Approved, Rejected, Sent | Alta |
| ticket_candidates (revisión) | Gestión de cambios | CC8.1 | reviewed_by (colaborador) | approved, discarded | Alta, cuando 38533 esté desplegada |
| loom_sync_runs | Operación y monitoreo | CC7.2 | trigger (normalizar solicitante) | success, partial, failure, abandoned | Media |
| priority_events (solo guard_fix, dedupe, airtable_error, validation_failed) | Operación y monitoreo | CC7.2, CC7.3 | user o automation | status | Media |
| ingestion_runs | Integridad de procesamiento | PI1 | run_by (texto libre) | Completed, Completed with errors, Failed | Baja: el modo replace sobrescribe la fila |

Los códigos TSC son una propuesta provisional de Singular, marcada como provisional hasta que Max o Scrut confirmen las tareas pendientes.

## 5. Integridad e inmutabilidad

Airtable no tiene registros inmutables: un editor puede cambiar o borrar filas. Medidas en orden de costo:

1. Copia al capturar: la evidencia guarda los valores observados, así que cambios posteriores en la fuente no la alteran.
2. Un solo escritor: soc2_evidences la escriben solo las automatizaciones; los revisores entran por una interfaz de solo lectura.
3. Detección de edición: si la última modificación de un registro es posterior a captured_at (fuera de la confirmación), el registro se marca como modificado y sale de la exportación hasta que alguien lo revise.
4. Hash de integridad: integrity_hash permite probar que la fila exportada es la que se capturó.
5. Retención: la evidencia no se borra y se conserva al menos 12 meses (período típico de un SOC 2 Type II).

## 6. Decisiones de implementación

### Tomadas

| Decisión | Fecha | Fuente |
|---|---|---|
| La evidencia vive en Map King Hub, no en una base aparte | 13 oct 2026 | estimation-report.md §4.5 |
| v1 sin integración directa con Scrut; la API queda como story de backlog | 13 oct 2026 | implementation-plan.md §3 |
| Se reparte en 37539 (base) + P01 (fuentes) + P02 (paquete para Scrut) | 14 oct 2026 | SS |
| Código en airtable/soc2/ con prefijo soc2-, TypeScript compilado a scripts para pegar | 14 oct 2026 | working agreement; esqueleto ya creado |
| Clave de idempotencia source_type + run_id; en aprobaciones run_id = record id | 14 oct 2026 | implementation-plan.md §9 |
| source_type es link a soc2_control_mappings; confirmed tras releer | 14 oct 2026 | implementation-plan.md §9 |
| Solo ids, estados, fechas y actores; nunca contenido | 13 oct 2026 | implementation-plan.md §6 |

### Pendientes

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | Cómo llega la actividad a la evidencia | a) Los productores escriben en activity_runs (P01 actual, cumple T1 y T8). b) Adaptadores sobre las tablas existentes (plan y diagnóstico) | b) para v1: no toca agentes, y las fuentes fuertes (approvals, ticket_candidates) ya son tablas. activity_runs queda para fuentes futuras que no tengan tabla |
| 2 | ai_output_state para fuentes sin IA | Agregar not_applicable, o limitar el campo | Agregar not_applicable |
| 3 | soc2_capture_runs por corrida o por fila | Por corrida con detalle de motivos, o una fila por evento | Por corrida, con los motivos agrupados y la lista de ids salteados |
| 4 | Reglas y mapeo | Una tabla o dos | Dos: reglas de captura (37539) y controles (P02); un solo writer cada una |
| 5 | Hora de aprobación | approval_date (solo fecha) o last_modified | captured_at como hora de la evidencia y approval_date como fecha informativa |
| 6 | Integridad | Medidas 1 a 3, o también el hash | 1 a 3 en v1; hash si Max o el auditor lo piden |
| 7 | Período en el export | Sin filtro, o filtro por fechas | Agregar filtro por período a la P02 |
| 8 | Subida a Scrut | Manual, Google Drive o Scrut MCP | Manual o Drive en v1; evaluar Scrut MCP como story de backlog en lugar de la API |

### Para pedir a Max

1. Acceso a Scrut, o la lista de evidence tasks y controles SOC 2 que Scrut marca como pendientes, con su recurrencia.
2. Quién sube la evidencia a Scrut y con qué frecuencia.
3. Si su plan de Scrut incluye el MCP, para evaluar la subida automática.

## 7. Límites que conviene decir

- Scrut nunca marca una tarea como completa sola: alguien del lado de Max la verifica y la cierra.
- Lo que más pide un auditor de SOC 2 (revisiones de acceso, cambios de código y despliegues del producto, incidentes) no está en estas tres stories. Lo que sí cubren es el control humano sobre salidas de IA y el monitoreo de los agentes. Conviene que Max lo sepa antes de contar con esto como cobertura de SOC 2.
- El mapeo a controles es provisional hasta tener los requisitos de Scrut.

## Fuentes

- Scrut, Frequently Asked Questions: https://scrut.io/faq
- Scrut Help Center, How to create evidence tasks: https://help.scrut.io/docs/how-to-create-evidence-tasks
- Scrut Help Center, Upload evidence manually: https://help.scrut.io/docs/uploading-evidence
- Scrut Help Center, Upload evidence from Google Drive: https://help.scrut.io/docs/google-drive-integration-upload-evidences-from-google-drive
- Scrut Help Center, Evidence automation workflow: https://help.scrut.io/docs/evidence-automation-workflow
- Scrut Help Center, Evidence collection statuses: https://help.scrut.io/docs/understanding-evidence-collection-statuses
- Scrut, Meet Scrut MCP (20 jul 2026): https://www.scrut.io/post/meet-scrut-mcp
- Map King Hub: esquema de approvals, ticket_candidates, loom_sync_runs, ingestion_runs y priority_events, leído el 14 oct 2026.
- Repo: stories/MapMigGon37539/estimation-report.md, implementation-plan.md, validation-MapKMigGon39261-39264.md.
