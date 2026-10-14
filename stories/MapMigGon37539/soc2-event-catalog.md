# SOC 2 Evidence · catálogo de eventos y tablas

Map MigGon37539 (base) · MapKMigGon39261 (P01) · MapKMigGon39264 (P02). Versión 0.4 · 14 oct 2026 · propuesta para revisión de Andrés.

## 1. Idea

En lugar de "toda corrida de agente produce evidencia", se estudia una lista explícita de eventos. Cada evento estudiado está definido y documentado en una tabla de catálogo; cada vez que ocurre, se registra una fila en una tabla de eventos. La lista empieza chica y crece agregando filas al catálogo, sin cambiar el modelo.

Arranque (v1): Loom, Ingestion Agent y dos automatizaciones que ya dejan rastro.

## 2. Dos tablas, no una

El esquema sugerido mezcla dos cosas distintas:

- Lo que describe un tipo de evento (descripción, configuración, cómo se detecta, a qué control apunta). Cambia poco y lo edita una persona.
- Lo que pasó una vez (cuándo se produjo, cuándo se registró, quién, con qué resultado). Se escribe muchas veces y solo lo escribe una automatización.

Separarlas da un solo escritor por tabla (regla del proyecto), deja la documentación en un lugar y hace que agregar un evento sea agregar una fila.

| Tabla | Qué guarda | Escribe |
|---|---|---|
| soc2_event_types | Catálogo: un evento estudiado por fila, con su documentación y configuración | Editores designados |
| soc2_events | Una fila por ocurrencia capturada. Es la evidencia | Solo las automatizaciones de captura |
| soc2_capture_runs | Una fila por corrida de captura: capturados, salteados, fallidos y motivos | Solo las automatizaciones de captura |

Esto reemplaza dos piezas del diseño anterior:

- soc2_event_types absorbe las reglas de qué califica (antes soc2_evidence_rules) y el source type (antes la tabla de tipos que linkeaba la evidencia).
- No hace falta activity_runs: todas las fuentes de v1 ya escriben en tablas que existen.

## 3. soc2_event_types (catálogo)

| Campo | Tipo | Contenido |
|---|---|---|
| event_code | Texto (primario) | Código estable: loom.sync.init, ingestion.run.error, etc. No se reutiliza nunca |
| name | Texto | Nombre corto legible |
| description | Texto largo | Qué es el evento y por qué es evidencia |
| source | Single select | loom, ingestion, automation (crece con nuevas fuentes) |
| source_table | Texto | Tabla de Map King Hub donde se detecta |
| source_workflow | Texto | Para automatizaciones: nombre e id de la automatización (wfl…) |
| detection | Texto largo | La regla en palabras: qué fila y qué cambio produce el evento |
| detection_config | Texto largo (JSON) | La regla en datos para el script: campo de estado, valores, exclusiones |
| produced_at_field | Texto | Campo de la fuente con la hora del evento |
| actor_rule | Texto | De dónde sale el actor |
| outcome | Single select | Resultado que asigna: started, success, partial, failure, abandoned, fixed |
| category | Single select | Change Management, Access Control, Operations & Monitoring, Risk & Compliance |
| tsc_refs | Texto | Criterios TSC tentativos, por ejemplo CC7.2 (provisional) |
| qualifies | Checkbox | Pasó el checklist de calificación (atribuible, control, resultado, íntegro) |
| qualification_notes | Texto largo | Por qué califica o qué le falta |
| status | Single select | enabled, trace, paused, disabled (ver abajo) |
| version | Número | Sube cuando cambia la regla de detección |
| controls | Link a soc2_controls | Lo agrega la P02 |
| owner, doc_url | Colaborador, URL | Responsable y documentación |
| last_modified, last_modified_by | Automáticos | Quién cambió la definición y cuándo |

Valores de status:

- enabled: se captura.
- trace: se detecta y se evalúa igual que enabled, pero no se escribe en soc2_events. Lo que se habría escrito (event_key, registro de origen, outcome, motivo si se salteó) queda en soc2_capture_runs y en el log de la automatización. No cuenta como evidencia y al pasar a enabled no se recupera lo trazado.
- paused: se deja de capturar por un tiempo (por ejemplo, ruido o un problema en la fuente). Al volver a enabled no se recupera lo ocurrido durante la pausa; la pausa queda registrada en soc2_capture_runs.
- disabled: definido y documentado pero no se captura: todavía no es observable o se dejó de usar. El event_code no se reutiliza.

Las automatizaciones de captura leen el catálogo: solo se escribe evidencia de un evento con status enabled.

Ciclo de vida de un evento nuevo: disabled (definido) → trace (se valida la detección contra datos reales, sin escribir) → enabled. trace también sirve para diagnosticar un evento ya activo: se pasa a trace, se mira qué detecta y se vuelve a enabled.

Además del status por evento, el script acepta una entrada dryRun para la corrida completa (mismo patrón que cct-triage-compute): con dryRun = yes ningún evento escribe, sea cual sea su status. dryRun sirve para la puesta en marcha; trace, para un evento puntual.

soc2_capture_runs guarda el detalle de lo trazado en un campo de texto (JSON), con tope de entradas por corrida para no crecer sin control. La regla de detección vive en el script (sección 10); detection y detection_config en la tabla la documentan y deben coincidir con el código, que lo verifica al arrancar.

## 4. soc2_events (ocurrencias)

| Campo | Tipo | Contenido |
|---|---|---|
| event_key | Texto (primario) | event_code + ":" + record id de la fuente + ":" + produced_at en ISO. Clave de idempotencia |
| event_type | Link a soc2_event_types | Se llena una vez, al crear |
| source | Lookup | Desde el tipo |
| source_table, source_record_id, source_url | Texto, texto, URL | Trazabilidad hasta la fila de origen |
| run_ref | Texto | Id propio de la fuente: run_id de Loom, archivo de Ingestion, id de la automatización |
| produced_at | Fecha y hora | Cuándo ocurrió según la fuente |
| source_recorded_at | Fecha y hora | Hora de servidor de la fila de origen (creación o última modificación en Airtable) |
| recorded_at | Creación (automático) | Cuándo lo registramos. Hora de servidor; es la hora de la evidencia |
| actor | Texto | Quién: "agent:Loom", "agent:Ingestion Agent", "automation:<nombre>" y, si lo hay, la persona que lo pidió |
| trigger | Texto | schedule, slack:#ingestion <persona>, record, hourly |
| outcome | Single select | started, success, partial, failure, abandoned, fixed |
| summary | Texto | Una línea sin contenido: conteos, motivo corto |
| details | Texto largo (JSON) | Conteos y códigos; nunca texto de tareas, archivos o reportes |
| capture_run | Link a soc2_capture_runs | Qué corrida lo capturó |
| confirmed | Checkbox | El módulo lo marca después de releer el registro escrito |
| is_test | Checkbox | Datos de prueba (regla en la sección 7); no se exportan |
| integrity_hash | Texto | Opcional: hash de los campos observados |
| last_modified | Automático | Para detectar ediciones posteriores a la captura |

### Por qué dos fechas (tres, en realidad)

- produced_at es la hora que reporta la fuente (Loom escribe su started_at y finished_at). Sirve para el relato, pero la escribe un agente.
- source_recorded_at es la hora en que Airtable guardó la fila de origen. La pone el servidor.
- recorded_at es la hora en que nosotros capturamos. La pone el servidor.

SOC 2 prefiere hora de servidor. La diferencia entre produced_at y recorded_at además mide la latencia de captura, que sirve para monitoreo. Para tener source_recorded_at en las fuentes que solo tienen fechas escritas por el agente (loom_sync_runs, ingestion_runs), se agrega a esas tablas un campo automático de última modificación. Es aditivo y no cambia a los productores.

## 5. Eventos de arranque (v1)

### Loom (loom_sync_runs)

| event_code | Se produce cuando | produced_at | outcome |
|---|---|---|---|
| loom.sync.init | Se crea una fila con status running | started_at | started |
| loom.sync.completed | El status pasa a success o partial | finished_at | success o partial |
| loom.sync.error | El status pasa a failure o abandoned | finished_at | failure o abandoned |

Notas:

- abandoned no lo escribe la corrida que falló: lo escribe la corrida siguiente al encontrar una fila running de más de 35 minutos (prompt de Loom). La hora es la del abandono, no la del corte; se documenta así.
- rejected_busy (otra sincronización en curso) no está en v1. Es buena evidencia de control de concurrencia y queda como candidato.
- Actor: "agent:Loom" más el solicitante cuando trigger es slack:#ingestion <persona>. El solicitante a veces es el id de Slack y a veces el nombre; se normaliza.

### Ingestion Agent (ingestion_runs)

| event_code | Se produce cuando | produced_at | outcome |
|---|---|---|---|
| ingestion.run.init | Empieza el procesamiento de un archivo | — | started |
| ingestion.run.completed | Se crea o reemplaza la fila con run_status Completed o Completed with errors | run_at | success o partial |
| ingestion.run.error | La fila tiene run_status Failed | run_at | failure |

Notas:

- ingestion.run.init no es observable hoy. El agente escribe ingestion_runs una sola vez, al terminar. Opciones: (a) que el agente cree la fila al empezar, con status running, como Loom; es un cambio de prompt en Hyperagent; (b) dejar el evento en el catálogo con status disabled. Recomendación: (b) en v1 y (a) cuando se toque el agente por otro motivo.
- Failed solo cubre "no pudo escribir en Supabase". Si el agente se corta antes de escribir la fila, no queda rastro; es un límite conocido.
- En modo replace el agente actualiza la misma fila. Como event_key incluye produced_at (run_at), un reemplazo es un evento nuevo y el anterior se conserva.
- Las dos filas actuales (19 ago, archivos de muestra) son de prueba.

### Automatizaciones

Elegidas porque ya registran cada corrida en priority_events con source = automation y hora de servidor (created_at), sin tocar su código. En los últimos dos días hay 42 eventos de automatización.

| event_code | Automatización | Se produce cuando | outcome |
|---|---|---|---|
| automation.triage_compute.completed | command_center_triages · compute · hourly (wflFoOYmzWHZEcHPA) | Evento triage_compute con status ok | success |
| automation.triage_compute.error | La misma | Evento triage_compute con status distinto de ok | failure |
| automation.lanes_integrity.fixed | task_lanes · integrity on create / on update (wflzX39Z0Wl4xQLel, wflvV2l7S9rBYzVFS) | Evento guard_fix o dedupe | fixed |

Notas:

- Se excluyen las corridas en dry run (summary empieza con "[dry run]").
- triage_compute corre cada hora: unas 24 evidencias por día. Si el volumen molesta, se puede capturar solo el error y un resumen diario del completed; queda como configuración.
- lanes_integrity es la mejor evidencia de control de las dos: muestra que el sistema detecta y corrige estados inválidos (duplicados, ranking roto) y lo registra.
- Candidato siguiente: el guard de duplicados de command_center_tasks (wfletTuP3cF7pZjWV). Hoy no deja registro fuera del historial de la automatización; necesitaría escribir en priority_events.

### Calificación de los eventos de arranque

| Evento | Atribuible | Control | Resultado | Íntegro | Categoría · TSC |
|---|---|---|---|---|---|
| loom.sync.* | Sí (agente + solicitante) | Monitoreo de procesamiento | Sí | Parcial: Loom actualiza su fila | Operations & Monitoring · CC7.2 |
| ingestion.run.* | Parcial (run_by es texto libre) | Validación de datos de entrada | Sí | Parcial: replace sobrescribe | Operations & Monitoring · PI1 |
| automation.triage_compute.* | Sí | Monitoreo de procesamiento | Sí | Sí: priority_events no se borra | Operations & Monitoring · CC7.2 |
| automation.lanes_integrity.fixed | Sí | Detección y corrección de errores | Sí | Sí | Operations & Monitoring · CC7.3 |

"Íntegro parcial" se resuelve copiando los valores al capturar: soc2_events guarda lo observado en ese momento aunque la fuente cambie después.

## 6. Cómo se captura

1. Automatizaciones disparadas por registro en Map King Hub:
   - loom_sync_runs: al crear (init) y cuando el status pasa a un valor terminal (completed o error).
   - ingestion_runs: al crear o cambiar run_status o run_at.
   - priority_events: al crear, con source = automation.
2. Cada una llama al mismo módulo (airtable/soc2): busca en el catálogo los eventos activos para esa tabla, evalúa detection_config, arma la fila, verifica event_key, escribe, relee y marca confirmed.
3. Una automatización horaria recorre las fuentes y captura lo que se haya perdido (disparo fallido o caído), con la misma clave.
4. soc2_capture_runs registra cada corrida: capturados, ya existentes, salteados (con motivo) y fallidos.

## 7. Datos de prueba

is_test se marca si se cumple alguna:

- produced_at anterior a la fecha de go-live de la captura (configurable).
- El nombre o id de la fila contiene TEST o QA-TEST.
- Archivos de ingestion con "sample" o "test" en el nombre.
- Corridas en dry run.

Los eventos de prueba se guardan (sirven para QA) pero no se exportan ni cuentan como evidencia.

## 8. Qué cambia en las stories (pendiente, no aplicado)

- 37539: la tabla de evidencia pasa a ser soc2_events y la de reglas pasa a ser soc2_event_types. El módulo, los reintentos, el confirmed y soc2_capture_runs no cambian.
- P01 (39261): su alcance pasa a ser estos eventos de arranque. Sale activity_runs; Ingestion queda sin init en v1; las revisiones de tickets salen hasta que el flujo de 38533 esté desplegado.
- P02 (39264): el mapeo a controles pasa de source type a event type (más fino). Se agrega categoría y filtro por período.
- Aprobaciones (approvals): fuera de v1. Los datos actuales son de desarrollo (último registro el 24 ago). Entran como evento del catálogo (approval.decided) cuando la bandeja de aprobaciones tenga uso regular.
- Textos de SS actualizados en MapKMigGon39261-final.md y MapKMigGon39264-final.md (versión 2, fase 0).
- Docs a actualizar después de aprobar esto: scrut-soc2-evidence-format.md, implementation-plan.md §9, los -final.md y el paquete de contexto del repo.

## 9. Decisiones abiertas

1. Ingestion init: dejar disabled (recomendado) o cambiar el prompt del agente ya.
2. triage_compute: capturar cada corrida o solo errores más un resumen diario.
3. Fecha de go-live de la captura (corta los datos de prueba).
4. Agregar el campo automático de última modificación a loom_sync_runs e ingestion_runs (aditivo, con OK).
5. Si rejected_busy de Loom entra en v1.

## 10. Decisión: un único script con todos los eventos (14 oct 2026)

Un solo script de captura, airtable/soc2/soc2-capture.ts, contiene el registro de todos los eventos estudiados: para cada event_code, la tabla de origen, la regla de detección, el mapeo de campos (produced_at, actor, outcome, summary) y la regla de datos de prueba. El mismo archivo se pega en todas las automatizaciones de captura; cada una le pasa la tabla y el registro que la dispararon, o "hourly" para la recuperación.

Reparto entre código y tabla:

| Vive en el script | Vive en soc2_event_types |
|---|---|
| Detección, mapeo de campos y exclusiones | Descripción y documentación del evento |
| Tests unitarios por evento, con fixtures de filas reales | status: enabled, trace, paused o disabled, sin tocar código |
| version de la regla | Categoría, TSC, calificación y controles (P02) |

Al arrancar, el script compara su registro con la tabla:

- Un evento del código sin fila en la tabla, o con status distinto de enabled, no se captura y queda en soc2_capture_runs como configuración incompleta.
- Una fila de la tabla sin evento en el código se ignora y se reporta.
- Si la version del código y la de la tabla no coinciden, se reporta.

Los agentes (Loom, Ingestion Agent) no llaman a este script ni escriben evidencia: siguen escribiendo solo su propio log de corrida, y el script captura desde ahí. Motivos: la evidencia la produce un tercero y no el actor auditado; un corte del agente igual queda registrado (Loom marca abandoned); las automatizaciones quedan cubiertas por el mismo camino; y no se tocan prompts en producción. Si se quiere ingestion.run.init, el agente crea su fila en ingestion_runs con status running al empezar, como Loom, y el script la convierte en evento.

Agregar un evento: una entrada en el registro del script con su test, una fila en soc2_event_types y, si la tabla de origen es nueva, una automatización más que pegue el mismo script.

