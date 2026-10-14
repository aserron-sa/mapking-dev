---
name: story-context
description: Use to build, refresh, search or check the project-wide rich context (stories, epics, Airtable tables, agents, automations, decisions, dependencies) that makes story text accurate, or when another skill such as story-split-derive needs a context pack or a lite context for one story.
---

# Story context

A rich context is a small folder of markdown nodes that says what the project is, which stories exist and how they depend on each other, and which tables, agents, automations and interfaces exist or are planned, with their fields, types, owners and the story that produces them. It lets a story be corrected, split and validated against what is really built and what is really coming first.

Context schema version: 1

This skill owns the schema, the tool and the procedures. Other skills call it; they do not restate it. story-split-derive calls it in lite mode at minimum.

## Rules

- Read other systems freely (Singular Stories, Slack, Drive, calendar, email, Linear, Airtable, Hyperagent). Write to none of them. Writing the context files is the only write.
- Restrict the search to the functionality being built: follow a link only when it touches the same tables, agents, automations, interfaces, sources or concepts as the story. No long navigations, no reading for its own sake.
- Store distilled facts with their source, never raw conversations, personal content or credentials.
- Facts live once, edges are stored in one direction, generated files are never edited by hand.
- Do exactly what was asked. Do not touch files outside the context folder, except the story folder when another skill asks.
- Never mark a check as passed without having run it or re-read what it covers.

## Modes

The user's words or the calling skill decide:

- build [<story id> | project] [deep]: the full procedure (Build). Default when asked to "build", "refresh" or "prepare" the context.
- lite <story id>: the lite profile, for a caller that must work only with what is at hand in the thread.
- update: write back what the current thread learned (Update).
- check, find, slice, deps, merge: run the tool command of the same name and report.

## Where things live

Local install (a project folder is provided, or it already has .claude/skills/story-context/): the folder holds SKILL.md (byte-identical to this skill text), tools/context.mjs and context/ (the data). If missing, create it: write this text to SKILL.md, copy tools/context.mjs from the project doc claude/tools/context.mjs (or from the mapking-dev repo), run node tools/context.mjs init. In the Map King repo: .claude/skills/story-context/.

Project mode (no folder): the same tree and node format under claude/context/ in the Claude Project docs, maintained by hand with the check rules below. The project docs are the source; there is no mirror.

Mirror (local install only): the repo is the source of truth. The Claude Project keeps a read-only mirror of INDEX.md, project.md and glossary.md, each starting with the line "mirror of <path>@<hash>". Never edit a mirror: edit the source, then re-mirror at the end of the thread.

## Context structure

Layout under context/:

```
_meta.json                    schema_version, mode (full or lite), skill_sha256, scope, status_map, last_deep_scan
INDEX.md, index.json          GENERATED navigation and machine index (never edit)
CHANGELOG.md                  append only: date | thread or story | what changed | why
project.md                    what the project is, stack, sources of truth (read first)
glossary.md                   terms and banned words with replacements
epics/<slug>.md               Key Project card: goal, release, scope, out of scope
stories/<key>.md              story card: definition status, concern, dependencies, contracts consumed
data/tables/<name>.md         one Airtable table: fields with types, writer, producer story
data/agents/<name>.md         one Hyperagent agent: goal, triggers
data/automations/<name>.md    one automation: trigger, producer story
data/interfaces/<name>.md     one interface page
data/sources/<name>.md        one connector or platform (Linear, Attio, Calendar, the Airtable base)
decisions/<yyyy-mm-dd>-<slug>.md   decisions and open questions, with who decides
notes/<slack|drive|calendar|email|linear|hyperagent|airtable|provided>/<yyyy-mm-dd>-<slug>.md   distilled external findings
```

Every .md under context/ is a node with flat YAML frontmatter: scalars, [a, b] lists, or "- item" lists, no nested objects (so it stays greppable). Common keys: id, type, title, summary (one line, 160 characters or fewer, shown in search results), status (existing, planned, deprecated, open, decided), updated (YYYY-MM-DD), confidence (verified = read from the source of truth, inferred = derived from a story or plan, assumed = needs confirmation), tags, provenance ([ss:<key>, repo:<path>, slack:<url>, drive:<id>, project:<doc>, thread:<date> <who>, user:<text>]).

Ids are <type>:<slug>, the slug being the file name (no dots): table:evidence, agent:loom, story:MapMigGon37539, epic:soc2-evidence, decision:2026-10-14-points-and-sprint-order. project.md has id project, glossary.md has id glossary.

Keys by type, besides the common ones:

- table: fields ([name:type, ...], Airtable field types such as text, singleSelect, link, checkbox, dateTime, number), writer (one component: agent:..., automation:..., or human; several only with append_only: true), produced_by (the story that creates it; required when planned), populated_by ([agents or automations whose runs fill it]).
- agent: goal, triggers. automation: trigger. interface and source: produced_by when planned.
- story: key, ss_status (the status text as SS shows it), concern (one line), epic, parent, derived_from, points, sprint, depends_on ([story:<key>@<gate>]), consumes ([<ref> or <ref>.<field>:<type>]).
- epic: key_project. decision: decided_by, about ([refs]). note: provenance and confidence required.

One direction only, so nothing can disagree: artifacts say who produces them (produced_by, writer, populated_by); stories say what they depend on (depends_on) and which contracts they consume (consumes). "produces", "blocks", "consumed_by" and "writes" are never written; the tool derives them into index.json.

Keep it small, searchable, consistent:

- A node covers one thing and stays under about 300 lines. Split before it grows. The body is prose and short lists; the frontmatter carries everything a query needs.
- State a fact in one node and point to it by id. Do not copy a field list or a convention into a story card.
- Search by summary and tags first (node tools/context.mjs find <words>), open a node only after a hit. Get a working pack with node tools/context.mjs slice <id>.
- Update in place. When something is replaced, set status deprecated and say what replaced it.

## Dependencies and gates

A story must not start while something it needs does not exist yet. Model it.

- Gates in order: defined (acceptance criteria exist), in_progress, ready_for_qa, qa_passed, done.
- depends_on: [story:<key>@<gate>] is the prerequisite and the minimum state the other story must reach before this one starts implementation. The default for a dependency that supplies data is ready_for_qa.
- consumes: the contracts a story relies on, written as table:evidence (the artifact) or table:evidence.source_type:link (a field and its type). The tool checks the field exists with that type.
- Inference: the producers of a consumed artifact are its produced_by story and the produced_by story of every agent or automation in its populated_by. The consumer must depend on each of them, directly or through a chain, at ready_for_qa or later.
- Readiness: node tools/context.mjs deps story:<key> compares each prerequisite's SS status with the required gate through status_map in _meta.json and prints can start: yes or no. Verify the map against list-story-catalogs; an unmapped status is reported, never guessed.

Two patterns to model every time:

1. An automation fed by a table that an agent run populates: the table has populated_by: [agent:<name>] and the produced_by story that creates it; the automation story consumes the table and depends on the agent's story and the table's story at ready_for_qa.
2. A behavior that needs a field of a defined type produced earlier: the field is listed with its type in the table node; the later story consumes table:<t>.<field>:<type> and depends on the producing story at ready_for_qa.

## Check rules

The tool's check command enforces these. In project mode or lite mode without the tool, verify them by hand.

1. Every node has the required keys for its type and a valid status and confidence; summaries are 160 characters or fewer.
2. Id equals <type>:<file name>, and the file sits in the folder of its type.
3. Every reference (produced_by, writer, populated_by, depends_on, consumes, epic, parent, about) resolves to a node.
4. Every consumed field exists in the table node with the same type.
5. A table has one writer component (several only with append_only: true); a planned table has produced_by.
6. depends_on entries are story:<key>@<gate> with a valid gate; the graph has no cycle.
7. For every consumed artifact, each producer story is a prerequisite at ready_for_qa or later.
8. Generated files (INDEX.md, index.json) are current (lite mode may omit them).
9. _meta.json schema_version equals the Context schema version line of this skill. Skills that call this one state the version they require ("Requires story-context schema version: N") and must match.
10. Warnings: a node not updated for 45 days (not in lite mode), a node over 300 lines.

## Build

Skip only when the context already covers the story, its epic and its referenced stories and check passes with no stale nodes for them.

1. Scope, widening only as needed: the source story; its epic (Key Project: list-project-key-projects, list-key-project-versions, search-stories) and the stories that share it; the stories it references (links, keys in its text, dependencies); then project-wide knowledge when the story belongs to a project (working agreement, repo story folders, schemas, agent configs). Stop at the first ring that stops adding facts about the same functionality.
2. Read in tiers. T0: the existing context (find and slice; note nodes whose updated date is old or whose SS status changed). T1: local files (stories/<id>/ with ss-export, schema.md, implementation plans, ss-drafts, the working agreement). T2: the SS MCP when connected and a related story is not covered locally (get-story-detail, get-story-activity, list-story-evidence, links).
3. Deep scan, only when asked ("deep scan", "deep"): query the sources below with terms from the story (story keys, table, agent, automation and interface names, distinctive phrases of the acceptance criteria). Per source read at most 10 items, newer than 90 days unless an included node references the item, and stop when a query returns nothing new.
   - Slack: channels tied to the project, conversations, threads and files that mention the terms.
   - Google Drive: the project and story folders, and documents or files that mention the terms.
   - Email and calendar: only through an available connector; threads and meetings that mention the terms in the last 60 days.
   - Linear: optional, only when connected.
   - Provided resources: text, images and URLs the user gave (read images with the Read tool).
   - SS MCP: every story of the epic, with its activity and comments.
   - Airtable: documentation or specs tables in Map King Hub (read only).
   - Hyperagent: prompts, configs and threads of the agents the story touches (read only).
   Set last_deep_scan in _meta.json and add a CHANGELOG line with what was searched and how many items were discarded as irrelevant.
4. Distill, do not copy. Per relevant finding create or update one node: artifacts into data/, decisions and open questions into decisions/, distilled external text into notes/<kind>/ with provenance and confidence. When two sources disagree, keep both claims in one node, mark the confidence, and open a decision with who decides.
5. Fix, clean and complete: correct misleading statements (for example a story that says Loom runs hourly), remove duplicates and unrelated bulk, add what is missing and relevant (the producer story of a table, the type of a field, the trigger of an automation, the owner of a decision). A node that no longer applies becomes deprecated, not silently deleted.
6. node tools/context.mjs index, then check. Fix until clean.

### Self-assessment loop: readiness

Before handing the context to a caller, confirm and fix, at most 3 rounds:

- check reports 0 errors; each warning is fixed or noted.
- Every table, agent, automation, interface and source the story names has a node with status and confidence.
- Every planned artifact has a producer story; every consumed field exists with its type.
- Every story of the epic has a card whose ss_status was read from SS, not remembered.
- Nothing was added that the story does not touch, and nothing relevant lives only in a thread.
- Open questions and contradictions are decision nodes, not chat.

## Lite profile

For a caller that must work only with what is at hand in the thread. Same folders and format as the full context, so it can be merged later.

- Where: if the full install exists, write the nodes into its context/ (they are ordinary nodes with lower confidence). Otherwise write them under stories/<source id>/derived/context/ in the repo (project mode: claude/context-lite/<source id>/) with _meta.json {"schema_version": N, "mode": "lite"}.
- Sources: only what is already in the thread: the story text read from SS or provided by the user, local files already read (or the story folder), user-provided text, images and URLs, and at most one get-story-detail per directly referenced story. No searches across the epic, no Slack, Drive, email, calendar, Linear, Airtable or Hyperagent, no deep scan.
- Node types: one epic, the source, derived and referenced stories, the tables, agents, automations, interfaces and sources the story names, and decisions for open questions. project.md and glossary.md are optional. notes/ only under notes/provided.
- Confidence: verified only for facts read from SS or a local file in this thread; everything else inferred or assumed.
- The links that make dependencies work are mandatory even in lite: produced_by, writer, populated_by, depends_on and consumes.
- Generated files: run index when the tool is available; otherwise skip them. check applies the rules above (without staleness).
- Promotion: when the full context exists, run node tools/context.mjs merge <lite folder>. New ids are copied; an id that differs from the full node is reported as a conflict and never overwritten; resolve it by hand.

## Update

The context outlives the thread. Before finishing any thread that touched it:

1. Create or update the story cards and artifact nodes the thread defined (produced_by set, confidence honest).
2. Write each open question or PM decision as a decision node.
3. Append one line to CHANGELOG.md.
4. Run index, then check, until it reports 0 errors.
5. Local install: re-mirror INDEX.md, project.md and glossary.md to the Claude Project docs with the "mirror of <path>@<hash>" first line.
6. Tell the user which paths changed. If asked to commit: node tools/commit/commit.mjs --add .claude/skills/story-context --add stories/<source id>, previewing with --dry first.

## Tool

node tools/context.mjs: init, index, check, find <words> [--type t] [--tag x] [--status s], slice <id> [--full], deps <story id>, merge <lite folder>, seal. Add --dir <path> to run on another context folder (for example a lite one). After a change to this skill text: bump the schema version line only when the schema changes, migrate the nodes, run check, then seal.
