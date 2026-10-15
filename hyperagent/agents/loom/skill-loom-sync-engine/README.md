# loom-sync-engine — Loom's sync engine (Hyperagent skill)

Source of the Hyperagent skill `loom-sync-engine`. Loom prompt versions after v3.12 require it: the prompt only makes tool calls and does enrichment, and every mechanical step of a sync runs in this engine. The prompt deployed when this snapshot was taken is v3.14 (`PROMPT_VERSION` in `scripts/config.py`).

| | |
|---|---|
| Hyperagent skill | `cmv94wrja069s07admbjkcfwr`, workspace "Map King Skills" (`69Z5R51ZR8R2G3H`): https://hyperagent.com/skills/cmv94wrja069s07admbjkcfwr |
| Snapshot | Export of 2026-10-15T07:41:15Z. Identical, file by file, to the live skill (updated 2026-10-15T07:28:40Z, content hash `v1:219bb579…4169e1`) |
| Scope | Global skill, no credentials, not attached to any agent. Loom fetches it at the start of every run with `FetchSkillScripts("loom-sync-engine")` and runs `python3 <folder>/loom.py <command>` |
| Runtime | Python 3 standard library only. The engine makes no network calls; every read and write goes through Loom's tool calls (Airtable, Attio, Google Calendar, Linear, Slack) |

## Layout

- `SKILL.md` — the runbook the agent follows: the 13-step sequence (tool call and engine command per step), result saving, the Calendar integrity gate, schema validation, error handling.
- `scripts/` — the 16 files fetched by `FetchSkillScripts`. `loom.py` is the only entry point; `schema.py` holds the Airtable schema as data; `pipeline.py`, `lock.py`, `report.py` and the `src_*.py` modules hold the flow, run lock, report and per-source rules (module table in `SKILL.md`); `test_loom.py` holds the offline tests.
- `skill.json` — manifest: Hyperagent ids and timestamps, content hash, and size and SHA-256 of every script.

## Test

```
cd scripts && python3 test_loom.py
```

Expected: `PASS (9 tests)`. Last verified on 2026-10-15 with Python 3.12, offline. The tests use fixtures; they do not exercise real tool outputs.

## Keeping this folder and Hyperagent in sync

The skill is edited in Hyperagent, so this folder is a snapshot and can fall behind. After any change to the skill:

1. Export it from Hyperagent (or read it from `/api/skills/<id>`) and regenerate `scripts/` and `SKILL.md`.
2. Recompute `skill.json` (`updatedAt`, `contentHash`, per-file size and SHA-256).
3. Run the tests.
4. Commit with the skill's `updatedAt` and content hash in the message.

A mismatch between a script's SHA-256 here and the live skill means the repo is behind (or the skill was edited without export).

## Notes

- The earlier `skill.json` in this folder was an excerpt of the export: invalid JSON (unescaped quotes), cut off mid-sentence, without scripts. It was replaced by the generated manifest above, and `SKILL.md` now holds the full runbook (11,604 characters; the excerpt stopped at 7,376).
- The full export file (`skill-loom-sync-engine.json`) is not stored here, to avoid duplicating the scripts. Re-export from Hyperagent when a re-import is needed.
- The source-of-truth prompt stays in the parent folder: [loom.agent.md](../loom.agent.md) and [loom.changelog.md](../loom.changelog.md).
