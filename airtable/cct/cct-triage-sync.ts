/**
 * cct-triage-sync — MapKMigGon38571
 *
 * Pure planning for the hourly automation cct-triage-compute: given the current
 * command_center_tasks rows and the current command_center_triages rows, decide which
 * triage rows to create, which fields to update, which rows are duplicates and which are
 * orphans. No Airtable calls: the automation does the I/O, this module decides.
 *
 * 1:1 rules (spec §3, schema.md "New table command_center_triages"):
 *   - One triage row per task, key = normalized_task_id (upsert).
 *   - Open + usable task  → row_status active, all triage values computed by cct-triage-rules.
 *   - Task not open        → row_status closed, stale / delegate / lane / identity cleared.
 *   - Triage key with no task row any more → row_status orphan. Never deleted.
 *   - Two triage rows with the same key → keep one (the row the task links to; else the lowest
 *     record id), report the others; never delete.
 *   - Only changed fields are written. A second run with no data changes plans 0 writes.
 *   - computed_at is set only on rows that are created or changed ("values last changed at").
 *     Run freshness is tracked separately in triage_configs.last_run_at.
 *
 * Abort rule (spec §6): if invalid open rows > cfg.invalidRowsMaxPct of open rows, the plan is
 * empty and `aborted` explains why.
 *
 * Used by: airtable/cct/automations/cct-triage-compute.ts · Tested by: airtable/cct/tests/cct-triage-sync.test.ts
 */
import { evaluateTask, resolveIdentities, validateTask } from './cct-triage-rules.ts';
import type { Issue, TaskInput, TeamMember, TriageConfig } from './cct-triage-rules.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RowStatus = 'active' | 'closed' | 'orphan';

/** The values the automation owns in a command_center_triages row (computed_at excluded). */
export interface TriageValues {
  taskRecordId: string | null;
  rowStatus: RowStatus;
  ownerCanonical: string | null;
  ownerMatch: string | null;
  staleState: string | null;
  staleReason: string | null;
  delegateEligible: boolean;
  delegateReason: string | null;
  delegateSuggestedTo: string | null;
  laneSuggested: string | null;
  laneRule: string | null;
  identityKey: string | null;
  identityStatus: string | null;
}

export type TriageField = keyof TriageValues;

export interface ExistingTriage {
  recordId: string;
  normalizedTaskId: string | null;
  values: TriageValues;
}

/** Task row plus the triage record ids its inverse link `triage` points to. */
export interface TaskRow extends TaskInput {
  triageLinks: string[];
}

export interface SyncInput {
  tasks: TaskRow[];
  existing: ExistingTriage[];
  roster: TeamMember[];
  cfg: TriageConfig;
  today: string; // YYYY-MM-DD in cfg.timezone
  devTicketLinearKey: Map<string, string>;
  approvalCounterparts: Map<string, string[]>;
}

export interface PlannedCreate {
  normalizedTaskId: string;
  values: TriageValues;
}

export interface PlannedUpdate {
  recordId: string;
  normalizedTaskId: string | null;
  changes: Partial<TriageValues>;
}

export interface DuplicateGroup {
  normalizedTaskId: string;
  keep: string;
  extra: string[];
}

export interface SyncCounts {
  tasks: number;
  open: number;
  evaluated: number;
  invalidOpen: number;
  byLane: Record<string, number>;
  byStale: Record<string, number>;
  delegable: number;
  duplicateCandidates: number;
  ambiguous: number;
  ownerUnmatched: number;
}

export interface SyncPlan {
  aborted: string | null;
  creates: PlannedCreate[];
  updates: PlannedUpdate[];
  unchanged: number;
  duplicates: DuplicateGroup[];
  issues: Issue[];
  counts: SyncCounts;
}

const EMPTY_VALUES: Omit<TriageValues, 'taskRecordId' | 'rowStatus'> = {
  ownerCanonical: null,
  ownerMatch: null,
  staleState: null,
  staleReason: null,
  delegateEligible: false,
  delegateReason: null,
  delegateSuggestedTo: null,
  laneSuggested: null,
  laneRule: null,
  identityKey: null,
  identityStatus: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Diff helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Treat '' and null as the same value (Airtable returns null for empty text). */
function same(a: unknown, b: unknown): boolean {
  const na = a === '' || a === undefined ? null : a;
  const nb = b === '' || b === undefined ? null : b;
  return na === nb;
}

export function diffValues(current: TriageValues, desired: TriageValues): Partial<TriageValues> {
  const changes: Partial<TriageValues> = {};
  for (const k of Object.keys(desired) as TriageField[]) {
    if (!same(current[k], desired[k])) (changes as Record<string, unknown>)[k] = desired[k];
  }
  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan
// ─────────────────────────────────────────────────────────────────────────────

export function planTriageSync(input: SyncInput): SyncPlan {
  const { tasks, existing, roster, cfg, today } = input;
  const issues: Issue[] = [];
  const counts: SyncCounts = {
    tasks: tasks.length,
    open: 0,
    evaluated: 0,
    invalidOpen: 0,
    byLane: {},
    byStale: {},
    delegable: 0,
    duplicateCandidates: 0,
    ambiguous: 0,
    ownerUnmatched: 0,
  };
  const empty = (aborted: string | null): SyncPlan => ({
    aborted,
    creates: [],
    updates: [],
    unchanged: 0,
    duplicates: [],
    issues,
    counts,
  });

  // 1. Validate rows. Rows without key or source cannot be triaged.
  const usable: TaskRow[] = [];
  for (const t of tasks) {
    const v = validateTask(t);
    issues.push(...v.issues);
    const isOpen = t.lifecycle === 'open';
    if (isOpen) counts.open += 1;
    if (!v.usable) {
      if (isOpen) counts.invalidOpen += 1;
      continue;
    }
    usable.push(t);
  }
  if (counts.open > 0 && (counts.invalidOpen / counts.open) * 100 > cfg.invalidRowsMaxPct) {
    return empty(
      `${counts.invalidOpen} of ${counts.open} open rows are invalid (limit ${cfg.invalidRowsMaxPct}%). Nothing written.`,
    );
  }

  // 2. Identity across sources (open tasks only).
  const openIds = usable.filter((t) => t.lifecycle === 'open').map((t) => t.taskId as string);
  const identities = resolveIdentities({
    openTaskIds: openIds,
    devTicketLinearKey: input.devTicketLinearKey,
    approvalCounterparts: input.approvalCounterparts,
  });

  // 3. Desired values per task key.
  const desiredByKey = new Map<string, { task: TaskRow; values: TriageValues }>();
  for (const t of usable) {
    const key = t.taskId as string;
    if (desiredByKey.has(key)) continue; // Loom's duplicate guard keeps keys unique; first wins if not.
    if (t.lifecycle !== 'open') {
      desiredByKey.set(key, { task: t, values: { taskRecordId: t.recordId, rowStatus: 'closed', ...EMPTY_VALUES } });
      continue;
    }
    const r = evaluateTask(t, roster, cfg, today);
    const id = identities.get(key) ?? { key: null, status: 'unique' };
    counts.evaluated += 1;
    counts.byLane[r.lane.lane] = (counts.byLane[r.lane.lane] ?? 0) + 1;
    counts.byStale[r.stale.state] = (counts.byStale[r.stale.state] ?? 0) + 1;
    if (r.delegate.eligible) counts.delegable += 1;
    if (id.status === 'duplicate_candidate') counts.duplicateCandidates += 1;
    if (id.status === 'ambiguous') counts.ambiguous += 1;
    if (r.owner.match === 'unmatched') {
      counts.ownerUnmatched += 1;
      issues.push({
        code: r.owner.ambiguousWith.length ? 'owner_ambiguous' : 'owner_unmatched',
        recordId: t.recordId,
        detail: r.owner.ambiguousWith.length
          ? `owner "${t.owner}" matches ${r.owner.ambiguousWith.join(', ')}`
          : `owner "${t.owner}" not in team_members`,
      });
    }
    desiredByKey.set(key, {
      task: t,
      values: {
        taskRecordId: t.recordId,
        rowStatus: 'active',
        ownerCanonical: r.owner.canonical,
        ownerMatch: r.owner.match,
        staleState: r.stale.state,
        staleReason: r.stale.reason,
        delegateEligible: r.delegate.eligible,
        delegateReason: r.delegate.reason,
        delegateSuggestedTo: r.delegate.suggestedTo,
        laneSuggested: r.lane.lane,
        laneRule: r.lane.rule,
        identityKey: id.key,
        identityStatus: id.status,
      },
    });
  }

  // 4. Group existing triage rows by key; pick the keeper of each group.
  const groups = new Map<string, ExistingTriage[]>();
  const keyless: ExistingTriage[] = [];
  for (const e of existing) {
    if (!e.normalizedTaskId) {
      keyless.push(e);
      continue;
    }
    if (!groups.has(e.normalizedTaskId)) groups.set(e.normalizedTaskId, []);
    groups.get(e.normalizedTaskId)!.push(e);
  }
  const duplicates: DuplicateGroup[] = [];
  const keeperByKey = new Map<string, ExistingTriage>();
  for (const [key, rows] of groups) {
    if (rows.length === 1) {
      keeperByKey.set(key, rows[0]);
      continue;
    }
    const linked = new Set(desiredByKey.get(key)?.task.triageLinks ?? []);
    const sorted = [...rows].sort((a, b) => a.recordId.localeCompare(b.recordId));
    const keep = sorted.find((r) => linked.has(r.recordId)) ?? sorted[0];
    keeperByKey.set(key, keep);
    duplicates.push({ normalizedTaskId: key, keep: keep.recordId, extra: sorted.filter((r) => r !== keep).map((r) => r.recordId) });
  }

  // 5. Creates and updates.
  const creates: PlannedCreate[] = [];
  const updates: PlannedUpdate[] = [];
  let unchanged = 0;
  for (const [key, d] of desiredByKey) {
    const current = keeperByKey.get(key);
    if (!current) {
      creates.push({ normalizedTaskId: key, values: d.values });
      continue;
    }
    const changes = diffValues(current.values, d.values);
    if (Object.keys(changes).length) updates.push({ recordId: current.recordId, normalizedTaskId: key, changes });
    else unchanged += 1;
  }

  // 6. Orphans: keeper rows whose key has no task any more (or keyless rows).
  for (const [key, row] of keeperByKey) {
    if (desiredByKey.has(key)) continue;
    // A task that exists but was skipped as invalid is not an orphan: leave its row untouched.
    if (tasks.some((t) => t.taskId === key)) {
      unchanged += 1;
      continue;
    }
    const desired: TriageValues = { ...row.values, taskRecordId: null, rowStatus: 'orphan' };
    const changes = diffValues(row.values, desired);
    if (Object.keys(changes).length) updates.push({ recordId: row.recordId, normalizedTaskId: key, changes });
    else unchanged += 1;
  }
  for (const row of keyless) {
    const desired: TriageValues = { ...row.values, taskRecordId: null, rowStatus: 'orphan' };
    const changes = diffValues(row.values, desired);
    if (Object.keys(changes).length) updates.push({ recordId: row.recordId, normalizedTaskId: null, changes });
    else unchanged += 1;
  }

  return { aborted: null, creates, updates, unchanged, duplicates, issues, counts };
}
