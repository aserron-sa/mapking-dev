# Validación ítem por ítem · MapKMigGon39261 (P01) y MapKMigGon39264 (P02)

Fecha: 14 oct 2026. Revisa los textos de MapKMigGon39261-final.md y MapKMigGon39264-final.md.

Cada ítem se valida en tres ejes:

- Definido: Sí (se puede implementar y probar sin preguntar), Parcial (falta un dato o una regla), No (ambiguo).
- Factual: Verificado (comprobado en Map King Hub, en los prompts de los agentes o en el repo), Diseño (algo nuevo que la story propone construir; es legítimo, no existe todavía), No respaldado (afirma algo sobre lo que ya existe y no hay fuente que lo confirme).
- Spec: el criterio de la story padre Map MigGon37539 que cubre (IDs F/T/D/E/S de estimation-report.md §3), "Plan" si viene del implementation-plan.md de la 37539, "Desvío" si contradice el plan de la 37539 (no el padre: ver la sección de trazabilidad), "Nuevo" si no está en ninguno.

Fuentes consultadas: SS (37539; 39261 y 39264 leídas de nuevo el 14 oct a las 09:45), estimation-report.md, implementation-plan.md §3 y §9, esquema de Map King Hub (tablas, campos y opciones leídas hoy), automatizaciones de Map King Hub, hyperagent/agents/loom/loom.agent.md, hyperagent/agent-ingestion-agent.json y docs/temp/ingestion.md.

## Validación de lo que hoy está en SS (lectura del 14 oct 2026, 09:45 UTC-3)

Fuente: detalle y actividad de MapKMigGon39261 y MapKMigGon39264 leídos de SS. El nombre de la story no viene en la lectura de SS, así que no se valida acá.

Criterios de aceptación:

- P01: el texto en SS es el de MapKMigGon39261-final.md, con estos cambios ya aplicados: airtable/soc2/, link de source type, confirmed y escenarios con link de vuelta. Las tablas por ítem de más abajo valen tal cual para SS.
- P02: el texto en SS es el validado más abajo, sin las correcciones de MapKMigGon39264-final.md. Todavía dice "the sources story" en 4 lugares.

### MapKMigGon39261 · P01 · campos en SS

| Campo en SS | Valor actual | Definido | Factual | Spec | Observación |
|---|---|---|---|---|---|
| Written story | As a Backend Engineer, I want to extend the SOC 2 evidence capture built in Map MigGon37539 to Loom runs, Ingestion Agent runs, automation events and ticket reviews… | Sí | — | F1, E6 | Bien. |
| Business story | As a Client, I want evidence to be collected from every agent and automation in the operation… | Parcial | No respaldado | F1 | "every agent" exagera: Hyperagent tiene 10 agentes y la story cubre 4 fuentes. |
| Work area / stage | Backend / Back-End | Sí | Verificado | — | Bien. |
| Tech | AI, Airtable | Parcial | Incompleto | — | Falta TypeScript: los criterios dicen que adaptadores y logging son TypeScript. |
| Primary AI technology | Claude, Other, Hyperagent, Claude Code | No | No respaldado | — | "Other" no designa nada. Hyperagent depende de la decisión 1. |
| AI description | …Hyperagent/Other will orchestrate run-log evaluation, idempotency, and terminal-status capture… | No | No respaldado | — | Contradice los criterios: la evaluación, la idempotencia y el estado terminal los hacen los scripts de Airtable, no Hyperagent. |
| Acceptance criteria | Texto final (ver tablas P01 abajo) | Parcial | Parcial | F1, F3–F7, E1–E7, S1–S6 | Hallazgos 1 a 7. Sigue "the panel's value". |
| Client-friendly AC | Vacío | No | — | — | El cliente no ve nada en SS. Va el texto de MapKMigGon39261-final.md, corrigiendo "already used" (hallazgo 10). |
| Dependencies | Ninguna | No | — | — | Depende de Map MigGon37539: tabla de evidencia, módulo, log de corridas y automatización horaria. Falta cargarla. |
| Fechas | start 2026-10-14 · due 2026-10-14 | No | — | — | Due el mismo día en que se creó, sin la 37539 construida (está en el sprint 5). No es alcanzable; lo decide el PM. |
| Puntos | 4 (AI sugerido 4) | — | — | — | Antes la sugerencia de IA era 5; ahora SS registra 4. |

### MapKMigGon39264 · P02 · campos en SS

| Campo en SS | Valor actual | Definido | Factual | Spec | Observación |
|---|---|---|---|---|---|
| Written story | As a compliance reviewer, I want to browse and export stored SOC 2 evidence by control… | Sí | — | F2 | Válida como historia, pero cambia de persona respecto de la 37539 y la P01 (Backend Engineer). Borrador alternativo en MapKMigGon39264-final.md. |
| Business story | …the SOC 2 evidence already captured in Map King Hub to be organized by SOC 2 control and ready for export… | Parcial | No respaldado | F2 | "already captured": hoy no hay evidencia capturada (37539 y P01 sin construir). |
| Work area / stage | Full Stack / Stage Not Assigned | No | No respaldado | — | Todo es Airtable nativo, sin frontend propio: Backend (stage Back-End). |
| Tech | AI, SQL, Full Stack Operations, Java Script, Node JS, TypeScript, Airtable | No | No respaldado | — | Los criterios dicen "No scripts or automations": SQL, JS, Node y TypeScript no se usan. Solo Airtable. |
| Primary AI technology | Airtable AI, Claude | Parcial | No respaldado | — | Ningún criterio usa Airtable AI. Solo Claude. |
| AI description | …assist TypeScript/Node.js implementation… TypeScript/Node.js will wire read-only CSV export and traceability checks across the full stack. | No | No respaldado | — | Contradice los criterios: el CSV sale de la descarga de la interfaz y no hay código. |
| Acceptance criteria | Ver tablas P02 abajo | Parcial | Parcial | F2, F4, F6, D6, S1–S5 | "the sources story" en 4 lugares (debe ser MapKMigGon39261). Más los hallazgos 8 y 9, el encabezado con el control filtrado y la carpeta de docs. |
| Client-friendly AC · columnas del CSV | control ID, control name, evidence type, source type, run ID, source reference, timestamp, status, actor, AI output state | No | No respaldado | F2 | No coincide con los criterios (mapped controls, mapping provisional, source type, run_id, source reference, finished_at, run status, trigger, counts, actor, AI output state). "evidence type" y "source type" son lo mismo. Faltan provisional, trigger y counts. |
| Client-friendly AC · "where access and credentials are managed" | — | Parcial | — | S2, S3 | La P02 no usa credenciales; los criterios piden documentar accesos sin credenciales. |
| Client-friendly AC · "avoid personal data… actor" | — | Parcial | — | S1 | Se contradice: actor es una persona. |
| Client-friendly AC · resto | No new evidence sources; no changes to capture; no Scrut API; provisional mappings now | Sí | — | F2 | Bien. |
| Dependencies | Ninguna | No | — | — | Depende de Map MigGon37539 y de MapKMigGon39261, y de la compuerta del CSV con filtro (plan §9.5). |
| Fechas | Sin fechas | — | — | — | Bien; las define el PM. |

### Qué está bien en SS

- P01: historia técnica, área de trabajo y casi todos los criterios. Los escenarios de Loom, el skip con motivo y los de errores están verificados contra Map King Hub.
- P02: los criterios técnicos, de datos, de bordes y de seguridad son coherentes entre sí y con el plan de la 37539, salvo los puntos listados.

### Qué hay que corregir en SS, por prioridad

1. P02: Tech, Primary AI technology, AI description y Work area. Hoy describen una implementación en TypeScript y Node que la story misma excluye.
2. P02: columnas del CSV en el texto para el cliente. Hoy difieren de los criterios.
3. P01: AI description y Primary AI technology (Hyperagent no orquesta la captura).
4. P01: texto para el cliente vacío.
5. Ambas: dependencia con Map MigGon37539 (y P02 con P01), y la fecha de vencimiento de la P01.
6. P01: decisiones 1 a 4 de abajo antes de tocar los criterios.

## Trazabilidad contra la story padre (Map MigGon37539)

P01 y P02 salen de los 35 criterios de la 37539, que sigue siendo la story base: captura de aprobaciones, módulo de evidencia, reintentos, reproceso. Esta sección mide las dos sub-stories contra el texto de esos criterios, no contra el plan.

Estados:

- Cubre: la sub-story lo implementa para su alcance.
- Hereda: lo implementa la 37539 y la sub-story lo usa citándola.
- Parcial: lo toca, pero falta algo o choca con el texto del padre.
- —: no le corresponde a esa sub-story.

### Del padre hacia P01 y P02

| ID | Criterio del padre (resumen) | P01 | P02 | Observación |
|---|---|---|---|---|
| F1 | Captura automática de operaciones de agentes que califican, sin paso manual | Cubre (Loom, Ingestion, automatizaciones, tickets) | — | El padre deja abierto qué califica. P01 lo cierra para Loom e Ingestion; para automatizaciones falta la lista (hallazgo 4). |
| F2 | Registros en un formato mapeable al framework de Scrut | — | Cubre | P02 va más allá: pide vista por control y CSV, cuando el padre solo pide formato mapeable (ver ampliaciones abajo). |
| F3 | Registro con metadata y contexto al completar o en el punto de captura configurado | Cubre (estado terminal, fila nueva) | — | Bien. |
| F4 | Marcado disponible para auditoría al persistir | Cubre (confirmed) | Cubre (solo confirmados) | Bien. |
| F5 | Sin duplicados con regla de idempotencia determinista | Parcial | — | Clave source_type + run_id. Falta cómo se evita la carrera entre la automatización disparada y la horaria. |
| F6 | Trazabilidad hasta la actividad de origen | Parcial | Cubre | Loom, Ingestion y automatizaciones enlazan su fila; en tickets, "ticket id" es ambiguo (hallazgo 5). |
| F7 | Log de éxito, fallo o salteado | Parcial | — | El log de la 37539 es por corrida; P01 lo pide por fila (hallazgo 7). |
| T1 | Workflow disparado por actividad de agentes o eventos del backend, con límites claros | Cubre | — | La P01 lo cumple al pie de la letra: productor registra, automatización disparada, adaptador, módulo. |
| T2 | Validar entradas: id de origen, timestamp, estado, contexto | Cubre | — | Valida run_id, source_type, finished_at y status; "contexto suficiente" no se valida. |
| T3 | Payload normalizado sin detalles transitorios | Cubre | — | Adaptadores hacia el contrato de la 37539. |
| T4 | De salidas IA, solo contexto relevante; no salida arbitraria del modelo por defecto | Parcial | — | "AI content stays in the AI fields" no limita qué contenido IA se guarda (hallazgo 11). |
| T5 | Mapeo de campos definido y validación antes de escribir en Airtable | Hereda | — | Módulo de evidencia de la 37539. |
| T6 | Manejo explícito de respuestas de Airtable (éxito, validación, 429, transitorios) | Hereda | — | Bien. |
| T7 | Logs estructurados de intentos, validaciones, reintentos y estado final | Hereda | — | P01 no lo repite para la automatización disparada; conviene una línea. |
| T8 | Contrato interno estable para que los servicios de agentes envíen evidencia | Cubre | — | activity_runs más el contrato en airtable/soc2 cumplen esto. |
| D1 | Flujo actividad, evaluación, normalización, persistencia, registro del resultado | Cubre | Cubre (lectura) | Bien. |
| D2 | Payload mínimo: referencia única, tipo o categoría, timestamp, estado, contexto | Cubre | Cubre (columnas CSV) | source_type es el tipo o categoría. |
| D3 | Mapeo definido y aplicado entre campos de origen y de evidencia | Parcial | — | La P01 dice que hay un adaptador por fuente, pero no fija el mapeo campo por campo. Va en el spec. |
| D4 | Distinguir metadata observada de contenido IA | Cubre | — | Bien. |
| D5 | Validación, manejo de respuesta y confirmación de persistencia en el límite con Airtable | Cubre | — | Relectura y confirmed. |
| D6 | Nunca "evidenciado" sin persistencia confirmada | Cubre | Cubre | Bien. |
| D7 | Reproceso sin duplicados | Cubre | — | Bien. |
| E1 | Faltan campos: rechazar, registrar motivo, marcar fallo o salteado | Cubre | — | Bien. |
| E2 | Airtable rechaza: capturar detalle, no marcar guardado | Cubre | — | Bien. |
| E3 | Dependencia caída: reintentar | Hereda | — | Bien. |
| E4 | Reintentos agotados: fallo terminal reprocesable | Cubre | — | Bien. |
| E5 | Evento repetido: sin duplicado | Cubre | — | Ver F5. |
| E6 | Salida IA malformada, ausente o no relevante: conservar la metadata | Parcial | — | Cubre "malformada" y "ausente". El padre nombra también "no relevante", que es el caso de automatizaciones y revisiones humanas; hoy no tiene valor propio (hallazgo 3). |
| E7 | Evento que no califica: saltear y registrar motivo | Cubre | — | Bien. |
| S1 | Solo datos necesarios | Cubre | Cubre | Bien. |
| S2 | Autorización según prácticas existentes | Parcial | Cubre (documentación) | "Only producers write to activity_runs" no está verificado en Airtable. |
| S3 | Credenciales fuera del código y los logs | Cubre | Cubre | Bien. |
| S4 | Logs sin contenido sensible | Cubre | — | Bien. |
| S5 | No bloquear el procesamiento de los agentes | Cubre | Cubre | Bien. |
| S6 | Reintentos acotados | Hereda | — | Bien. |

Resumen: de los 35 criterios, los que tocan P01 y P02 quedan cubiertos o heredados, salvo 9 parciales: F1, F5, F6, F7, T4, D3, E6, S2 en P01 y ninguno de fondo en P02. No hay criterios del padre contradichos por las sub-stories.

### De P01 y P02 hacia el padre (ampliaciones)

| Ítem | Origen | Evaluación |
|---|---|---|
| P01 · doble camino: automatización disparada más red horaria | T1 + plan | Dentro del padre. |
| P01 · activity_runs append-only, escrita por productores | T1, T8 | Dentro del padre. Se aparta del diagnóstico (modelo pull), no del padre. |
| P01 · trigger de Loom tal cual | F6 | Dentro del padre, salvo "the panel's value" (hallazgo 6). |
| P01 · sin datos de prueba en producción | Riesgo del diagnóstico | Agregado razonable. |
| P02 · tablas de controles y mapeo, flag provisional | F2 | Dentro del padre: es lo que hace mapeable el formato. |
| P02 · página por control, página sin mapeo, CSV desde la interfaz | Plan (paquete para Scrut) | Ampliación: el padre pide formato mapeable, no vista ni export. Justificado en el plan, pero es alcance agregado y conviene que el PM lo sepa. |
| P02 · CSV en UTF-8 e ISO 8601 UTC | Nuevo | Ampliación chica; requiere configurar los campos de fecha. |
| P02 · guía de QA y trazabilidad de criterios | S2, S3 + práctica del equipo | Dentro del padre para S2 y S3; el resto es práctica. |

## Hallazgos que cambian el texto

1. activity_runs se aparta del plan, no del padre. Los criterios T1 y T8 de la 37539 piden un workflow disparado por la actividad de los agentes y un contrato estable para que los agentes envíen evidencia: la P01 cumple eso al pie de la letra. El diagnóstico y el plan (§3, story B) habían elegido otra lectura, también válida: leer las tablas que ya existen (ingestion_runs, priority_events, ticket_candidates) sin tocar a los agentes. Las dos cumplen el padre. Hay que elegir una y dejarla asentada: activity_runs agrega trabajo en el prompt del Ingestion Agent y en cada automatización; leer las tablas existentes no toca a los productores pero obliga a un adaptador por tabla con campos distintos (ingestion_runs no tiene run_id ni started_at/finished_at).
2. El Ingestion Agent ya escribe una fila por archivo en ingestion_runs (Map King Hub). Esa tabla no tiene run_id ni started_at/finished_at: tiene run_at, run_by, run_status (Completed, Completed with errors, Failed) y conteos. En modo "replace" actualiza la misma fila en lugar de crear otra. La validación del agente es un script determinista, así que "AI output state" no tiene un dato de IA que mirar.
3. "AI output state" no admite "no aplica". Las corridas de automatizaciones y las revisiones de tickets (hechas por personas) no tienen salida de IA; con el enum present/missing/malformed quedarían como "missing", que en una auditoría se lee como falla. Hace falta un cuarto valor (not_applicable) o limitar el campo a las fuentes con IA.
4. "Qualifying automation" no está definido. No dice qué automatizaciones. Hoy la actividad de automatizaciones ya queda en priority_events (triage_compute, guard_fix, dedupe, validation_failed, airtable_error), escrita por las automatizaciones de 38570 y 38571.
5. El flujo de revisión de tickets no está desplegado. La revisión se hace en ticket_candidates (review_status pending, approved o discarded; reviewed_by; reviewed_at es solo fecha, sin hora). Las dos automatizaciones de 38533 ("Validate - On Ticket Candidate Created" y "Create - On Candidate Approved") están sin desplegar y con el script pendiente de pegar. "The ticket review flow writes one row" no tiene hoy quién lo haga, y "ticket id" puede ser el source_finding_id, el registro del candidato o el ticket de Linear.
6. "The panel's value" como trigger de Loom no tiene fuente. El prompt de Loom solo define "schedule" y "slack:#ingestion <requester>", y las 6 filas de loom_sync_runs tienen solo esos dos. Hay que sacarlo.
7. El log de corridas de la 37539 es por corrida, no por fila. El diagnóstico define soc2_capture_runs como "un registro por corrida, no por evento". Varios ítems de la P01 piden registrar cada fila como skipped, failed o duplicate con su motivo. O el log pasa a ser por fila, o los motivos van dentro del registro de la corrida.
8. Dos tablas para lo mismo. El plan de la 37539 pone las reglas de qué califica y el mapeo a controles en soc2_evidence_rules. La P02 crea soc2_control_mappings, una fila por source type. Hay que decidir si son una sola tabla o dos con responsabilidades separadas (reglas de captura en una, controles en la otra).
9. La hora de aprobación no existe. approvals.approval_date es un campo de fecha sin hora. La P02 exporta "finished_at (approval time for approvals)". Se puede usar approval_date (solo fecha) o last_modified (fecha y hora del último cambio, que no siempre es la aprobación).
10. El texto para el cliente de la P01 dice "the same evidence approach already used for the existing SOC 2 workflow". Hoy no hay nada implementado en la 37539, así que "already used" es falso.
11. Contenido IA en la evidencia. El padre (T4) pide guardar de las salidas IA solo el contexto relevante para la auditoría, no la salida del modelo por defecto. La P01 dice "AI content stays in the AI fields", sin límite. Sugerido: "Evidence keeps only the AI output state and a reference to the AI output in its source; the AI text itself is not copied into evidence."

## MapKMigGon39261 · P01

### Campos

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Name | Sí | — | — | Bien. |
| Work area: Backend | Sí | Verificado (igual en SS) | — | Bien. |
| Tech: AI, Airtable, TypeScript | Sí | Verificado (airtable/soc2 existe con código TS) | — | Bien. |
| Primary AI technology: Claude, Claude Code, Hyperagent | Sí | Verificado (Hyperagent corre el Ingestion Agent) | — | Si se vuelve al plan (hallazgo 1), Hyperagent deja de participar y sale de la lista. |
| Written story | Sí | — | F1, E6 | Bien. |
| Business story | Parcial | No respaldado | F1 | "every agent and automation in the operation" exagera: Hyperagent tiene 10 agentes y la story cubre Loom, Ingestion, automatizaciones y revisiones (más aprobaciones en la 37539). Sugerido: "from Loom, the Ingestion Agent, automations and ticket reviews, not only from approvals". |
| AI description | Sí | Diseño | Desvío | Depende de activity_runs (hallazgo 1). |

### Acceptance Criteria

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Finished Loom runs produce evidence | Sí | Verificado (estados, run_id, trigger y conteos existen en loom_sync_runs) | F1, F3, F6 | loom_sync_runs también tiene skipped; si se quiere completo, agregarlo a los conteos. |
| Loom runs still in progress | Sí | Verificado ("running" existe y hace de lock) | F3 | Bien. |
| Ingestion Agent runs produce evidence | Parcial | Diseño sobre algo que ya existe distinto | F1 · Desvío | Hallazgos 1, 2 y 3. "Ingestion qualifying rule" no dice cuál es. Sin activity_runs, la fuente es ingestion_runs y los campos son run_at, run_by, run_status y conteos. |
| Automation runs produce evidence | No | Diseño | F1, T1 · Desvío | Hallazgo 4: falta la lista de automatizaciones. Con el plan, la fuente es priority_events. |
| Ticket reviews produce evidence | No | No respaldado (el flujo no está desplegado) | F1 · Desvío | Hallazgo 5. Definir qué es "ticket id" y quién registra la revisión (approve y discard). |
| Non-qualifying runs are skipped with a reason | Sí | Verificado ("rejected_busy" existe) | E7, F7 | Depende del hallazgo 7 (log por fila o por corrida). |

### Technical Implementation

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Two run logs feed evidence capture | Sí | Diseño | Desvío | Hallazgo 1. |
| Producers only log their run | Parcial | Diseño | Desvío | Agrega trabajo en el prompt del Ingestion Agent y en cada automatización, que no estaba en el plan ni en las horas. |
| Record-triggered automation | Sí | Verificado (Airtable tiene triggers "record created" y "record matches conditions") | F3, T1 | Bien. |
| Hourly safety net from 37539 | Sí | Plan | Plan §3 | Bien. |
| One adapter per source type | Sí | Plan | T1, T3, D3 | Bien. |
| Qualifying rules in the evidence rules table | Parcial | Plan | E7 | Hallazgo 8. |
| TypeScript under airtable/soc2/ | Sí | Verificado | T8 | Bien. |

### Data & Integration Requirements

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Evidence sources are two run logs | Sí | Diseño | Desvío | Hallazgo 1. |
| activity_runs is append-only | Sí | Diseño | Nuevo | Coherente con "un solo writer por tabla". |
| activity_runs fields | Parcial | Diseño | D2 | "counts" no dice si es un número, varios o texto. ai_output_state no aplica a todos (hallazgo 3). |
| Each evidence record links to its source type row | Sí | Plan | Plan §9.1, F6 | Hallazgo 8. |
| The adapter resolves the source type | Sí | Diseño | T2 | Bien. |
| Loom evidence keeps the trigger | Parcial | Parcial | F6 | "schedule" y "slack:#ingestion <requester>": verificado. "the panel's value": no respaldado (hallazgo 6). El requester a veces es el id de Slack y a veces el nombre. |
| AI output state values | Parcial | — | D4, E6 | Hallazgo 3. |
| Evidence status per run in the evidence run log | Parcial | Plan | F7 | Hallazgo 7. |
| Idempotency key source_type + run_id | Sí | Plan | F5, E5, D7 | Plan §9.3. El diagnóstico usaba otra clave (fuente + id + tipo de evento + versión); §9 la reemplaza. |
| Confirmed only after re-read | Sí | Plan | F4, D5, D6 | Plan §9.2. |

### Edge Cases & Error Handling

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| AI output missing | Sí | — | E6 | Hallazgo 3. |
| AI output malformed | Sí | — | E6 | "the parse error is logged": dónde depende del hallazgo 7. |
| Required core metadata missing | Sí | — | E1, T2 | Bien. |
| Evidence write rejected or failing | Sí | — | E2, E3, E4 | Bien. |
| Triggered capture fails and is recovered | Sí | Diseño | E4, D7 | Bien. |
| Triggered and hourly process the same run | Parcial | — | E5 | Airtable no tiene campos únicos: dos lecturas simultáneas pueden escribir dos veces. El diagnóstico propone un lock por corrida y un guard de duplicados (como el de 38532). Falta decir cuál se usa. |
| Producer logs the same run twice | Sí | Diseño | E5 | Bien. |
| Producer fails to log its run | Parcial | Diseño | S5 | "visible in that producer's own log or report" no dice dónde para cada productor (historial de la automatización, mensaje de Slack del Ingestion Agent). |

### Security & Performance

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Only ids, statuses, timestamps… | Sí | — | S1, T4 | "actor" guarda nombres de personas; está aceptado en el plan (quién aprobó). |
| Credentials not hardcoded or logged | Sí | Verificado (los scripts corren dentro de Airtable) | S3 | Bien. |
| Logging step is a single record write | Sí | Diseño | S5 | Bien. |
| Retries bounded | Sí | Plan | S6 | Bien. |
| One run row per execution, batch and time budget | Sí | Verificado (mismo patrón que cct-triage-compute: lotes de 50, 22 s) | S5 | Bien. |
| Only producers write to activity_runs | Parcial | No respaldado | S2 | Los agentes de Hyperagent escriben con la cuenta OAuth de una persona. Restringir escritura por tabla depende del plan de Airtable (permisos de edición por tabla). Hay que verificarlo o bajar el texto a "por convención y documentado". |
| No test data in production tables | Sí | — | Riesgo del diagnóstico | Bien. |

### Client-friendly acceptance criteria

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Capture evidence for Loom, Ingestion, automations, tickets | Sí | — | F1 | Bien. |
| Evidence even when AI details are missing | Sí | — | E6 | Bien. |
| Trace each record back | Sí | — | F6 | Bien. |
| "same evidence approach already used" | Sí | No respaldado | — | Hallazgo 10. Sugerido: "The same evidence approach built in the base SOC 2 story will be extended to these additional activity types." |
| Stored in Map King Hub, counts once confirmed | Sí | Plan | F4, D6 | Bien. |
| Only listed activities; others skipped with reason | Sí | — | E7 | Bien. |
| Temporary failures retried, then flagged | Sí | — | E3, E4 | Bien. |

## MapKMigGon39264 · P02

### Campos

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Name | Sí | — | — | Bien. |
| Work area: Backend | Sí | — | — | En SS está Full Stack; el cambio es correcto. |
| Tech: Airtable | Sí | Verificado (no se agrega código) | — | Bien. |
| Primary AI technology: Claude | Sí | — | — | Bien. |
| Written story | Sí | — | F2 | Bien. |
| Business story | Sí | — | F2 | Bien. |
| AI description | Sí | — | — | Bien. |

### Acceptance Criteria

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Browse evidence by SOC 2 control | Sí | Diseño | F2 | Depende del hallazgo 8. |
| One source type mapped to several controls | Sí | Diseño | F2 | Bien. |
| Mapping changes apply without rewriting evidence | Sí | Verificado (lookups y lastModifiedBy son tipos nativos) | F2 | Bien. |
| Export evidence for a selected control | Parcial | No verificado | F2 | La descarga CSV con filtro de usuario sobre un lookup es la compuerta de entrada (plan §9.5): no está probada. "approval time" no existe (hallazgo 9). |
| Exported evidence traces back to its origin | Sí | Diseño | F6 | Bien. |
| Only confirmed evidence is listed and exported | Sí | Plan | F4, D6 | Bien. |

### Technical Implementation

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Airtable only, no scripts | Sí | — | — | Bien. |
| New table soc2_controls | Sí | Diseño | F2 | Bien. |
| New table soc2_control_mappings | Parcial | Diseño | Desvío | Hallazgo 8: el plan ponía el mapeo en soc2_evidence_rules. |
| evidence.source_type links to soc2_control_mappings | Sí | Plan | Plan §9.1 | Bien. |
| Controls through a conditional lookup | Sí | Verificado (Airtable permite lookups condicionados) | F2 | Son dos saltos: mapping → controles activos → evidencia. Funciona con un lookup condicionado en el mapeo y un lookup de ese campo en la evidencia. |
| Per-control page with a heading that shows the selected control | Parcial | No verificado | F2 | Un encabezado de interfaz no muestra el valor de un filtro de usuario. Sugerido: sacar "a heading that shows the selected control" y confiar en el filtro visible. |
| Unmapped evidence page | Sí | Diseño | F2 | Bien. |
| CSV gate before implementation | Sí | — | Plan §9.5 | Bien. |
| Story documentation in stories/<story id>/ | Parcial | No respaldado | S2, S3 | Los docs de P01 y P02 viven en stories/MapMigGon37539/, no en una carpeta propia. Sugerido: "in stories/MapMigGon37539/". |

### Data & Integration Requirements

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Reads only, never writes | Sí | — | — | Bien. |
| Mapping key = source type values | Sí | Plan | Plan §9 | Bien. |
| Data flow | Sí | Diseño | D1 | Bien. |
| Approvals: run_id = approval record id | Sí | Plan | Plan §9.3 | Bien. |
| Mapped controls column; selected control in heading | Parcial | No verificado | F2 | Mismo problema del encabezado. |
| Mapping provisional column | Sí | Diseño | F2 | Bien. |
| Provisional mapping from SOC 2 TSC until Max or Scrut confirm | Sí | Plan | F2 · Plan §4 | Bien. |
| CSV in UTF-8, header row, ISO 8601 UTC | Parcial | No verificado | — | La descarga de Airtable usa el formato de cada campo de fecha; ISO 8601 en UTC requiere configurar los campos (formato ISO, zona GMT). Agregarlo al texto o bajar la exigencia. |
| Scrut API out of scope | Sí | — | Plan §3 (story D) | Bien. |

### Edge Cases & Error Handling

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Source type without a mapping | Sí | — | F2 | Bien. |
| Control deactivated | Sí | — | F2 | Bien. |
| Optional field blank | Sí | — | — | Bien. |

### Security & Performance

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Only designated editors change controls and mappings | Parcial | No verificado | S2 | Igual que en P01: depende de los permisos por tabla del plan de Airtable. El acceso de solo lectura por interfaz sí existe. |
| Documentation of access, no credentials | Sí | — | S2, S3 | Bien. |
| Only export columns exposed | Sí | — | S1, S4 | Bien. |
| Native Airtable, no load on automations | Sí | — | S5 | Bien. |

### Client-friendly acceptance criteria

| Ítem | Definido | Factual | Spec | Observación |
|---|---|---|---|---|
| Browse, download, unmapped, change assignments | Sí | — | F2 | Bien. |
| Two new tables | Sí | Diseño | — | Hallazgo 8. |
| CSV columns | Sí | — | F2 | "finish time" para aprobaciones es solo fecha (hallazgo 9). |
| "no personal content" | Parcial | — | S1 | El CSV incluye actor (nombres). Sugerido: "only ids, statuses, times and who acted; no message or document content". |
| Rest | Sí | — | — | Bien. |

## Decisiones necesarias antes de corregir los textos

1. P01: activity_runs (productores escriben) o adaptadores sobre ingestion_runs, priority_events y ticket_candidates (plan original). Cambia la mitad de los criterios de la P01 y la descripción de IA.
2. AI output state: agregar not_applicable o limitar el campo a fuentes con IA.
3. Lista cerrada de automatizaciones que califican.
4. Revisión de tickets: qué evento se captura (approve y discard) y quién lo registra mientras 38533 no esté desplegada.
5. soc2_capture_runs por corrida o por fila.
6. soc2_evidence_rules y soc2_control_mappings: una tabla o dos.
7. Hora de aprobación: approval_date (solo fecha) o last_modified.
