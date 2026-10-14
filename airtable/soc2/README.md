# airtable/soc2 — SOC 2 evidence capture

Stories: **MapMigGon37539** (base: approvals, evidence module, retries, reprocessing) · **MapKMigGon39261** (P01: Loom, Ingestion, automation events, ticket reviews) · **MapKMigGon39264** (P02: control mapping, CSV for Scrut).
Docs: `stories/MapMigGon37539/` (implementation plan, estimation report, SS export and drafts).

Layout and conventions follow `airtable/cct/` (see the working agreement): lowercase kebab-case with `soc2-` prefix, erasable TypeScript only, header block in every file, tests with `node --test <file>`.

```
airtable/soc2/
  soc2-evidence-contract.ts   types and constants of the evidence contract (provisional, v0.1)
  soc2-evidence.ts            (37539) validation, normalization, idempotency, retries, confirmed
  soc2-adapter-<source>.ts    (P01) one pure adapter per source: loom, ingestion, automation, ticket_review
  automations/                Airtable automation scripts, pasted by hand
  tests/                      node --test, soc2-<module>.test.ts
```

Run the tests from the repo root:

```
node --test airtable/soc2/tests/soc2-evidence-contract.test.ts
```

Not wired yet (needs Andrés's OK): `airtable/soc2/**` in `tsconfig.node.json` and `soc2:test` / `soc2:build` scripts in `package.json`.
