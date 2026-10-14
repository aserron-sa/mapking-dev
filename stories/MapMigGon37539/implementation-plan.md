# Map MigGon37539 — Plan para resolver la story

| | |
|---|---|
| Story | Map MigGon37539 · SOC 2 evidence capture (Scrut-aligned) · Map King Discovery & Foundation / Max Hanratty |
| Sprint / Épica | 5 (2026-10-21 → 2026-11-20) · SOC 2 Evidence · Release v1 (2026-11-04) |
| Peso actual en SS | 8 SP (AI sugerido: 7) · QA 1 SP |
| Owner / QA | Andrés Serrón / Gonzalo Lucas Ranieri |
| Versión | 1.1 · 2026-10-13 · entrega adelantada a esta semana (13 al 16 de octubre) · propuesta, pendiente de aprobación (Andrés y PM) |
| Documentos relacionados | `estimation-report.md` (diagnóstico, lectura del AC sobre el stack, criterios F/T/D/E/S, alternativa de base separada) |

---

## 1. Resumen

- La story no tiene nada implementado. Está "In Progress" desde 2026-08-13, bloqueada desde agosto por falta de acceso y requisitos de Scrut.
- Se puede resolver sin Scrut: la actividad de agentes ya queda registrada en Map King Hub, y la evidencia puede quedar **mapeable** a Scrut sin integrarse con su API.
- Ubicación decidida (2026-10-13): tablas nuevas dentro de **Map King Hub**. La base separada queda documentada como alternativa en `estimation-report.md` sección 7.
- El trabajo estimado es de **≈27 h**. Con la tabla de puntos de Singular Stories eso equivale a **13 SP**, no a 8.
- Propuesta: **dividir en tres stories (5 + 5 + 3 SP)** y dejar la integración con la API de Scrut en backlog, sin estimar.

## 2. Análisis del peso

### 2.1 Calibración de Singular Stories

Consultada con la herramienta de estimación de entrega de SS (2026-10-13):

| SP | Días de entrega |
|---|---|
| 1–3 | 1 |
| 5–8 | 2 |
| 11 | 3 |
| 13–16 | 4 (16 es el máximo; más que eso se divide) |

### 2.2 Por qué 8 SP queda corto

| Señal | Qué indica |
|---|---|
| Plan de ≈27 h (3,5 días de un desarrollador) | Cae en el tramo de 13 SP (4 días); 8 SP son 2 días |
| 35 criterios de aceptación | Describen un servicio completo: captura, contrato, idempotencia, reintentos, reproceso, trazabilidad, logging |
| Dependencia externa sin resolver (Scrut, pedido desde 2026-08-25) | Incertidumbre que el puntaje no contempla |
| Sugerencia IA de 7 SP | Hecha sobre el texto de la story, antes de traducir el AC al stack |
| Precedente 38571 | Pesada en 8 SP; su sizing report concluyó ≈13 SP por causas parecidas (AC escrito para un servicio aparte, costo de verificación en Airtable) |

**Conclusión:** el peso correcto es **13 SP** como story única, o **3 stories de 5 + 5 + 3 SP**.

Límite: las horas son estimación del plan, no horas trabajadas. La comparación usa la tabla de SS como calibración, no la velocidad histórica del equipo.

## 3. División propuesta

Cortes verticales: cada story entrega captura de evidencia funcionando de punta a punta, tiene QA propio y deja aislada la dependencia de Scrut.

### Story A — Captura de evidencia de aprobaciones de salidas IA · 5 SP · ≈13 h

Esqueleto completo con la fuente de mayor valor para SOC 2: `approvals`, el control humano sobre todo lo que la IA envía a clientes.

| Paso | Horas |
|---|---|
| Drafts para Max y para SS (los envía Andrés) | 0,5 |
| Spec base: lectura del AC, catálogo de eventos, modelo de datos, clave de idempotencia, errores | 1,5 |
| Esquema en Map King Hub (aditivo, con OK): `soc2_evidence_rules`, `soc2_evidences`, `soc2_capture_runs` + vistas por estado | 2,5 |
| Módulo `soc2-evidence.ts`: contrato del payload, validación, normalización, idempotencia, separación observado / IA. Tests unitarios | 4 |
| Adaptador `approvals` (qué califica, qué se saltea y por qué) | 0,5 |
| Automatización horaria `soc2-capture`: lock por corrida, lotes, confirmación por relectura, log de corrida. Arranca en dry-run | 2 |
| Pruebas en Map King Hub: captura normal, evento repetido, campo faltante, evento que no califica | 1 |
| Evidencia delivery por criterio | 1 |

Criterios: F1, F3–F7, T1–T8, D1–D6, E1, E5, E7, S1–S5 (28 de 35).

### Story B — Cobertura de agentes y automatizaciones + resiliencia · 5 SP · ≈9 h

| Paso | Horas |
|---|---|
| Spec: actualización con las fuentes nuevas | 0,5 |
| Módulo: manejo de salida IA inválida o ausente sin perder la metadata operativa | 1 |
| Adaptadores `loom_sync_runs`, `ingestion_runs`, `priority_events`, `ticket_candidates` (exclusión de datos de prueba) | 3 |
| Reintentos acotados ante 429/5xx, fallo terminal | 1,5 |
| Reproceso de fallidos y terminales sin duplicar | 1 |
| Pruebas: error de escritura simulado, reintentos agotados, reproceso, corridas superpuestas | 1,5 |
| Evidencia delivery | 0,5 |

Criterios: D7, E2, E3, E4, E6, S6, y F1 extendido a todas las fuentes.

### Story C — Paquete listo para Scrut · 3 SP · ≈5 h

| Paso | Horas |
|---|---|
| Mapeo de cada tipo de evidencia a controles o categorías SOC 2 en `soc2_evidence_rules` (provisorio si Max no responde; editable sin código) | 1 |
| Vista y export CSV por control | 0,5 |
| Documentación de acceso y credenciales (S2, S3) | 0,5 |
| Spec: trazabilidad final de los 35 criterios | 1 |
| Pruebas del export | 0,5 |
| QA guide para Gonzalo y evidencia delivery | 1,5 |

Criterios: F2, y documentación de S2 y S3.

### Story D — Integración con la API de Scrut · backlog, sin estimar

Enviar la evidencia a Scrut. Se escribe y se pesa cuando haya acceso a la API y requisitos de evidencia.

### Totales

| Story | SP | Horas | Días SS |
|---|---|---|---|
| A | 5 | 13 | 2 |
| B | 5 | 9 | 2 |
| C | 3 | 5 | 1 |
| **Total** | **13** | **27** | **5** |
| D | — | — | backlog |

## 4. Calendario

| Story | Fechas | Nota |
|---|---|---|
| A | mar 2026-10-13 → mié 2026-10-14 | Prioridad: cumple 28 de los 35 criterios |
| B | jue 2026-10-15 | |
| C | vie 2026-10-16 | Con categorías provisorias si Max no responde sobre Scrut |

Entrega adelantada a esta semana (decisión de Andrés, 2026-10-13). 27 h en 4 días hábiles (≈6,75 h por día). Como story única de 13 SP la tabla de SS da 4 días: entra justo. Repartida en A/B/C la tabla suma 5 días (2 + 2 + 1); B se compacta en un día según las horas del plan.

Riesgos del adelanto:

- La semana se comparte con el cierre de 38571 y 38532 (2026-10-20). A es la prioridad.
- La story es del sprint 5 (arranca 2026-10-21): entregarla ahora implica adelantarla o pasarla al sprint 4. Lo decide el PM.
- Contingencia: si no alcanza, C pasa al lunes 2026-10-19, sin afectar la release v1 (2026-11-04).

## 5. Ventajas de dividir

- A sola ya cumple el núcleo: evidencia real de aprobaciones de IA y 28 de los 35 criterios.
- Solo C depende de Max. A y B salen igual; C sale con categorías provisorias si Scrut no responde.
- Cada story tiene su evidencia y su QA, en vez de una entrega única al final.
- El bloqueo de la API de Scrut deja de frenar la story: queda en D.

## 6. Dependencias y decisiones

### Para el PM

1. **Aplicar el nuevo peso y la división en SS.** Andrés no puede editar los SP de esta story ni administrarla (`canEditTalentSp` y `canManage` en falso). Opciones: dividir en A/B/C (+ D en backlog), o dejarla como story única de 13 SP.
2. **Adelantar la entrega a esta semana** (sprint 4 o adelanto del sprint 5) y **corregir el due date** al 2026-10-16 (hoy 2026-08-14).

### Para Max (texto a preparar; lo envía Andrés)

3. **Scrut:** acceso a la API y requisitos de evidencia, o al menos la lista de controles SOC 2 que Scrut marca como pendientes. Acordar por escrito el alcance v1 "mapeable sin integración".
4. **Actividades que califican en v1:** aprobaciones, corridas de Loom, corridas de ingesta, eventos de automatizaciones, revisiones de tickets.
5. **Datos personales:** guardar ids, estados, fechas y quién aprobó; nunca el texto de los borradores ni emails de clientes.

### Para Andrés

6. **Carpeta en el repo:** `airtable/soc2/` con prefijo `soc2-` (cambio al layout acordado, que hoy solo define `airtable/cct/`).
7. **Hash de integridad** (detectar evidencia editada después de capturada): opcional, +1,5 h, no incluido.

Resuelto: ubicación en Map King Hub (2026-10-13).

## 7. Justificación ante auditoría de estimaciones

El cambio de 8 a 13 SP se apoya en datos verificables, no en criterio personal:

- la tabla de SP → días de Singular Stories (sección 2.1);
- las horas por paso de este plan (sección 3);
- los 35 criterios de aceptación de la story;
- el precedente de 38571.

La división no agrega alcance: suma las mismas ≈27 h del `estimation-report.md`, repartidas en tres entregas.

## 8. Estado

Pendiente: OK de Andrés al plan, decisión del PM sobre peso y división (1–2), respuesta de Max (3–5).

## 9. Requisitos derivados de las partes en SS (P01 y P02)

Desde el 14 de octubre la story se reparte en dos sub-stories en Singular Stories: **MapKMigGon39261 (P01, cobertura de fuentes, 4 SP)** y **MapKMigGon39264 (P02, paquete listo para Scrut, 3 SP)**. Ambas dependen de esta story. Los requisitos siguientes salen de sus criterios y deben cumplirse aquí.

1. **evidence.source_type es un link**, no texto, a una tabla de tipos de fuente con una fila por tipo: approval, loom, ingestion, automation, ticket_review. El módulo de evidencia la llena una vez, al crear el registro. P02 convierte esa tabla en soc2_control_mappings (agrega controles, marca provisional y notas), por eso se crea aquí con ese nombre.
2. **evidence.confirmed** (checkbox), que el módulo de evidencia marca después de releer y confirmar la escritura. Las páginas y exportaciones de P02 solo muestran registros confirmados. Un registro sin confirmar queda para reprocesar y nunca se muestra como evidencia.
3. **Las aprobaciones usan source_type "approval" y run_id = id del registro de aprobación**, de modo que la clave de idempotencia (source_type + run_id) y la trazabilidad funcionan igual para todas las fuentes.
4. **Campos de evidencia que usa la exportación de P02:** run_id, referencia de origen, finished_at (hora de aprobación en el caso de aprobaciones), estado de la corrida, trigger, counts, actor y ai_output_state (present, missing, malformed).
5. **Antes de empezar P02:** verificar en Map King Hub que una lista de interfaz con filtro por usuario sobre un campo lookup se puede descargar como CSV con el filtro aplicado. Es compuerta de entrada de P02.

Nota de división: la sección 3 describe la división en A/B/C/D que se usó para estimar. En Singular Stories la división vigente es 37539 (base) + P01 + P02; la cobertura de agentes y automatizaciones de la sección 3 (story B) corresponde a P01.

## Fuentes

- Singular Stories: detalle de Map MigGon37539; herramienta de estimación de entrega (tabla SP → días, consultada 2026-10-13).
- `stories/MapMigGon37539/estimation-report.md` v1.1.
- `Claude outputs/MapKMigGon38571-sizing-report.md`.
- Slack: #map-king_interno (2026-08-18, 2026-08-25), #map-king-development (2026-09-03).
