# MapKMigGon38571 — Plan de implementación (v2)

| | |
|---|---|
| Story | MapKMigGon38571 · Triage lanes por domain, owner y source |
| Sprint | 4 · cierra **2026-10-20** · QA: Gonzalo Lucas Ranieri |
| Versión | 2.2 · 2026-10-12 · salida de la triage en tabla propia `command_center_triages` · reemplaza la sección 6 de `estimation-report.md` (v1.1) |
| Estado | **Aprobado por Andrés el 2026-10-12 · en ejecución** (ver sección 10, Avance) |
| Workflow | Claude edita en `E:\projects\singular\mapking.ai`; Andrés commitea y pushea. **Escrituras en SS y comunicación con Max/equipo: solo Andrés o bajo pedido explícito.** Backups en Drive `Map King (Map.ai)/stories/MapKMigGon38571/` |
| Documentos | `spec.md` y `schema.md` (**fuente de verdad** de reglas, contrato y campos) · `acceptance-criteria-stack.md` (AC sobre el stack, IDs F/T/D/E/S) · `estimation-report.md` (diagnóstico inicial) |

---

## 0. Resumen

### Qué pide la story

Max tiene tareas en Linear, Attio, Google Calendar y varias tablas de Airtable. Loom ya las junta en `command_center_tasks` (unas 150 abiertas), pero eso es solo una lista larga. La story pide ayudarlo a **decidir qué hacer con cada tarea** desde una sola pantalla:

- **Lanes:** On Fire (lo urgente, máximo 3), This Week, Waiting On, Queued, Icebox.
- **Filtros** por domain, owner y source, combinables.
- **Stale:** marcar lo que lleva tiempo sin moverse o está vencido, con el motivo.
- **Delegación:** marcar lo que Max podría pasarle a alguien del equipo, y a quién.
- **Honestidad de datos:** distinguir dato de la fuente, inferencia de IA y decisión de Max; avisar si una fuente falló; no inventar ni duplicar.

### Cómo se implementa

Tres piezas sobre lo que ya existe, sin IA nueva, sin tocar Loom ni las fuentes y con cambios de esquema solo aditivos:

1. **Reglas configurables + script horario.** `cct_triage_configs` (umbrales) y `team_members` (equipo, alias, dominios). `cct-triage-compute.ts` aplica las reglas cada hora y escribe en cada tarea: stale, delegable, owner unificado, lane sugerida y posibles duplicados. Cambiar un umbral es editar una celda.
2. **Lane manual o por regla.** Si Max movió la tarea, manda su decisión (`task_lanes`, como hoy). Si no, se usa `lane_suggested`, marcada "rule". Cada tarea siempre tiene lane, sin tocar lo de 38570.
3. **Work · Queue.** Partimos de la página de Carlos y sumamos: tabs con manual/rule, badge de stale con motivo, "Delegate to X?", marca de valores de IA, aviso de resultado parcial y aviso claro si falta un campo.

## Estado actual por criterio (2026-10-12)

De los 41 criterios de `acceptance-criteria-stack.md`: **8 hechos**, **3 no aplican**, **10 parciales**, **19 por hacer** y **1 sin verificar**.

| Estado | Criterios |
|---|---|
| Hecho | F2, T1 (Loom), T4, T8 (Loom), D4 (Loom), S3, S4, S6 |
| No aplica (sin IA nueva) | D5, E4, S2 |
| Parcial | F1, F3, F4, F7, F10, T7, D1, D2, D8, S1 |
| Por hacer | F5, F6, F8, F9, T2, T3, T5, T6, T9, D3, D6, D7, E1, E2, E3, E5, E6, E7, S5 |
| Sin verificar | E8 (estado vacío en la UI de Carlos; el código no está en el repo) |

---

## 1. Qué cambió desde v1.1

| Tema | v1.1 | v2 | Por qué |
|---|---|---|---|
| Reglas configurables | Fórmulas de Airtable leyendo `cct_triage_configs` | **Script de automatización horario** (`cct-triage-compute.ts`) que lee la config y escribe los resultados | Una fórmula de Airtable no puede leer otra tabla sin un link por fila. El patrón ya existe y funciona en 38570 (`needs-you-waiting-since.js`, horario) |
| Dónde vive la salida | Campos nuevos en `command_center_tasks` | **Tabla `command_center_triages`, una fila por tarea (1:1)** | `command_center_tasks` ya tiene ~35 campos de tres dueños. Un escritor por tabla. Decidido 2026-10-12 |
| Lane por defecto | Crear filas en `task_lanes` por regla | **`lane_suggested` en `command_center_triages`**; `task_lanes` queda solo para decisiones manuales | No crear cientos de filas por usuario ni disparar las automatizaciones de integridad de 38570. Lane efectiva = manual si existe, si no la sugerida |
| `lane_basis` | Campo nuevo en `task_lanes` | Derivado en el contrato: hay fila manual → `manual`, si no → `rule` | Cero cambios en `task_lanes` |
| Owner canónico y roster | Mapa en `cct_triage_configs` | Tabla **`team_members`** (nombre canónico, alias, email, es CEO, recibe delegaciones) | Sirve a la vez para normalizar owners y para sugerir "Delegate to X" |
| Lógica de reglas | Repartida entre fórmulas y UI | **Módulo puro** `cct-triage-rules.ts` con tests, inlineado en el script de automatización y reutilizado por el contrato de la extensión | Determinismo testeable (AC: "deterministic stale detection") |
| Estimación | 29,5 h | **26 h** | Menos superficie: sin cambios en `task_lanes`, reglas en un solo lugar |

Lo que **no** cambia: el stack (Airtable + Hyperagent), Loom no se toca, sin IA nueva, todos los cambios de esquema son aditivos.

## 2. Arquitectura

```
Loom (diario 07:47 + Slack) ──> command_center_tasks  (campos de Loom, intactos)
                                       │
cct_triage_configs + team_members ──┐       │
                               ▼       ▼
              cct-triage-compute.ts (automatización, cada hora)
                 · usa cct-triage-rules.ts (puro, testeado)
                 · escribe SOLO en command_center_triages (1:1 por tarea)
                 · log a priority_events
                                       │
                                       ▼
Work · Queue (extensión) ── cct-triage-contract.ts ── lee tasks + task_lanes (del usuario)
     · lane efectiva + basis (manual / rule)          + loom_sync_runs (completitud)
     · filtros validados domain / owner / source
     · stale, delegate, procedencia (source / AI / override)
     · banner completo / parcial · estado vacío
     · escribe solo task_lanes (decisiones) + priority_events
```

Dueños de cada escritura (nadie pisa a otro):

| Escribe | En | Campos |
|---|---|---|
| Loom | `command_center_tasks` | los suyos (sin cambios) |
| `cct-triage-compute.ts` | `command_center_triages` | todos sus campos (crea, actualiza, marca cerradas y huérfanas; nunca borra) |
| Work · Queue / Today | `task_lanes` | lane manual, overrides, `delegated_to`, acciones |
| Todos | `priority_events` | eventos |

## 3. Modelo de datos (todo aditivo)

Resumen. El detalle definitivo (tipos, defaults, IDs) está en `schema.md`.

### Tabla nueva `cct_triage_configs` (una fila activa)

| Campo | Tipo | Default propuesto |
|---|---|---|
| `active` | checkbox | ✔ |
| `stale_inactive_days` | número | 7 |
| `stale_overdue_days` | número | 2 |
| `this_week_horizon_days` | número | 7 |
| `icebox_inactive_days` | número | 30 |
| `waiting_on_tags` | texto | `waiting-on-external` |
| `delegate_exclude_tags` | texto | `needs-max` |
| `delegate_require_schedulable` | checkbox | ✔ |
| `notes` | texto largo | qué decidió Max y cuándo |

### Tabla nueva `team_members`

| Campo | Tipo | Uso |
|---|---|---|
| `name` | texto (primario) | nombre canónico |
| `aliases` | texto largo | variantes vistas en las fuentes (una por línea; ej. "SERGIO GONGORA") |
| `email` | email | match por email |
| `is_ceo` | checkbox | identifica a Max para la regla de delegación |
| `receives_delegation` | checkbox | candidato para "Delegate to…" |
| `domains` | multiple select | Sales / Delivery / Product / QA / Revenue / Ops → a quién sugerir por dominio |

### Tabla nueva `command_center_triages` (1:1 con `command_center_tasks`, escrita solo por `cct-triage-compute.ts`)

`command_center_tasks` recibe solo el link inverso `triage`. Además de los campos de abajo: `normalized_task_id` (primario), `task` (link) y `row_status` (`active` / `closed` / `orphan`).

| Campo | Tipo | Valores |
|---|---|---|
| `owner_canonical` | texto | nombre de `team_members`, o el owner crudo si no hay match, o vacío |
| `owner_match` | single select | `matched` / `unmatched` / `empty` |
| `stale_state` | single select | `stale` / `fresh` / `unknown` |
| `stale_reason` | texto | ej. "9 days without activity (limit 7)" |
| `delegate_eligible` | checkbox | |
| `delegate_reason` | texto | por qué sí / por qué no |
| `delegate_suggested_to` | texto | miembro del roster según dominio, o vacío |
| `lane_suggested` | single select | `this_week` / `waiting_on` / `queued` / `icebox` (nunca `on_fire`) |
| `lane_rule` | texto | qué regla asignó la lane |
| `identity_key` | texto | clave de identidad entre fuentes (ej. `linear:MK-402` para un dev_ticket espejo) |
| `identity_status` | single select | `unique` / `duplicate_candidate` / `ambiguous` |
| `computed_at` | fecha-hora | última corrida que evaluó la fila |

### `priority_events`: tipos nuevos

`triage_compute` (resumen de corrida), `triage_data_issue` (owner sin match, fecha inválida, config faltante), `triage_filter_invalid`, `triage_action` (retag, reassign, delegate desde Work · Queue).

### `task_lanes`

Sin cambios de esquema.

## 4. Reglas (defaults; todas configurables)

Resumen. El detalle definitivo está en `spec.md` §4. El spec agrega el estado `excluded` para fuentes que no aplican a stale (Google Calendar) y el flag `delegate_empty_owner_is_ceo` (D4).

Orden de evaluación de `lane_suggested` (gana la primera que aplica):

1. Tag de `waiting_on_tags` → `waiting_on`
2. `due_date` dentro de `this_week_horizon_days` (o vencida) → `this_week`
3. Sin `due_date` y ≥ `icebox_inactive_days` sin actividad → `icebox`
4. Resto → `queued`

Stale:

- `unknown` si no hay `last_updated_at` válido (no se inventa).
- `stale` si vencida hace ≥ `stale_overdue_days`, o ≥ `stale_inactive_days` sin actividad.
- `fresh` en otro caso.

Delegación (`delegate_eligible`):

- Abierta.
- Owner es el CEO (`is_ceo`) o está vacío.
- Sin tags de `delegate_exclude_tags`.
- `schedulable` = true si `delegate_require_schedulable`.

Sugerencia: el primer miembro con `receives_delegation` cuyo `domains` incluya el dominio de la tarea.

Identidad entre fuentes:

- `dev_tickets` con `linear_issue_id` = la key de una tarea Linear abierta → ambas `duplicate_candidate` con el mismo `identity_key`.
- Una approval y la invoice o follow-up que referencia → `duplicate_candidate`.
- Más de un match → `ambiguous`.
- Nunca se fusiona ni se borra: la UI muestra las filas agrupadas y marcadas.

Fila de Loom con `lifecycle` ≠ open: el script limpia `stale_*`, `delegate_*` y `lane_suggested`.

## 5. Plan de acción

Leyenda de responsable: **C** = Claude, **A** = Andrés (paso manual en Airtable, git o decisión).

| # | Paso | Resp. | Entregable | Est. |
|---|---|---|---|---|
| 0 | Aprobación del plan. Claude prepara los textos (comentario SS, mensaje a Max); Andrés los revisa y publica | C + A | Textos en chat / `ss-drafts.md` | 0,5 h |
| 1 | `spec.md` + `schema.md` de la story (AC sobre el stack, modelo, reglas, errores, trazabilidad, plan de pruebas). Copia en el project y backup en Drive | C | `docs/stories/MapKMigGon38571/spec.md`, `schema.md` | 2,5 h |
| 2 | Esquema en Airtable vía MCP: `cct_triage_configs` (1 fila con defaults), `team_members` (sembrada con los owners vistos, sin `is_ceo` hasta que confirmes quién es Max en las fuentes), tabla `command_center_triages` (15 campos, link 1:1 a `command_center_tasks`), 4 tipos de evento. **Te aviso antes de ejecutar** | C | Esquema + IDs en `schema.md` | 1,5 h |
| 3 | `airtable/cct/cct-triage-rules.ts` (puro) + `airtable/cct/tests/cct-triage-rules.test.ts` (`node --test`): lanes, stale, delegate, owner, identidad, bordes (nulls, fechas inválidas, config faltante) | C | Lib + tests en verde | 4 h |
| 4 | `airtable/cct/automations/cct-triage-compute.ts` (inlinea la lib con `airtable/cct/tools/cct-build.ts`), modo `dryRun`, upsert 1:1 en `command_center_triages` (crear, actualizar, cerradas, huérfanas, control de duplicados), escritura solo de cambios en lotes de 50, log a `priority_events` | C | Script + `dist/` para pegar | 2,5 h |
| 4b | Crear la automatización "command_center_triages · compute · hourly", pegar el script, correr con `dryRun = yes`, revisar conteos, después `no` y encenderla | A (≈20 min) | Automatización activa | 1 h |
| 5 | Recuperar `WorkQueuePage.tsx` de la extensión de Airtable al repo (copiar desde el editor de la extensión) | A (≈15 min) | Archivo en `airtable/cct/interfaces/` | 0,5 h |
| 6 | `airtable/cct/interfaces/cct-triage-contract.ts` (puro): arma la fila de triage, lane efectiva + basis, filtros combinados + validación, procedencia, completitud. Tests con `node --test` | C | Módulo + tests | 3 h |
| 7 | Integración en Work · Queue: tabs por lane efectiva con badge manual/rule, stale + motivo, prompt "Delegate to X?" (escribe `delegated_to` + `triage_action`), marcas de procedencia, banner completo/parcial, estado vacío, aviso de filtro inválido | C | `WorkQueuePage.tsx` actualizado | 5 h |
| 7b | Publicar la extensión y exponer los campos nuevos en el panel Data de la página (fue la causa del bug de "0 tareas" de Carlos) | A (≈20 min) | Extensión publicada | 0,5 h |
| 8 | Pruebas E2E en la interface según el plan del spec. Evidencia "delivery" por criterio preparada en `ss-drafts.md`; Andrés la revisa item por item y la publica | C + A | Evidencias listas para SS | 3,5 h |
| 9 | Cierre: trazabilidad, comentario final y reemplazo del docx viejo preparados en `ss-drafts.md`, backup en Drive. `send-to-qa` solo con OK de Andrés | C | Story lista para QA | 1,5 h |
| | **Total** | | | **≈26 h** (≈3 h tuyas) |

### Calendario propuesto

| Día | Pasos |
|---|---|
| Mar 13 | 0, 1, 2 · vos: 5 (recuperar Work · Queue) |
| Mié 14 | 3, 4 · vos: 4b (automatización en dry-run y live) |
| Jue 15 | 6, 7 |
| Vie 16 | 7 · vos: 7b (publicar) · inicio 8 |
| Lun 19 | 8, 9 |
| Mar 20 | Buffer · `send-to-qa` |

## 6. Plan de pruebas (resumen; el detalle va en el spec)

| # | Prueba | Esperado |
|---|---|---|
| U1 | Unit: reglas de lane, stale, delegate, owner, identidad | Todos en verde, incluidos nulls y fechas inválidas |
| U2 | Unit: contrato (filtros simples, combinados, inválidos, vacío) | Filtrado exacto; inválido → aviso + filtro descartado; vacío → lista vacía sin error |
| A1 | Automatización en dry-run | Conteos coherentes con 146 abiertas; 0 escrituras |
| A2 | Automatización live, dos corridas seguidas | 2ª corrida escribe 0 cambios (idempotente) |
| A3 | Cambiar un umbral en `cct_triage_configs` | La siguiente corrida recalcula stale y lanes según la nueva config |
| E1 | Work · Queue: filtrar por domain + owner + source | Solo tareas que cumplen los tres |
| E2 | Tarea sin fila manual | Aparece en `lane_suggested` con badge "rule" |
| E3 | Mover tarea a otra lane | Badge pasa a "manual"; `task_lanes` creada/actualizada; Today y On Fire siguen consistentes |
| E4 | Tarea stale | Badge + motivo; tarea con `unknown` sin badge falso |
| E5 | Delegate | Prompt solo en elegibles; aceptar escribe `delegated_to` + evento |
| E6 | Fuente `unavailable` o última corrida de Loom `partial` | Banner "resultado parcial" con la fuente afectada |
| E7 | Duplicado entre fuentes | Filas agrupadas y marcadas, ninguna borrada |
| R1 | Regresión 38570 | Top 3 On Fire, Needs-You y Power Hour sin cambios |

## 7. Decisiones abiertas

| # | Decisión | Quién | Si no llega a tiempo |
|---|---|---|---|
| D1 | Umbrales de stale | Max | Defaults de la sección 4 |
| D2 | Reglas de lane por defecto | Max | Defaults de la sección 4 |
| D3 | Regla de delegación + roster (quién recibe qué dominio) | Max | Roster vacío → `delegate_eligible` se calcula pero sin sugerencia de persona |
| D4 | **Cómo aparece Max en las fuentes** (nombre, email; hoy 70 tareas sin owner) | Max / Andrés | Owner vacío cuenta como "de Max" para delegación |
| D5 | Limpiar las 18 filas de prueba de `task_lanes` (Carlos / Andrés) | Andrés | Se dejan; no afectan a Max (son por usuario) |

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Max no responde antes del 14 | Defaults en config; cambiarlos no requiere código |
| `WorkQueuePage.tsx` no se puede recuperar | Reescribir la página sobre el contrato nuevo (+4 h); se decide el 13 |
| Campos nuevos no visibles para la extensión | Paso 7b explícito + chequeo de campos requeridos en la página (como Today) |
| Conflicto con automatizaciones de 38570 | `task_lanes` sin cambios; prueba R1 |
| Pasos manuales en Airtable (pegar scripts, publicar) | Agrupados en 3 bloques cortos (≈1 h total) con instrucciones exactas |

## 9. Trazabilidad AC → paso

| AC | Pasos |
|---|---|
| Lanes On Fire / This Week / Waiting On / Queued / Icebox por tarea | 2, 3, 4, 6, 7 |
| Filtros por domain / owner / source, combinables | 3 (owner canónico), 6, 7 |
| Vista unificada normalizada | Loom (38532) + 6 |
| Stale configurable y determinista | 2, 3, 4 |
| Elegibilidad / prompt de delegación | 2, 3, 4, 7 |
| Separar inferido (IA) de fuente; IA no sobrescribe | 6, 7 (procedencia); Loom ya escribe solo sus campos |
| Validación de filtros; vacío = éxito; errores estructurados | 6, 7 |
| Completo vs parcial | 6, 7 |
| Sin duplicados destructivos entre fuentes | 3, 4, 7 |
| Logging de fallos | 4, 7 (`priority_events`) |
| Acceso y credenciales | Plataforma (documentado en 1) |
| Performance | 4 (lotes, solo cambios), 6 (cálculo en memoria) |

## 10. Avance

| # | Paso | Estado | Fecha | Notas |
|---|---|---|---|---|
| 0 | Aprobación, comentario en SS, mensaje a Max | Hecho | 2026-10-12 | Plan aprobado por Andrés. Comentario en SS publicado por Claude antes de la regla "SS solo con revisión item por item" (Andrés decide si queda). Mensaje a Max: lo maneja Andrés |
| 1 | `spec.md` + `schema.md` | Hecho | 2026-10-12 | Copia del spec en el project (`claude/spec-MapKMigGon38571.md`) y backup en Drive |
| 2 | Esquema en Airtable | Hecho | 2026-10-12 | Aprobado por Andrés. Tablas `cct_triage_configs` (1 fila default), `team_members` (4 filas sembradas), `command_center_triages` (vacía), link inverso `triage` en `command_center_tasks`, 4 tipos de evento. IDs en `schema.md` |
| 3 | Reglas + tests | Hecho | 2026-10-12 | `airtable/cct/cct-triage-rules.ts` + `airtable/cct/tests/cct-triage-rules.test.ts` (13 tests en verde, `node --test`). Convención: TS/TSX, prefijo `cct-`, carpetas `airtable/cct/{automations,interfaces,tests}` |
| 4 | `cct-triage-compute.ts` + build | Hecho (código) | 2026-10-12 | `automations/cct-triage-compute.ts`, `cct-triage-sync.ts` (plan 1:1 puro), `tools/cct-build.ts` → `dist/automations/cct-triage-compute.js`. 27 tests en verde (13 reglas, 10 sync, 4 smoke sobre el JS generado con una base Airtable simulada). Falta: 3 campos heartbeat en `cct_triage_configs` (OK de Andrés) |
| 4b | Automatización en Airtable | Pendiente (Andrés) | | |
| 5 | Recuperar `WorkQueuePage.tsx` | Hecho | 2026-10-12 | Export de Andrés (source_export.zip). Guardado tal cual en `airtable/cct/interfaces/WorkQueuePage.tsx` (+ `extension-template/` con package.json y style.css). Hallazgos: muestra tareas cerradas (no filtra `lifecycle`), oculta tareas de fuentes no `ok`, busca campos por nombre |
| 6 | `cct-triage-contract.ts` + tests | Pendiente | | |
| 7 | UI Work · Queue | Pendiente | | |
| 7b | Publicar extensión | Pendiente (Andrés) | | |
| 8 | Pruebas E2E + evidencia | Pendiente | | |
| 9 | Cierre | Pendiente | | |
