# Compuerta CSV · protocolo de prueba (fase 0.4)

Objetivo: confirmar antes de construir la P02 que una lista de interfaz de Airtable descarga a CSV solo lo que muestran sus filtros, incluido un filtro de usuario sobre un campo lookup y un filtro de fecha. La API no descarga CSV de interfaces, así que la prueba se hace en la UI.

Tiempo: unos 20 minutos. Ejecuta: Andrés. No se escribe en tablas existentes.

## Preparación

1. En soc2_controls, crear dos filas de prueba: control_code TEST-A y TEST-B, active marcado.
2. En soc2_event_types, crear dos filas de prueba: event_code test.gate.one (controls: TEST-A) y test.gate.two (controls: TEST-B), status disabled.
3. En soc2_events, crear cuatro filas de prueba a mano (solo para esta prueba): event_key gate-1 a gate-4, event_type alternando test.gate.one y test.gate.two, confirmed marcado, is_test sin marcar. Dejar dos con recorded_at de hoy (se crean hoy) y, para la prueba de período, usar el filtro sobre produced_at con fechas distintas (gate-1 y gate-2 en septiembre, gate-3 y gate-4 en octubre).

## Prueba

4. Crear una interfaz de prueba "SOC2 · CSV gate" con una página de lista sobre soc2_events.
5. Filtro de la página: export_ok = 1.
6. Filtro de usuario 1: control_codes (lookup) con opción de elegir valor.
7. Filtro de usuario 2: produced_at dentro de un rango.
8. Habilitar la descarga CSV de la lista y dejar visibles las columnas event_key, control_codes, produced_at.
9. Elegir TEST-A y octubre. Descargar el CSV.

## Resultado esperado

- El CSV tiene solo las filas de TEST-A en octubre (una fila) y solo las columnas visibles.
- Repetir con TEST-B y septiembre: una fila.

Si el CSV trae todas las filas o ignora alguno de los filtros, la compuerta falla.

## Plan B si falla

Una vista de grilla en soc2_events por control y período (filtro fijo), descargada con "Download CSV" de la vista. Para que el revisor no edite filtros, se comparte la vista en solo lectura o se arma una vista por control y se cambia el período al exportar. Se anota en la P02 antes de construir.

## Limpieza

10. Borrar las filas de prueba (TEST-A, TEST-B, test.gate.one, test.gate.two, gate-1 a gate-4) y la interfaz de prueba.
11. Anotar el resultado abajo y en airtable/soc2/schema/CHANGELOG.md.

## Resultado

- Fecha:
- Resultado (pasa o falla, y qué filtro falló):
- Decisión:
