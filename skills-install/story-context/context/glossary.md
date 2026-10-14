---
id: glossary
type: glossary
title: Glossary and banned words
summary: Terms used across Map King stories and the words to replace with real components.
updated: 2026-10-14
---

## Terms

- Map King Hub: the Airtable base (appcdpGNTo0DouoqJ). "Backend" in old story text means this plus the Hyperagent agents.
- Loom: Hyperagent agent that syncs work sources into the Hub. Runs each morning and on demand (panel or Slack), not hourly. Writes loom_sync_runs.
- Ingestion Agent: Hyperagent agent triggered from Slack that ingests content into the Hub.
- Run log: one row per finished run (loom_sync_runs for Loom, activity_runs for the others).
- Evidence record: one row in the evidence table per qualifying run or approval, created once and traceable to its source row.
- Source type: approval, loom, ingestion, automation, ticket_review.
- Confirmed: evidence marked confirmed by the evidence module after it re-read the stored record.
- Provisional: a control assignment proposed by Singular and not yet confirmed by Max or Scrut.
- Terminal status: success, partial, failure, abandoned (a run that is no longer running).
- Part naming: P01, P02 (two digits) for derived stories of one source story.

## Replace these words

| Old word | Say instead |
|---|---|
| backend, service, server | Airtable table, automation, interface, or the named Hyperagent agent |
| API, endpoint | the named connector, or "Airtable automation" |
| database | Airtable base / table |
| Node.js, TypeScript (in a story that is Airtable only) | remove; scripts are written in TypeScript under airtable/cct/ and built to paste-ready automation scripts only when the story says so |
