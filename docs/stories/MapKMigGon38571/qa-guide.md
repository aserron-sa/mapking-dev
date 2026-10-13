# MapKMigGon38571 — QA guide: testing Work · Queue with your own Claude

Story: Priority Lanes — Triage View (Work · Queue / CC4). Base: Map King Hub (`appcdpGNTo0DouoqJ`). Interface 2 → page **Work · Queue**.
Page URL: `https://airtable.com/appcdpGNTo0DouoqJ/pag03n2LkOElxV9qW`
Version: 1.0 · 2026-10-13 · written for Gonzalo Ranieri (QA). Spanish speakers: you can give Claude the prompts in Spanish; the record values below must stay exactly as written.

This guide replaces the open items of the 2026-09-18 QA report for 38571: the missing-last-activity test case (not confirmed then), the "records older than 7 days are not Stale" finding (fixed in the current build), and a full end-to-end walk-through. The developer's own run (20 tests, all pass) is in `MapKMigGon38571-work-queue-qa-report-v7.pdf`; this guide lets you reproduce it independently.

---

## Feature map: what the story asks for and where to test it

| Feature in the story | AC | Test it in |
|---|---|---|
| Five lanes with live counts; every task has a lane (manual or suggested by a rule) | F2, F10 | Section 4.1, 4.10 |
| Filter by domain, owner and source, alone or combined; empty result without an error | F1, F3, F7, E1, E8 | Section 2 |
| Stale badge with the reason, configurable; never stale without data | F5, F8, T9, E5 | Sections 1 and 3 |
| Delegation prompt, written to `task_lanes` and logged | F6, F9 | Section 4.2 |
| Actions on a task: Done, Drop, +7d, Move to (with "not synced to source") | F10, T7 | Sections 4.1, 4.3, 4.4, 4.5 |
| Bulk retag, reassign, push | T7 | Sections 4.6, 4.7, 4.8 |
| Possible duplicates and ambiguous matches across sources | D6, E6 | Section 4.9 |
| Banner when data is incomplete | D7 | Section 4.10 |
| Message when a required field is missing | T2, E3 | Developer-only (needs the interface designer); see `evidence.md` and QA report test 20 |
| Every action leaves an event; the page never edits source rows | T7, D8 | Verification prompt in section 4 |

Developer evidence for every criterion: `evidence.md`. Screenshots: `MapKMigGon38571-work-queue-qa-report-v7.pdf`.

---

## 0. Before you start

**What your Claude needs**

- The **Airtable** connector, signed in as a user with access to Map King Hub. Used to create test records and to verify what the page wrote.
- **Claude in Chrome** (or the in-app browser) for the UI steps, signed in to Airtable.

**What your Claude cannot do (so plan a human step)**

- Read the page's text. Work · Queue is an Airtable custom component running in a cross-origin iframe, so Claude sees it only through **screenshots**. Ask it to take a screenshot after every action and describe what it sees.
- Operate the native dropdown "Retag domain…" reliably. If it hangs, pick the option yourself.
- Handle browser dialogs. "Reassign owner…" opens a prompt and any failure opens an alert. Claude must tell you **before** it clicks, and you type or dismiss.
- Delete anything. Claude should never delete records; you delete test records in Airtable at the end (section 5).
- Publish or edit the interface. Do not open the designer (`/edit`).

**Safety rules (paste these into your Claude first)**

> You are helping me QA story MapKMigGon38571 on the Map King Hub Airtable base (appcdpGNTo0DouoqJ). Rules: (1) Only create or change records I explicitly ask for. (2) Every record you create in `command_center_tasks` must have source = Manual, a title that starts with `TEST - QA 38571 · `, a `normalized_task_id` that starts with `manual:qa-38571-`, and a description that ends with `SAFE TO DELETE.` (3) Never touch real tasks (any other source or title). When you tick a checkbox in Work · Queue, take a screenshot and confirm that only the TEST task is selected before you press any bulk button. If a real task is selected by mistake, untick it and do nothing else. (4) Never delete records. (5) Never edit the interface, the automation, `cct_triage_configs` or `team_members`. (6) The page is an iframe: use screenshots, and tell me before any click that may open a prompt or alert dialog.

**Conventions**

- Test tasks: source `Manual`, lifecycle `open`, source_status `ok`, domain_tag `Ops` (unless the test says otherwise).
- The triage automation ("command_center_triages · compute · hourly") needs to run before stale and lane rules appear for a new task. Until then the page shows the banner "This list may be incomplete or out of date. N open tasks have no triage yet" and places the task in Queued. To avoid waiting up to an hour, ask the developer (Andrés) to run the automation once after you create records.
- Tasks whose title starts with "TEST -" are skipped by Loom for its own sources; Manual-source rows are not touched by Loom, so they stay until you delete them.

---

## 1. Test case: task missing last-activity data returns a non-stale default

**Acceptance criterion:** a task with no last-activity timestamp must get a non-stale default (`unknown`), never a fabricated stale flag.

**Why this needed a new procedure:** in the real data, every row with an empty `last_updated_at` is closed (`not_returned`) and the page only shows open tasks, so there was nothing to look at. You create one.

### 1.1 Create the record under test

Prompt for your Claude:

> In table `command_center_tasks` create one record with: `normalized_task_id` = `manual:qa-38571-noactivity`, `title` = `TEST - QA 38571 · no last activity`, `source` = Manual, `domain_tag` = Ops, `lifecycle` = open, `source_status` = ok, `description` = `QA test record for story MapKMigGon38571 (missing last-activity default). Created <today's date>. SAFE TO DELETE.` Leave `last_updated_at`, `due_date` and `owner` EMPTY. Then read the record back and show me every field.

Expected: record created; `last_updated_at` empty.

### 1.2 Create a control record (to prove the rule is not simply "never stale")

> Create a second record in `command_center_tasks`: `normalized_task_id` = `manual:qa-38571-oldactivity`, `title` = `TEST - QA 38571 · old activity 20 days`, source Manual, domain_tag Ops, lifecycle open, source_status ok, `last_updated_at` = a timestamp exactly 20 days ago (UTC), `description` ending with `SAFE TO DELETE.` Leave `due_date` empty.

### 1.3 Let the automation run

Ask Andrés to run "command_center_triages · compute · hourly" once, or wait for the next hourly run.

### 1.4 Verify in Airtable

> In `command_center_triages` find the rows whose `normalized_task_id` starts with `manual:qa-38571-`. For each, show `stale_state`, `stale_reason`, `lane_suggested`, `lane_rule`, `row_status`.

| Record | Expected `stale_state` | Expected `stale_reason` |
|---|---|---|
| `manual:qa-38571-noactivity` | `unknown` | `No activity date` |
| `manual:qa-38571-oldactivity` | `stale` | `20 days without activity (limit 7)` |

Pass criterion for the AC: the no-activity record is **never** `stale`.

### 1.5 Verify on the page

> Open the Work · Queue page in Chrome. Take a screenshot. Click the lane tab that contains "TEST - QA 38571 · no last activity" (it should be Queued) and take a screenshot. Then find "TEST - QA 38571 · old activity 20 days" and take a screenshot. Tell me which of the two shows a red "Stale · …" badge.

Expected: the no-activity task has **no** Stale badge; the 20-day task shows "Stale · 20 days without activity (limit 7)".

Result to record: PASS if 1.4 and 1.5 match; FAIL if the no-activity record is `stale` or shows a Stale badge.

---

## 2. Test case: combined domain + owner + source filter

**Setup:** none beyond a few real tasks being open (the page lists all open tasks).

> Open Work · Queue, click "All", and take a screenshot of the counts. Apply Domain = Sales, Owner = (an owner that has Sales tasks, e.g. Carlos Olivares or Max Hanratty if present), and Source = Attio together. Take a screenshot. List every task shown with its three tags. Then do the same with a second combination (for example Domain = Revenue + Source = Airtable). Click "Clear filters" and confirm the counts return to the original.

Expected: every task shown carries all selected attributes; no mismatches; a combination with no matches shows "Nothing matches these filters" with every lane count at 0 and no error. Also check the lane tabs: with filters on, the lane counts reflect the filtered set.

---

## 3. Stale badges (regression of the 2026-09-18 finding)

> Open Work · Queue, filter Source = Airtable and take a screenshot. List the tasks that show "Stale · …" and the reason text. Then filter Source = Google Calendar and tell me whether any task shows a Stale badge.

Expected:

- Airtable, Attio and Linear tasks past a limit show "Stale · Overdue N days (limit 2)" or "Stale · N days without activity (limit 7)".
- Google Calendar tasks never show a Stale badge (excluded source).
- A task that already has an action (Done / Drop / Reschedule) does not show the stale badge.

---

## 4. Extended walk-through (optional, full coverage)

Use one test task for all write actions. Create it like section 1.1 with `normalized_task_id` = `manual:qa-38571-actions`, title `TEST - QA 38571 · actions`, and give it a `last_updated_at` of now, no due date.

| # | Action | Prompt for your Claude | Expected on the page | Expected in Airtable |
|---|---|---|---|---|
| 4.1 | Move to a lane | "In Work · Queue open the task 'TEST - QA 38571 · actions', click its title, choose 'Waiting On' in 'Move to…' (click the select, press Down three times, Enter). Screenshot." | MANUAL LANE badge; Waiting On count +1; panel says "you placed it" | `task_lanes` row for the task with lane `waiting_on`; `priority_events` row `move · manual:qa-38571-actions → waiting_on` |
| 4.2 | Delegate | "Click 'Delegate to someone else?', type QA-delegate-test, Confirm. Screenshot." | Tag "DELEGATED · QA-DELEGATE-TEST" | `task_lanes.delegated_to` = QA-delegate-test; event `delegate · …` |
| 4.3 | Reschedule +7d | "Click '+7d'. Screenshot." | Tag "rescheduled · local only" | `task_lanes.action_status` = rescheduled, `rescheduled_date` = today + 7; event `rescheduled +7d · … → <date>` with "local only, not synced to source" |
| 4.4 | Done | Create a separate TEST task (`…-done`), then "click its title, click Done" | Tag "done · local only" | `action_status` = done; `synced_to_source` = false; event with "local only, not synced to source" |
| 4.5 | Drop | Same with a `…-drop` task, click Drop | Tag "dropped · local only" | `action_status` = dropped; event |
| 4.6 | Bulk retag | "Tick ONLY the TEST task (confirm with a screenshot), pick a different domain in 'Retag domain…'" | Domain tag changes | event `bulk retag · 1 of 1`; `task_lanes.domain_override` set |
| 4.7 | Bulk reassign (human step) | "Tick ONLY the TEST task. Tell me before you click 'Reassign owner…'." You type `QA-owner-test` in the prompt. | Owner tag changes; a new Owner filter pill appears | event `bulk reassign · 1 of 1`; `owner_override` = QA-owner-test |
| 4.8 | Bulk push | "Tick ONLY the TEST task, click 'Push to next week'" | Selection clears; no alert | event `bulk push · 1 of 1` ("push: 1 written, 0 failed") |
| 4.9 | Duplicate / ambiguous badges | "Filter Source = Airtable and screenshot" | Related pairs show POSSIBLE DUPLICATE or AMBIGUOUS MATCH; both items stay visible | `command_center_triages.identity_status` = duplicate_candidate / ambiguous |
| 4.10 | Incomplete-data banner | Right after creating a new TEST task and before the automation runs | Banner "N open tasks have no triage yet"; the task is in Queued | No `command_center_triages` row yet; after the run the banner disappears |
| 4.11 | Regression: Today | "Open the Today page and screenshot" | Page loads; counts consistent with the queue | — |

**Verification prompt for any row:**

> In `priority_events` list the newest events whose summary contains `qa-38571` or starts with `bulk`. Show `summary`, `message`, `event_type`, `source`, `status` and `created_at`. In `task_lanes` (table `tblZhorxkVfKdsW3Z`) show the row for the test task: `lane`, `action_status`, `rescheduled_date`, `delegated_to`, `domain_override`, `owner_override`, `synced_to_source`.

Every write action must produce exactly one `triage_action` event (source `extension`, status `ok`). The page must never write to `command_center_tasks` or `command_center_triages` (compare the test record's fields before and after).

**If an action fails with an alert**

- "No permission to update task_lanes" or "N of N items failed to …" means the component's User actions are not enabled. "Edit records inline" and "Add records inline" must be ON in the interface designer (the developer sets this). Report it as a configuration defect, not a code defect.
- A list that says "Work · Queue cannot show a complete list: some fields are not available to this page" means fields were hidden in the component's Data panel. Report the field names it lists.

---

## 5. Cleanup

Test records stay in production until you remove them. Your Claude must not delete them.

1. Ask Claude: "List every record in `command_center_tasks` whose `normalized_task_id` starts with `manual:qa-38571-`, and every `task_lanes` row linked to them, with record IDs."
2. You delete those records in Airtable (the trash allows recovery for a few days).
3. `priority_events` is append-only by design. The test events stay; they are identifiable by `qa-38571` or `bulk …` in the summary.
4. If you touched a real task by mistake, tell the developer before changing it back.

---

## 6. What to record in your report

For each test: the Actual Result in one or two sentences, the screenshot, and the Airtable record IDs you verified. For section 1 state explicitly: the `stale_state` of the no-activity record, whether the page showed a Stale badge, and the control record result. Note anything outside the acceptance criteria separately, as you did with the 7-day finding.
