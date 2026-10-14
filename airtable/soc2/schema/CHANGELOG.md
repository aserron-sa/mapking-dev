# SOC 2 Evidence · cambios en Map King Hub

Una línea por acción, solo se agrega. Formato: fecha · origen (API o UI) · quién · tabla · acción · action id. Los action id de la API sirven para revertir la acción.

## 2026-10-14 · fase 1 (tablas nuevas) · OK de Andrés en el chat

- API · Claude · soc2_controls (tblMOPSnkhTsQcANX) · tabla creada con control_code, name, description, category, scrut_task, recurrence, active · (create_table no devuelve action id)
- API · Claude · soc2_controls · campo active_code (fórmula) · actHYrcjcieF9jWWb
- API · Claude · soc2_controls · campo last_modified · actqKyclXQp4bvMyd
- API · Claude · soc2_controls · campo last_modified_by · acts5V5TvvHOXRsLI
- API · Claude · soc2_event_types (tbl2PJOE4M4JdcCL7) · tabla creada con event_code, name, description, source, source_table, source_workflow, detection, detection_config, outcome, category, tsc_refs, qualifies, qualification_notes, status, version, mapping_provisional, owner, doc_url · (sin action id)
- API · Claude · soc2_event_types · campo controls (link a soc2_controls) · actP77fFi6syMWp60
- API · Claude · soc2_event_types · campo last_modified · act1JCI1S65ciBsII
- API · Claude · soc2_event_types · campo last_modified_by · act08Dk3HA1xbpvce
- API · Claude · soc2_event_types · campo active_control_codes (lookup) · actWFFW3DIr5mnPAK
- API · Claude · soc2_capture_runs (tblpmfB65pfWCnu2k) · tabla creada con run_id, mode, trigger_table, trigger_record_id, status, dry_run, started_at, finished_at, evaluated, captured, existing, skipped, traced, failed, skip_reasons, trace, errors, config_issues, script_version · (sin action id)
- API · Claude · soc2_capture_runs · campo created · acttGzSNigYun9C1z
- API · Claude · soc2_events (tblBlVgex266Mqhea) · tabla creada con event_key, source_table, source_record_id, source_url, run_ref, produced_at, source_recorded_at, actor, trigger, outcome, summary, details, ai_output_state, confirmed, is_test, integrity_hash · (sin action id)
- API · Claude · soc2_events · campo event_type (link a soc2_event_types) · actWKxMnSzNOBPNyA
- API · Claude · soc2_events · campo capture_run (link a soc2_capture_runs) · acthTm1CTbolIR5Uh
- API · Claude · soc2_events · campo recorded_at (creación) · actqDjscAvzmXUbqa
- API · Claude · soc2_events · campo last_modified · actO9WGtztYJMSJq0
- API · Claude · soc2_events · lookup event_code · act6GzMMfW8AtYYLW
- API · Claude · soc2_events · lookup event_name · actf99YLJSDoA2oqo
- API · Claude · soc2_events · lookup category · actVamvt9zVgTOnXp
- API · Claude · soc2_events · lookup control_codes · actr0PLrZTjVYQUIz
- API · Claude · soc2_events · lookup mapping_provisional · actd8ovwv4mzibilg
- API · Claude · soc2_events · fórmula modified_after_capture · actZazIHHqvZ31Tgh
- API · Claude · soc2_events · lookup event_status · actrvK5YOomsC3ue1
- API · Claude · soc2_events · fórmula export_ok · actgb7J286q0xcAXw
- API · Claude · soc2_controls · link inverso renombrado a event_types, con descripción · actUETecKgjyXH0ga
- API · Claude · soc2_event_types · link inverso renombrado a events, con descripción · actK2pXlbm3zpg3lA
- API · Claude · soc2_capture_runs · link inverso renombrado a events, con descripción · act01Ua6XpUIUdmgI
- Repo · Claude · snapshot soc2-schema.json (sha256 199eb3e9…a16514) y tables.md generados

## 2026-10-14 · fases 2 y 3 · OK de Andrés ("sigues con el plan") · ejecutado por subagente Haiku con guion exacto, verificado por la sesión principal

- API · Claude (Haiku) · loom_sync_runs (tblLnaOIEzNbIWp9S) · campo last_modified (fldn0Hiwc8Y0fPra1), última modificación de status y finished_at · act3JauPZckuCkx6f
- API · Claude (Haiku) · ingestion_runs (tbl2EiVoOt6fEAId6) · campo last_modified (fldLk5V39UiQJ7lQK), última modificación de run_status y run_at · act5XZJH5urFQ6dNd
- API · Claude (Haiku) · soc2_controls · 3 registros desde seed-v1.json: CC7.2 recFOmHXWPph9OLiS, CC7.3 recKM73zlfQlUfMzh, PI1.2 rec3cGO5NVvGQXlcs · actDe466wgBCMOiJt
- API · Claude (Haiku) · soc2_event_types · 9 registros desde seed-v1.json (8 trace, ingestion.run.init disabled, version 1, mapeo provisional): loom.sync.init recsr687ISTW4GT9H, loom.sync.completed recrlT444KkcV6p3P, loom.sync.error recQ8Vgt0huznRmBs, ingestion.run.init recisCrZadLPD4yNF, ingestion.run.completed rec12dqHIuT894GGr, ingestion.run.error recEHl446wV1NIUeu, automation.triage_compute.completed recifFeQ6Ig3wbaU4, automation.triage_compute.error rectXEK7ikngitVnF, automation.lanes_integrity.fixed recLwVhEBRNZ8ZTqs · actH03UsL1YseHFAz
- Verificación (sesión principal): 9 tipos, status correctos, cada uno con al menos un control activo en active_control_codes; los dos campos nuevos referencian los campos correctos.
- Pendiente UI: los dos campos last_modified nuevos también quedaron con zona horaria del navegador; pasarlos a GMT/ISO.
