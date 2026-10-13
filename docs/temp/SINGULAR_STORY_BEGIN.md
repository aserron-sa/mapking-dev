
Arrancamos la story {MapKMigGon38571} del project Map King (Map.ai).

## 1. Contexto (solo lectura; no cambies nada todavía)

- SingularStories: buscá la story (search-stories), traé el detalle (get-story-detail),
  la actividad (get-story-activity), la evidencia y los links existentes. Anotá estado,
  sprint, fecha de cierre, puntos, épica, QA asignado y criterios de aceptación.
- Project: revisá los docs relacionados (project_search) y si ya existe
  claude/spec-{MapKMigGon38571}.md.
- Sistemas vivos: verificá el estado real en Airtable (Map King Hub), Hyperagent
  y Slack según lo que toque la story. No asumas que algo está hecho porque un
  comentario lo diga.

## 2. Diagnóstico

Devolveme un resumen corto con:

- Qué pide la story, en una frase.
- Tabla criterio → estado actual (Cumplido / Parcial / No implementado / Sin verificar),
  con la evidencia de cada uno.
- Dependencias, bloqueos y decisiones que necesitan a Max o al PM.
- Riesgos para llegar al cierre del sprint.
- Plan propuesto por pasos, con estimación.
  Pará acá y esperá mi OK.

## 3. Al aprobar el plan

- Pasá la story a in_progress (si no lo está) y dejá un comentario en SS con el
  plan resumido.
- Creá o actualizá claude/spec-{MapKMigGon38571}.md en el project con: objetivo,
  arquitectura, modelo de datos, manejo de errores, trazabilidad de criterios y
  plan de pruebas.

## 4. Ejecución

- Trabajá por pasos y avisame en cada cambio a sistemas productivos.
- Nunca borres ni modifiques datos de Max sin mi OK explícito.
- Versioná los prompts o configs que cambies (CHANGELOG en el project).

## 5. Cierre (antes de send-to-qa)

- Corré el plan de pruebas y subí evidencia de tipo "delivery" (una por criterio
  o por prueba, no una por captura).
- Actualizá la tabla de trazabilidad en el spec.
- Dejá un comentario final en SS: qué se hizo, qué queda abierto y cómo probarlo.
- Recién entonces pedime confirmación para hacer send-to-qa.




---

Aclaraciones

- Nuestro stack esta compuesto por Airtable y agentes Hyperagent, tenemos consumo de fuentes como linear, attio, google calendar, y hay un servidor supabase que no usamos directamente
- Consecuentemente las vistas son interfaces Airtable
- Tenemos un repositorio para guardar los elementos como el codigo de las vistas o las automations: https://github.com/aserron-sa/mapking-dev
- Cuando los spec hablan de BACKEND, hablan del stack anteriormente nombrado

Decisiones que afectaron la letras de los stories
Los stories estan escritos con implementacion abierta, al acotar el stack a lo definido, la letra de las stories cambia, algunas cosas no aplican y otras quedan mas definidas, en general se vuelve mas concreto
