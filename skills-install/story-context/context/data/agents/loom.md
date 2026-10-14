---
id: agent:loom
type: agent
title: Loom
summary: Hyperagent agent that syncs work sources into Map King Hub; runs each morning and on demand from the panel or Slack.
status: existing
updated: 2026-10-14
confidence: verified
goal: sync Linear, Attio and Google Calendar into Map King Hub tasks
triggers: [schedule: each morning, panel: on demand, slack: on demand]
tags: [loom, sync]
provenance: [thread:2026-10-13 Andrés]
---

Writes loom_sync_runs. Not hourly (a story that says so is wrong). Prompt and execution config: claude/loom-system-prompt-v3.8.md, claude/loom-execution-config.md.
