/**
 * Tests for cct-triage-contract — MapKMigGon38571 (spec §9, U7 and filter/completeness cases)
 * Run from the repo root:  node --test airtable/cct/tests/cct-triage-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NONE,
  applyFilters,
  buildTriageRows,
  checkRequiredFields,
  compareRows,
  completeness,
  hasActiveFilters,
  identityGroups,
  laneCounts,
  ownersPresent,
  provenance,
  showStaleBadge,
  validateFilters,
} from '../interfaces/cct-triage-contract.ts';
import type { LaneRecord, TaskRecord, TriageRecord, TriageRow } from '../interfaces/cct-triage-contract.ts';

const NOW = new Date('2026-10-13T12:00:00.000Z');

function task(over: Partial<TaskRecord> = {}): TaskRecord {
  return {
    recordId: 'recT1',
    taskId: 'linear:MAPKING-1',
    title: 'Fix login',
    source: 'Linear',
    sourceTable: null,
    sourceUrl: 'https://linear.app/x/1',
    statusRaw: 'In Progress',
    dueDate: null,
    lastUpdatedAt: '2026-10-12T10:00:00.000Z',
    lifecycle: 'open',
    sourceStatus: 'ok',
    domain: 'Product',
    owner: 'Kyle',
    category: 'bug',
    tags: ['bug'],
    schedulable: true,
    ...over,
  };
}

function triage(over: Partial<TriageRecord> = {}): TriageRecord {
  return {
    recordId: 'recX1',
    taskRecordId: 'recT1',
    rowStatus: 'active',
    ownerCanonical: 'Kyle',
    ownerMatch: 'matched',
    staleState: 'fresh',
    staleReason: 'Active 1 days ago',
    delegateEligible: false,
    delegateReason: 'Not delegable: owner is Kyle',
    delegateSuggestedTo: null,
    laneSuggested: 'queued',
    laneRule: 'default',
    identityKey: null,
    identityStatus: 'unique',
    ...over,
  };
}

function lane(over: Partial<LaneRecord> = {}): LaneRecord {
  return {
    recordId: 'recL1',
    taskRecordId: 'recT1',
    lane: null,
    rankPosition: null,
    actionStatus: 'none',
    delegatedTo: null,
    domainOverride: null,
    ownerOverride: null,
    ...over,
  };
}

function rowsOf(tasks: TaskRecord[], triages: TriageRecord[] = [], lanes: LaneRecord[] = []): TriageRow[] {
  return buildTriageRows({ tasks, triages, lanes });
}

// ── buildTriageRows: which tasks ─────────────────────────────────────────────

test('only open tasks with a key become rows', () => {
  const rows = rowsOf([
    task(),
    task({ recordId: 'recT2', taskId: 'linear:MAPKING-2', lifecycle: 'closed' }),
    task({ recordId: 'recT3', taskId: 'linear:MAPKING-3', lifecycle: 'not_returned' }),
    task({ recordId: 'recT4', taskId: null }),
  ]);
  assert.deepEqual(rows.map((r) => r.recordId), ['recT1']);
});

test('a task whose source is stale or unavailable is still listed', () => {
  const rows = rowsOf([task({ sourceStatus: 'unavailable' }), task({ recordId: 'recT2', taskId: 'x:2', sourceStatus: 'stale' })]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sourceStatus, 'unavailable');
});

// ── buildTriageRows: lane (spec 5.1) ─────────────────────────────────────────

test('manual lane wins over the suggested lane', () => {
  const [r] = rowsOf([task()], [triage({ laneSuggested: 'icebox' })], [lane({ lane: 'on_fire', rankPosition: 2 })]);
  assert.deepEqual(r.lane, { value: 'on_fire', basis: 'manual', rule: null, rank: 2 });
  assert.equal(r.laneRecordId, 'recL1');
});

test('without a manual lane the suggested lane and its rule are used', () => {
  const [r] = rowsOf([task()], [triage({ laneSuggested: 'this_week', laneRule: 'overdue' })]);
  assert.deepEqual(r.lane, { value: 'this_week', basis: 'rule', rule: 'overdue', rank: null });
});

test('a lane row with an empty lane (only overrides) falls back to the suggestion', () => {
  const [r] = rowsOf([task()], [triage({ laneSuggested: 'waiting_on', laneRule: 'waiting_on_tag:waiting-on-external' })], [lane({ lane: null, ownerOverride: 'Max' })]);
  assert.equal(r.lane.value, 'waiting_on');
  assert.equal(r.lane.basis, 'rule');
});

test('no triage row yet → queued / fallback, and triageRecordId is null', () => {
  const [r] = rowsOf([task()]);
  assert.deepEqual(r.lane, { value: 'queued', basis: 'rule', rule: 'fallback', rank: null });
  assert.equal(r.triageRecordId, null);
  assert.equal(r.stale.state, 'unknown');
});

test('an unknown lane value is ignored, never trusted', () => {
  const [r] = rowsOf([task()], [triage({ laneSuggested: 'bogus' })], [lane({ lane: 'nonsense' })]);
  assert.equal(r.lane.rule, 'fallback');
});

test('closed and orphan triage rows are not used for an open task', () => {
  const [r] = rowsOf([task()], [triage({ rowStatus: 'closed', laneSuggested: 'icebox' })]);
  assert.equal(r.triageRecordId, null);
  assert.equal(r.lane.rule, 'fallback');
});

test('two triage rows for the same task: the lowest record id wins', () => {
  const [r] = rowsOf([task()], [triage({ recordId: 'recX9', laneSuggested: 'icebox' }), triage({ recordId: 'recX2', laneSuggested: 'this_week' })]);
  assert.equal(r.triageRecordId, 'recX2');
  assert.equal(r.lane.value, 'this_week');
});

// ── buildTriageRows: owner, domain, provenance ──────────────────────────────

test('owner: override > owner_canonical > raw owner', () => {
  const [a] = rowsOf([task({ owner: 'SERGIO GONGORA' })], [triage({ ownerCanonical: 'Sergio Góngora' })]);
  assert.deepEqual(a.owner, { value: 'Sergio Góngora', raw: 'SERGIO GONGORA', match: 'matched', from: 'source' });
  const [b] = rowsOf([task({ owner: 'SERGIO GONGORA' })], [triage({ ownerCanonical: 'Sergio Góngora' })], [lane({ ownerOverride: 'Max Hanratty' })]);
  assert.deepEqual(b.owner, { value: 'Max Hanratty', raw: 'SERGIO GONGORA', match: 'matched', from: 'override' });
  const [c] = rowsOf([task({ owner: 'Someone' })]);
  assert.deepEqual(c.owner, { value: 'Someone', raw: 'Someone', match: 'unmatched', from: 'source' });
  const [d] = rowsOf([task({ owner: null })]);
  assert.deepEqual(d.owner, { value: null, raw: null, match: 'empty', from: 'source' });
});

test('domain: override wins over the source value', () => {
  const [a] = rowsOf([task({ domain: 'Product' })]);
  assert.deepEqual(a.domain, { value: 'Product', from: 'source' });
  const [b] = rowsOf([task({ domain: 'Product' })], [], [lane({ domainOverride: 'Sales' })]);
  assert.deepEqual(b.domain, { value: 'Sales', from: 'override' });
});

test('provenance marks manual / override / AI', () => {
  const [r] = rowsOf([task()], [triage()], [lane({ lane: 'queued', domainOverride: 'Ops' })]);
  assert.deepEqual(provenance(r), { lane: 'manual', domain: 'override', owner: 'source', category: 'ai' });
});

// ── buildTriageRows: delegate, identity, stale, action ──────────────────────

test('delegate and identity come from the triage row; delegatedTo from the user lane row', () => {
  const [r] = rowsOf(
    [task()],
    [triage({ delegateEligible: true, delegateReason: 'CEO-owned', delegateSuggestedTo: 'Kyle', identityKey: 'linear:MAPKING-1', identityStatus: 'duplicate_candidate' })],
    [lane({ delegatedTo: 'Sergio Góngora' })],
  );
  assert.deepEqual(r.delegate, { eligible: true, reason: 'CEO-owned', suggestedTo: 'Kyle', delegatedTo: 'Sergio Góngora' });
  assert.deepEqual(r.identity, { key: 'linear:MAPKING-1', status: 'duplicate_candidate' });
});

test('stale badge is hidden once the user acted', () => {
  const stale = triage({ staleState: 'stale', staleReason: 'Overdue 3 days (limit 2)' });
  const [a] = rowsOf([task()], [stale]);
  assert.equal(showStaleBadge(a), true);
  const [b] = rowsOf([task()], [stale], [lane({ actionStatus: 'rescheduled' })]);
  assert.equal(showStaleBadge(b), false);
  const [c] = rowsOf([task()], [triage({ staleState: 'excluded' })]);
  assert.equal(showStaleBadge(c), false);
});

test('AI fields are carried with their own marker data', () => {
  const [r] = rowsOf([task({ category: 'bug', tags: ['bug', 'client-facing'], schedulable: false })]);
  assert.deepEqual(r.ai, { category: 'bug', tags: ['bug', 'client-facing'], schedulable: false });
});

// ── sorting, counts, identity groups ────────────────────────────────────────

test('compareRows: rank first (nulls last), then due date, then title', () => {
  const base = rowsOf([task()])[0];
  const mk = (over: Partial<TriageRow>): TriageRow => ({ ...base, ...over });
  const a = mk({ taskId: 'a', title: 'A', lane: { ...base.lane, rank: 2 } });
  const b = mk({ taskId: 'b', title: 'B', lane: { ...base.lane, rank: 1 } });
  const c = mk({ taskId: 'c', title: 'C', dueDate: '2026-10-20' });
  const d = mk({ taskId: 'd', title: 'D', dueDate: '2026-10-15' });
  const e = mk({ taskId: 'e', title: 'E' });
  assert.deepEqual([a, e, c, d, b].sort(compareRows).map((r) => r.taskId), ['b', 'a', 'd', 'c', 'e']);
});

test('laneCounts lists every lane, even with zero', () => {
  const rows = rowsOf(
    [task(), task({ recordId: 'recT2', taskId: 'x:2' })],
    [triage({ laneSuggested: 'this_week' })],
    [],
  );
  assert.deepEqual(laneCounts(rows), { on_fire: 0, this_week: 1, waiting_on: 0, queued: 1, icebox: 0 });
});

test('identityGroups groups rows that share a key and skips unique ones', () => {
  const rows = rowsOf(
    [task(), task({ recordId: 'recT2', taskId: 'airtable:dev_tickets:r1', title: 'Dup' }), task({ recordId: 'recT3', taskId: 'x:3' })],
    [
      triage({ identityKey: 'linear:MAPKING-1', identityStatus: 'duplicate_candidate' }),
      triage({ recordId: 'recX2', taskRecordId: 'recT2', identityKey: 'linear:MAPKING-1', identityStatus: 'duplicate_candidate' }),
      triage({ recordId: 'recX3', taskRecordId: 'recT3' }),
    ],
  );
  const g = identityGroups(rows);
  assert.deepEqual([...g.keys()], ['linear:MAPKING-1']);
  assert.equal(g.get('linear:MAPKING-1')!.length, 2);
});

// ── filters (spec 5.2) ──────────────────────────────────────────────────────

function sample(): TriageRow[] {
  return rowsOf(
    [
      task({ recordId: 'r1', taskId: 'a:1', source: 'Linear', domain: 'Product', owner: 'Kyle' }),
      task({ recordId: 'r2', taskId: 'a:2', source: 'Attio', domain: 'Sales', owner: null }),
      task({ recordId: 'r3', taskId: 'a:3', source: 'Linear', domain: null, owner: 'Max Hanratty' }),
    ],
    [
      triage({ recordId: 'x1', taskRecordId: 'r1', ownerCanonical: 'Kyle', laneSuggested: 'this_week' }),
      triage({ recordId: 'x2', taskRecordId: 'r2', ownerCanonical: null, ownerMatch: 'empty', laneSuggested: 'queued' }),
      triage({ recordId: 'x3', taskRecordId: 'r3', ownerCanonical: 'Max Hanratty', laneSuggested: 'queued' }),
    ],
  );
}

test('filters: OR inside a dimension, AND across dimensions', () => {
  const rows = sample();
  assert.deepEqual(applyFilters(rows, { source: ['Linear'] }).map((r) => r.taskId), ['a:1', 'a:3']);
  assert.deepEqual(applyFilters(rows, { source: ['Linear', 'Attio'] }).length, 3);
  assert.deepEqual(applyFilters(rows, { source: ['Linear'], lane: ['queued'] }).map((r) => r.taskId), ['a:3']);
  assert.equal(applyFilters(rows, {}).length, 3);
  assert.equal(applyFilters(rows, { domain: [] }).length, 3);
});

test('__none__ matches an empty domain or an empty owner', () => {
  const rows = sample();
  assert.deepEqual(applyFilters(rows, { domain: [NONE] }).map((r) => r.taskId), ['a:3']);
  assert.deepEqual(applyFilters(rows, { owner: [NONE] }).map((r) => r.taskId), ['a:2']);
  assert.deepEqual(applyFilters(rows, { owner: [NONE, 'Kyle'] }).map((r) => r.taskId), ['a:1', 'a:2']);
});

test('a valid filter with no matches returns an empty list, not an error', () => {
  assert.deepEqual(applyFilters(sample(), { source: ['Manual'] }), []);
});

test('filters use the effective values (override, manual lane)', () => {
  const rows = rowsOf([task()], [triage({ laneSuggested: 'queued' })], [lane({ lane: 'on_fire', domainOverride: 'Sales' })]);
  assert.equal(applyFilters(rows, { lane: ['on_fire'], domain: ['Sales'] }).length, 1);
  assert.equal(applyFilters(rows, { lane: ['queued'] }).length, 0);
  assert.equal(applyFilters(rows, { domain: ['Product'] }).length, 0);
});

test('ownersPresent is distinct, non-empty and sorted', () => {
  assert.deepEqual(ownersPresent(sample()), ['Kyle', 'Max Hanratty']);
});

test('validateFilters keeps valid values, drops invalid ones and reports each', () => {
  const owners = ['Kyle', 'Max Hanratty'];
  const { valid, issues } = validateFilters(
    { lane: ['on_fire', 'someday'], domain: 'Sales', owner: ['Kyle', 'Nobody', NONE], source: ['Slack'], bogus: 'x' },
    owners,
  );
  assert.deepEqual(valid, { lane: ['on_fire'], domain: ['Sales'], owner: ['Kyle', NONE] });
  assert.deepEqual(issues.map((i) => `${i.param}:${i.value}`).sort(), ['bogus:"x"', 'lane:someday', 'owner:Nobody', 'source:Slack']);
});

test('validateFilters: empty, null and wrong shapes never throw', () => {
  assert.deepEqual(validateFilters(null, []), { valid: {}, issues: [] });
  assert.deepEqual(validateFilters(undefined, []), { valid: {}, issues: [] });
  assert.equal(validateFilters('lane=on_fire', []).issues.length, 1);
  assert.equal(validateFilters([1, 2], []).issues.length, 1);
  const r = validateFilters({ lane: [1, null, 'queued'] }, []);
  assert.deepEqual(r.valid, { lane: ['queued'] });
  assert.equal(r.issues.length, 2);
});

test('validateFilters: __none__ is valid for domain and owner but not for source or lane', () => {
  const r = validateFilters({ domain: [NONE], owner: [NONE], source: [NONE], lane: [NONE] }, []);
  assert.deepEqual(r.valid, { domain: [NONE], owner: [NONE] });
  assert.deepEqual(r.issues.map((i) => i.param).sort(), ['lane', 'source']);
});

test('validateFilters removes duplicates; hasActiveFilters sees any value', () => {
  assert.deepEqual(validateFilters({ lane: ['queued', 'queued'] }, []).valid, { lane: ['queued'] });
  assert.equal(hasActiveFilters({}), false);
  assert.equal(hasActiveFilters({ lane: [] }), false);
  assert.equal(hasActiveFilters({ owner: [NONE] }), true);
});

// ── completeness (spec 5.3) ─────────────────────────────────────────────────

const FRESH_BEAT = { lastRunAt: '2026-10-13T11:10:00.000Z', lastRunStatus: 'ok' };

function completeInput(over: Partial<Parameters<typeof completeness>[0]> = {}) {
  return {
    tasks: [task()],
    triages: [triage()],
    loomRuns: [{ status: 'success', startedAt: '2026-10-13T11:00:00.000Z' }],
    heartbeat: FRESH_BEAT,
    now: NOW,
    ...over,
  };
}

test('completeness: everything fine → complete with no reasons', () => {
  assert.deepEqual(completeness(completeInput()), { status: 'complete', reasons: [] });
});

test('completeness: the latest finished Loom run decides; running / busy / abandoned are skipped', () => {
  const ok = completeness(
    completeInput({
      loomRuns: [
        { status: 'success', startedAt: '2026-10-13T10:00:00.000Z' },
        { status: 'running', startedAt: '2026-10-13T11:30:00.000Z' },
        { status: 'rejected_busy', startedAt: '2026-10-13T11:40:00.000Z' },
        { status: 'abandoned', startedAt: '2026-10-13T11:50:00.000Z' },
      ],
    }),
  );
  assert.equal(ok.status, 'complete');
  const bad = completeness(
    completeInput({
      loomRuns: [
        { status: 'success', startedAt: '2026-10-13T09:00:00.000Z' },
        { status: 'partial', startedAt: '2026-10-13T11:00:00.000Z' },
      ],
    }),
  );
  assert.deepEqual(bad.reasons, ['Last Loom sync was partial']);
  const failed = completeness(completeInput({ loomRuns: [{ status: 'failure', startedAt: '2026-10-13T11:00:00.000Z' }] }));
  assert.deepEqual(failed.reasons, ['Last Loom sync was failure']);
});

test('completeness: no Loom runs at all is not a reason by itself', () => {
  assert.equal(completeness(completeInput({ loomRuns: [] })).status, 'complete');
});

test('completeness: unavailable sources are named with counts; closed tasks are ignored', () => {
  const tasks = [
    task({ recordId: 'r1', taskId: 'a:1', source: 'Linear', sourceStatus: 'unavailable' }),
    task({ recordId: 'r2', taskId: 'a:2', source: 'Linear', sourceStatus: 'unavailable' }),
    task({ recordId: 'r3', taskId: 'a:3', source: 'Attio', sourceStatus: 'unavailable' }),
    task({ recordId: 'r4', taskId: 'a:4', source: 'Attio', sourceStatus: 'unavailable', lifecycle: 'closed' }),
  ];
  const triages = tasks.map((t, i) => triage({ recordId: `x${i}`, taskRecordId: t.recordId }));
  const r = completeness(completeInput({ tasks, triages }));
  assert.deepEqual(r.reasons, ['Attio unavailable (1 task)', 'Linear unavailable (2 tasks)']);
  assert.equal(r.status, 'partial');
});

test('completeness: open tasks without a live triage row are counted', () => {
  const tasks = [task(), task({ recordId: 'recT2', taskId: 'a:2' }), task({ recordId: 'recT3', taskId: 'a:3' })];
  const r = completeness(completeInput({ tasks, triages: [triage(), triage({ recordId: 'x3', taskRecordId: 'recT3', rowStatus: 'closed' })] }));
  assert.deepEqual(r.reasons, ['2 open tasks have no triage yet']);
  const one = completeness(completeInput({ tasks: [task(), task({ recordId: 'recT2', taskId: 'a:2' })] }));
  assert.deepEqual(one.reasons, ['1 open task has no triage yet']);
});

test('completeness: heartbeat missing, stale or not ok', () => {
  assert.deepEqual(completeness(completeInput({ heartbeat: { lastRunAt: null, lastRunStatus: null } })).reasons, ['Triage has not run yet']);
  assert.deepEqual(completeness(completeInput({ heartbeat: { lastRunAt: 'garbage', lastRunStatus: 'ok' } })).reasons, ['Triage has not run yet']);
  assert.deepEqual(completeness(completeInput({ heartbeat: { lastRunAt: '2026-10-13T09:59:00.000Z', lastRunStatus: 'ok' } })).reasons, ['Triage last ran more than 2 hours ago']);
  assert.equal(completeness(completeInput({ heartbeat: { lastRunAt: '2026-10-13T10:00:00.000Z', lastRunStatus: 'ok' } })).status, 'complete');
  assert.deepEqual(completeness(completeInput({ heartbeat: { lastRunAt: '2026-10-13T11:10:00.000Z', lastRunStatus: 'partial' } })).reasons, ['Last triage run was partial']);
});

test('completeness: reasons add up in a stable order', () => {
  const r = completeness({
    tasks: [task({ sourceStatus: 'unavailable' })],
    triages: [],
    loomRuns: [{ status: 'failure', startedAt: '2026-10-13T11:00:00.000Z' }],
    heartbeat: { lastRunAt: null, lastRunStatus: null },
    now: NOW,
  });
  assert.deepEqual(r.reasons, ['Last Loom sync was failure', 'Linear unavailable (1 task)', '1 open task has no triage yet', 'Triage has not run yet']);
});

// ── required fields (spec 5.4) ──────────────────────────────────────────────

test('checkRequiredFields names every missing field with its table', () => {
  const msgs = checkRequiredFields({
    tables: [
      { label: 'command_center_tasks', required: [{ id: 'fld1', label: 'title' }, { id: 'fld2', label: 'due_date' }], available: ['fld1'] },
      { label: 'task_lanes', required: [{ id: 'fld9', label: 'lane' }], available: ['fld9'] },
    ],
  });
  assert.deepEqual(msgs, ['command_center_tasks.due_date (fld2) is not available']);
  assert.deepEqual(checkRequiredFields({ tables: [] }), []);
});
