/**
 * Tests for cct-triage-rules — MapKMigGon38571 (spec §9, U1–U6)
 * Run from the repo root:  node --test airtable/cct/tests/
 * Node 22.18+ runs .ts files directly (type stripping), no install needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  daysBetween,
  dateInZone,
  delegation,
  evaluateTask,
  isDateOnly,
  matchOwner,
  normalizeName,
  resolveIdentities,
  staleState,
  suggestLane,
  validateConfig,
  validateTask,
} from '../cct-triage-rules.ts';
import type { TaskInput, TeamMember, TriageConfig } from '../cct-triage-rules.ts';

const TODAY = '2026-10-12';
const cfg: TriageConfig = { ...DEFAULT_CONFIG };

function task(over: Partial<TaskInput> = {}): TaskInput {
  return {
    recordId: 'recT',
    taskId: 'linear:MAPKING-1',
    source: 'Linear',
    domain: 'Product',
    owner: null,
    dueDate: null,
    lastUpdatedAt: '2026-10-11T15:00:00.000Z',
    lifecycle: 'open',
    tags: [],
    schedulable: true,
    ...over,
  };
}

function member(over: Partial<TeamMember> = {}): TeamMember {
  return {
    recordId: 'recM',
    name: 'Someone',
    aliases: [],
    email: null,
    isCeo: false,
    receivesDelegation: false,
    domains: [],
    active: true,
    ...over,
  };
}

const sergio = member({ recordId: 'recS', name: 'Sergio Góngora', aliases: ['SERGIO GONGORA'] });
const kyle = member({ recordId: 'recK', name: 'Kyle', email: 'kyle@mapking.ai', receivesDelegation: true, domains: ['Sales', 'Ops'] });
const max = member({ recordId: 'recX', name: 'Max Hanratty', email: 'max@mapking.ai', isCeo: true });
const roster = [sergio, kyle, max];

// ── Dates ────────────────────────────────────────────────────────────────────

test('dates: isDateOnly accepts real dates only', () => {
  assert.equal(isDateOnly('2026-10-12'), true);
  assert.equal(isDateOnly('2026-02-30'), false);
  assert.equal(isDateOnly('2026-10-12T00:00:00Z'), false);
  assert.equal(isDateOnly(null), false);
});

test('dates: daysBetween and time zone boundary', () => {
  assert.equal(daysBetween('2026-10-10', '2026-10-12'), 2);
  assert.equal(daysBetween('2026-10-12', '2026-10-10'), -2);
  // 03:00 UTC on Oct 13 is still Oct 12 in Chicago (UTC-5)
  assert.equal(dateInZone(new Date('2026-10-13T03:00:00Z'), 'America/Chicago'), '2026-10-12');
});

// ── Config ───────────────────────────────────────────────────────────────────

test('config: defaults are valid; bad values are reported', () => {
  assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
  const problems = validateConfig({ ...DEFAULT_CONFIG, staleInactiveDays: -1, timezone: 'Mars/Base', invalidRowsMaxPct: 150 });
  assert.equal(problems.length, 3);
});

// ── U1 Owner ─────────────────────────────────────────────────────────────────

test('U1 owner: exact, alias, accents/case, email, unmatched, empty, ambiguous, inactive', () => {
  assert.equal(normalizeName('  Sergio   GÓNGORA '), 'sergio gongora');
  assert.deepEqual(
    [matchOwner('Sergio Góngora', roster).canonical, matchOwner('Sergio Góngora', roster).match],
    ['Sergio Góngora', 'matched'],
  );
  assert.equal(matchOwner('SERGIO GONGORA', roster).canonical, 'Sergio Góngora');
  assert.equal(matchOwner('sergio gongora', roster).match, 'matched');
  assert.equal(matchOwner('KYLE@mapking.ai', roster).canonical, 'Kyle');

  const unknown = matchOwner('  Jane Doe ', roster);
  assert.deepEqual([unknown.canonical, unknown.match, unknown.ambiguousWith], ['Jane Doe', 'unmatched', []]);

  assert.deepEqual([matchOwner(null, roster).match, matchOwner('   ', roster).match], ['empty', 'empty']);

  const twins = [member({ name: 'Alex A', aliases: ['Alex'] }), member({ name: 'Alex B', aliases: ['alex'] })];
  const amb = matchOwner('Alex', twins);
  assert.deepEqual([amb.match, amb.ambiguousWith], ['unmatched', ['Alex A', 'Alex B']]);

  assert.equal(matchOwner('Kyle', [{ ...kyle, active: false }]).match, 'unmatched');
});

// ── U2 Lane ──────────────────────────────────────────────────────────────────

test('U2 lane: rule order and boundaries', () => {
  const lane = (t: Partial<TaskInput>) => suggestLane(task(t), cfg, TODAY);

  // tag wins over due date
  assert.deepEqual(lane({ tags: ['waiting-on-external'], dueDate: '2026-10-13' }), {
    lane: 'waiting_on',
    rule: 'waiting_on_tag:waiting-on-external',
  });
  assert.deepEqual(lane({ dueDate: '2026-10-11' }), { lane: 'this_week', rule: 'overdue' });
  assert.deepEqual(lane({ dueDate: TODAY }), { lane: 'this_week', rule: 'due_within:7d' });
  assert.deepEqual(lane({ dueDate: '2026-10-19' }), { lane: 'this_week', rule: 'due_within:7d' });
  assert.deepEqual(lane({ dueDate: '2026-10-20' }), { lane: 'queued', rule: 'default' });

  // no due date: icebox at 30 days of inactivity, not at 29
  assert.deepEqual(lane({ lastUpdatedAt: '2026-09-12T12:00:00Z' }), { lane: 'icebox', rule: 'inactive_no_due:30d' });
  assert.deepEqual(lane({ lastUpdatedAt: '2026-09-13T12:00:00Z' }), { lane: 'queued', rule: 'default' });
  // no due date and no activity date → queued (never guessed as icebox)
  assert.deepEqual(lane({ lastUpdatedAt: null }), { lane: 'queued', rule: 'default' });
  // invalid due date is treated as no due date
  assert.equal(lane({ dueDate: '13/10/2026' }).lane, 'queued');
});

test('U2 lane: never on_fire', () => {
  for (const due of [null, '2026-01-01', TODAY, '2027-01-01']) {
    assert.notEqual(suggestLane(task({ dueDate: due }), cfg, TODAY).lane, 'on_fire');
  }
});

// ── U3 Stale ─────────────────────────────────────────────────────────────────

test('U3 stale: excluded, overdue, inactivity, unknown, fresh', () => {
  const st = (t: Partial<TaskInput>) => staleState(task(t), cfg, TODAY);

  assert.deepEqual(st({ source: 'Google Calendar', lastUpdatedAt: null }), {
    state: 'excluded',
    reason: 'Source excluded (Google Calendar)',
  });
  assert.equal(st({ dueDate: '2026-10-11' }).state, 'fresh'); // overdue 1 day < 2
  assert.deepEqual(st({ dueDate: '2026-10-10' }), { state: 'stale', reason: 'Overdue 2 days (limit 2)' });
  assert.equal(st({ lastUpdatedAt: '2026-10-06T12:00:00Z' }).state, 'fresh'); // 6 days
  assert.deepEqual(st({ lastUpdatedAt: '2026-10-05T12:00:00Z' }), {
    state: 'stale',
    reason: '7 days without activity (limit 7)',
  });
  assert.deepEqual(st({ lastUpdatedAt: null }), { state: 'unknown', reason: 'No activity date' });
  assert.deepEqual(st({ lastUpdatedAt: 'yesterday' }), { state: 'unknown', reason: 'No activity date' });
  assert.deepEqual(st({ lastUpdatedAt: '2026-10-12T14:00:00Z' }), { state: 'fresh', reason: 'Active today' });
});

test('U3 stale: never stale without data', () => {
  assert.notEqual(staleState(task({ lastUpdatedAt: null, dueDate: null }), cfg, TODAY).state, 'stale');
});

// ── U4 Delegation ────────────────────────────────────────────────────────────

test('U4 delegation: CEO owner, empty owner, tags, schedulable, closed, roster', () => {
  const del = (t: Partial<TaskInput>, c: TriageConfig = cfg) => {
    const tk = task(t);
    return delegation(tk, matchOwner(tk.owner, roster), roster, c);
  };

  const ceo = del({ owner: 'max@mapking.ai', domain: 'Sales' });
  assert.equal(ceo.eligible, true);
  assert.equal(ceo.suggestedTo, 'Kyle');
  assert.match(ceo.reason, /^CEO-owned/);

  const empty = del({ owner: null, domain: 'Product' });
  assert.equal(empty.eligible, true);
  assert.equal(empty.suggestedTo, null); // nobody receives Product
  assert.match(empty.reason, /counted as CEO/);

  assert.equal(del({ owner: null }, { ...cfg, delegateEmptyOwnerIsCeo: false }).reason, 'Not delegable: no owner');
  assert.equal(del({ owner: 'Sergio Góngora' }).reason, 'Not delegable: owner is Sergio Góngora');
  assert.equal(del({ owner: null, tags: ['needs-max'] }).reason, 'Not delegable: tag needs-max');
  assert.equal(del({ owner: null, schedulable: false }).reason, 'Not delegable: not schedulable');
  assert.equal(del({ owner: null, schedulable: false }, { ...cfg, delegateRequireSchedulable: false }).eligible, true);
  assert.equal(del({ owner: null, lifecycle: 'closed' }).reason, 'Not delegable: task not open');
});

test('U4 delegation: suggestion is stable (alphabetical) and skips CEO and inactive members', () => {
  const r = [
    member({ name: 'Zoe', receivesDelegation: true, domains: ['Ops'] }),
    member({ name: 'Ana', receivesDelegation: true, domains: ['Ops'] }),
    member({ name: 'Old', receivesDelegation: true, domains: ['Ops'], active: false }),
    member({ name: 'Boss', receivesDelegation: true, domains: ['Ops'], isCeo: true }),
  ];
  const t = task({ owner: null, domain: 'Ops' });
  assert.equal(delegation(t, matchOwner(null, r), r, cfg).suggestedTo, 'Ana');
});

// ── U5 Identity ──────────────────────────────────────────────────────────────

test('U5 identity: dev_ticket ↔ Linear, approval ↔ invoice, ambiguous, closed counterpart', () => {
  const res = resolveIdentities({
    openTaskIds: [
      'airtable:dev_tickets:recA',
      'linear:MAPKING-478',
      'airtable:approvals:recP',
      'airtable:invoices:recI',
      'airtable:approvals:recQ',
      'airtable:invoices:recJ',
      'airtable:follow_ups:recF',
      'airtable:dev_tickets:recB',
      'linear:MAPKING-9',
    ],
    devTicketLinearKey: new Map([
      ['airtable:dev_tickets:recA', 'MAPKING-478'],
      ['airtable:dev_tickets:recB', 'MAPKING-999'], // Linear task not open → unique
    ]),
    approvalCounterparts: new Map([
      ['airtable:approvals:recP', ['airtable:invoices:recI']],
      ['airtable:approvals:recQ', ['airtable:invoices:recJ', 'airtable:follow_ups:recF']],
    ]),
  });

  assert.deepEqual(res.get('airtable:dev_tickets:recA'), { key: 'linear:MAPKING-478', status: 'duplicate_candidate' });
  assert.deepEqual(res.get('linear:MAPKING-478'), { key: 'linear:MAPKING-478', status: 'duplicate_candidate' });
  assert.deepEqual(res.get('airtable:approvals:recP'), { key: 'airtable:invoices:recI', status: 'duplicate_candidate' });
  assert.deepEqual(res.get('airtable:invoices:recI'), { key: 'airtable:invoices:recI', status: 'duplicate_candidate' });
  assert.equal(res.get('airtable:approvals:recQ')!.status, 'ambiguous');
  assert.equal(res.get('airtable:invoices:recJ')!.status, 'ambiguous');
  assert.deepEqual(res.get('airtable:dev_tickets:recB'), { key: null, status: 'unique' });
  assert.deepEqual(res.get('linear:MAPKING-9'), { key: null, status: 'unique' });
});

// ── Validation ───────────────────────────────────────────────────────────────

test('validation: unusable rows and warnings', () => {
  assert.equal(validateTask(task()).usable, true);
  assert.equal(validateTask(task({ taskId: null })).usable, false);
  assert.equal(validateTask(task({ source: null })).usable, false);
  const warn = validateTask(task({ dueDate: '10/13', lastUpdatedAt: 'nope' }));
  assert.equal(warn.usable, true);
  assert.deepEqual(warn.issues.map((i) => i.code), ['invalid_due_date', 'invalid_last_updated_at']);
});

// ── U6 Determinism and config ────────────────────────────────────────────────

test('U6 determinism: same input, same output; output follows config', () => {
  const t = task({ owner: 'max@mapking.ai', domain: 'Ops', lastUpdatedAt: '2026-10-08T12:00:00Z' });
  assert.deepEqual(evaluateTask(t, roster, cfg, TODAY), evaluateTask(t, roster, cfg, TODAY));

  assert.equal(evaluateTask(t, roster, cfg, TODAY).stale.state, 'fresh'); // 4 days, limit 7
  const strict = { ...cfg, staleInactiveDays: 3 };
  assert.deepEqual(evaluateTask(t, roster, strict, TODAY).stale, {
    state: 'stale',
    reason: '4 days without activity (limit 3)',
  });
});
