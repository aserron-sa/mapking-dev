/**
 * Needs-You waiting_since reconciliation — MapKMigGon38570
 *
 * Airtable automation script ("Run a script" action). Paste it by hand.
 * Trigger: "At a scheduled time" → every hour.
 * No input variables.
 *
 * Rule (decided 2026-10-11, see docs/38570/schema.md):
 *   - needs_you_signals (formula on command_center_tasks) lists which of the 5
 *     signals apply to an open task; empty = not in Needs-You.
 *   - waiting_since is stamped when the first signal appears and is never
 *     overwritten while at least one signal remains.
 *   - It is cleared when all signals disappear (or the task closes, which empties
 *     the formula). A later signal starts a new wait.
 *   - waiting_since_basis:
 *       manual     = the signal includes "manual": exact time of Max's mark
 *                    (task_lanes.needs_you_manual_at)
 *       first_seen = automatic signals only: the time this reconciliation first
 *                    saw it (precision = Loom sync + up to 1 hour)
 *       estimated  = set only by the one-time backfill script
 *
 * Run needs-you-backfill.js ONCE before turning this automation on; otherwise the
 * tasks already waiting get first_seen = the first hourly run.
 */

const CFG = {
  tasksTable: 'tblX61yfIFroyhMTj',
  lanesTable: 'tblZhorxkVfKdsW3Z',
  eventsTable: 'tbl0k4YFnduwhMJG2',
  tasks: {
    signals: 'fld7byISqz2gObpzl',
    waitingSince: 'fldyg45qTxIIhESfp',
    basis: 'fldi2U965ciOBxxws',
    lanesLink: 'flde8Nn7pNUnFcWkE',
  },
  lanes: {
    needsYouManual: 'fldo0KraIpsDzzgZj',
    needsYouManualAt: 'fldLG8JroDCqtIkyS',
  },
  events: {
    summary: 'fldxNmEoRpB4SRouZ',
    eventType: 'fldu8UXkQBfrIHvZe',
    status: 'fldL2k5qUjcOasDxU',
    source: 'fldIj7BNfY7f13atJ',
    task: 'fldxIN69YVqXAWn0e',
    message: 'fldBZdiRQ4ThpYEgX',
  },
};

class EventLogger {
  constructor(table) {
    this.table = table;
  }
  async dataIssues(issues) {
    const E = CFG.events;
    const records = issues.map((i) => ({
      fields: {
        [E.summary]: `needs_you_data_issue · ${i.taskId}`,
        [E.eventType]: { name: 'needs_you_data_issue' },
        [E.status]: { name: 'validation_failed' },
        [E.source]: { name: 'automation' },
        [E.task]: [{ id: i.taskId }],
        [E.message]: i.message,
      },
    }));
    try {
      for (let i = 0; i < records.length; i += 50) {
        await this.table.createRecordsAsync(records.slice(i, i + 50));
      }
    } catch (e) {
      console.warn(`priority_events write failed: ${e.message}`);
    }
  }
}

/** Latest manual mark time per task_lanes row that has needs_you_manual checked. */
async function loadManualMarks() {
  const L = CFG.lanes;
  const query = await base.getTable(CFG.lanesTable).selectRecordsAsync({
    fields: [L.needsYouManual, L.needsYouManualAt],
  });
  const marks = new Map();
  for (const r of query.records) {
    if (r.getCellValue(L.needsYouManual)) marks.set(r.id, r.getCellValue(L.needsYouManualAt));
  }
  return marks;
}

function manualTimeFor(taskRecord, marks) {
  const links = taskRecord.getCellValue(CFG.tasks.lanesLink) || [];
  const times = links.map((l) => marks.get(l.id)).filter(Boolean).sort();
  return times.length ? times[0] : null; // earliest active mark
}

const T = CFG.tasks;
const nowIso = new Date().toISOString();
const marks = await loadManualMarks();
const tasksTable = base.getTable(CFG.tasksTable);
const query = await tasksTable.selectRecordsAsync({
  fields: [T.signals, T.waitingSince, T.basis, T.lanesLink],
});

const updates = [];
const issues = [];
let stamped = 0;
let cleared = 0;

for (const r of query.records) {
  const signals = (r.getCellValueAsString(T.signals) || '').trim();
  const waitingSince = r.getCellValue(T.waitingSince);

  if (signals && !waitingSince) {
    const isManual = signals.split(',').map((s) => s.trim()).includes('manual');
    const manualAt = isManual ? manualTimeFor(r, marks) : null;
    if (isManual && manualAt) {
      updates.push({ id: r.id, fields: { [T.waitingSince]: manualAt, [T.basis]: { name: 'manual' } } });
    } else {
      updates.push({ id: r.id, fields: { [T.waitingSince]: nowIso, [T.basis]: { name: 'first_seen' } } });
    }
    stamped++;
  } else if (!signals && waitingSince) {
    updates.push({ id: r.id, fields: { [T.waitingSince]: null, [T.basis]: null } });
    cleared++;
  } else if (signals && waitingSince && waitingSince > nowIso) {
    issues.push({ taskId: r.id, message: `waiting_since ${waitingSince} is in the future` });
  }
}

for (let i = 0; i < updates.length; i += 50) {
  await tasksTable.updateRecordsAsync(updates.slice(i, i + 50));
}
if (issues.length) await new EventLogger(base.getTable(CFG.eventsTable)).dataIssues(issues);

output.set('stamped', stamped);
output.set('cleared', cleared);
output.set('dataIssues', issues.length);
