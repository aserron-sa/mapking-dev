/**
 * Tests for cct-triage-sync — MapKMigGon38571 (spec §9, U10)
 * Run from the repo root:  node --test airtable/cct/tests/cct-triage-sync.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../cct-triage-rules.ts';
import { diffValues, planTriageSync } from '../cct-triage-sync.ts';
import type { ExistingTriage, SyncInput, TaskRow, TriageValues } from '../cct-triage-sync.ts';

const TODAY = '2026-10-12';

function task(over: Partial<TaskRow> = {}): TaskRow {
  return {
    recordId: 'recTask1',
    taskId: 'linear:MAPKING-1',
    source: 'Linear',
    domain: 'Product',
    owner: null,
    dueDate: null,
    lastUpdatedAt: '2026-10-11T15:00:00.000Z',
    lifecycle: 'open',
    tags: [],
    schedulable: true,
    triageLinks: [],
    ...over,
  };
}

function input(over: Partial<SyncInput> = {}): SyncInput {
  return {
    tasks: [],
    existing: [],
    roster: [],
    cfg: { ...DEFAULT_CONFIG },
    today: TODAY,
    devTicketLinearKey: new Map(),
    approvalCounterparts: new Map(),
    ...over,
  };
}

/** Run a plan, then build the rows it would leave behind (to test idempotency). */
function applyPlan(inp: SyncInput): ExistingTriage[] {
  const plan = planTriageSync(inp);
  const rows = new Map(inp.existing.map((e) => [e.recordId, { ...e, values: { ...e.values } }]));
  for (const u of plan.updates) Object.assign(rows.get(u.recordId)!.values, u.changes);
  plan.creates.forEach((c, i) => rows.set(`recNew${i}`, { recordId: `recNew${i}`, normalizedTaskId: c.normalizedTaskId, values: { ...c.values } }));
  return [...rows.values()];
}

test('U10 create: a new open task gets one active row with computed values', () => {
  const plan = planTriageSync(input({ tasks: [task()] }));
  assert.equal(plan.aborted, null);
  assert.equal(plan.creates.length, 1);
  const v = plan.creates[0].values;
  assert.equal(plan.creates[0].normalizedTaskId, 'linear:MAPKING-1');
  assert.deepEqual(
    [v.taskRecordId, v.rowStatus, v.laneSuggested, v.staleState, v.ownerMatch, v.identityStatus],
    ['recTask1', 'active', 'queued', 'fresh', 'empty', 'unique'],
  );
});

test('U10 idempotency: second run with the same data plans 0 writes', () => {
  const first = input({ tasks: [task(), task({ recordId: 'recTask2', taskId: 'attio:x', source: 'Attio', lifecycle: 'closed' })] });
  const existing = applyPlan(first);
  const second = planTriageSync({ ...first, existing });
  assert.deepEqual([second.creates.length, second.updates.length, second.unchanged], [0, 0, 2]);
});

test('U10 update: only changed fields are planned', () => {
  const first = input({ tasks: [task()] });
  const existing = applyPlan(first);
  const plan = planTriageSync({ ...first, existing, tasks: [task({ dueDate: '2026-10-13' })] });
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0].changes, { laneSuggested: 'this_week', laneRule: 'due_within:7d' });
});

test('U10 closed: task closes → row closed and triage values cleared', () => {
  const first = input({ tasks: [task({ dueDate: '2026-10-01' })] });
  const existing = applyPlan(first);
  const plan = planTriageSync({ ...first, existing, tasks: [task({ lifecycle: 'not_returned', dueDate: '2026-10-01' })] });
  const c = plan.updates[0].changes;
  assert.equal(c.rowStatus, 'closed');
  assert.equal(c.staleState, null);
  assert.equal(c.laneSuggested, null);
  assert.equal(c.identityStatus, null);
});

test('U10 orphan: task row gone → row orphan, link cleared, nothing deleted', () => {
  const first = input({ tasks: [task()] });
  const existing = applyPlan(first);
  const plan = planTriageSync({ ...first, existing, tasks: [] });
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0].changes, { taskRecordId: null, rowStatus: 'orphan' });
  assert.equal(plan.creates.length, 0);
});

test('U10 duplicates: keep the row the task links to, report the extra, update only the keeper', () => {
  const values: TriageValues = {
    taskRecordId: 'recTask1', rowStatus: 'active', ownerCanonical: null, ownerMatch: 'empty', staleState: 'fresh',
    staleReason: 'x', delegateEligible: false, delegateReason: null, delegateSuggestedTo: null, laneSuggested: 'queued',
    laneRule: 'default', identityKey: null, identityStatus: 'unique',
  };
  const existing: ExistingTriage[] = [
    { recordId: 'recA', normalizedTaskId: 'linear:MAPKING-1', values: { ...values } },
    { recordId: 'recB', normalizedTaskId: 'linear:MAPKING-1', values: { ...values } },
  ];
  const plan = planTriageSync(input({ tasks: [task({ triageLinks: ['recB'] })], existing }));
  assert.deepEqual(plan.duplicates, [{ normalizedTaskId: 'linear:MAPKING-1', keep: 'recB', extra: ['recA'] }]);
  assert.ok(plan.updates.every((u) => u.recordId === 'recB'));
  assert.equal(plan.creates.length, 0);

  const noLink = planTriageSync(input({ tasks: [task()], existing }));
  assert.equal(noLink.duplicates[0].keep, 'recA'); // lowest record id
});

test('U10 abort: too many invalid open rows → nothing planned', () => {
  const tasks = [task(), task({ recordId: 'r2', taskId: null }), task({ recordId: 'r3', source: null, taskId: 'x:3' })];
  const plan = planTriageSync(input({ tasks }));
  assert.match(plan.aborted ?? '', /2 of 3 open rows are invalid/);
  assert.equal(plan.creates.length + plan.updates.length, 0);
});

test('U10 invalid row under the limit is skipped and reported; its existing row is not orphaned', () => {
  const tasks = Array.from({ length: 20 }, (_, i) => task({ recordId: `r${i}`, taskId: `linear:K-${i}` }));
  const first = input({ tasks });
  const existing = applyPlan(first);
  tasks[0] = { ...tasks[0], source: null };
  const plan = planTriageSync({ ...first, existing, tasks });
  assert.equal(plan.aborted, null);
  assert.ok(plan.issues.some((i) => i.code === 'missing_source' && i.recordId === 'r0'));
  assert.equal(plan.updates.length, 0);
});

test('U10 counts and owner issues', () => {
  const plan = planTriageSync(
    input({
      tasks: [
        task({ owner: 'Jane Doe', dueDate: '2026-10-01' }),
        task({ recordId: 'r2', taskId: 'gcal:1', source: 'Google Calendar', tags: ['waiting-on-external'] }),
      ],
    }),
  );
  assert.deepEqual(plan.counts.byLane, { this_week: 1, waiting_on: 1 });
  assert.deepEqual(plan.counts.byStale, { stale: 1, excluded: 1 });
  assert.equal(plan.counts.ownerUnmatched, 1);
  assert.ok(plan.issues.some((i) => i.code === 'owner_unmatched'));
});

test('diffValues treats empty string and null as equal', () => {
  const base: TriageValues = {
    taskRecordId: 'r', rowStatus: 'active', ownerCanonical: '', ownerMatch: 'empty', staleState: null, staleReason: null,
    delegateEligible: false, delegateReason: null, delegateSuggestedTo: null, laneSuggested: null, laneRule: null,
    identityKey: null, identityStatus: null,
  };
  assert.deepEqual(diffValues(base, { ...base, ownerCanonical: null }), {});
});
