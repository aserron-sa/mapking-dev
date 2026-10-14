# SOC 2 Evidence · hallazgos de contexto (14 oct 2026)

Búsqueda en Slack, Drive, Map King Hub (datos reales, no solo esquema), Hyperagent, el artifact del MAP y el paquete de contexto del repo (.claude/skills/story-context/context). Complementa estimation-report.md, implementation-plan.md, validation-MapKMigGon39261-39264.md y scrut-soc2-evidence-format.md.

## 1. Origen de la story

- El MAP original (21 jul 2026) tenía una build transversal E10 de SOC 2. Según el resumen que hizo el bot MIKE al armar el sprint de 100 SP, incluía "la tabla de evidencia SOC 2 para Scrut (security / vendor / processing-integrity / confidentiality por fase)", "controles Scrut" entre los ítems cerrados en el kickoff y la nota de que "Singular alimenta Scrut, no lo corre". E10 arrancaba en la semana 1 "con los logs de F2" (los approval gates) y compilaba en la semana 4.
- La versión actual del artifact del MAP (v0-singular-artifacts) ya no menciona SOC 2 ni Scrut: la lista de builds termina en E9 y los ítems cerrados del kickoff son playbooks, conexiones front-office y Alta HQ + Slack. El dashboard de Hyperagent con la tabla original no se puede leer desde acá (carga dinámica).
- Lectura: la intención original era evidencia por fase en cuatro categorías (seguridad, proveedor, integridad de procesamiento, confidencialidad), alimentada por los logs de los approval gates. Eso se parece más a "paquete para Scrut" (P02) más la captura de aprobaciones (37539) que a capturar toda corrida de agente (P01).

## 2. Historia del bloqueo

| Fecha | Qué pasó | Dónde |
|---|---|---|
| 18 ago | Miguel Pérez: 37539 "totalmente bloqueada" junto con 37536 y 37535. Carlos: "aún estamos bloqueados con soc2 y scrut" | #map-king_interno |
| 24 ago | Carlos: "Aún no tenemos api o acceso a SCRUT" | #map-king_interno |
| 25 ago | Pedido a Max: "Scrut API access + evidence-requirements documentation" (Carlos en interno; Mairene a Max en #map-king_agile) | #map-king_interno, #map-king_agile |
| 26 ago | Auditoría Bodyguard del Sprint 3: 37539 es carryover del Sprint 2 y recomienda re-scope a 2–3 SP como finalización, por riesgo de doble cobro | #ai-playground |
| 3 sep | Mismo pedido repetido a Max | #map-king-development |
| 30 sep | Andrés en el daily: 37539 requiere credenciales externas. Miguel: "va mañana lo hablamos con max". Andrés: "Discutimos dejar el ticket para luego, incluso yo no tengo contexto de si son necesarias las integraciones" | #map-king_interno |
| 13 oct | Andrés en el daily: avanzar 37539 "si queda tiempo" | #map-king_interno |

No hay respuesta registrada de Max sobre Scrut en ningún canal. Max no tiene mensajes sobre SOC 2.

## 3. Datos reales en las fuentes (leídos hoy)

| Fuente | Registros | Qué hay | Consecuencia |
|---|---|---|---|
| approvals | 24 | Del 19 jul al 24 ago. Los que tienen approved_by los aprobó Carlos Olivares (desarrollo), no Max. 3 filas vacías. Nada desde el 24 ago | La fuente "más fuerte" hoy es casi toda prueba de desarrollo. No hay uso productivo de los approval gates desde agosto |
| ticket_candidates | 3 | Del 14 sep; uno aprobado con source_finding_id QA-TEST-001, sin reviewed_by | Datos de prueba; el flujo de 38533 no está desplegado |
| ingestion_runs | 2 | 19 ago, archivos de muestra (freedom250_pois_sample.csv, _test.csv); run_by en texto libre; uno fue "replaced prior rows" | Datos de prueba; confirma la sobrescritura |
| loom_sync_runs | 6 | Del 7 al 12 oct, todas success; triggers schedule y slack:#ingestion | Única fuente con actividad productiva y regular |
| priority_events | 67 (diagnóstico) | Eventos de 38570 y 38571: triage_compute, guard_fix, dedupe, errores | Actividad real de automatizaciones |

## 4. Otros contextos

- En SS, Andrés comentó en P01 y P02 que son la compensación planificada de story points, y en la P01 que el texto se armó reprocesando la sugerencia de IA de SS con Claude.
- El repo tiene un paquete de contexto (.claude/skills/story-context/context) con nodos para la épica, las tres stories, las tablas evidence, activity_runs, loom_sync_runs y soc2_control_mappings, el módulo y la captura. Hoy refleja el diseño con activity_runs; si se decide lo contrario, hay que actualizarlo.
- En un DM del 13 oct, Andrés describe la story de SOC 2 como poco concreta.

## 5. Implicancias

1. Valor real hoy: lo que se capture va a ser casi todo prueba o actividad de Loom y automatizaciones. La exclusión de datos de prueba no es un borde: es la mayor parte de los datos. Hay que definir la regla (por ejemplo, actor del equipo de Singular, nombres con TEST, fechas anteriores al go-live).
2. Puntos: la Bodyguard ya marcó 37539 como carryover y pidió bajarla a 2–3 SP. Subir el total a 15 SP con dos sub-stories va a recibir el mismo escrutinio; la justificación tiene que estar por escrito (estimation-report, plan) y conviene que el PM la valide antes.
3. Scrut: siete semanas sin respuesta de Max. Avanzar sin Scrut sigue siendo correcto, pero el entregable tiene que poder mostrarse solo, sin depender de que Max suba algo.
4. Alcance: la intención original (evidencia por fase en cuatro categorías, alimentada por los approval gates) apoya priorizar 37539 (aprobaciones) y P02 (paquete por control y categoría) por sobre P01.
