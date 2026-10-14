# Prompt for Airtable Omni — create automations A and B (MapKMigGon38570)

Copy everything between the two lines below into Omni, in the **Map King Hub** base.

---

In this base (Map King Hub), create **two automations** on the table **`task_lanes`**. Both run the **same script**, pasted exactly as given at the end of this message. Do not change, shorten, reformat or "improve" the script in any way: copy it character for character.

**Automation A**
- Name: `task_lanes · integrity · on create`
- Trigger: **When a record is created**, table `task_lanes`
- Action: **Run a script**
  - Input variable: name `recordId`, value = the trigger record's **Airtable record ID**
  - Script: the code below

**Automation B**
- Name: `task_lanes · integrity · on update`
- Trigger: **When a record is updated**, table `task_lanes`, watching only these fields: `lane`, `rank_position`, `user`, `task`
- Action: **Run a script**
  - Input variable: name `recordId`, value = the trigger record's **Airtable record ID**
  - Script: the same code below

Rules:
- Leave **both automations turned OFF** after creating them. I will test them and turn them on myself.
- Do not create any other automation, field, table or view, and do not modify existing records.
- The input variable must be named exactly `recordId` (the script reads `input.config().recordId`).
- If you cannot add a "Run a script" action or cannot paste the code, create everything else (name, trigger, watched fields) and tell me which step I must finish by hand.
- When done, reply with: the two automation names, their IDs (`wfl…`) if you can see them, the trigger and watched fields of each, and the input variable mapping.

Script (identical for A and B):

```javascript
/**
 * task_lanes integrity guard — MapKMigGon38570
 *
 * Airtable automation script ("Run a script" action). Paste it by hand into the
 * script step: Airtable's API cannot create or edit that step.
 *
 * Use it in TWO automations on table `task_lanes` (tblZhorxkVfKdsW3Z):
 *   A. Trigger "When a record is created"
 *   B. Trigger "When a record is updated", watching: lane, rank_position, user, task
 * Input variable (both): recordId = the trigger record's Airtable record ID.
 *
 * What it does, for the user who owns the trigger record:
 *   1. Dedupe: keeps one row per user + task. The oldest row is kept; if the
 *      trigger row is a newer duplicate, its lane / rank / needs_you_manual are
 *      copied onto the kept row before the duplicate is deleted.
 *   2. Top-3 guard: at most 3 rows in lane on_fire. If there are more, the
 *      newcomer (the trigger row, or else the most recently ranked) goes back
 *      to this_week. Never deletes a ranked row.
 *   3. Ranks: renumbers the remaining on_fire rows to 1..n, keeping their order
 *      (rank_position, then ranked_at). Rows outside on_fire get rank cleared.
 *   4. Logs every correction to priority_events (source = automation).
 *
 * Idempotent: when the state is already valid it writes nothing, so its own
 * writes (which re-trigger automation B) end in a no-op run.
 */

// ── Configuration ────────────────────────────────────────────────────────────
const CFG = {
  lanesTable: 'tblZhorxkVfKdsW3Z',
  eventsTable: 'tbl0k4YFnduwhMJG2',
  lanes: {
    autonumber: 'fldzVlkvjlweW446r',
    user: 'fldv531mBAE9KL2Yk',
    task: 'fldXRxxIcIxWbZ7ai',
    lane: 'fldHBsnLRIT7RrGv0',
    rank: 'fld1PKtXTsBK17pxD',
    rankedAt: 'fld15soq5jo4j3jxC',
    needsYouManual: 'fldo0KraIpsDzzgZj',
  },
  events: {
    summary: 'fldxNmEoRpB4SRouZ',
    eventType: 'fldu8UXkQBfrIHvZe',
    status: 'fldL2k5qUjcOasDxU',
    source: 'fldIj7BNfY7f13atJ',
    user: 'fldzCkpn3zNyG6Ehm',
    laneRecordIds: 'fldZTy7U9ktOaIB7L',
    before: 'fldiVSNDCHL5lHjTd',
    after: 'fldxLPzLdJMIP5LoR',
    message: 'fldBZdiRQ4ThpYEgX',
  },
  maxFires: 3,
  onFire: 'on_fire',
  demoteLane: 'this_week',
};

// ── Logger ───────────────────────────────────────────────────────────────────
class EventLogger {
  constructor(table) {
    this.table = table;
  }
  async log({ type, status = 'ok', userId = null, laneIds = [], before = null, after = null, message = '' }) {
    const E = CFG.events;
    const fields = {
      [E.summary]: `${type} · ${laneIds.length} row(s)`,
      [E.eventType]: { name: type },
      [E.status]: { name: status },
      [E.source]: { name: 'automation' },
      [E.laneRecordIds]: laneIds.join(','),
      [E.before]: before ? JSON.stringify(before) : '',
      [E.after]: after ? JSON.stringify(after) : '',
      [E.message]: message,
    };
    if (userId) fields[E.user] = { id: userId };
    try {
      await this.table.createRecordAsync(fields);
    } catch (e) {
      // Logging must never break the guard.
      console.warn(`priority_events write failed: ${e.message}`);
    }
  }
}

// ── Repository ───────────────────────────────────────────────────────────────
class LanesRepository {
  constructor(table) {
    this.table = table;
  }
  async loadAll() {
    const L = CFG.lanes;
    const query = await this.table.selectRecordsAsync({
      fields: [L.autonumber, L.user, L.task, L.lane, L.rank, L.rankedAt, L.needsYouManual],
    });
    return query.records.map((r) => LaneMapper.toRow(r));
  }
  async update(changes) {
    for (let i = 0; i < changes.length; i += 50) {
      await this.table.updateRecordsAsync(changes.slice(i, i + 50));
    }
  }
  async remove(ids) {
    for (let i = 0; i < ids.length; i += 50) {
      await this.table.deleteRecordsAsync(ids.slice(i, i + 50));
    }
  }
}

// ── Mapper ───────────────────────────────────────────────────────────────────
class LaneMapper {
  static toRow(record) {
    const L = CFG.lanes;
    const user = record.getCellValue(L.user);
    const task = record.getCellValue(L.task);
    const lane = record.getCellValue(L.lane);
    return {
      id: record.id,
      seq: record.getCellValue(L.autonumber) ?? Number.MAX_SAFE_INTEGER,
      userId: user ? user.id : null,
      taskId: task && task.length ? task[0].id : null,
      lane: lane ? lane.name : null,
      rank: record.getCellValue(L.rank),
      rankedAt: record.getCellValue(L.rankedAt),
      needsYouManual: Boolean(record.getCellValue(L.needsYouManual)),
    };
  }
  static snapshot(rows) {
    return rows.map((r) => ({ id: r.id, task: r.taskId, lane: r.lane, rank: r.rank }));
  }
}

// ── Service ──────────────────────────────────────────────────────────────────
class IntegrityService {
  constructor(repo, logger) {
    this.repo = repo;
    this.logger = logger;
  }

  async run(triggerId) {
    let rows = await this.repo.loadAll();
    const trigger = rows.find((r) => r.id === triggerId);
    if (!trigger) return 'trigger row no longer exists';
    if (!trigger.userId) return 'trigger row has no user';

    rows = await this.dedupe(rows, trigger);
    await this.guard(rows.filter((r) => r.userId === trigger.userId), triggerId);
    return 'done';
  }

  /** Keep one row per user + task; merge the newest intent into the oldest row. */
  async dedupe(rows, trigger) {
    if (!trigger.taskId) return rows;
    const same = rows
      .filter((r) => r.userId === trigger.userId && r.taskId === trigger.taskId)
      .sort((a, b) => a.seq - b.seq);
    if (same.length < 2) return rows;

    const keeper = same[0];
    const dupes = same.slice(1);
    const newest = trigger.id !== keeper.id ? trigger : dupes[dupes.length - 1];
    const L = CFG.lanes;
    const merged = {
      lane: newest.lane,
      rank: newest.rank,
      rankedAt: newest.rankedAt,
      needsYouManual: keeper.needsYouManual || dupes.some((d) => d.needsYouManual),
    };
    const before = LaneMapper.snapshot(same);

    await this.repo.update([
      {
        id: keeper.id,
        fields: {
          [L.lane]: merged.lane ? { name: merged.lane } : null,
          [L.rank]: merged.rank,
          [L.rankedAt]: merged.rankedAt,
          [L.needsYouManual]: merged.needsYouManual,
        },
      },
    ]);
    await this.repo.remove(dupes.map((d) => d.id));

    Object.assign(keeper, merged);
    await this.logger.log({
      type: 'dedupe',
      userId: trigger.userId,
      laneIds: same.map((r) => r.id),
      before,
      after: LaneMapper.snapshot([keeper]),
      message: `Kept ${keeper.id}, removed ${dupes.length} duplicate(s) for task ${trigger.taskId}`,
    });

    const removed = new Set(dupes.map((d) => d.id));
    return rows.filter((r) => !removed.has(r.id));
  }

  /** At most 3 on_fire rows, ranks 1..n unique; rank cleared outside on_fire. */
  async guard(userRows, triggerId) {
    const L = CFG.lanes;
    const byOrder = (a, b) => {
      const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.rankedAt ?? '').localeCompare(String(b.rankedAt ?? ''));
    };

    let fires = userRows.filter((r) => r.lane === CFG.onFire).sort(byOrder);
    const before = LaneMapper.snapshot(fires);
    const changes = [];
    const demoted = [];

    // 1) Over the cap: the newcomer goes back to this_week.
    while (fires.length > CFG.maxFires) {
      let intruder = fires.find((r) => r.id === triggerId && !demoted.includes(r));
      if (!intruder) {
        intruder = [...fires].sort((a, b) => String(b.rankedAt ?? '').localeCompare(String(a.rankedAt ?? '')))[0];
      }
      demoted.push(intruder);
      fires = fires.filter((r) => r.id !== intruder.id);
      changes.push({ id: intruder.id, fields: { [L.lane]: { name: CFG.demoteLane }, [L.rank]: null } });
    }

    // 2) Renumber the remaining fires 1..n, keeping their order.
    fires.forEach((r, i) => {
      if (r.rank !== i + 1) changes.push({ id: r.id, fields: { [L.rank]: i + 1 } });
    });

    // 3) Ranks only make sense in on_fire.
    userRows
      .filter((r) => r.lane !== CFG.onFire && r.rank != null && !demoted.includes(r))
      .forEach((r) => changes.push({ id: r.id, fields: { [L.rank]: null } }));

    if (!changes.length) return;

    await this.repo.update(changes);
    const after = fires.map((r, i) => ({ id: r.id, task: r.taskId, lane: CFG.onFire, rank: i + 1 }));
    await this.logger.log({
      type: 'guard_fix',
      userId: userRows[0]?.userId ?? null,
      laneIds: changes.map((c) => c.id),
      before,
      after,
      message: demoted.length
        ? `More than ${CFG.maxFires} fires: moved ${demoted.map((d) => d.id).join(', ')} to ${CFG.demoteLane}; ranks renumbered`
        : 'Ranks renumbered to 1..n (duplicates, gaps or ranks outside on_fire)',
    });
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────
const { recordId } = input.config();
const service = new IntegrityService(
  new LanesRepository(base.getTable(CFG.lanesTable)),
  new EventLogger(base.getTable(CFG.eventsTable))
);
const result = await service.run(recordId);
output.set('result', result);
```

---

## After Omni finishes (checklist)

1. Open each automation and confirm: trigger and table, watched fields (B only), input variable `recordId` mapped to the trigger's Airtable record ID, and the script identical to `airtable/cct/automations/task_lanes-integrity.js` (Omni must not have edited it).
2. **Test** each one with an existing `task_lanes` row. Expected output `result = done`. Note: the current data is Carlos's test clicks: three `on_fire` rows all at rank 1, and several duplicate rows for the same task (up to 6 for one Attio deal). Testing with one of those rows will renumber the fires and **delete the duplicate rows of that task**, logging `guard_fix` / `dedupe` in `priority_events`. That is the guard working, but it changes the test data: test on a row whose task has no duplicates, or only after the OK to clean Carlos's data (task 4).
3. Turn both on.
4. Write the automation IDs (`wfl…`) into `docs/38570/schema.md` and `airtable/cct/automations/README.md`.
