# MapKMigGon38571 — Diagnóstico y estimación

| | |
|---|---|
| Story | MapKMigGon38571 · Map King Discovery & Foundation / Max Hanratty |
| Historia | As a Map King CEO, I want to sort all my tasks into clear priority lanes by domain, owner, and source, so that I can quickly triage work from every source in one place and know what needs attention, what can wait, and what should be delegated. |
| Estado SS | In Progress (desde 2026-10-08) · etapa Back-End |
| Sprint | 4 (2026-09-21 → **2026-10-20**) · Release v1 (2026-10-30) |
| Épica | Front-Office Workflows |
| Story points | 8 (AI sugerido: 5) · impacto alto |
| Owner | Andrés Serrón (reemplaza a Carlos Olivares) |
| QA | Gonzalo Lucas Ranieri |
| Due date SS | 2026-10-09 (**vencida**) |
| Actividad SS | Sin comentarios, sign-offs ni links. 1 evidencia delivery pendiente: docx de Carlos (2026-09-17) |
| Versión | 1.1 · 2026-10-12 · ajustada al stack definido. Solo lectura, sin cambios en sistemas |

---

## 1. Stack y lectura del AC

Las stories están escritas con implementación abierta. Al acotarlas al stack del proyecto, la letra se vuelve más concreta: algunos puntos no aplican y otros quedan definidos.

| Capa | Qué es en Map King |
|---|---|
| "Backend" | Airtable (base **Map King Hub**, `appcdpGNTo0DouoqJ`: tablas, campos calculados, automatizaciones) + agentes Hyperagent |
| Fuentes | Linear, Attio, Google Calendar y tablas de Airtable, leídas por el agente **Loom** hacia `command_center_tasks` |
| Vistas | Interfaces de Airtable (extensiones custom: Today, Work · Queue, CEO Command Center) |
| Código | Repo `aserron-sa/mapking-dev` (extensiones, scripts de automatizaciones, docs) |
| Supabase | Existe, no se usa directamente. Fuera de alcance |

### Cómo se traduce el AC

| AC (letra original) | Lectura sobre el stack |
|---|---|
| Servicio que ingiere fuentes y las mapea a un contrato común | Ya resuelto por Loom → `command_center_tasks` (38532). Esta story **no** reingiere fuentes |
| Contrato estable para pedir resultados filtrados | El contrato es el **esquema de Airtable** (campos documentados de `command_center_tasks` + `task_lanes`) más un módulo de triage dentro de la extensión Work · Queue que arma la fila de triage |
| Filtros por domain / owner / source, combinables | Filtros de la interface Work · Queue sobre campos canónicos (`domain` efectivo, `owner_canonical`, `source`) |
| Rechazar filtros inválidos con error estructurado | Los filtros salen de opciones cerradas (single select / pills), así que no se puede pedir un valor inválido. Queda: validar el estado de filtros en el módulo (descartar valores desconocidos y avisar), y lanes inválidas imposibles por el single select + la automatización de integridad |
| Resultado vacío = éxito | Estado vacío explícito en la interface ("Nothing matches these filters"), no error |
| Stale con reglas configurables y deterministas | Campos calculados en Airtable leyendo una tabla `triage_config`; estado `unknown` si falta actividad |
| Elegibilidad para delegar | Campo calculado `delegate_eligible` + motivo; el prompt "Delegate to…?" en la interface |
| Separar valores inferidos por IA de los de la fuente | Campos IA de Loom (`category`, `tags`, `schedulable`) marcados como inferidos en la interface y en la doc; overrides del CEO en `task_lanes`, nunca en `command_center_tasks` |
| IA no sobrescribe valores de la fuente | Ya garantizado por Loom (escribe solo campos propios). Esta story no agrega IA nueva |
| Indicar resultado completo o parcial | Banner en la interface según `source_status` de las filas y la última corrida en `loom_sync_runs` |
| Sin duplicados entre fuentes | Regla de identidad documentada (ej. `dev_tickets.linear_issue_id` ↔ `linear:<KEY>`); si hay ambigüedad, se muestran ambas filas marcadas, sin merge destructivo |
| Logging de fallos de ingesta / mapeo / IA / fuente parcial | Ingesta e IA: `loom_sync_runs` (Loom). Mapeo y lanes: `priority_events` |
| Retries ante fallos transitorios de lectura | Ingesta: Loom (ya implementado). Interface: lectura nativa de Airtable, no aplica |
| Control de acceso | Permisos de la base y de la interface en Airtable |
| Credenciales en gestor de secretos | OAuth de Hyperagent; la interface no usa credenciales. Cumplido por plataforma |
| Latencia, caché, batching | Lectura nativa de la interface (146 tareas abiertas); writes de bulk en lotes. Riesgo bajo |

## 2. Hallazgo principal

El trabajo anterior de Carlos se construyó contra el AC de **CC4** (Work · Queue, UI), no contra el AC de esta story. Su docx lo dice: *"No se pudo confirmar el AC verbatim de 38571 en Singular Stories"*. Lo construido (UI Work · Queue, `task_lanes` con las 5 lanes, overrides, acciones bulk) es una buena base, pero faltan stale configurable, elegibilidad de delegación, lane por defecto, owner canónico, indicador de completitud y la regla de identidad entre fuentes.

Además, **`WorkQueuePage.tsx` no está en el repo** `mapking-dev` (solo `TodayPage.tsx` y `dashboard.tsx`). Hay que recuperarlo de la extensión antes de modificarlo.

## 3. Criterios → estado actual

| Criterio | Estado | Evidencia |
|---|---|---|
| Valores de las 5 lanes | Parcial | `task_lanes.lane` tiene las 5 opciones. Solo 18 de 146 tareas abiertas tienen lane, todas de prueba (Carlos / Andrés); **Max no tiene ninguna**. No hay lane por defecto |
| Filtrar por domain / owner / source, solos o combinados | Parcial | Filtros en la UI de Carlos. Owner sin normalizar ("Sergio Góngora" ×48 vs "SERGIO GONGORA" ×12; 70 tareas sin owner) |
| Vista unificada normalizada | Cumplido (base) | `command_center_tasks` vía Loom (38532). Falta sumar lane, stale, delegate y completitud a la fila de triage |
| Stale configurable y determinista | No implementado | Regla fija en el código de la UI (vencida + 2 días sin cambio). Sin campo, config ni `unknown`. Hoy: 56 abiertas con ≥7 días sin actividad; 20 vencidas |
| Elegibilidad para delegar | No implementado | Solo `delegated_to` (texto libre, post-decisión) |
| Separación IA vs fuente | Parcial | Campos IA documentados, no señalados en la interface. Overrides sí separados |
| Validación de filtros / vacío = éxito | Parcial | Opciones cerradas en la UI; falta validación del estado de filtros y verificación del estado vacío |
| Indicador completo / parcial | No implementado | Los datos existen (`source_status`, `loom_sync_runs`), la interface no los muestra |
| Sin duplicados entre fuentes | Parcial | Dentro de cada fuente resuelto (38532). Sin regla entre fuentes; riesgos: `dev_tickets` ↔ Linear, approvals ↔ invoices / follow-ups (hoy 0 dev_tickets abiertos) |
| Logging | Parcial | `loom_sync_runs` y `priority_events` existen; faltan eventos de triage (lane por regla, datos inválidos) |
| Acceso y credenciales | Cumplido (plataforma) | Permisos Airtable + OAuth Hyperagent. Falta documentar |
| Performance | Sin verificar | Riesgo bajo |

## 4. Decisiones pendientes

### Para Max

1. **Regla de stale.** Propuesta: abierta y ≥7 días sin `last_updated_at`, o vencida hace ≥2 días. Sin dato de actividad → `unknown`.
2. **Lane por defecto** para tareas no triageadas a mano:
   - vence en ≤7 días → `this_week`;
   - tag `waiting-on-external` → `waiting_on`;
   - >30 días sin actividad y sin due date → `icebox`;
   - resto → `queued`.

   `on_fire` queda manual (top 3 de 38570). Cada lane lleva `lane_basis` = `manual` | `rule`.
3. **Regla de delegación y roster del equipo.** Propuesta: elegible si abierta, owner = Max o vacío, sin tag `needs-max` y `schedulable` = true. Sin roster no se puede proponer "delegar a X".
4. **Mapa canónico de owners** (mayúsculas, acentos, emails).

Todas quedan en `triage_config`: si Max no responde a tiempo, se arranca con estos defaults y se ajustan sin tocar código.

### Para Andrés / PM

5. **Limpieza de las 18 filas de prueba** en `task_lanes` (Carlos / Andrés). No son datos de Max, pero las toca 38570.
6. **Recuperar `WorkQueuePage.tsx`** de la extensión de Airtable (copia manual desde el editor de la extensión) y subirlo al repo.

Resueltas: la forma del backend (Airtable + Hyperagent, sin servicio aparte) y el acceso al repo.

## 5. Riesgos para el cierre del sprint

- Story vencida en SS; quedan 6 días hábiles. Las decisiones 1–4 dependen de Max, que responde lento (la pregunta del 2026-10-08 sobre "Ready for QA" sigue abierta). Mitigación: defaults configurables.
- Solapamiento con 38570 (Today / On Fire): no romper `task_lanes-integrity.js` ni el top 3.
- Los scripts de automatizaciones se pegan a mano en Airtable (la API no edita el paso "Run a script").
- La evidencia existente (docx) describe otro AC; reemplazarla en vez de sumar otra.

## 6. Plan (Airtable + Hyperagent)

| # | Paso | Estimación |
|---|---|---|
| 1 | Enviar decisiones 1–4 a Max en #map-king_agile con defaults propuestos | 0,5 h |
| 2 | Spec `stories/MapKMigGon38571/spec.md` (+ copia en el project): lectura del AC, modelo de datos, reglas, trazabilidad, plan de pruebas | 3 h |
| 3 | Esquema (solo campos nuevos): tabla `triage_config`; en `command_center_tasks` `stale_state` (stale / fresh / unknown), `stale_reason`, `delegate_eligible`, `delegate_reason`, `owner_canonical`, `domain_effective`; en `task_lanes` `lane_basis` | 4 h |
| 4 | Lane efectiva: script de automatización `triage-default-lane.js` (lane por regla para tareas sin fila manual, respeta on_fire de 38570); correcciones y datos inválidos a `priority_events` | 4 h |
| 5 | Recuperar `WorkQueuePage.tsx` al repo | 1 h |
| 6 | Módulo de triage en la extensión: validación del estado de filtros, filtros combinados sobre campos canónicos, marca `source` / `inferred` / `override`, banner completo / parcial, regla de identidad entre fuentes | 6 h |
| 7 | Integración en Work · Queue: indicadores de stale y delegate, prompt "Delegate to…?", lane por regla vs manual | 4 h |
| 8 | Pruebas: filtros (simples, combinados, vacío), stale (stale / fresh / unknown), delegate, lane por regla, fuente caída (`source_status` = unavailable), integridad con 38570 | 5 h |
| 9 | Evidencia delivery por criterio, trazabilidad, comentario en SS, reemplazo del docx viejo | 2 h |
| | **Total** | **≈29,5 h (4 días)** |

Llega al 2026-10-20 con margen de un día si se arranca el 2026-10-13.

## 7. Estado de aprobación

Pendiente: OK al plan.

## Fuentes consultadas

- Singular Stories: detalle, actividad y evidencia de MapKMigGon38571.
- Airtable · Map King Hub: `command_center_tasks`, `task_lanes`, automatizaciones e interfaces.
- Hyperagent: agente Loom v3.9.
- Slack: #map-king_agile (2026-10-06, 2026-10-08).
- Repo `aserron-sa/mapking-dev`: `airtable/cct/`, `docs/38570/schema.md`.
- Project: `claude/spec-MapKMigGon38532.md`.
