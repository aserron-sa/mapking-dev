# Map MigGon37539 — Diagnóstico y estimación

| | |
|---|---|
| Story | Map MigGon37539 · Map King Discovery & Foundation / Max Hanratty |
| Historia | As a Backend Engineer, I want to implement automatic SOC 2 evidence capture within Scrut-aligned backend workflows, so that agent activity produces consistent, audit-ready records with minimal manual follow-up. |
| Historia (negocio) | As a Client, I want SOC 2 evidence to be collected automatically during agent operations, so that the business has reliable audit support without running a separate documentation effort. |
| Estado SS | In Progress desde 2026-08-13 · etapa sin asignar |
| Sprint | 5 (2026-10-21 → **2026-11-20**) · Release v1 (2026-11-04) |
| Épica | SOC 2 Evidence (única story de la épica) |
| Story points | 8 (AI sugerido: 7) · impacto medio · QA 1 SP |
| Owner | Andrés Serrón (reemplaza a Carlos Olivares) |
| QA | Gonzalo Lucas Ranieri |
| Due date SS | 2026-08-14 (**desactualizada**) |
| Actividad SS | Sin comentarios, sign-offs, links ni evidencia |
| Versión | 1.1 · 2026-10-13 · evidencia en Map King Hub (decidido); base separada documentada como alternativa (sección 7). Solo lectura, sin cambios en sistemas |

Nota: la clave de negocio es "Map MigGon37539" (formato viejo, distinto de "MapKMigGon…"). La carpeta usa `MapMigGon37539`, sin espacio.

---

## 1. Stack y lectura del AC

| Capa | Qué es en Map King |
|---|---|
| "Backend" | Airtable (base **Map King Hub**, `appcdpGNTo0DouoqJ`: tablas, automatizaciones con scripts) + agentes Hyperagent |
| "Agent activity" | Lo que los agentes y automatizaciones ya registran en Map King Hub (ver sección 2) |
| "Evidence store" | Una tabla nueva en Map King Hub. El AC ya contempla Airtable como store |
| Scrut | Plataforma de compliance de Max. **Sin acceso ni documentación** (ver sección 4) |
| Código | Repo `aserron-sa/mapking-dev` (módulo TS + script de automatización + tests) |

### Cómo se traduce el AC

| AC (letra original) | Lectura sobre el stack |
|---|---|
| Servicio de captura disparado por actividad de agentes, con límites claros entre ejecución, transformación y persistencia | **Automatización programada de Airtable** (script) que lee los logs de actividad existentes y genera evidencia. Modelo *pull*: no toca los prompts de los agentes ni los frena (cumple S5). Separación en módulos: adaptadores por fuente → normalización → persistencia |
| Contrato interno estable para que los agentes envíen evidencia | Módulo `soc2-evidence.ts` con el contrato del payload + esquema documentado de la tabla. Un agente que quiera escribir evidencia directa usa el mismo contrato (fuera de alcance v1) |
| Formato mapeable a Scrut | Cada evidencia lleva `control_ref` (control o categoría) tomado de una tabla de reglas editable. Export CSV por control desde una vista. **Sin push a la API de Scrut** (bloqueado) |
| Idempotencia determinista | Clave `idempotency_key` = fuente + id de registro + tipo de evento + versión del estado. Airtable no tiene unique: el script consulta antes de escribir y reporta duplicados (mismo patrón que el guard de 38532) |
| Marcar "disponible para auditoría" solo si se confirmó la persistencia | `capture_status` pasa a `persisted` recién después de releer el registro escrito |
| Log de éxito / fallo / salteado | Tabla de corridas `soc2_capture_runs` con conteos y motivos; un registro por corrida, no por evento |
| Retries acotados, fallo terminal, reproceso | Reintento dentro de la corrida para 429/5xx con tope; los fallidos se reintentan en corridas siguientes hasta N; después `failed_terminal`, reprocesable a mano cambiando el estado |
| Contenido IA separado del observado | Campos `observed_metadata` vs `ai_content_ref`. De los textos IA (`draft_content_ai`) se guarda solo que existió y su referencia, no el texto (S1) |
| "Claude normaliza…", "Hyperagent orquesta…" (descripción IA) | No hace falta IA para normalizar: la transformación es determinista y testeable. Hyperagent no participa en v1 |
| Credenciales fuera del código y de los logs | El script corre dentro de Airtable, sin credenciales. Cumplido por plataforma |
| Performance | Volumen bajo (decenas de eventos por día). Lotes de 50 y presupuesto de tiempo por corrida, como `cct-triage-compute` |

## 2. Hallazgo principal

**No hay nada implementado.** La story está "In Progress" desde agosto sin un solo artefacto: no hay tabla de evidencia en Map King Hub, ni código en el repo, ni docs en el project o en Drive.

La causa está en Slack: el 2026-08-18 se la marcó como **"totalmente bloqueada"** (Miguel Pérez, #map-king_interno) por falta de **acceso a la API de Scrut y de la documentación de requisitos de evidencia**. Carlos se lo pidió a Max el 2026-08-25 y de nuevo el 2026-09-03 (#map-king-development). No hay respuesta registrada después.

La buena noticia: la "actividad de agentes" ya deja rastro en Map King Hub, así que hay de dónde capturar sin tocar a los agentes.

| Fuente | Qué registra | Volumen hoy | Valor para SOC 2 |
|---|---|---|---|
| `approvals` | Aprobación humana de toda salida IA dirigida a clientes (propuestas, follow-ups, facturas) | 24 | Alto: control humano sobre salidas de IA |
| `loom_sync_runs` | Cada corrida de Loom: estado, disparador, conteos, fallos | 6 | Alto: integridad de procesamiento, monitoreo |
| `ingestion_runs` | Corridas del Ingestion Agent con validación (válidos / inválidos) | 2 | Medio |
| `priority_events` | Eventos de automatizaciones: `triage_compute`, errores de validación, guards | 67 | Medio: monitoreo y manejo de errores |
| `ticket_candidates` | Revisión humana de hallazgos de Argus antes de ir a Linear | — | Medio: revisión de cambios |
| `cct_triage_configs` | Cambios de configuración de reglas | 1 activa | Bajo/medio: gestión de cambios |

Hay 10 agentes en Hyperagent (Loom, Marrowback, Proposal Drafter, Follow-Up, Pipeline, Argus, Ticketing, Ingestion, Cinderback, Bodyguard). Los que escriben en Map King Hub ya quedan cubiertos por las tablas de arriba.

## 3. Criterios → estado actual

IDs para la trazabilidad: F funcional, T técnico, D datos e integración, E bordes y errores, S seguridad y performance.

| Criterio | Estado | Evidencia |
|---|---|---|
| F1 Captura automática sin paso manual | No implementado | Sin tabla ni automatización |
| F2 Formato mapeable a Scrut | No implementado · **bloqueado parcial** | Sin requisitos de Scrut. Se puede dejar mapeable con `control_ref` configurable |
| F3 Registro con metadata al completar la operación | No implementado | — |
| F4 Marcar disponible tras persistir | No implementado | — |
| F5 Sin duplicados (idempotencia determinista) | No implementado | — |
| F6 Trazabilidad hasta la actividad de origen | No implementado | Las fuentes tienen id de registro y timestamps; falta el vínculo |
| F7 Log de éxito / fallo / salteado | No implementado | — |
| T1 Workflow con límites claros | No implementado | — |
| T2 Validar campos requeridos | No implementado | — |
| T3 Payload normalizado sin detalles transitorios | No implementado | — |
| T4 Solo contexto relevante de salidas IA | No implementado | — |
| T5 Mapeo de campos y validación antes de escribir en Airtable | No implementado | — |
| T6 Manejo explícito de respuestas de Airtable | No implementado | — |
| T7 Logs estructurados | No implementado | — |
| T8 Contrato interno estable | No implementado | — |
| D1 Flujo actividad → evaluar → normalizar → persistir → registrar | No implementado | — |
| D2 Campos mínimos del payload | No implementado | — |
| D3 Mapeo fuente → evidencia definido y aplicado | No implementado | — |
| D4 Distinguir observado vs IA | No implementado | — |
| D5 Validación y confirmación en el límite con Airtable | No implementado | — |
| D6 Nunca "evidenciado" sin persistencia confirmada | No implementado | — |
| D7 Reproceso sin duplicados | No implementado | — |
| E1 Faltan campos → rechazar y loguear | No implementado | — |
| E2 Airtable rechaza el registro → capturar el motivo | No implementado | — |
| E3 Dependencia caída → reintentar | No implementado | — |
| E4 Reintentos agotados → fallo terminal reprocesable | No implementado | — |
| E5 Evento repetido → sin duplicado | No implementado | — |
| E6 Salida IA inválida → conservar la metadata operativa | No implementado | — |
| E7 Evento que no califica → salteado con motivo | No implementado | — |
| S1 Solo datos necesarios | No implementado | — |
| S2 Autorización según prácticas existentes | Cumplido (plataforma) | Permisos de la base Map King Hub. Falta documentar |
| S3 Credenciales fuera del código y logs | Cumplido (plataforma) | El script corre dentro de Airtable, sin credenciales. Falta documentar |
| S4 Logs sin contenido sensible | No implementado | — |
| S5 No bloquear el procesamiento de agentes | Cumplido por diseño (pull) | A verificar en pruebas |
| S6 Reintentos acotados | No implementado | — |

Resumen: 35 criterios. 0 cumplidos por implementación, 2 cumplidos por plataforma, 1 por diseño, 32 por hacer (1 bloqueado parcial).

## 4. Dependencias y decisiones

### Para Max (texto a preparar; lo envía Andrés)

1. **Scrut: acceso y requisitos de evidencia.** Pendiente desde 2026-08-25. Propuesta para destrabar: entregar v1 **mapeable sin integración** (evidencia en Map King Hub + export CSV por control) y dejar el push a la API de Scrut para una story posterior. Pedir al menos la lista de controles SOC 2 que Scrut le marca como "evidencia pendiente".
2. **Qué actividades califican en v1.** Propuesta: aprobaciones de salidas IA (`approvals`), corridas de Loom (`loom_sync_runs`), corridas de ingesta (`ingestion_runs`), errores y corridas de automatizaciones (`priority_events`), revisiones de tickets (`ticket_candidates`). Todo configurable en la tabla de reglas.
3. **Datos personales en la evidencia.** Propuesta: guardar ids, estados, fechas y quién aprobó; nunca el texto del borrador ni emails de clientes. El link al registro de origen da el detalle a quien tenga permiso.

Si Max no responde, se arranca con estas propuestas y una categoría provisoria por fuente (`control_ref` editable sin tocar código).

### Para Andrés / PM

4. **Carpeta y prefijo en el repo.** El layout acordado solo define `airtable/cct/`. Propuesta: `airtable/soc2/` con la misma estructura (`soc2-evidence.ts`, `automations/soc2-capture.ts`, `tests/`) y build por la misma herramienta. Es un cambio de layout: necesita tu OK.
5. **Nombres de tablas** (plural, una por dominio, un solo writer): `soc2_evidences`, `soc2_capture_runs`, `soc2_evidence_rules`. **Ubicación decidida (2026-10-13): dentro de Map King Hub.** La alternativa de una base separada queda documentada en la sección 7.
6. **Estado en SS.** Lleva "In Progress" desde agosto con due date 2026-08-14. Decidir si se corrige la fecha o se deja comentario explicando el bloqueo de Scrut (los dos como draft en `ss-drafts.md`).
7. **Prioridad frente a 38571 y 38532**, que cierran el 2026-10-20. Esta story es del sprint 5. **Actualizado 2026-10-13:** la entrega se adelanta a esta semana (13 al 16 de octubre); ver `implementation-plan.md` sección 4.

## 5. Riesgos para el cierre del sprint

- **Scrut.** Sin requisitos, "Scrut-aligned" puede leerse como no cumplido en QA o por Max. Mitigación: acordar por escrito el alcance "mapeable sin integración" antes de construir, y dejar el mapeo como configuración.
- **Expectativas viejas.** El MAP original (2026-07-21) hablaba de una "tabla de evidencia SOC 2 para Scrut". Conviene confirmar que esa es la expectativa y no un control-by-control completo.
- **Sin unique en Airtable.** La idempotencia depende de leer antes de escribir; dos corridas superpuestas podrían duplicar. Mitigación: lock por corrida en `soc2_capture_runs` (patrón de `loom_sync_runs`) + reporte de duplicados.
- **Límites del script de automatización** (tiempo de ejecución, tamaño de lote). Volumen bajo hoy; presupuesto de tiempo y cursor por fuente.
- **Datos de prueba** en las fuentes (filas "TEST"). Regla de exclusión en la tabla de reglas.
- Los scripts se pegan a mano en Airtable (la API no edita el paso "Run a script").

## 6. Plan (Airtable + repo)

| # | Paso | Estimación |
|---|---|---|
| 1 | Preparar el texto de decisiones 1–3 para Max (Andrés lo envía) y los drafts de SS (estado, comentario) | 0,5 h |
| 2 | Spec `stories/MapMigGon37539/spec.md` (+ copia en el project): lectura del AC, catálogo de eventos que califican, modelo de datos, clave de idempotencia, manejo de errores, trazabilidad, plan de pruebas | 3 h |
| 3 | Esquema en Map King Hub (aditivo, con tu OK): `soc2_evidence_rules`, `soc2_evidences`, `soc2_capture_runs` + vistas por control y por estado | 2,5 h |
| 4 | Módulo `soc2-evidence.ts`: contrato del payload, validación, normalización, clave de idempotencia, separación observado / IA. Tests unitarios | 5 h |
| 5 | Adaptadores por fuente (`approvals`, `loom_sync_runs`, `ingestion_runs`, `priority_events`, `ticket_candidates`) con cursor por fuente y regla "califica / se saltea con motivo". Tests | 4 h |
| 6 | Script `soc2-capture` (automatización horaria): lock, lotes, reintentos acotados, confirmación por relectura, fallo terminal, registro de corrida. Arranca en dry-run | 4 h |
| 7 | Reproceso: fallidos y terminales vuelven a la cola sin duplicar; export CSV por control para Scrut | 1,5 h |
| 8 | Pruebas en Map King Hub: captura normal, evento repetido, campo faltante, evento que no califica, error de escritura simulado, reproceso, corridas superpuestas | 4 h |
| 9 | Evidencia delivery por criterio, trazabilidad en el spec, QA guide para Gonzalo, drafts de SS | 2,5 h |
| | **Total** | **≈27 h (3,5 días)** |

Entrega adelantada a esta semana (2026-10-13 → 2026-10-16), compartida con el cierre de 38571 y 38532; detalle y contingencia en `implementation-plan.md` sección 4. Si Scrut entrega requisitos durante el sprint, el ajuste es en la tabla de reglas, no en el código.

## 7. Alternativa evaluada: base separada para SOC 2

**Decisión (2026-10-13, Andrés):** la evidencia vive en Map King Hub. Esta sección deja documentada la opción de una base aparte ("Map King SOC 2 Evidence", en el workspace Map King) por si más adelante la pide un auditor, Scrut o el crecimiento del volumen.

### Comparación

| Criterio | Tablas en Map King Hub (elegida) | Base separada |
|---|---|---|
| Integridad | Cualquier editor del Hub puede modificar o borrar evidencia | Solo el script escribe. Límite: los colaboradores del workspace heredan acceso a todas sus bases y su permiso no se puede bajar por base (a confirmar en el plan de Airtable), así que no garantiza por sí sola que nadie edite |
| Mínimo privilegio | Dar acceso a un auditor expone clientes, deals y facturas | Se invita al auditor solo a esa base |
| Cupo de registros | La evidencia (append-only) consume el cupo del Hub | Cupo y retención propios |
| Cambios de esquema | Un cambio en el Hub puede afectar la evidencia | Aislada; solo depende de las vistas que lee |
| Trazabilidad | Link directo al registro de origen | Sin links entre bases: base + tabla + id + URL del origen |
| Complejidad | Menor | Sincronización entre bases (ver abajo) |

### Cómo se implementaría

- **Entrada (Hub → base de evidencia):** una vista por fuente en el Hub, con solo los campos necesarios, sincronizada en solo lectura hacia la base de evidencia. El script de captura corre en esa base y lee las copias locales. Sin credenciales y sin posibilidad de escribir en el Hub. Requiere:
  - que el plan de Airtable permita tablas sincronizadas entre bases (no verificado);
  - crear las sincronizaciones a mano en la UI (la API no las crea);
  - exponer el id original con `RECORD_ID()` en las fuentes que no lo tienen (`priority_events`, `loom_sync_runs`, `ingestion_runs`).
- **Plan B de entrada:** el script lee el Hub por la API REST con un token de solo lectura guardado en los secretos de Airtable (la cuenta ya usa secretos). Suma paginación, límite de ~5 req/s y reintentos.
- **Salida (consumo desde las interfaces del Hub):** las interfaces y los componentes custom solo ven tablas de su propia base. Para mostrar la evidencia en el Hub se sincroniza `soc2_evidences` (o una vista filtrada: últimos 30 días, fallos y pendientes) de vuelta al Hub, en solo lectura. No genera bucle porque el script no la usa como fuente. Para un auditor, interface propia en la base de evidencia. Un componente custom no debe leer la otra base por API (expondría el token en el navegador).

### Costo adicional estimado

| Pieza | Horas |
|---|---|
| Base, vistas fuente, sincronizaciones, campos `RECORD_ID()`, pruebas de sincronización | +3 h |
| Plan B por API en lugar de sincronización | +6 h (en lugar de las 3) |
| Sincronizar la evidencia de vuelta al Hub + página en la interface | +1,5 h |
| Interface propia para auditor | +1 h |

### Migración futura

El diseño elegido no la complica: el módulo `soc2-evidence.ts` y el script no dependen de la base, los nombres de tablas y campos salen de la configuración, y cada evidencia guarda la referencia al origen como texto (base, tabla, id, URL) además del link. Mover la evidencia a otra base sería: crear la base, copiar las tres tablas, cambiar la entrada a tablas sincronizadas y volver a pegar el script.

### Mitigación aplicable en cualquiera de las dos opciones (no incluida en el plan)

Evidencia con detección de alteraciones: el script guarda un hash de cada registro al capturarlo y una verificación periódica marca los registros editados después. Costo estimado: +1,5 h. A decidir.

## 8. Estado de aprobación

Pendiente: OK al plan y a las decisiones 4, 6 y 7. Decisión 5 (ubicación) resuelta: Map King Hub.

## Fuentes consultadas

- Singular Stories: detalle y actividad de Map MigGon37539; búsqueda en la épica SOC 2 Evidence (única story).
- Airtable · Map King Hub: esquema de las 22 tablas, automatizaciones, muestras de `approvals`, `loom_sync_runs`, `ingestion_runs`, `priority_events`.
- Hyperagent: lista de agentes.
- Slack: #map-king_interno (2026-08-18, 2026-08-25), #map-king-development (2026-09-03), #map-king_agile (2026-08-20, 2026-08-24, 2026-08-25), #ai-playground (2026-07-21).
- Google Drive: sin resultados para "Scrut" o "SOC 2".
- Repo `aserron-sa/mapking-dev`: sin referencias a 37539, SOC 2 o Scrut.
- Project: `claude/working-agreement.md`, `docs/temp/SINGULAR_STORY_BEGIN.md`.
