# MapKMigGon38571 — Evidence by acceptance criterion

Story: Triage lanes by domain, owner and source (Work · Queue). Version 1.0 · 2026-10-13. Criteria IDs come from `acceptance-criteria-stack.md` (F = functional, T = technical, D = data, E = edge cases, S = non-functional).

## How to read this document

- **Unit** = automated tests, `npm run cct:test`: 64 pass (rules 13, sync 10, compute smoke 4, contract 37). Test IDs U1–U10 are the groups in `spec.md` section 9.
- **A1–A5** = automation tests in Airtable. Run: A1 dry run (837 to create, 0 errors), A2 live load and repeated runs (837 created on the first live run; the third run wrote 0 changes), A5 one triage row per task (838 rows). Not run live: A3 (threshold change) and A4 (inactive config); both are covered by unit test U6 and the config validation tests.
- **T1–T20** = tests in the QA evidence report `MapKMigGon38571-work-queue-qa-report-v7.pdf` (screenshots, steps, record IDs). T1–T6 first published version and designer preview, T7–T13 published page, T14–T19 Claude in Chrome, T20 required fields.
- **Gap** = what the evidence does not show. Every gap is listed again in section 3.
- Record IDs are in Airtable base Map King Hub (`appcdpGNTo0DouoqJ`). Test events are in `priority_events`; test tasks are `TEST - QA 38571 · …` (source Manual, "SAFE TO DELETE").

## 1. Evidence table

### Functional

| AC | Criterion | Implemented in | Evidence | Gap |
|---|---|---|---|---|
| F1 | Filter by domain, owner, source; every task has a lane | Contract 5.1, 5.2; rules 4.2 | Unit U2, U7, U8. T1 (lane counts All 146, On Fire 2, This Week 38, Waiting On 4, Queued 68, Icebox 35), T2 (domain Sales), T13 (combined filters) | — |
| F2 | Five lane values | `task_lanes.lane`, `lane_suggested` | T1 (all five tabs with counts); schema choices on_fire, this_week, waiting_on, queued, icebox | — |
| F3 | Combined filters across sources | Contract 5.2 | Unit U8. T13, T14 (Source Google Calendar: 14 tasks; Source Airtable: 10 tasks). QA report 2026-09-18 confirmed two 3-way combinations on the earlier build | — |
| F4 | Unified triage data | `command_center_tasks` + `command_center_triages` + `task_lanes` | Unit U7. A5 (838 triage rows). T1, T19 (page reads, writes only `task_lanes` and `priority_events`) | — |
| F5 | Configurable stale | Rules 4.3, `cct_triage_configs` | Unit U3, U6 (output follows config). Stale badges with limits 2 and 7 in T14 | A3 (live threshold change) not run |
| F6 | Delegation eligibility | Rules 4.4, `team_members` | Unit U4. T3 (DELEGABLE badge), T12 (delegation written) | — |
| F7 | Only matching tasks | Contract 5.2 | Unit U8. T2, T13, T14 | — |
| F8 | Stale badge with reason | Page + `stale_state`, `stale_reason` | Unit U3. T14: "Stale · Overdue 71 days (limit 2)", "Stale · 66 days without activity (limit 7)"; Google Calendar tasks show no badge | — |
| F9 | Delegate prompt writes `delegated_to` and logs | Page, `triage_action` | Unit U4. T12: tag "DELEGATED · QA-DELEGATE-TEST", `task_lanes.delegated_to` written, event `delegate · manual:qa-38571-push → QA-delegate-test` (recJCX90fC37PQjCf) | Roster empty (D3): the suggested-person path is covered by unit tests only |
| F10 | Lane kept per user and identity; Loom re-sync never changes a manual lane | `task_lanes` (page only), 5.1 | Unit U7. T4 (move creates a row), T5 (move updates the row), T11 (Waiting On, event recEmOPi8ceYRKTUx). Loom does not write `task_lanes` | — |

### Technical

| AC | Criterion | Implemented in | Evidence | Gap |
|---|---|---|---|---|
| T1 | Ingestion into a common contract | Loom (MigGon38532, MigGon38568) | QA report 2026-09-18: 71 rows, zero identity collisions; by reference | Not this story's scope |
| T2 | Field validation before use | Page and script required-field checks | T20: message names each missing field as `table.field (id)`; list not rendered. T5, T6 (alerts naming a missing field in run 1, fixed). Unit: validation tests in rules and compute smoke | — |
| T3 | AI values separated from source values | Provenance in 5.1 | Unit U7. T1: tags such as "AI · REVENUE" shown as AI values | — |
| T4 | AI never overwrites source data | Decisions only in `task_lanes` | T19: `command_center_tasks` and `command_center_triages` unchanged after all actions | — |
| T5 | Stable contract | `schema.md`, `TriageRow`, `Filters` | Unit U7, U8; `npm run typecheck:dist` clean | — |
| T6 | Filter validation | `validateFilters` | Unit U8 (unknown values dropped and listed) | Not run live from a URL |
| T7 | Logging | `priority_events` | T8–T12, T17, T18, T19: one event per action (Done recBgUjVCvmJBWAK1, Drop recmW29zvmIdQ0HPB, +7d recvMSW9ZZQNIB9ln, move recEmOPi8ceYRKTUx, delegate recJCX90fC37PQjCf, bulk retag recmxVGrXskD5vYCr, reassign recpJU43T0deYS8EY, push recaBdvtpYZpyLykG and recwPJ22KxvDJRqDI). Automation writes `triage_compute` | — |
| T8 | Retries on transient failures | Loom (38532); script retries a failed batch once, then record by record | Unit U10, compute smoke | No live failure injected |
| T9 | Deterministic stale | Rules 4.3 | Unit U3, U6 (same input twice gives the same output). A2 (third run 0 writes) | — |

### Data

| AC | Criterion | Implemented in | Evidence | Gap |
|---|---|---|---|---|
| D1 | Minimum row fields | `TriageRow` | Unit U7. T3 (detail panel shows tags, date, owner, lane and basis, stale reason) | — |
| D2 | Traceability to source values | `lane_rule`, `owner_canonical` + raw owner, provenance | Unit U2, U7. T3 (lane "you placed it" vs rule; raw owner visible) | — |
| D3 | Missing values handled | `__none__`, `unknown`, `empty` | Unit U1, U3, U8. T13 ("No domain" and "Unassigned" pills) | Live open task with an empty last-activity date not yet shown on the page; procedure in `qa-guide.md` section 1 |
| D4 | Airtable retrieval | Loom (38532) | By reference | Not this story's scope |
| D5 | Minimal AI context | N/A: no AI in this story | — | — |
| D6 | No duplicates across sources | Rules 4.5 | Unit U5. T15: POSSIBLE DUPLICATE on Coastal Realty Group follow-up and approval (recKmr30ByGn1Yalu, recU0XKx6zggVWPVm); AMBIGUOUS MATCH on the INDYCAR invoice and approvals; both rows stay visible | — |
| D7 | Complete vs partial result | Contract 5.3 | Unit U9. T7: banner "3 open tasks have no triage yet" (triage pending); the banner disappeared after the automation ran | Loom partial / unavailable source not simulated |
| D8 | Source-of-record consistency | One writer per table (`schema.md`) | T19: the page wrote only to `task_lanes` and `priority_events` | — |

### Edge cases

| AC | Criterion | Implemented in | Evidence | Gap |
|---|---|---|---|---|
| E1 | Missing filter attributes | `__none__` | Unit U8. T13 | — |
| E2 | Malformed records | Rules validation, sync | Unit (`validateTask`, U10); compute smoke on a simulated base | — |
| E3 | Renamed or missing fields | Field IDs, required-field check | T20; T5 and T6 (run 1 alerts "No field with ID …") | — |
| E4 | AI failure | N/A (Loom fallback) | — | — |
| E5 | Stale without activity → unknown | Rules 4.3 | Unit U3: `lastUpdatedAt` null or invalid → `unknown`, "No activity date", never `stale` | Live open case not yet shown (QA guide section 1) |
| E6 | Ambiguous duplicates | Rules 4.5 | Unit U5. T15: AMBIGUOUS MATCH on INDYCAR (recY3xV52Q9UOg2vn, recVOxqQayJaOKi7L, recs3eqgxmfMKuome) | — |
| E7 | Invalid filter | `validateFilters` | Unit U8 | Not run live from a URL |
| E8 | Empty result | Contract 5.2 | T13: "Nothing matches these filters", all counts 0, no error | — |

### Non-functional

| AC | Criterion | Implemented in | Evidence | Gap |
|---|---|---|---|---|
| S1 | Access control | Airtable permissions; `task_lanes` per user | Run 3: with the User actions OFF, writes were refused ("No permission to update task_lanes"); back ON, writes work (event recwPJ22KxvDJRqDI) | — |
| S2 | AI data minimization | N/A | — | — |
| S3 | Credentials | None in code | Code review: no secrets in scripts or extension | — |
| S4 | Latency | In-memory computation | Page loads with 146 open tasks in the first screenshot (T1); no timing measured | No latency measurement |
| S5 | Avoid repeated reads and writes | Writes only differences, batches of 50 | A2: third run 0 writes. Unit U10 | — |
| S6 | Logs without task content | IDs, counts, rules | T19: event summaries hold task IDs and short reasons, no titles or descriptions | — |

## 2. Summary

| Group | Criteria | Met | N/A | Met with a gap |
|---|---|---|---|---|
| Functional | 10 | 10 | 0 | 2 (F5, F9) |
| Technical | 9 | 9 | 0 | 2 (T6, T8); T1 by reference |
| Data | 8 | 7 | 1 (D5) | 2 (D3, D7); D4 by reference |
| Edge cases | 8 | 7 | 1 (E4) | 2 (E5, E7) |
| Non-functional | 6 | 5 | 1 (S2) | 1 (S4) |
| **Total** | **41** | **38** | **3** | **9** |

Result: all 38 applicable criteria are met; the 9 gaps are listed below and none blocks QA.

## 3. Gaps and how to close them

| Gap | Criteria | How to close |
|---|---|---|
| Live open task with an empty last-activity date | D3, E5 | `qa-guide.md` section 1: create a Manual task without `last_updated_at`, run the automation, check `stale_state` = `unknown` and no Stale badge |
| Threshold change recomputes stale | F5 | A3: set `stale_inactive_days` 7 → 3, run, check the count and the reason limit, restore 7 |
| Loom partial run or unavailable source | D7 | Wait for a real partial run, or test in a copy of the data |
| Filters from a URL | T6, E7 | Open the page with an invalid filter in the URL and check the dropped value and the `triage_filter_invalid` event |
| Delegation with a suggested person | F9 | Fill the roster in `team_members` (D3 with Max), then repeat T12 |
| Retry on a failed write | T8 | No live failure injected; unit tests only |
| Latency | S4 | Time the page load; not an acceptance blocker |
| A4 inactive config | — | Deactivate the config row, run, check that nothing is written, reactivate |

## 4. Reproduction

Everything above can be reproduced with `qa-guide.md` (prompts for QA's Claude, expected results, verification queries and cleanup). The screenshots are in `MapKMigGon38571-work-queue-qa-report-v7.pdf`.
