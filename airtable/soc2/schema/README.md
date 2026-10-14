# airtable/soc2/schema · registro del diseño en Airtable

Registro de todo lo que se crea en Map King Hub (appcdpGNTo0DouoqJ) para SOC 2 Evidence: Map MigGon37539 (base), MapKMigGon39261 (P01), MapKMigGon39264 (P02). La base es la fuente de verdad; esta carpeta es el respaldo y la explicación.

| Archivo | Qué es | Cómo se mantiene |
|---|---|---|
| soc2-schema.json | Snapshot completo de las tablas soc2_ (campos, IDs, tipos, opciones, descripciones) | Se regenera desde la API después de cada cambio de esquema |
| tables.md | Las mismas tablas en formato legible | Se genera desde el JSON; no se edita a mano |
| design.md | El diseño: rol de cada tabla, reglas, fórmulas, vistas, automatizaciones, interfaces y datos iniciales, con lo hecho y lo pendiente | A mano, en el mismo cambio que toca Airtable |
| seed-v1.json | Datos iniciales cargados en soc2_controls y soc2_event_types (fase 3) | Se versiona: un seed nuevo por cambio de catálogo |
| CHANGELOG.md | Cada acción sobre la base, con fecha, quién, qué y el action id de la API (sirve para revertir) | Una línea por acción, solo se agrega |

Reglas:

- Todo cambio en Map King Hub para SOC 2 queda en CHANGELOG.md antes de cerrar la sesión.
- Cada tabla y cada campo nuevo lleva descripción en Airtable (story, propósito, escritor).
- Cambios hechos en la UI (vistas, zonas horarias, pasos de script) también se anotan, con "UI" como origen.
- Docs de la story: stories/MapMigGon37539/ (plan de datos, catálogo de eventos, formato Scrut).
