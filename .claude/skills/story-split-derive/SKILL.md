---
name: story-split-derive
description: Use when given a Singular Stories story id to split it into derived stories by concern (Airtable data, interfaces, Hyperagent agents, ingestion) with declared dependencies, correct its text to the current stack, and write ready-to-create markdown files. Calls story-context for the context pack.
---

# Split a story into derived stories by concern

Input: a Singular Stories story id (for example MapMigGon37539). Optional: constraints from Andrés (max number of derived stories, sprint, points budget).

Requires story-context schema version: 1

Goal: get a context pack for the story (skill story-context: full when available, lite at minimum), use it to correct the story text to the current implementation, split the story into derived stories with one clear concern each and explicit dependencies, distribute every definition entry to exactly one derived story, write ready-to-use markdown for each one using the AC template below, and check your own work in loops before reporting. Create nothing in Singular Stories.

## Rules

- Read SS freely, write nothing. No create-story, update-story-details, comments or links without Andrés's review, item by item. Prepare the exact calls in ss-drafts.md and stop. Wait for "post item N".
- Do not message anyone. Andrés handles all communication.
- Stay in this stack. Map King Hub (Airtable): tables, automations (record-triggered and scheduled), interfaces (custom components). Hyperagent agents (Loom, Ingestion Agent, others). Sources: Linear, Attio, Google Calendar, Slack triggers. The words backend, API, service, endpoint, database, server and Node.js are not allowed unless the source story names a real component that exists (for example "Scrut API" in an out-of-scope line). Replace them with the real thing.
- Do exactly what was asked. Do not touch files outside the story folder. Propose wider changes in chat.
- Keep the source story's language per section (acceptance criteria in English, client-facing text and observations in Spanish, unless the story says otherwise).
- Never write a passing result in a self-assessment log without having re-read the text it refers to.
- The split never runs without a context pack. Folder layout, node format, dependency model and check rules belong to story-context; do not restate or invent them here.
- Restrict reading to the functionality being split. Other systems are read-only and only through story-context's procedures.

## AC template

Use this shape for the five definition sections of every derived story. It was extracted from an accepted story (per-control SOC 2 evidence browse and export) and generalized. Angle brackets are placeholders. The template is shown in a fenced block here only; the deliverable files contain no backticks.

```
## Acceptance Criteria

Scenario: <behavior in plain words, not a test id>
   Given <state of the data, with real table names, field names and enumerated values>
   And <second precondition, only when needed>
   When <ONE action by a named actor: reviewer, editor, auditor, automation, agent>
   Then <ONE observable result>
   And <second observable result, or a negative assertion such as "the records themselves are not modified">

(one blank line between scenarios; 4 to 8 scenarios; the happy paths of the story)

## Technical Implementation

- <Stack line first: "Airtable only: tables, linked records, lookups, interfaces in Map King Hub. No scripts or automations are added by this story." or "Hyperagent agent <name>: ..."; say what is added and what is NOT added>
- New table <plural_snake_name>: <field list>.
- <Relationship or automation rule: who writes it, who reads it, when it runs (record-triggered or scheduled, how often)>
- <Interface page: filter, heading, columns shown, download enabled>
- <Verification gate when something unproven is assumed: "verified in Map King Hub before implementation; if not possible, the story is re-estimated before continuing">
- Story documentation in stories/<story id>/ in the mapking-dev repo, backed up to the story folder under Map King (Map.ai)/stories/ in Google Drive: spec, <what the spec must contain>; QA guide for <QA name>; delivery evidence per criterion.

## Data & Integration Requirements

- Reads <tables>; writes <tables> / never writes to <tables>.
- Key: <the identifier and its enumerated values, spelled out>.
- Data flow: <source> -> <step> -> <step> -> <result>.
- Id convention: <what run_id or reference holds for each source type, and the idempotency key>.
- Meaning of each exposed column or flag (for example, a "provisional" flag and who clears it).
- Formats: UTF-8, header row, ISO 8601 UTC timestamps; enumerations spelled out.
- Out of scope: <external system or later work> and where it will be tracked.

## Edge Cases & Error Handling

Scenario: <missing input, duplicate, deactivated reference, blank optional field, failure, retry>
   Given ...
   When ...
   Then ...
   And ...

(same Scenario format; 3 to 7 scenarios; each one a failure or boundary, never a second happy path)

## Security & Performance

- Roles: who edits, who only reads or downloads, who has no access to what.
- The documentation names who can read, edit and export, and where access is administered; no credentials or secrets in the documentation.
- Exposed data: only <ids, statuses, timestamps, trigger, actor, counts>. No transcripts, ticket bodies, prompts, reports or other content.
- Load: <why this adds no load to the automations, or the per-run budget and batch size>.
```

Rules extracted from the model text, apply them to every derived story:

1. Section headings are exactly: Acceptance Criteria, Technical Implementation, Data & Integration Requirements, Edge Cases & Error Handling, Security & Performance. Scenarios appear only in Acceptance Criteria and Edge Cases & Error Handling. The other three are bullet lists.
2. Scenario format: "Scenario:" flush left; Given, When, Then, And lines indented exactly 3 spaces; one blank line between scenarios; no tabs; no backticks.
3. One When per scenario. One observable Then. A second outcome goes in And. Add a negative assertion whenever the story reads or exports data ("not modified", "no placeholder records", "the export does not fail").
4. Given names the data state with real table names, field names and values. Spell out enumerations (approval, loom, ingestion, automation, ticket_review).
5. Refer to other stories by SS key (for example MapKMigGon39261), never "the other story" or "the sources story".
6. The first Technical Implementation bullet states the stack and what is not added. Say "no scripts or automations" when true.
7. Edge cases cover: missing mapping, deactivated or removed reference, blank optional field, duplicate input, failure and retry, and what is shown where nothing matches.
8. A claim that depends on something unproven gets a verification gate bullet.
9. When a value is not yet confirmed, store a flag and expose it (provisional), instead of hiding the uncertainty.
10. Map King conventions: plural table names; one writer per table; production base changes are additive and need Andrés's approval; Loom runs each morning and on demand (panel or Slack), not hourly; hourly automations are safety nets.

### Domain scenario menu

Pick from these when writing or checking scenarios. Do not include a scenario that does not apply.

- Airtable data and automation: capture on a terminal status change; in-progress rows not processed yet; a non-qualifying row skipped with the rule that excluded it; the triggered and the scheduled automation process the same row and only one record exists (idempotency key); missing required fields produce a validation failure that lists them; bounded retries then a terminal failure state; a producer cannot write its log row and its own run is not blocked; backfill of existing rows; append-only tables are never edited.
- Airtable interfaces: filter by a reference; heading shows the selected value; empty state when nothing matches; read-only access for reviewers; CSV download shows only the export columns and respects the filter; a page for exceptions (unmapped, failed, unconfirmed); a record opens from the list for traceability.
- Hyperagent agent: how it is triggered (schedule, Slack, panel, on demand); inputs it reads; tools it may call; output format and the AI output state (present, missing, malformed); approval required before an irreversible action; nothing to do ends as a logged no-op; a failure ends as a log row with status and reason; no personal content stored; a re-run does not duplicate results.
- Data ingestion and source configuration: expired or missing credentials (kept in secrets, never in tables); pagination; rate limit with bounded retry and backoff; a renamed or missing source field stops the write and names the field; duplicates by external id; deleted at source; timezone converted to ISO 8601 UTC; backfill window.
- Evidence and compliance: append-only records; who changed a mapping and when; confirmed versus unconfirmed; retention; export fields only.
- Airtable limits worth stating when they matter (confirm against current Airtable documentation before citing a number): the automation script has a short run-time limit, scripts create or update records in batches (about 50 per call), and the REST API throttles requests per base. Design batch size and per-run budget around these.

## Step 0 - Get the context pack (story-context)

Load the skill story-context (Skill tool) and follow it. Which mode:

- Full (build): when the user asks for it ("context", "deep scan"), when the project folder has story-context installed and its context covers the story's epic, or when a project folder is provided. Add deep only when asked.
- Lite (lite <story id>): the mandatory minimum when full is not asked or not available. It uses only what is at hand in this thread (the story as read from SS or given by the user, files already read, user-provided text, images and URLs, one SS read per directly referenced story) and writes the same folders and format as the full context, so story-context can merge it later.

If story-context is not available as a skill and not installed locally, stop and tell Andrés it is missing. Do not improvise a context format.

Then satisfy story-context's readiness loop (check passes, every artifact the story names has a node, every consumed field exists with its type, every planned artifact has a producer story) before continuing.

## Step 1 - Read the context pack

1. Pack: story-context slice for the source story and for each artifact it touches (lite without the tool: read the nodes you just wrote). That is the whole context reading list.
2. SS: get-story-detail for the source story. Note points, sprint, release, work area, techs, assignee, dependencies; compare ss_status with the card and fix the card if it differs.
3. Repo: stories/<story id>/ (spec, schema, implementation plan, estimation report, ss-drafts, ss-export). Read what exists; do not invent a spec.

## Step 2 - Inventory

Number every definition entry in the source story: each acceptance criteria scenario, Technical Implementation line, Data and Integration line, Edge Case, Security and Performance line, and client-friendly item. Give each a stable id (AC-1, TI-3, DI-2, EC-4, SP-1, CF-2). Write a table: id, original text (shortened), concern tag.

## Step 3 - Fix, enhance, update

For each entry decide one status and write the corrected text:

- keep: correct and current.
- fix: wrong, contradictory, or untestable. Say what was wrong.
- update: refers to an outdated or generic implementation. Rewrite to the real component (a named Airtable table, field, automation, interface page, Hyperagent agent, or source connector).
- enhance: missing a precondition, an observable result, a failure path, or a data rule. Add it, using the AC template and the domain scenario menu.
- drop: duplicate or out of scope. Say where the idea is covered, or why it is out.

Treat the text as something to refactor against the context pack:

- Misleading: contradicts a node (wrong trigger, wrong table, wrong writer, wrong status value, "backend"). Correct it and say which node proves it.
- Irrelevant: describes work that belongs to another story, another epic, or no story. Remove it or move it to the story that owns it.
- Missing: a precondition, a contract (a field and its type produced by another story), a failure path, an owner. Add it; if it needs another story, add the dependency instead of absorbing that work.

### Self-assessment loop 1: correction check

After the pass, re-read every corrected entry against these questions. Fix and repeat; at most 3 rounds.

- Does it use only real components of this stack (no banned words, no generic "service")?
- Do table and field names exist (check schema.md of related stories or the base)?
- Is the trigger stated (record-triggered or scheduled, and how often) wherever an automation acts?
- Is there exactly one writer per table?
- Are idempotency, re-run and failure behavior stated where data is written?
- Is it clear what personal data is stored (should be none beyond ids, statuses, timestamps, actor)?

Log the result in the index (rounds used, what changed, what stays open).

## Step 4 - Define the concerns

Group the corrected entries into concerns. Start from this catalog and add others only when the story needs them:

1. Airtable data and automation: tables, fields, links, lookups, record-triggered and scheduled automations, scripts.
2. Airtable interfaces: pages, custom components, filters, downloads.
3. Hyperagent agent <goal>: one derived story per agent and goal (prompt, tools, triggers, outputs, approval behavior).
4. Data ingestion and source configuration: connectors, mappings, source types, scheduling, credentials handling, backfill.
5. Evidence, audit and compliance (only if the story has it): what is recorded, retention, export.
6. Integration with an external system (Slack, Scrut, Linear, Attio): only when it is a separate deliverable.
7. Quality and rollout: QA guide, evidence per criterion, migration or backfill of existing data, documentation.

Rules for the split:

- One concern per derived story. If a derived story would need two different skills or two different reviewers, split it.
- Aim for about 2 to 5 SP each (use estimate-story-delivery-days calibration; points are fixed per role and only a PM changes them, so say "suggested"). Merge anything under 1 SP of real work.
- Name format: [<source id short> · P01] <concern>: <goal>, two-digit part numbers.
- Order by dependency. Mark what can run in parallel.
- Give every derived story its depends_on (key@gate, default ready_for_qa for anything that supplies data) and consumes (artifacts, fields and types), and make every artifact it creates a node with produced_by, as story-context defines. A producer and its consumer never share a story.
- Stuffing smells that mean split: a consumer and its producer in one story; an agent prompt change plus an automation plus an interface; two reviewers or two skills needed; acceptance criteria that cannot be tested until another part exists; "and" in the title; points above 5.

## Step 5 - Distribute

Assign each corrected entry to exactly one derived story. A shared entry goes to the derived story that owns the data or behavior; the others reference it. Build a coverage matrix: every inventory id appears in exactly one place or is marked drop.

### Self-assessment loop 2: coverage and independence

Check, fix, repeat; at most 3 rounds.

- Every inventory id appears exactly once in the matrix (no orphan, no duplicate). If an entry cannot be placed, stop and report it.
- Each derived story can be accepted on its own. What it needs from siblings is written as a Given precondition, not assumed.
- No two derived stories write the same table.
- The dependency order has no cycle.
- Run story-context check and deps for every derived story: each consumed artifact has its producer declared at ready_for_qa or later, and the readiness answer matches what the PM will see in SS.
- The points total is stated against the source story's points.

## Step 6 - Write the deliverables

Folder: stories/<source id>/derived/ in the repo (create it). Files:

- index.md: source story summary; the concern list; a dependency table (derived story, depends on, blocks); a relationship diagram in mermaid; the coverage matrix; the change log of fixes, updates and enhancements with the reason; the self-assessment log; open decisions for the PM (points, sprint, order).
- P01-<slug>.md, P02-<slug>.md, ...: one file per derived story, each section as a "## " heading, in this order, ready to paste or to launch with create-story: Datos (name, project, Key Project, release, objective, work area, techs, AI technology, suggested SP, sprint, assignee, QA); Historia; Historia para el cliente; Descripción de IA; Acceptance Criteria; Technical Implementation; Data & Integration Requirements; Edge Cases & Error Handling; Security & Performance (the five definition sections follow the AC template exactly); Criterios para el cliente; Observaciones; Relaciones (parent story id, siblings, depends on as key@gate, consumes as artifact refs with field and type, artifacts it creates, blocks, the inventory ids this story owns, links to the repo folder and Drive folder).
- ss-drafts.md (append, do not overwrite): one numbered item per SS action: create-story per derived story (exact fields and text, or the file to read), add-story-link for parent and sibling links (relationship type stated), and one comment on the source story listing the derived stories and the reason for the split. Mark every item "awaiting review". For SS paste, scenario blocks may be wrapped in fences here only.

### Self-assessment loop 3: AC quality rubric

For every scenario in every derived file, score each item pass or fail. All must pass. Rewrite failing scenarios and re-score; at most 3 rounds. Record the remaining failures, if any, in index.md under "Unresolved".

1. Title names a behavior, not a test id.
2. Exactly one When, by a named actor.
3. Exactly one observable Then (the second outcome is in And).
4. Given uses real table or field names and values; enumerations spelled out.
5. A negative assertion is present when the story reads or exports data.
6. No implementation detail (script, formula, query) inside a scenario; that belongs in Technical Implementation.
7. QA could run it in Map King Hub with sample data and see the result without asking the developer.
8. Stories are referred to by key.
9. Not a duplicate of another scenario in this file or in a sibling.
10. The Edge Cases section has at least the boundaries from the domain scenario menu that apply, and each is a failure or boundary.
11. Technical Implementation starts with the stack line and states what is not added.
12. Security & Performance names roles, exposed fields and load.

### Self-assessment loop 4: mechanical lint

Run these on the derived files (from the derived folder, on the device with device_bash or on a copy). Fix every hit and run again until clean; at most 3 rounds. Paste the final clean output summary into the self-assessment log.

```
# tabs and backticks must not appear in deliverables (ss-drafts.md excluded)
grep -nP '\t' P*.md index.md
grep -n '`' P*.md
# steps must be indented exactly 3 spaces
grep -nE '^(Given|When|Then|And) ' P*.md
grep -nE '^ {1,2}(Given|When|Then|And) |^ {4,}(Given|When|Then|And) ' P*.md
# exactly one When per scenario
for f in P*.md; do awk -v F="$f" '/^Scenario:/{if(s&&w!=1)print F": "s" has "w" When"; s=$0; w=0} /^   When /{w++} END{if(s&&w!=1)print F": "s" has "w" When"}' "$f"; done
# blank line before every Scenario (except the first line of a section)
for f in P*.md; do awk -v F="$f" '/^Scenario:/{if(prev!="" && prev !~ /^## /)print F":"NR": no blank line before Scenario"} {prev=$0}' "$f"; done
# the five definition headings, exact
for f in P*.md; do for h in "## Acceptance Criteria" "## Technical Implementation" "## Data & Integration Requirements" "## Edge Cases & Error Handling" "## Security & Performance"; do grep -qxF "$h" "$f" || echo "$f: missing $h"; done; done
# banned words (review each hit; allowed only when it names a real component)
grep -niE '\b(backend|back-end|api|endpoint|microservice|node\.?js|database|server)\b' P*.md
```

### Self-assessment loop 5: fresh read

Reload each derived file as if you were the QA person. Walk its scenarios in order and ask: can I set up this Given, perform this When, and see this Then? Then compare field names, source types and status values across all derived files and the source story's sibling exports; fix any inconsistency. If the split has more than three derived stories, or you changed more than a third of the source entries, also ask an independent agent to review the files (give it the files and the rubric, not your conclusions) and apply what holds up. At most 2 rounds.

## Step 7 - Report

Answer in chat with: the number of derived stories and their concerns; the points total versus the source story; the three largest corrections; the dependency chain and what can start now; the context mode used (full or lite) and what it added; the self-assessment result per loop (rounds used, final pass or fail, anything unresolved); open questions for the PM; and the path of the files. No recap of every entry.

## Step 8 - Write back to the context

Follow story-context's Update procedure: story cards for the source and each derived story (status planned, depends_on, consumes, concern, epic, parent), a node for every artifact they create (produced_by set), decision nodes for every open question, a CHANGELOG line, then index and check until clean. Lite output stays where lite puts it and is merged into the full context when that exists.

Do not run git commit unless Andrés asks. If he does, use node tools/commit/commit.mjs with --add for stories/<source id> and the context folder, and preview with --dry first.
