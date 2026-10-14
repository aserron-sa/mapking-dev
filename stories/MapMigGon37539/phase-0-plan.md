# Fase 0 · alinear stories y probar la compuerta CSV

Parte de data-implementation-plan.md. Versión 1.0 · 2026-10-14. Estado al pie de cada punto.

Objetivo: que lo que dicen las stories en SS sea exactamente lo que se construye (catálogo de eventos, tablas soc2_ ya creadas, formato Scrut), y saber antes de construir la P02 si la descarga CSV de una interfaz respeta los filtros.

## 0.1 Textos finales de MapKMigGon39261 (P01)

- 0.1.1 Alcance: eventos de arranque del catálogo (Loom init, completed, error; Ingestion completed, error; init disabled; dos automatizaciones). Salen activity_runs, ticket reviews y el paso de registro en los agentes. Estado: hecho.
- 0.1.2 Campos de SS: Name, Work area, Tech, Primary AI technology, Written story, Business story, AI description. Estado: hecho.
- 0.1.3 Criterios de aceptación en formato SS (escenarios en texto plano, sin backticks): Acceptance Criteria, Technical Implementation, Data & Integration Requirements, Edge Cases & Error Handling, Security & Performance. Estado: hecho.
- 0.1.4 Criterios para el cliente. Estado: hecho.
- 0.1.5 Archivo: MapKMigGon39261-final.md (reemplaza la versión anterior) e ítem en ss-drafts-MapKMigGon39261.md. Estado: hecho.

## 0.2 Textos finales de MapKMigGon39264 (P02)

- 0.2.1 Mapeo por tipo de evento (soc2_event_types.controls) en lugar de source type; tablas soc2_events y soc2_controls ya creadas. Estado: hecho.
- 0.2.2 Columnas del CSV según scrut-soc2-evidence-format.md §3.3; filtro por período; export_ok como única condición. Estado: hecho.
- 0.2.3 Correcciones de la validación: "the sources story" pasa a MapKMigGon39261; sale el encabezado con el control filtrado; carpeta de docs stories/MapMigGon37539/; hora de aprobación fuera (no hay aprobaciones en v1). Estado: hecho.
- 0.2.4 Campos de SS (Work area Backend, Tech Airtable, Primary AI Claude, AI description, Written y Business story) y criterios para el cliente. Estado: hecho.
- 0.2.5 Archivo: MapKMigGon39264-final.md (reemplaza la versión anterior) e ítem en ss-drafts-MapKMigGon39264.md. Estado: hecho.

## 0.3 Map MigGon37539 (padre)

- 0.3.1 Los criterios del padre no cambian en SS. Estado: decidido.
- 0.3.2 Comentario para SS que explica el reparto: catálogo de eventos, tablas creadas, qué cubre cada parte y que las aprobaciones quedan para un evento futuro. Estado: borrador hecho, ítem en ss-drafts.md.

## 0.4 Compuerta CSV

- 0.4.1 Protocolo de prueba paso a paso en csv-gate-test.md (lo ejecuta Andrés en la UI; la API no descarga CSV). Estado: hecho.
- 0.4.2 Resultado: se anota en csv-gate-test.md y en airtable/soc2/schema/CHANGELOG.md. Estado: pendiente de Andrés.
- 0.4.3 Si falla: plan B (vista filtrada por control y período, descargada desde la grilla) ya descrito en el protocolo. Estado: hecho.

## 0.5 Publicación

- 0.5.1 Andrés revisa los -final.md y postea en SS, o pide "post item N". Estado: pendiente de Andrés.
- 0.5.2 Al postear, Generate Story puede regenerar campos: pegar los textos después de usarla. Estado: aviso.
