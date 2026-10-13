# MapKMigGon38571 — Work · Queue (Triage por Lanes)

Equivalente formal de CC4 del backlog de Command Center

**Sprint:** #3 (Map King)

**Epic:** Front-Office Workflows

**Story Points:** 8

**Status:** Implementado y verificado end-to-end

**Fecha:** 2026-09-17

**Owner:** Carlos Olivares

**QA responsable:** Gonzalo Lucas Ranieri

**Nota de trazabilidad:** este documento asume que el AC de 38571 coincide con el de CC4 ("Work · Queue — filterable task list with triage lanes") del backlog de Command Center, dado que el resumen de 38571 describe exactamente lo mismo. No se pudo confirmar el AC verbatim de 38571 en Singular Stories — si difiere, avisar antes de dar la historia por cerrada.

## 1. Objetivo

Darle al CEO una vista única para triage: filtrar todas sus tareas por domain/owner/source, organizarlas en 5 lanes (On Fire, This Week, Waiting On, Queued, Icebox), detectar tareas stale y forzar una decisión (Done/Drop/Reschedule), mostrar un prompt de delegación, y permitir acciones bulk (retag, reasignar, empujar a la próxima semana).

## 2. Decisión de arquitectura central

**El AC pide que Done/Drop/Reschedule escriban de vuelta al sistema de origen.** Esto es imposible tal cual está para Attio, Linear y Google Calendar — Loom es expresamente read-only ahí por diseño (Story MapKMigGon38568/CC1). La solución: el campo synced_to_source en task_lanes solo es true cuando el source del task es Airtable (donde sí tenemos escritura real vía las automatizaciones ya construidas). Para las demás fuentes, la acción se registra igual pero queda marcada "· not synced to source" en la UI — generalización del edge case que el propio AC ya contempla para reschedule sin campo de fecha.

**Ninguna decisión del CEO se escribe en command_center_tasks.** Todo (lane, acción, delegado, retag, reasignación) vive en task_lanes como override — si escribiéramos directo en la tabla que sincroniza Loom, el próximo ciclo de sync lo pisaría sin aviso.

## 3. Qué se construyó

### 3.1 Extensión de schema

| **Cambio** | ** Detalle** |
| --- | --- |
| Tabla fire_ranks → task_lanes | Renombrada (mismo table ID, no rompe nada de Story 38570/Today). Ahora cubre las 5 lanes, no solo on_fire. |
| 3 choices nuevos en lane | waiting_on, queued, icebox — agregados vía el patrón typecast create-then-delete, ya que la API no permite editar choices existentes. |
| Choice "Manual" en command_center_tasks.source | Para tareas ad-hoc no backed por ninguna fuente real — agregado al schema, la UI de alta todavía no se construyó (ver §5). |
| Campos nuevos en task_lanes | action_status (none/done/dropped/rescheduled), rescheduled_date, synced_to_source, delegated_to, domain_override, owner_override. |

### 3.2 Página Work · Queue

| ** Elemento** | ** Qué hace** |
| --- | --- |
| Toggle Queue / Delivery | Delivery muestra un placeholder honesto ("Coming soon — CC9") en vez de simular esa historia, que es completamente distinta. |
| Tabs de lane con count en vivo | All / On Fire / This Week / Waiting On / Queued / Icebox — filtran una lista plana, no columnas lado a lado. |
| Sidebar de filtros (Domain/Owner/Source) | Pills single-select, con "Clear filters". |
| Stale detection | due_date pasado + last_updated_at ≥2 días sin cambio + sin acción tomada. Fuerza los 3 botones Done/Drop/Reschedule inline. |
| Panel de detalle | Al hacer click en una tarea: tags, fecha, acciones, Move to, Open in {source}, Delegate. Sin contenido fabricado (nada de "next action" ni "suggested steps" — no existen esos datos, ver §4). |
| Bulk actions | Retag domain, Reassign owner, Push to next week sobre la selección — transaccional por item vía Promise.allSettled, reporta fallos parciales sin bloquear el resto. |

## 4. Lo que no se construyó, y por qué

- ** "Next action" + "Suggested steps" con estimados de tiempo:**Max compartió capturas de un prototipo con un panel de desglose de tareas generado por IA (pasos sugeridos, minutos estimados). Ese contenido no existe en Attio, Linear ni Airtable — es razonamiento de IA por tarea, territorio de un futuro agente tipo CC12, no de esta historia. No se fabricó.

- ** Pestaña Delivery (CC9):**historia completamente distinta (capacity meter, 6 stages de pipeline, runbook checklist) — queda como placeholder explícito.

- ** Alta de tareas manuales:**el choice "Manual" ya existe en el schema, pero no se construyó el formulario para crearlas desde la UI.

- ** Semántica real de "Done" por tabla de Airtable:**hoy synced_to_source queda en true para tasks de Airtable, pero no hay un write real al record original (¿"Done" en una invoice significa "Paid"? ¿en una approval significa "Approved"?). No se definieron esas reglas sin confirmarlas con Carlos primero, para no arriesgar escribir mal un status real.

## 5. Verificación

- Bug de datos vacíos ("Nothing matches these filters" con todos los counts en 0): resuelto — no era el código, sino que varios campos de command_center_tasks y task_lanes no estaban marcados como visibles en el panel Data del bloque. Una vez expuestos, la página mostró los 71 tasks reales de Loom correctamente.

- Carlos confirmó manualmente: el panel de detalle abre correctamente al hacer click; una acción sobre un task de Attio/Linear queda marcada "not synced to source"; el bulk retag/reassign/push-to-next-week escribe en task_lanes (nunca en command_center_tasks); mover una tarea a On Fire desde Work·Queue la refleja también en la página Today, confirmando que ambas páginas comparten la misma tabla de verdad.

## 6. Pendiente / fuera de esta historia

- Confirmar el AC verbatim de 38571 en Singular Stories contra este documento.

- Definir junto con Carlos qué significa "Done" por cada tabla de Airtable antes de habilitar el write-back real.

- Formulario de alta de tareas manuales.

- CC9 (Work · Delivery) — historia separada, no iniciada.

## 7. Archivos entregados

- WorkQueuePage.tsx (Airtable Interface Extension)

- Este documento (spec-MapKMigGon38571.docx)
