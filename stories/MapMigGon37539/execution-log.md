# SOC 2 Evidence · log de ejecución

Se agrega al final, nunca se edita lo anterior. Formato de entrada: execution-context.md §6. Paquetes: execution-spec.md.

## Gates

Solo Andrés da un OK. La sesión principal lo anota acá con la fecha y la cita.

| Gate | Qué habilita | Estado |
|---|---|---|
| G1 | Scripts soc2:test y soc2:build en package.json; airtable/soc2/** en tsconfig.node.json | Aprobado (Andrés, 2026-10-14: "apruebo todo") |
| G2 | Crear las 5 automatizaciones soc2 · capture en Map King Hub (dry run) | Aprobado (Andrés, 2026-10-14: "apruebo todo") |
| G3 | Pasar cada tipo de evento de trace a enabled (un OK por evento o por grupo) | Aprobado (Andrés, 2026-10-14: "apruebo todo") |
| G4 | Crear la interfaz SOC 2 Evidence y sus páginas | Aprobado (Andrés, 2026-10-14: "apruebo todo") |

## Decisiones abiertas

D1 a D5 en execution-context.md §8. Cuando Andrés decide una, se anota acá y se actualiza el contexto.

## Entradas

## 2026-10-14 · spec y contexto creados · Opus (sesión principal)
- Hecho: execution-context.md, execution-spec.md y este log. Fases 0 a 3 del plan de datos ya hechas (ver schema/CHANGELOG.md).
- Siguiente: WP-A (sin gate).

## 2026-10-14 · decisiones del spec aprobadas · Opus (sesión principal)
- Andrés: "proceed ambas". Quedan aprobadas las cuatro decisiones de diseño del spec v1.0: (1) triage en dry run se saltea con motivo dry_run; (2) loom.sync.init sale de toda fila que no sea rejected_busy; (3) source_recorded_at de loom.sync.init vacío con marca cuando la fila ya no está running; (4) run_ref genérico task_lanes·integrity.
- Se lanza WP-A (Haiku) y, al terminar, WP-B (Sonnet).

## 2026-10-14 08:56 UTC-3 · WP-A · terminado · Haiku
- Hecho: lectura de schema de las tres fuentes y de sus filas (field IDs). Fixtures y sources.md escritos. Sin escrituras en Airtable.
- Archivos: airtable/soc2/tests/fixtures/loom_sync_runs.json (6 filas, 3069 B), ingestion_runs.json (2 filas, 1164 B), priority_events.json (11 filas, 3141 B); airtable/soc2/schema/sources.md.
- Verificación: los tres JSON cargan. Filas por case: loom_success 6; ingestion_completed_with_errors 2; triage_compute_ok 3, triage_compute_not_ok 1, guard_fix_or_dedupe 3, triage_dry_run 1, triage_data_issue 1, source_not_automation 2. Ninguna clave prohibida. Conteos por filtro de Airtable (metadata.totalRecordCount).
- Supuestos: last_modified de loom mira status y finished_at; el de ingestion mira run_status y run_at (leído del schema). run_at tiene zona America/New_York configurada pero la API devuelve UTC.
- Bloqueos / decisiones para Andrés: no hay filas para loom partial, failure, abandoned, rejected_busy; ingestion Completed y Failed; triage_data_issue con source automation. Solo hay 1 dry run (se pedían 2). Las filas de setup no traen source (4). Ningún bloqueo para WP-B.
- Propuestas (fuera de alcance): añadir a la regla de §2.3 el caso source vacío. Revisar si el campo run_at necesita zona GMT en views-checklist.

## 2026-10-14 09:00 UTC-3 · WP-B · terminado · Sonnet
- Hecho: contrato v0.2 (§2.1) y registro de los 9 eventos (version 1) con detect puro y helpers normalizeActor, isTestRow, toIso. Ajustes de la sesión principal aplicados y documentados en la cabecera de soc2-registry.ts: (1) priority_events con source vacío o null → skip not_automation_source; (2) requester de Loom sin pasar a minúsculas, actor "agent:Loom requested_by:<id>"; (3) requested_by de ingestion con espacios colapsados y 80 caracteres; (4) fixtures sintéticos derivados de filas reales; (5) escritura con python.
- Archivos: airtable/soc2/soc2-evidence-contract.ts (153 líneas, reescrito), airtable/soc2/soc2-registry.ts (468, nuevo), airtable/soc2/tests/soc2-evidence-contract.test.ts (64, actualizado), airtable/soc2/tests/soc2-registry.test.ts (567, nuevo), airtable/soc2/tests/fixtures/synthetic.json (15 filas, nuevo). package.json y tsconfig sin tocar. Sin imports de Airtable. Sin escrituras en Airtable.
- Verificación (desde la raíz del repo, node v22.23.2):
  - node --test airtable/soc2/tests/soc2-evidence-contract.test.ts → tests 7, pass 7, fail 0.
  - node --test airtable/soc2/tests/soc2-registry.test.ts → tests 61, pass 61, fail 0.
  - npx tsc --noEmit --allowImportingTsExtensions --strict --target es2022 --module nodenext --moduleResolution nodenext --skipLibCheck sobre los 4 archivos .ts → sin errores (no bloqueante).
- Supuestos:
  - Opciones de soc2_events.outcome (started, success, partial, failure, abandoned, fixed) tomadas del spec §2.1; soc2-schema.json no lista las opciones de los selects y no se pudieron verificar en el repo.
  - Un priority_events con source automation y un event_type sin evento (por ejemplo triage_data_issue) devuelve none en los tres detectores; el plan (WP-C, §2.5) lo convierte en skip no_matching_event una vez por fila. Así evita que una fila válida sume skips falsos.
  - dry_run se evalúa por evento, después de calzar event_type; orden en priority_events: source (skip), campos requeridos (invalid), tipo, dry_run.
  - is_test: el identificador (run_id o source_file) con "test" en cualquier posición (cubre TEST y QA-TEST); también "latest" o "contest" darían true, como dice el spec literal. Dry run nunca es is_test.
  - Loom con status desconocido (no listado en el select) → skip loom_status_<valor>. loom.sync.error sin finished_at ni last_modified → invalid con missing ["finished_at"].
  - Las dos filas reales de ingestion son is_test por source_file (sample, test); el caso no test usa una fila sintética (ingestion_completed, ingestion_failed).
  - Slack mention "<@U...>" se normaliza quitando @ < >; el prefijo "slack:#ingestion" se reconoce sin distinguir mayúsculas.
  - run_ref de lanes_integrity = "task_lanes·integrity" (supuesto del spec).
- Bloqueos / decisiones para Andrés: ninguno.
- Propuestas (fuera de alcance): confirmar en Airtable las opciones de outcome y ai_output_state (WP-C/F). Si D1 define goLive, agregar un test con la fecha real. Ver si conviene acotar la regla "test" del identificador a TEST/QA-TEST como palabra para evitar falsos positivos.

## 2026-10-14 · verificación de WP-A y WP-B · Opus (sesión principal)
- WP-A: sources.md y fixtures revisados; sin claves prohibidas. Las opciones de select coinciden con §2.3. La cobertura que falta se resuelve con fixtures sintéticos en WP-B.
- WP-B: relanzados los tests en el device: 68 pass, 0 fail. soc2-registry.ts solo importa el contrato. Opciones de soc2_events.outcome y ai_output_state verificadas en Airtable (get_table_schema): coinciden con OUTCOMES y AI_OUTPUT_STATES.
- Decisión para Andrés: is_test busca "test" en cualquier parte de run_id o source_file, así que también marcaría "latest" o "contest". Opciones: dejarlo así (más conservador) o exigir palabra completa (TEST, QA-TEST o test separado por _ - . o espacio).
- Siguiente: WP-C (Opus), módulo de evidencia. Sin gate.

## 2026-10-14 · aprobaciones · Opus (sesión principal)
- Andrés aprobó todo lo presentado ("apruebo todo"): WP-C, regla is_test por palabra suelta, G1 a G4 y las propuestas D1 a D5.
- D1: go-live = fecha del primer paso a enabled (G3). D2: triage_compute.completed en cada corrida. D3: edita catálogo y controles solo Andrés hasta que Max designe. D4: verificar el plan de Airtable; si permite, restringir soc2_events y soc2_capture_runs; si no, convención documentada. D5 = G1.
- G3 sigue sujeto a 24 h en trace y revisión mostrada a Andrés antes de cada paso a enabled. G4 sigue sujeto a que pase la compuerta CSV.

## 2026-10-14 09:15 UTC-3 · WP-C · terminado · Opus
- Hecho: módulo de evidencia puro airtable/soc2/soc2-evidence.ts (v0.1): SOC2_IDS, checkFieldIds y checkConfig (§2.4), planCapture (§2.5), classifyError, withRetries (sleep, now y deadline inyectados), writeInBatches (lotes de 50, patrón cct), buildFields y validateDraft, sanitizeDetails, verifyReadBack y confirmReadBacks, capJson, runStatus y summarizeRun (§2.7 paso 8). Importa solo el contrato y el registro (toIso). Cambio aprobado en soc2-registry.ts: isTestRow por palabra suelta (TEST_TOKEN: test, qa-test o sample delimitado por inicio/fin o _ - . espacio), cabecera Versions actualizada y 3 tests nuevos en soc2-registry.test.ts.
- Archivos: airtable/soc2/soc2-evidence.ts (837 líneas, nuevo), airtable/soc2/tests/soc2-evidence.test.ts (820, nuevo, 57 tests), airtable/soc2/soc2-registry.ts (476, editado), airtable/soc2/tests/soc2-registry.test.ts (595, +3 tests), ac-tracker.md. package.json y tsconfig sin tocar. Sin escrituras en Airtable ni en SS.
- Verificación (desde la raíz, node v22.23.2):
  - node --test airtable/soc2/tests/soc2-evidence-contract.test.ts airtable/soc2/tests/soc2-registry.test.ts airtable/soc2/tests/soc2-evidence.test.ts → tests 128, pass 128, fail 0 (7 + 64 + 57).
  - npx tsc --noEmit --noUnusedLocals --allowImportingTsExtensions --strict --target es2022 --module nodenext --moduleResolution nodenext --skipLibCheck --types node sobre los tres .ts y sus tres tests → sin errores.
- Criterio → test (soc2-evidence.test.ts):

| Criterio | Test |
|---|---|
| F4 | D6 F4 only rows re-read and matching are confirmed; a mismatch or a missing row is an integrity error |
| F5 | F5 E5 a key that exists and is confirmed is an existing hit, never a write; F5 the same key twice in one run is written once; the second is skipped as duplicate_in_run |
| F7 | F7 run status: success when complete without failures; partial on failures or spent budget; failure when not complete; F7 T7 summarizeRun: counts, skip_reasons, trace, errors and config issues as JSON |
| T2 | E1 T2 P01-E1 missing required field: no evidence for it, skipped as missing_fields with the list in errors |
| T5 | T5 buildFields maps a real draft to soc2_events field IDs; T5 buildFields rejects an invalid draft before writing, as a validation error; T5 checkFieldIds: every soc2_ field must exist… |
| T6 | T6 classifyError: 422, INVALID_*, … are validation; T6 … rate_limit; T6 … transient; T6 … unknown |
| T7 | F7 T7 summarizeRun: counts, skip_reasons, trace, errors and config issues as JSON; S4 T7 capJson: trace keeps 50 entries plus {"truncated": n} |
| T8 (extra) | T8 P01-E6 checkConfig: version_mismatch disables the event (P01-DI4); T8 planCapture is deterministic and does not mutate its rows |
| D1 | D1 F4 D6 full flow with an in-memory soc2_events: plan, build, write, re-read, confirm, summarize |
| D5 | D5 verifyReadBack: a re-read row equal to its draft passes…; D5 verifyReadBack: each compared field that differs is reported |
| D6 | D6 a stored row whose re-read does not match stays unconfirmed and the run is partial |
| D7 | D7 a key that exists unconfirmed goes to toConfirm (reprocess), not to writes; D7 F5 E5 hourly run repeated over captured rows: captured 0, existing N, nothing written; D7 reprocess: an unconfirmed row from an earlier run is re-read and confirmed, not written again |
| E1 | E1 T2 P01-E1 missing required field…; E1 T2 a base field missing in all three Loom events is counted once per row, not once per event |
| E2 | E2 a validation error is not retried and keeps its reason; E2 T6 a batch rejected for one bad record goes record by record: only that record fails, without retry |
| E3 | E3 a transient error is retried and recovers, waiting 1 s first; E3 rate_limit is retried with 1 s and 2 s waits…; E3 a failed batch is retried (transient)… |
| E4 | E4 S6 retries run out after 3 retries (1 s, 2 s, 4 s): 4 attempts, kind kept; P01-E3 E4 a write that keeps failing… |
| E5 | F5 E5 a key that exists and is confirmed is an existing hit, never a write; D7 F5 E5 hourly run repeated… |
| E7 | E7 P01-AC7 trace status…; E7 P01-AC8 paused and disabled…; E7 enabled with dryRun = yes…; E7 P01-AC9 a row that matches no event…; E7 P01-AC9 registry skips count once per row and reason… |
| S1 | S1 buildFields keeps details free of forbidden keys…; S1 every planned write from the fixtures has details without forbidden keys after buildFields |
| S4 | S4 error messages are one line, at most 200 characters, without payloads; S4 capJson: the text never passes 100000 characters…; T7 S4 the run log never carries draft content… |
| S6 | S6 no retry wait starts past the deadline (time budget); S6 writeInBatches: batches of 50…; S6 writeInBatches: after the deadline no batch starts… |
| P01-E2 | P01-E2 F5 triggered and hourly process the same row: one record, the second run changes nothing |
| P01-E3 | P01-E3 E4 a write that keeps failing: error with kind, event and record; not confirmed; run partial and reprocessable |
| P01-E6 / P01-DI4 (extra) | P01-E6 checkConfig: missing_in_catalog, unknown_in_registry, version_mismatch, invalid_status (4 tests) |

- Decisiones de diseño:
  - Los IDs de soc2_event_types, soc2_events y soc2_capture_runs viven en SOC2_IDS dentro de soc2-evidence.ts (copiados de schema/tables.md). WP-D los importa y agrega solo los IDs de las fuentes. buildFields(draft, links, ids = SOC2_IDS.events): links = { eventTypeRecordId, captureRunRecordId }; el event type sale de checkConfig().eventTypeIds.
  - soc2_events.events solo lista campos escribibles; recorded_at, last_modified, lookups y fórmulas no están en el objeto (test con los 10 IDs de tables.md). confirmed no se escribe al crear.
  - buildFields valida antes de escribir (validateDraft) y lanza INVALID_DRAFT, que classifyError clasifica como validation (T5). details pasa por sanitizeDetails (sin claves prohibidas, solo primitivos, strings ≤ 100).
  - Los JSON del log son camelCase tal como los objetos TS (eventKey, recordId, outcome, isTest, reason); errors con { kind, eventKey, recordId, message, attempts } como dice §2.6.
- Diferencias con el spec (correcciones locales):
  - §2.6 "hasta 3 intentos con espera de 1 s, 2 s y 4 s": tres esperas implican 3 reintentos, así que son hasta 4 llamadas (1 + 3). RETRY_DELAYS_MS es revisable.
  - §2.6 "si falla un lote, se reintenta una vez y después registro por registro": el lote pasa por withRetries (que ya reintenta rate_limit y transient); si sigue fallando, se prueba registro por registro, cada uno con withRetries. Un lote rechazado por validación no se reintenta como lote (E2).
  - §2.4 no cubre un código repetido en el catálogo: issue duplicate_in_catalog y status disabled.
  - §2.5 no dice qué hacer con una clave repetida en la misma corrida: la segunda se saltea con reason duplicate_in_run.
  - Relectura: produced_at se compara al segundo (el campo dateTime de Airtable guarda segundos); event_key se compara exacto.
  - Presupuesto agotado: no empieza lotes ni esperas que terminen después del deadline; lo no intentado queda en notStarted (no cuenta como failed, la horaria lo retoma) y la corrida queda partial. summarizeRun expone notStarted aparte de los conteos.
  - Los patrones de classifyError salen de mensajes documentados de Airtable (códigos de la API REST y errores de scripting), no de errores reales registrados en Map King Hub.
- Supuestos: getCellValue devuelve un single select como { name } y un link como [{ id, name }] (verifyReadBack acepta también string para outcome).
- Bloqueos / decisiones para Andrés: ninguno.
- Propuestas (fuera de alcance): WP-D puede usar checkFieldIds para el paso 1 de §2.7 y writeInBatches tanto para createRecordsAsync como para el update de confirmed. En ac-tracker la nota de T8 todavía dice "Contrato provisorio v0.1" (lo actualiza quien cierre T8).

## 2026-10-14 09:24 UTC-3 · WP-D · terminado · Sonnet
- Hecho: entrada de automatización, build y smoke test. G1 aprobado (Andrés, "apruebo todo"): soc2:build y soc2:test en package.json y airtable/soc2/**/*.ts en tsconfig.node.json. soc2-capture.ts sigue §2.7: modos record y hourly, dryRun por defecto yes, chequeo de field IDs (soc2_ y fuentes de la corrida), lock de la horaria (30 min), fila de corrida también en dry run, catálogo + checkConfig, lectura de fuentes con solo los IDs de execution-context.md §2 (SOURCE_IDS), lectura de soc2_events solo con event_key y confirmed, planCapture, escritura en lotes de 50 con reintentos, relectura y confirmed, cierre de la fila y output. Importa SOC2_IDS y las funciones de soc2-evidence.ts. Constantes: SCRIPT_VERSION "1.0.0", GO_LIVE null (D1: fecha del primer paso a enabled, se completa en G3), LOOKBACK_HOURS 48, WRITE_BUDGET_MS 20000, LOCK_MINUTES 30.
- Cómo se importa la entrada en el test: soc2-capture.ts exporta main(env) con env = { base, input, output, now, sleep } y al final se ejecuta solo si existe el global base (guard typeof base !== 'undefined'). El test importa main y le inyecta una base falsa y un reloj falso. El build quita la palabra export, deja el guard, y en Airtable el archivo pegado llama a main con base, input, output, Date.now y setTimeout reales. Dos tests corren el dist con AsyncFunction (como Airtable) después de construirlo en un before.
- Archivos: airtable/soc2/automations/soc2-capture.ts (587 líneas, nuevo), airtable/soc2/tools/soc2-build.ts (copia adaptada de cct-build; solo el target del script, sin rama tsx), airtable/soc2/tests/soc2-capture.smoke.test.ts (635, 14 tests, nuevo), airtable/soc2/automations/README.md (reescrito), airtable/soc2/README.md (layout actualizado), package.json (+2 scripts, estilo y LF del original), tsconfig.node.json (+ "airtable/soc2/**/*.ts"), ac-tracker.md. Salida: airtable/soc2/dist/automations/soc2-capture.js (80227 bytes, 1586 líneas; git-ignored). Sin escrituras en Airtable ni en SS, sin mensajes, sin git.
- Verificación (desde la raíz, node v22.23.2):
  - npm run soc2:test → tests 142, pass 142, fail 0 (contract 7, registry 64, evidence 57, capture.smoke 14).
  - node airtable/soc2/tools/soc2-build.ts → genera el dist. node --check del dist → OK. grep de líneas import/export en el dist → 0.
  - npx tsc --noEmit -p tsconfig.node.json → 0 errores (incluye airtable/soc2 y airtable/cct).
  - S3: el test "S3 built file: no credentials, tokens or network calls" busca en el dist fetch, XMLHttpRequest, Authorization, Bearer, tokens pat/key de Airtable, asignaciones de api key, secret, password y token, process.env y require: ninguno.
- Casos del smoke: record dryRun yes (y default, y valor raro): sin evidencia, fila con dry_run, 2 traced; record dryRun no tipo enabled: escribe 2, relee, confirma (secuencia create 2, update 2); repetido: captured 0, existing 2; hourly dry run, live (captured 4, skipped 1, la fila vieja fuera del lookback) y repetida (captured 0, existing 4, sin escrituras en soc2_events); lock activo (locked, sin ninguna escritura); lock vencido (abandoned con finished_at y sigue); campo faltante en fuente, en soc2_events y en soc2_capture_runs (failure con missing_field:<id>, sin evidencia); error de validación en create (no reintenta: 0 esperas, partial, failed 1, attempts 1); error transitorio (una espera de 1 s y se recupera); entrada inválida; version_mismatch como config issue. En cada test la base falsa asegura: ninguna escritura en las tres fuentes ni en soc2_event_types (lanzan y quedan como violaciones), ningún campo calculado, nunca más de 50 por llamada, nunca un campo no pedido y como máximo 30 selectRecords por corrida.
- Límite de tiempo de los scripts de automatización de Airtable (fuente oficial): https://support.airtable.com/docs/run-a-script-action (igual en https://support.airtable.com/articles/6328053615-airtable-automation-action-run-a-script). Dice: timeout del script 30 s, "temporalmente 120 segundos para observación y pruebas"; llamadas de la API de scripting con timeout de 12 s; 512 MB; 50 fetch y 30 selectRecords por corrida; hasta 15 mutaciones por segundo y 50 registros por mutación; output hasta 6 MB. El supuesto (30 s, escrituras hasta 22 s en cct) se mantiene: no es menor. WRITE_BUDGET_MS queda en 20000 (medido desde el inicio de la corrida, incluye las lecturas), más 3 s para confirmar lo ya escrito y 6 s para cerrar la fila: si el límite vuelve a 30 s, el peor caso queda en 26 s.
- Diferencias con el spec (correcciones locales):
  - Output: además de result, captured, existing, traced, skipped y failed se emite message (resumen en una línea). result puede ser locked.
  - §2.7 paso 1: solo se chequean las tablas fuente que usa esa corrida (record: la de tableId; hourly: las tres). Si el failure es por un campo de soc2_capture_runs, la fila de corrida se crea igual con los campos que existen.
  - Presupuesto: la fase de confirmación usa WRITE_BUDGET_MS + 3 s (CONFIRM_GRACE_MS) y el cierre de la fila hasta + 6 s (CLOSE_GRACE_MS). Sin esto, una corrida que agota el presupuesto dejaba lo ya escrito sin confirmed hasta la siguiente horaria.
  - Entrada inválida: mode distinto de record y hourly → failure sin escribir nada (no hay opción de select para registrarlo). En record con tableId que no es una fuente, o recordId vacío o inexistente → fila de corrida en failure con un error validation invalid_input o record_not_found (no hay un config issue con ese tipo en el módulo de evidencia).
  - trigger_table guarda "<tabla> (<tableId>)", por ejemplo loom_sync_runs (tblLnaOIEzNbIWp9S).
  - Si dos filas del catálogo o de soc2_events comparten clave: el existing prefiere la confirmada.
  - Verificado en Airtable (get_table_schema, solo lectura): soc2_capture_runs.mode = record, hourly; status = running, success, partial, failure, abandoned; soc2_event_types.status = enabled, trace, paused, disabled. Coinciden con lo que usa el script.
- Supuestos:
  - setTimeout existe en el entorno de scripts de Airtable (se usa para las esperas de reintento; no lo confirma la documentación consultada).
  - selectRecordsAsync acepta recordIds (relectura y modo record) y createRecordsAsync devuelve el arreglo de IDs creados; getCellValue devuelve los dateTime, createdTime y lastModifiedTime como ISO.
  - loom_sync_runs.trigger y ingestion_runs.run_by son texto; mode, status, source_type, run_status, promotion_status, event_type y source son single select (el script convierte cualquiera de los dos a texto).
  - El tamaño del dist (80 KB) no tiene un límite documentado en las páginas consultadas; cct-triage-compute se pega igual. Confirmar al pegar (WP-F).
- Bloqueos / decisiones para Andrés: ninguno.
- Propuestas (fuera de alcance): (1) Dos corridas record o una record y una hourly pueden crear la misma clave a la vez (condición de carrera entre el chequeo de existing y la escritura); la relectura no lo detecta. La horaria no lo repara. Si aparece en WP-G, agregar una pasada que marque duplicados por event_key, o un lock por registro. (2) Un createRecordsAsync que falle en el cliente después de haberse aplicado en el servidor se reintenta y podría duplicar; mismo remedio. (3) El lock no cubre a dos horarias que arrancan en el mismo segundo (ambas leen antes de que exista la fila de la otra); WP-E puede evaluar si importa. (4) El ac-tracker T8 todavía dice "airtable/soc2 (esqueleto con 4 tests)" en Evidencia; lo cierra WP-E.

## 2026-10-14 09:35 UTC-3 · WP-E · terminado · Opus
- Hecho: revisión adversarial de B, C y D (contract, registry, evidence, capture, build, tests, tables.md, sources.md y dist). Salida: stories/MapMigGon37539/review-soc2-capture.md. Sin cambios de código, sin escrituras en Airtable (solo get_table_schema), SS ni git.
- Conteo: 0 bloqueantes, 6 importantes (R1 a R6), 10 menores (R7 a R16).
- Veredicto: apto para WP-F (dry run). Ningún tipo pasa a enabled (G3) hasta corregir R1 a R5 y reflejar R6 en el plan de WP-G.
- Importantes:
  - R1: carrera record + hourly, y created + terminal de Loom; las dos filas quedan confirmadas y exportables. Remedio: ventana de asentamiento de 10 min en la horaria, ganador determinista por recorded_at antes de confirmar, reporte de duplicados y horaria en otro minuto que wflFoOYmzWHZEcHPA. Dueños: WP-C, WP-D y WP-F.
  - R2: la evidencia confirmada por reproceso queda con modified_after_capture = 1 (last_modified mira confirmed) y nunca se exporta. Remedio: last_modified sin confirmed. Dueño: sesión principal (esquema, con OK).
  - R3: paused → enabled hace backfill de 48 h, contra P01-AC8. Remedio: status_changed_at en el catálogo y skip before_enabled; GO_LIVE fuera del código. Dueños: WP-C y WP-D, más esquema.
  - R4: run_by (texto del Ingestion Agent, fila real) y la cola del trigger de Loom llegan a actor y trigger. Remedio: requested_by solo si es un identificador; topes. Dueño: WP-B.
  - R5: setTimeout no verificado; si falta, los reintentos fallan y closeRun deja la corrida en running. Remedio: sleep con respaldo, closeRun que no lance, "timers" en el output. Dueño: WP-D.
  - R6: escenarios sin verificación posible en WP-G (E1 con tabla de prueba, trace de la horaria truncado, export_ok, duración). Dueño: sesión principal.
- Archivos: review-soc2-capture.md (nuevo). ac-tracker.md: S1 y P01-AC8 bajan a 🟡 Estructura (evidencia que no cubre; ver su Log) y se ajusta el Resumen.
- Verificación: en una copia fuera del repo ($HOME/wpe/repo), node --test de los 4 archivos → 142 pass, 0 fail; el build de la copia es igual al dist salvo la fecha. IDs: 0 diferencias con tables.md y context §2; get_table_schema confirma los 92 campos y sus opciones. En el dist solo se escribe en soc2_events y soc2_capture_runs. event_key estable con TZ=UTC y America/Montevideo, con y sin milisegundos.
- Supuestos: la existencia de setTimeout en automatizaciones y el límite de tamaño del script siguen sin verificar (se confirman en WP-F).
- Bloqueos / decisiones para Andrés: OK para el cambio de soc2_events.last_modified (R2) y para el campo soc2_event_types.status_changed_at (R3). Si quedaran dos filas confirmadas con la misma clave, decidir si se desmarca confirmed en la perdedora (R1).
- Propuestas (fuera de alcance): opción --compact del build (R8); corregir el texto Data & Integration de la v2 de P01 sobre dry runs (R15).

## 2026-10-14 · R2 y R3 aplicados en Airtable · Opus (sesión principal)
- Andrés aprobó R2 y R3 ("ok"). Creados soc2_events.content_modified_at (fldSCTYqCokJxZRwO) y soc2_event_types.status_changed_at (fldtgWq8objFMGzAH); modified_after_capture usa content_modified_at. Action ids en schema/CHANGELOG.md.
- Siguiente: WP-R (correcciones R1, R3 en código, R4, R5 y menores de review-soc2-capture.md), Opus. Luego R6 en el spec (sesión principal) y WP-F.

## 2026-10-14 09:54 UTC-3 · WP-R · terminado · Opus
- Hecho: correcciones de review-soc2-capture.md aprobadas por Andrés (R1, R3, R4, R5, R7 y menores de código R8, R9, R11, R12, R14, parte de R15 y R16 documentado). R2 ya estaba resuelto en esquema; sin cambio de código. Esquema del repo regenerado desde la API (solo lectura).
- Archivos: airtable/soc2/soc2-evidence-contract.ts (0.3, 168 líneas), soc2-registry.ts (544), soc2-evidence.ts (0.2, 1039), automations/soc2-capture.ts (1.1.0, 763), tools/soc2-build.ts (168, --compact y cabecera), tests/soc2-registry.test.ts (650), tests/soc2-evidence.test.ts (981), tests/soc2-capture.smoke.test.ts (819), automations/README.md, schema/soc2-schema.json, schema/tables.md, schema/design.md (§3 y §4), schema/CHANGELOG.md (línea Repo), ac-tracker.md, review-soc2-capture.md (§6 de estado). Sin escrituras en Airtable, SS ni mensajes; sin git.
- Correcciones → cambio → test:

| R | Cambio | Test |
|---|---|---|
| R1 | Horaria con SETTLE_MINUTES = 10. pickWinner puro (recorded_at más antiguo, empate → record id menor). existingFromRows: mapa existing con la ganadora (la clave cuenta como confirmada si cualquiera de sus filas lo está) y lista de claves con más de una fila. Antes de confirmar, relectura de event_key + recorded_at + confirmed y resolveConfirmations: solo se confirma la ganadora y nunca si otra fila de la clave ya está confirmada; las demás quedan sin confirmed, en errors con kind duplicate, y la corrida queda partial. La horaria reporta en errors todo grupo con más de una fila. CaptureErrorKind suma duplicate | evidence: R1 pickWinner…; R1 existingFromRows…; R1 resolveConfirmations…; R1 F7 a run with duplicates is partial. smoke: R1 two interleaved runs (record + hourly) over the same row: one confirmed row and one duplicate error (la horaria siguiente reporta el grupo y no confirma nada); R1.1 hourly leaves rows newer than SETTLE_MINUTES to the record trigger |
| R3 | SOC2_IDS.eventTypes.status_changed_at (fldtgWq8objFMGzAH), en checkFieldIds y en la lectura del catálogo. checkConfig devuelve enabledSince por código. planCapture: un borrador nuevo de un tipo enabled con producedAt < enabledSince → skip before_enabled (también en dry run; una clave ya guardada no se ve afectada). enabledSince null = sin restricción. GO_LIVE eliminado; ctx.goLive = null; D1 se cumple con status_changed_at (cabeceras del contrato, del módulo y de la entrada). La regla is_test por goLive sigue en el registro, sin uso | evidence: R3 checkConfig: enabledSince…; R3 P01-AC8 paused → enabled does not backfill…; R3 trace → enabled does not backfill the 48 h already traced…; R3 enabledSince null…; R3 a key already stored unconfirmed is still confirmed after a re-enable. smoke: R3 P01-AC8 the catalog status_changed_at stops the backfill |
| R4 | isRequesterId (id de Slack /^U[A-Z0-9]{6,}$/ o nombre ≤ 40 con letras, espacios, . - _). Loom: solo el primer token tras slack:#ingestion. normalizeTrigger: "slack:#ingestion <id>", "slack:#ingestion" o el primer token, tope 100. Contrato: ACTOR_MAX 100 y TRIGGER_MAX 100; validateDraft los controla | registry: S1 R4 P01-AC4 ingestion actor: free-text run_by (real row recOPCUimHKLtCgPm) gives no requested_by (reemplaza al test del corte a 80); S1 R4 Loom trigger with extra text…; S1 R4 isRequesterId…; P01-AC1 actor (fila real recQkszd15sN3nZeb → requested_by:Andres). evidence: S1 R4 validateDraft: actor over ACTOR_MAX or trigger over TRIGGER_MAX… |
| R5 | busyWait (espera activa sobre el reloj, tope WRITE_BUDGET_MS + CLOSE_GRACE_MS) cuando typeof setTimeout !== 'function'; closeRun con try/catch, nunca lanza; message termina en "queries <n> · timers: yes|no" | smoke: R5 closeRun never throws…; R5 busyWait spins on the clock for ms, capped; R5 built file without setTimeout: a transient error is retried with a bounded spin wait and the message says timers: no |
| R7 | writeInBatches acepta reconcile(batch): antes de reintentar una llamada que falló con transient o unknown; la entrada relee event_key (si quedan 3 consultas y hay tiempo) y saca del lote las claves ya guardadas, que van a relectura y confirmación (con la regla de R1) | evidence: R7 writeInBatches: before retrying a create after transient/unknown, reconcile drops the items already stored. smoke: R7 a create applied on the server but failed in the client is not created again |
| R8 | soc2-build.ts --compact → dist/automations/soc2-capture.compact.js (sin comentarios, con la cabecera de hashes) | build: node --check OK |
| R9 | Todas las selectRecords pasan por select() con contador (MAX_QUERIES = 30; al tope lanza un error que no se reintenta). Antes de cada tanda de relectura: deadline + 3 s y 2 consultas libres; si no, lo que falta queda not started. acquireLock marca abandoned también las record en running de más de 30 min, sin que bloqueen | smoke: R9 hourly marks stale record runs abandoned…; record live: 5 consultas; todos los tests ≤ 30 (assertNoProtectedWrites) |
| R11 | Cabecera y automations/README.md: "no" sin distinguir mayúsculas ni espacios; sin mode no hay fila de corrida; checklist de WP-F con variables, minuto de la horaria (R1.4), "dry run" y "timers" en el message | — (documentación) |
| R12 | toIso devuelve null para fecha-hora sin Z ni desplazamiento | registry: T2 R12 toIso rejects a date-time string without Z or offset… |
| R14 | summary de priority_events solo si calza con TEMPLATE_SUMMARY (/^[\w .·:()#\[\]\/-]{1,120}$/); si no, "<event_type> · <status>" | registry: S1 R14 priority_events summary is copied only when it looks like a template… (reemplaza al del corte a 250) |
| R15 | Cabecera de soc2-build.ts (copia de cct-build); ac-tracker F4, F5 y T8 | — |
| R16 | Riesgo aceptado anotado en la cabecera de soc2-capture.ts | — |

- Versiones: contrato 0.3, módulo de evidencia 0.2, SCRIPT_VERSION 1.1.0, registro con una línea nueva en Versions. Las reglas del registro siguen en version 1 (y el catálogo no cambia): R4 cambia actor y trigger, R14 el summary y R12 solo fechas sin zona que Airtable no devuelve; ninguno cambia qué se detecta ni la event_key. Decisión documentada en la cabecera del registro.
- Consultas selectRecords por corrida (documentado en la cabecera de soc2-capture.ts y en automations/README.md): record 5 si confirma algo (catálogo, fila fuente, claves de soc2_events, relectura, relectura de claves), 3 si no; hourly 7 + ceil(n/50) (8 hasta 50 eventos a confirmar, 6 si no hay nada); +1 por cada reintento de create con reconcile. Tope 30 con contador.
- Verificación (raíz del repo, node v22.23.2):
  - npm run soc2:test → tests 165, pass 165, fail 0 (contract 7, registry 68, evidence 68, capture.smoke 22).
  - npx tsc --noEmit -p tsconfig.node.json → exit 0, sin errores.
  - node airtable/soc2/tools/soc2-build.ts --compact → soc2-capture.js 98.245 caracteres, 104.330 bytes, 1.993 líneas; soc2-capture.compact.js 60.209 caracteres, 60.310 bytes, 1.490 líneas. node --check de los dos → OK. Líneas import/export → 0 en los dos. Sin fetch, process.env ni require.
  - Esquema: list_tables_for_base y get_table_schema (solo lectura) de las 4 tablas soc2_ → soc2-schema.json igual a la API (hash de tablas idéntico; 11, 24, 21 y 29 campos); tables.md regenerado con el generador que reproduce byte a byte el tables.md anterior desde el JSON anterior.
- Diferencias con lo pedido (decisiones locales):
  - before_enabled se aplica también en dry run (el dry run muestra lo que haría la corrida real) y no se aplica a una clave ya guardada: si existe sin confirmar, se confirma igual (se escribió con el tipo en enabled).
  - En el mapa existing, una clave con cualquier fila confirmada cuenta como capturada; resolveConfirmations no confirma a la ganadora si otra fila ya está confirmada (evita dos confirmadas). La relectura previa a confirmar trae también confirmed (mismo query).
  - Los duplicados no suman a failed: van a errors (kind duplicate) y ponen la corrida en partial; el message dice "duplicates n".
  - Con R4, la fila real recQkszd15sN3nZeb ("slack:#ingestion Andres Serron Ifran") queda como requested_by:Andres y trigger "slack:#ingestion Andres". Un trigger que no es de Slack se guarda como su primer token.
  - El dist completo creció de 80.227 a 104.330 bytes (comentarios de las correcciones); el compacto queda en 60.310.
- Supuestos: setTimeout sigue sin confirmar en el runtime (el message de WP-F lo dirá); la espera activa de busyWait no bloquea las llamadas de Airtable porque cada una se espera con await antes de esperar.
- Menores pendientes:
  - R6: plan de WP-G (E1, trace contra corridas record, export_ok, duración, prueba de R2). No es código; sesión principal.
  - R10: requiere decisión (formato de skip_reasons con filas o texto de AC9).
  - R13: decisión de la sesión principal sobre la clave de abandoned sin finished_at; supuesto documentado en la cabecera del registro.
  - R15: texto Data & Integration de MapKMigGon39261-final.md (sesión principal, antes de publicar la v2) y nota de ai_output_state malformed en el spec (WP-I).
  - R16: sumarlo a los riesgos de execution-spec.md §5 (sesión principal).
  - Verificaciones que quedan en WP-F: tamaño aceptado al pegar (R8), "timers" (R5), minuto de la horaria (R1.4). En WP-G: reproceso exportable (R2).
- Bloqueos / decisiones para Andrés: ninguno nuevo. Si alguna vez quedan dos filas confirmadas con la misma clave, decidir si se desmarca la perdedora (R1).
- Propuestas (fuera de alcance): design.md §5 todavía lista la fecha de go-live como pendiente de diseño (ya decidida, D1, e implementada con status_changed_at). Zona GMT/ISO de content_modified_at y status_changed_at sigue pendiente en la UI.

## 2026-10-14 · cierre de pendientes de WP-R · Opus (sesión principal)
- Verificado: npm run soc2:test 165 pass, 0 fail; dist completo 104.330 bytes y compacto 60.310.
- R6: WP-G reescrito en el spec (trace contra corridas record, E1 por tests, export_ok, R2, sin backfill, duración, timers y versión pegada).
- R10: se acepta; AC9 se verifica con corridas record; anotado como riesgo en §5. R13: supuesto documentado en §5 (y en la guía de QA en WP-I). R16: riesgo aceptado en §5.
- R15: corregido el texto Data & Integration de MapKMigGon39261-final.md (before_enabled, is_test, dry_run). Queda la nota de ai_output_state malformed para WP-I.
- Spec v1.1: nota al inicio sobre lo que cambió tras WP-E y WP-R.
- Siguiente: WP-F (automatizaciones en dry run, G2 aprobado).

## 2026-10-14 10:46 · WP-F · terminado · Haiku
- Creadas 5 automatizaciones en base appcdpGNTo0DouoqJ con el guion exacto de wp-f-payloads.json (script placeholder, dryRun = yes):
  - soc2 · capture · loom_sync_runs created → wfl6Ez5hcTAZK1tJ4 → https://airtable.com/appcdpGNTo0DouoqJ/wfl6Ez5hcTAZK1tJ4
  - soc2 · capture · loom_sync_runs terminal → wflZgQpJOsXvS2kX0 → https://airtable.com/appcdpGNTo0DouoqJ/wflZgQpJOsXvS2kX0
  - soc2 · capture · ingestion_runs → wflxzvnL8sihON0xJ → https://airtable.com/appcdpGNTo0DouoqJ/wflxzvnL8sihON0xJ
  - soc2 · capture · priority_events → wflgEKAqXntuIcP86 → https://airtable.com/appcdpGNTo0DouoqJ/wflgEKAqXntuIcP86
  - soc2 · capture · hourly → wfljbXBCh5G78ZA3A → https://airtable.com/appcdpGNTo0DouoqJ/wfljbXBCh5G78ZA3A
- Verificación (get_automation, 5 de 5): trigger correcto (recordCreated, recordMatchesConditions x3, cron hourly); nodo customScript con inputObj mode/tableId/recordId/dryRun = yes; deploymentStatus = undeployed (apagadas); configurationStatus = valid. Sí verificado.
- Los create no devolvieron actionId; se anota el key del nodo customScript que devuelve get_automation.
- Errores: ninguno en create ni en get. Un primer intento falló por validación de esquema (parámetro extra), no llegó a Airtable y no creó nada.
- Pendiente: pegar dist/automations/soc2-capture.js en las 5 (paso Run a script), probar y encender (Andrés).

## 2026-10-14 11:19 UTC-3 · WP-I (parte 1) · terminado · Sonnet
- Hecho: spec.md (lo construido: tablas con IDs, fórmulas, 9 eventos, flujo de una corrida, automatizaciones wfl y su estado, límites, versiones de código, decisiones, diferencias con execution-spec.md §2 y con los textos v2, y lo que falta) y qa-guide.md (preparación, un caso por escenario de P01 v2 y de P02 v2, casos transversales, riesgos aceptados R10, R13 y R16 en lenguaje simple). Escrito en español, solo lectura en Airtable (list_views_for_table de soc2_events y soc2_capture_runs; list_records_for_table de soc2_event_types). Sin escrituras en Airtable, SS ni mensajes; sin git.
- Archivos: stories/MapMigGon37539/spec.md (396 líneas), qa-guide.md (505 líneas), ac-tracker.md (nota en P02-DOC y línea en el Log, sin cambio de estado), este log.
- Casos de QA: P01 19 (15 escenarios v2: AC1 a AC9 y E1 a E6, más 4 transversales: DI3, SEC1, SEC2, PERF); P02 11 (AC1 a AC7 y E1 a E4, todos pendientes de WP-H y de la compuerta CSV). Por verificación: UI directa AC1, AC2 (success), AC6 (triage ok), AC7, AC9 (extension y dry run), E2, SEC1, PERF; UI + Andrés AC8, E6 y los de P02 que cambian mapeo (AC3, AC4, E1, E2); solo TEST (sin datos reales) AC3, AC4, AC5, E1, E3, E4, E5 de P01 y parte de AC2 (partial, fallbacks), AC6 (error, lanes) y AC9 (rejected_busy).
- Verificación: todos los IDs y valores salen de schema/tables.md, design.md, sources.md, CHANGELOG.md, automations/README.md, cabeceras de los .ts, wp-f-payloads.json y este log. Los nombres de tests citados en la guía se extrajeron con grep de los archivos de tests (165 tests por el log de WP-R; no se volvieron a correr). Lectura en Airtable del 2026-10-14: soc2_events y soc2_capture_runs solo tienen "Grid view" (las vistas de views-checklist.md no existen); los 9 tipos siguen en trace (ingestion.run.init en disabled), version 1.
- Supuestos:
  - Nombres de páginas de la P02 (Evidence by control, Unmapped evidence, Capture operations) tomados de data-implementation-plan.md §6; todavía no existen.
  - El nombre del CSV descargado puede no ser soc2_<control>_<período>.csv; no está verificado (depende de la compuerta). Lo dice la guía y el spec.
  - "trigger vacío" en las evidencias de automatizaciones (P02-E3): el spec solo fija trigger null para ingestion; la guía pide verificarlo en la fila.
  - En P01-AC8 la guía usa automation.triage_compute.completed (una fila por hora, en el minuto 10) para probar paused y sin backfill; la elección del tipo y de la hora es de Andrés.
- Huecos e inconsistencias encontrados:
  - status_changed_at: los 9 tipos muestran 2026-10-14T11:05:44Z (hora de la carga inicial), no vacío como dice design.md §3. Sin efecto en el comportamiento (el primer paso a enabled lo actualiza). design.md no se tocó.
  - design.md §5 todavía lista la fecha de go-live como pendiente de diseño (ya decidida, D1, e implementada con status_changed_at). Ya anotado en WP-R.
  - integrity_hash: no lo escribe el script (ninguna referencia en soc2-evidence.ts). El campo queda vacío; documentado en spec.md §3.3 como supuesto.
  - Con before_enabled, las 2 filas reales de ingestion (19 de agosto), las 6 de Loom (7 al 12 de octubre) y las guard_fix y dedupe existentes nunca generan evidencia: toda la evidencia real empieza después de G3. Casi toda la verificación de P01-AC4, AC5, E3 a E5 queda en tests. Decisión para Andrés: si se quiere evidencia real de ingestion para QA, hace falta que el agente procese un archivo real después del paso a enabled.
  - P01-AC9 con la horaria: solo cuenta motivos (R10); la guía lo explica y manda a las corridas record.
  - Diferencias de texto v2 listadas en spec.md §10.2 (ruta del script, vínculo al origen, nombre del CSV, hora de abandoned, comparación de version) para decidir si se corrige la v2 antes de publicar.
- Bloqueos / decisiones para Andrés: ninguno para esta parte. Para la parte 2 hacen falta WP-G y WP-H, y las vistas, GMT/ISO y la compuerta CSV (tareas de Andrés).
- Propuestas (fuera de alcance): corregir design.md §3 y §5; decidir si P01-AC4 necesita una corrida real de ingestion antes del cierre; confirmar con Max la designación de editores (D3) para el apartado de permisos de la guía.
