/**
 * Today — Daily priority list (MapKMigGon38570)
 *
 * Airtable Interface Extension for Interface 2 → Today.
 * Original by Carlos Olivares (2026-09-17); ranking rebuilt by Andrés Serrón (2026-10-12).
 *
 * Block 3a (this version): ranking operation.
 *   - promote / demote / reorder go through ONE operation: validate → plan → execute
 *     with compensation → log to priority_events → return a response state:
 *       ok · demotion_required · validation_failed · dependency_failed
 *   - Cap of 3 fires; a 4th requires a demote in the same operation.
 *   - Renumbering rule (prototype): remaining fires keep their order, the new one
 *     enters last. Demoted fires go to this_week (never deleted).
 *   - Upsert per user + task: a task that already has a task_lanes row is moved,
 *     never duplicated (so a demoted fire can be promoted again).
 *   - Server-side safety net: automations A/B (task_lanes-integrity.js) repair any
 *     write that breaks the cap or the ranks, whatever surface made it.
 *
 * Blocks 3b (Needs-You on needs_you_signals / waiting_since) and 3c (persisted
 * Power Hour on power_hour_items) are still pending: those sections are unchanged.
 *
 * Schema and IDs: docs/38570/schema.md
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  initializeBlock,
  useRecords,
  useSession,
  useCustomProperties,
} from '@airtable/blocks/interface/ui';
import { Table } from '@airtable/blocks/interface/models';

const ORANGE = '#f0883e';
const RED = '#f0625f';
const GREEN = '#3fb950';
const MUTED = '#6b7280';

// ─────────────────────────────────────────────────────────────────────────────
// Schema (field IDs: renaming a field in Airtable does not break the page)
// ─────────────────────────────────────────────────────────────────────────────

const IDS = {
  tasksTable: 'tblX61yfIFroyhMTj',
  lanesTable: 'tblZhorxkVfKdsW3Z',
  eventsTable: 'tbl0k4YFnduwhMJG2',
  tasks: {
    title: 'fld4JRaVYnwttmi4P',
    owner: 'fldECSTk2LFWGIS6V',
    domainTag: 'fldejhIOeD3YCFRRP',
    source: 'fldceaJIeHpA3Tdae',
    sourceUrl: 'fldqoka4e1FLKxJ6x',
    sourceStatus: 'fldXpO4TchBQJVkhm',
    lastUpdated: 'fldG6wphuQyvtHSIy',
    dueDate: 'fldld41zIqgdNXeyn',
    lifecycle: 'fldzqG2oVnK93COcW',
  },
  lanes: {
    user: 'fldv531mBAE9KL2Yk',
    task: 'fldXRxxIcIxWbZ7ai',
    lane: 'fldHBsnLRIT7RrGv0',
    rank: 'fld1PKtXTsBK17pxD',
    rankedAt: 'fld15soq5jo4j3jxC',
  },
  events: {
    summary: 'fldxNmEoRpB4SRouZ',
    eventType: 'fldu8UXkQBfrIHvZe',
    status: 'fldL2k5qUjcOasDxU',
    source: 'fldIj7BNfY7f13atJ',
    user: 'fldzCkpn3zNyG6Ehm',
    task: 'fldxIN69YVqXAWn0e',
    laneRecordIds: 'fldZTy7U9ktOaIB7L',
    before: 'fldiVSNDCHL5lHjTd',
    after: 'fldxLPzLdJMIP5LoR',
    message: 'fldBZdiRQ4ThpYEgX',
  },
};

const MAX_FIRES = 3;
const ON_FIRE = 'on_fire';
const DEMOTE_LANE = 'this_week';

/**
 * Fields the page reads, by table. Interface Extensions only see the fields that
 * are enabled for the extension in the Interface designer; a field that is not
 * enabled behaves as if it did not exist. Missing fields are listed on screen
 * instead of crashing the page.
 */
const REQUIRED_FIELDS: Record<'tasks' | 'lanes' | 'events', Record<string, string>> = {
  tasks: {
    [IDS.tasks.title]: 'title',
    [IDS.tasks.owner]: 'owner',
    [IDS.tasks.domainTag]: 'domain_tag',
    [IDS.tasks.source]: 'source',
    [IDS.tasks.sourceUrl]: 'source_url',
    [IDS.tasks.sourceStatus]: 'source_status',
    [IDS.tasks.lastUpdated]: 'last_updated_at',
    [IDS.tasks.dueDate]: 'due_date',
    [IDS.tasks.lifecycle]: 'lifecycle',
  },
  lanes: {
    [IDS.lanes.user]: 'user',
    [IDS.lanes.task]: 'task',
    [IDS.lanes.lane]: 'lane',
    [IDS.lanes.rank]: 'rank_position',
    [IDS.lanes.rankedAt]: 'ranked_at',
  },
  events: {
    [IDS.events.summary]: 'summary',
    [IDS.events.eventType]: 'event_type',
    [IDS.events.status]: 'status',
    [IDS.events.source]: 'source',
    [IDS.events.user]: 'user',
    [IDS.events.task]: 'task',
    [IDS.events.laneRecordIds]: 'lane_record_ids',
    [IDS.events.before]: 'before',
    [IDS.events.after]: 'after',
    [IDS.events.message]: 'message',
  },
};

function missingFields(table: Table | undefined, tableLabel: string, fields: Record<string, string>): string[] {
  if (!table) return [`${tableLabel} (table not configured)`];
  return Object.entries(fields)
    .filter(([id]) => !(table as any).getFieldIfExists(id))
    .map(([id, name]) => `${tableLabel} · ${name} (${id})`);
}

/** Reads a cell, returning null instead of throwing when the field is not visible. */
function readCell(record: any, table: Table | undefined, fieldId: string): any {
  if (!table || !(table as any).getFieldIfExists(fieldId)) return null;
  return record.getCellValue(fieldId);
}

function getCustomProperties(base: any) {
  const find = (id: string) => base.tables.find((t: Table) => t.id === id);
  return [
    { key: 'tasksTable', label: 'Tasks', type: 'table' as const, defaultValue: find(IDS.tasksTable) },
    { key: 'fireRanksTable', label: 'Task lanes (fire ranks)', type: 'table' as const, defaultValue: find(IDS.lanesTable) },
    { key: 'eventsTable', label: 'Priority events (log)', type: 'table' as const, defaultValue: find(IDS.eventsTable) },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Text of a cell that may be a string or a select option. */
function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'name' in (v as any)) return (v as any).name;
  return null;
}

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (Number.isNaN(diffMs)) return null;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatDueDate(dateString: string | null): string | null {
  if (!dateString) return null;
  const due = new Date(dateString);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking domain — pure planning (no Airtable calls)
// ─────────────────────────────────────────────────────────────────────────────

type ResponseStatus = 'ok' | 'demotion_required' | 'validation_failed' | 'dependency_failed';

type LaneRow = {
  id: string;
  taskId: string | null;
  lane: string | null;
  rank: number | null;
  rankedAt: string | null;
};

type LaneValues = { lane?: string | null; rank?: number | null; rankedAt?: string | null };

type UpdateWrite = { id: string; to: LaneValues; from: LaneValues };
type PromoteWrite =
  | { kind: 'update'; id: string; to: LaneValues; from: LaneValues }
  | { kind: 'create'; taskId: string; to: LaneValues };

type RankOp =
  | { kind: 'promote'; taskId: string; taskOpen: boolean; demoteRowId?: string }
  | { kind: 'demote'; rowId: string }
  | { kind: 'reorder'; rowId: string; direction: 'up' | 'down' };

type Plan =
  | { status: 'ok'; eventType: 'promote' | 'demote' | 'reorder'; batch: UpdateWrite[]; promote?: PromoteWrite; summary: string }
  | { status: 'demotion_required' | 'validation_failed'; message: string };

function activeFires(rows: LaneRow[]): LaneRow[] {
  return rows
    .filter((r) => r.lane === ON_FIRE)
    .sort((a, b) => {
      const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.rankedAt ?? '').localeCompare(String(b.rankedAt ?? ''));
    });
}

function valuesOf(r: LaneRow): LaneValues {
  return { lane: r.lane, rank: r.rank, rankedAt: r.rankedAt };
}

/** Renumber an ordered list of fires to 1..n; returns only the rows that change. */
function renumber(ordered: LaneRow[]): UpdateWrite[] {
  return ordered.flatMap((r, i) => (r.rank === i + 1 ? [] : [{ id: r.id, to: { rank: i + 1 }, from: { rank: r.rank } }]));
}

function planOperation(op: RankOp, rows: LaneRow[], nowIso: string): Plan {
  const fires = activeFires(rows);

  if (fires.length > MAX_FIRES) {
    return {
      status: 'validation_failed',
      message: `There are ${fires.length} fires; the integrity check is repairing the list. Try again in a few seconds.`,
    };
  }

  if (op.kind === 'promote') {
    if (!op.taskOpen) return { status: 'validation_failed', message: 'This task is no longer open in its source.' };
    if (fires.some((f) => f.taskId === op.taskId)) return { status: 'validation_failed', message: 'This task is already a fire.' };

    let remaining = fires;
    const batch: UpdateWrite[] = [];

    if (fires.length >= MAX_FIRES) {
      if (!op.demoteRowId) {
        return { status: 'demotion_required', message: 'Three is the cap: pick a fire to demote to add this one.' };
      }
      const demoted = fires.find((f) => f.id === op.demoteRowId);
      if (!demoted) return { status: 'validation_failed', message: 'The fire you picked to demote is no longer on the list.' };
      remaining = fires.filter((f) => f.id !== demoted.id);
      batch.push({ id: demoted.id, to: { lane: DEMOTE_LANE, rank: null }, from: valuesOf(demoted) });
    }

    batch.push(...renumber(remaining));
    const newRank = remaining.length + 1;
    const to: LaneValues = { lane: ON_FIRE, rank: newRank, rankedAt: nowIso };
    const existing = rows.find((r) => r.taskId === op.taskId);
    const promote: PromoteWrite = existing
      ? { kind: 'update', id: existing.id, to, from: valuesOf(existing) }
      : { kind: 'create', taskId: op.taskId, to };

    return {
      status: 'ok',
      eventType: 'promote',
      batch,
      promote,
      summary: op.demoteRowId ? `promote → rank ${newRank} (with demote)` : `promote → rank ${newRank}`,
    };
  }

  if (op.kind === 'demote') {
    const target = fires.find((f) => f.id === op.rowId);
    if (!target) return { status: 'validation_failed', message: 'This fire is no longer on the list.' };
    const remaining = fires.filter((f) => f.id !== target.id);
    return {
      status: 'ok',
      eventType: 'demote',
      batch: [{ id: target.id, to: { lane: DEMOTE_LANE, rank: null }, from: valuesOf(target) }, ...renumber(remaining)],
      summary: `demote rank ${target.rank ?? '?'} → ${DEMOTE_LANE}`,
    };
  }

  // reorder
  const index = fires.findIndex((f) => f.id === op.rowId);
  if (index < 0) return { status: 'validation_failed', message: 'This fire is no longer on the list.' };
  const swapWith = op.direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= fires.length) {
    return { status: 'validation_failed', message: `This fire is already ${op.direction === 'up' ? 'first' : 'last'}.` };
  }
  const reordered = [...fires];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
  return {
    status: 'ok',
    eventType: 'reorder',
    batch: renumber(reordered),
    summary: `reorder rank ${index + 1} → ${swapWith + 1}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Airtable side — execution with compensation, and the event log
// ─────────────────────────────────────────────────────────────────────────────

type OpResult = { status: ResponseStatus; message: string };

function laneFields(v: LaneValues): Record<string, unknown> {
  const L = IDS.lanes;
  const f: Record<string, unknown> = {};
  if ('lane' in v) f[L.lane] = v.lane ? { name: v.lane } : null;
  if ('rank' in v) f[L.rank] = v.rank ?? null;
  if ('rankedAt' in v) f[L.rankedAt] = v.rankedAt ?? null;
  return f;
}

class EventLog {
  constructor(private table: Table | undefined, private userId: string | null) {}

  async write(entry: {
    type: string;
    status: ResponseStatus;
    taskId?: string | null;
    laneIds?: string[];
    before?: unknown;
    after?: unknown;
    message?: string;
  }) {
    if (!this.table || !this.table.hasPermissionToCreateRecords()) return;
    const E = IDS.events;
    const fields: Record<string, unknown> = {
      [E.summary]: `${entry.type} · ${entry.status}`,
      [E.eventType]: { name: entry.type },
      [E.status]: { name: entry.status },
      [E.source]: { name: 'extension' },
      [E.laneRecordIds]: (entry.laneIds ?? []).join(','),
      [E.before]: entry.before ? JSON.stringify(entry.before) : '',
      [E.after]: entry.after ? JSON.stringify(entry.after) : '',
      [E.message]: entry.message ?? '',
    };
    if (this.userId) fields[E.user] = { id: this.userId };
    if (entry.taskId) fields[E.task] = [{ id: entry.taskId }];
    try {
      await this.table.createRecordAsync(fields);
    } catch (e) {
      // The log must never break the page.
      console.warn('priority_events write failed', e);
    }
  }
}

class RankingService {
  constructor(private lanes: Table, private log: EventLog, private userId: string) {}

  async run(op: RankOp, rows: LaneRow[]): Promise<OpResult> {
    const taskId =
      op.kind === 'promote' ? op.taskId : rows.find((r) => r.id === (op as any).rowId)?.taskId ?? null;
    const before = activeFires(rows).map((r) => ({ id: r.id, task: r.taskId, rank: r.rank }));
    const plan = planOperation(op, rows, new Date().toISOString());

    if (plan.status !== 'ok') {
      await this.log.write({ type: 'validation_failed', status: plan.status, taskId, before, message: plan.message });
      return { status: plan.status, message: plan.message };
    }

    const needsCreate = plan.promote?.kind === 'create';
    if (!this.lanes.hasPermissionToUpdateRecords() || (needsCreate && !this.lanes.hasPermissionToCreateRecords())) {
      const message = "You don't have permission to change the ranking.";
      await this.log.write({ type: 'validation_failed', status: 'validation_failed', taskId, before, message });
      return { status: 'validation_failed', message };
    }

    // Execute. Order keeps the list valid at every step: demote + renumber first
    // (n-1 fires, ranks 1..n-1), then the promote (n fires, ranks 1..n).
    const undo: Array<() => Promise<unknown>> = [];
    const laneIds = [...plan.batch.map((w) => w.id), ...(plan.promote?.kind === 'update' ? [plan.promote.id] : [])];
    try {
      if (plan.batch.length) {
        await this.lanes.updateRecordsAsync(plan.batch.map((w) => ({ id: w.id, fields: laneFields(w.to) })));
        undo.push(() => this.lanes.updateRecordsAsync(plan.batch.map((w) => ({ id: w.id, fields: laneFields(w.from) }))));
      }
      if (plan.promote?.kind === 'update') {
        const p = plan.promote;
        await this.lanes.updateRecordAsync(p.id, laneFields(p.to));
        undo.push(() => this.lanes.updateRecordAsync(p.id, laneFields(p.from)));
      } else if (plan.promote?.kind === 'create') {
        const p = plan.promote;
        const L = IDS.lanes;
        const newId = await this.lanes.createRecordAsync({
          [L.user]: { id: this.userId },
          [L.task]: [{ id: p.taskId }],
          ...laneFields(p.to),
        });
        laneIds.push(newId);
      }
    } catch (error: any) {
      // Compensation: undo the steps that succeeded, newest first.
      let compensated = true;
      for (const step of undo.reverse()) {
        try {
          await step();
        } catch {
          compensated = false;
        }
      }
      const message = compensated
        ? `Airtable rejected the change (${error?.message ?? 'unknown error'}). Nothing was changed.`
        : `Airtable rejected the change (${error?.message ?? 'unknown error'}) and the rollback did not finish; the integrity check will repair the list.`;
      await this.log.write({ type: 'airtable_error', status: 'dependency_failed', taskId, laneIds, before, message });
      if (undo.length) {
        await this.log.write({
          type: 'compensation',
          status: 'dependency_failed',
          taskId,
          laneIds,
          message: compensated ? 'Rolled back the completed steps.' : 'Rollback incomplete.',
        });
      }
      return { status: 'dependency_failed', message };
    }

    const after = [
      ...plan.batch.map((w) => ({ id: w.id, ...w.to })),
      ...(plan.promote ? [{ id: plan.promote.kind === 'update' ? plan.promote.id : 'new', task: taskId, ...plan.promote.to }] : []),
    ];
    await this.log.write({ type: plan.eventType, status: 'ok', taskId, laneIds, before, after, message: plan.summary });
    return { status: 'ok', message: '' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI components
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ text, color }: { text: string; color?: string }) {
  return (
    <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5" style={color ? { color } : undefined}>
      {text}
    </span>
  );
}

function Notice({ result, onClose }: { result: OpResult | null; onClose: () => void }) {
  if (!result || result.status === 'ok' || result.status === 'demotion_required') return null;
  const color = result.status === 'dependency_failed' ? RED : ORANGE;
  const label = result.status === 'dependency_failed' ? 'Could not save' : 'Not allowed';
  return (
    <div className="mb-4 rounded-md border px-4 py-3 flex items-start justify-between gap-4" style={{ borderColor: color }}>
      <p className="text-sm text-gray-200">
        <span className="font-semibold" style={{ color }}>
          {label}:{' '}
        </span>
        {result.message}
      </p>
      <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-200">
        Dismiss
      </button>
    </div>
  );
}

function FireCard({
  rank,
  title,
  owner,
  domainTag,
  sourceName,
  sourceUrl,
  daysInState,
  dueDate,
  closedInSource,
  missingTask,
  isFirst,
  isLast,
  busy,
  started,
  onStart,
  onDemote,
  onMove,
}: {
  rank: number | null;
  title: string;
  owner: string | null;
  domainTag: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  daysInState: number | null;
  dueDate: string | null;
  closedInSource: boolean;
  missingTask: boolean;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  started: boolean;
  onStart: () => void;
  onDemote: () => void;
  onMove: (direction: 'up' | 'down') => void;
}) {
  const dueLabel = formatDueDate(dueDate);
  return (
    <div className="bg-gray-800 rounded-lg p-4 border-l-4" style={{ borderColor: closedInSource || missingTask ? MUTED : ORANGE }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: ORANGE }}
          title="Stored rank"
        >
          {rank ?? '?'}
        </span>
        <h3 className="text-lg font-bold text-white flex-1">{title}</h3>
        <div className="flex flex-col">
          <button
            onClick={() => onMove('up')}
            disabled={busy || isFirst}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={busy || isLast}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30"
            title="Move down"
          >
            ▼
          </button>
        </div>
      </div>
      <div className="flex gap-2 mb-3 ml-8 flex-wrap">
        {domainTag && <Pill text={domainTag} />}
        {sourceName && <Pill text={sourceName} />}
        {closedInSource && <Pill text="Closed in source" color={RED} />}
        {missingTask && <Pill text="Task no longer available" color={RED} />}
      </div>
      {!missingTask && (
        <div className="text-xs text-gray-500 mb-3 ml-8">
          {owner ?? 'Unassigned'}
          {dueLabel && (
            <>
              {' · '}
              <span style={{ color: dueLabel === 'Overdue' ? RED : undefined }}>{dueLabel}</span>
            </>
          )}
          {daysInState != null && <> · {daysInState}d in state</>}
        </div>
      )}
      <div className="flex gap-3 ml-8">
        {!missingTask && (
          <button
            onClick={onStart}
            className="text-sm text-white px-4 py-2 rounded-md font-medium"
            style={{ backgroundColor: started ? '#3a3a3a' : ORANGE }}
          >
            {started ? 'Focus block running' : 'Start'}
          </button>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-4 py-2"
          >
            Open{sourceName ? ` in ${sourceName}` : ' in source'}
          </a>
        )}
        <button
          onClick={onDemote}
          disabled={busy}
          className="text-sm text-gray-500 hover:text-gray-300 self-center disabled:opacity-40"
        >
          Demote
        </button>
      </div>
    </div>
  );
}

function DemoteModal({
  pendingTaskTitle,
  candidates,
  busy,
  onDemote,
  onCancel,
}: {
  pendingTaskTitle: string;
  candidates: { id: string; title: string; domainTag: string | null; daysInState: number | null; rank: number | null }[];
  busy: boolean;
  onDemote: (rowId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-lg w-full">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ORANGE }}>
          Three is the cap
        </p>
        <p className="text-xl font-bold text-white mb-3">Something has to come off the list</p>
        <p className="text-sm text-gray-400 mb-5">
          You want to add <span className="text-white font-medium">{pendingTaskTitle}</span>. Pick the fire it
          replaces — it drops back to This Week, it doesn't disappear.
        </p>
        <div className="space-y-2 mb-5">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-gray-800 rounded-md px-4 py-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{c.rank ?? '?'}</p>
                <p className="text-sm text-white">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {[c.domainTag, c.daysInState != null ? `${c.daysInState}d in state` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => onDemote(c.id)}
                disabled={busy}
                className="text-sm font-medium disabled:opacity-40"
                style={{ color: ORANGE }}
              >
                {busy ? 'Saving…' : 'Demote'}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-md px-4 py-2 disabled:opacity-40"
          >
            Never mind
          </button>
          <p className="text-xs text-gray-600 italic max-w-[220px] text-right">
            The cap is the feature. Four fires means none of them move.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Needs You (unchanged until block 3b) ─────────────────────────────────────

function NeedsYouRow({
  title,
  domainTag,
  sourceName,
  days,
  sourceUrl,
}: {
  title: string;
  domainTag: string | null;
  sourceName: string | null;
  days: number;
  sourceUrl: string | null;
}) {
  const overdue = days > 3;
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          {domainTag && <span className="text-xs text-gray-500">{domainTag}</span>}
          {sourceName && <Pill text={sourceName} />}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: overdue ? RED : MUTED }}>
            {days}
          </p>
          <p className="text-[10px] text-gray-500">days waiting</p>
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5"
          >
            Unblock
          </a>
        )}
      </div>
    </div>
  );
}

// ── Power Hour (unchanged until block 3c: completion is session-local) ──────

function PowerHour({ seedTasks }: { seedTasks: { id: string; title: string; sourceName: string | null }[] }) {
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [draft, setDraft] = useState('');

  const toggleSeed = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const addCustom = () => {
    if (!draft.trim()) return;
    setCustomItems((prev) => [...prev, { id: `${Date.now()}`, text: draft.trim(), done: false }]);
    setDraft('');
  };
  const toggleCustom = (id: string) => {
    setCustomItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const doneCount = seedTasks.filter((t) => doneIds.has(t.id)).length + customItems.filter((i) => i.done).length;
  const totalCount = seedTasks.length + customItems.length;

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Power Hour</p>
        <p className="text-xs text-gray-500">
          {doneCount} of {totalCount} done
        </p>
      </div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>
        Seeded from your open tasks. Checkmarks are local to this session — persisted completion arrives with the next update.
      </p>
      <div className="space-y-2 mb-4">
        {seedTasks.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm text-gray-200" title={t.title}>
            <input type="checkbox" checked={doneIds.has(t.id)} onChange={() => toggleSeed(t.id)} />
            <span className={doneIds.has(t.id) ? 'line-through text-gray-500 flex-1 truncate' : 'flex-1 truncate'}>
              {t.title}
            </span>
            {t.sourceName && <Pill text={t.sourceName} />}
          </label>
        ))}
        {customItems.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-gray-200">
            <input type="checkbox" checked={item.done} onChange={() => toggleCustom(item.id)} />
            <span className={item.done ? 'line-through text-gray-500 flex-1' : 'flex-1'}>{item.text}</span>
            <Pill text="Manual" />
          </label>
        ))}
        {seedTasks.length === 0 && customItems.length === 0 && (
          <p className="text-sm" style={{ color: MUTED }}>
            Nothing queued for this power hour yet.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Add a manual item…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
        />
        <button onClick={addCustom} className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5">
          Add
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

function TodayApp(): React.ReactElement {
  const session = useSession();
  const currentUser = session.currentUser;
  const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);

  const tasksTable = customPropertyValueByKey.tasksTable as Table | undefined;
  const lanesTable = customPropertyValueByKey.fireRanksTable as Table | undefined;
  const eventsTable = customPropertyValueByKey.eventsTable as Table | undefined;

  const tasksRecords = useRecords(tasksTable ?? null);
  const laneRecords = useRecords(lanesTable ?? null);

  const addFiresRef = useRef<HTMLDetailsElement>(null);
  const [pendingTaskToAdd, setPendingTaskToAdd] = useState<{ id: string; title: string } | null>(null);
  const [startedIds, setStartedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // synchronous guard: blocks double clicks before React re-renders
  const [lastResult, setLastResult] = useState<OpResult | null>(null);

  const T = IDS.tasks;
  const L = IDS.lanes;

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const taskById = useMemo(() => new Map((tasksRecords ?? []).map((t) => [t.id, t])), [tasksRecords]);

  const isOpen = (task: any) => asText(readCell(task, tasksTable, T.lifecycle)) === 'open';

  const getTaskDetails = (task: any) => ({
    title: (readCell(task, tasksTable, T.title) as string) ?? 'Untitled',
    owner: asText(readCell(task, tasksTable, T.owner)),
    domainTag: asText(readCell(task, tasksTable, T.domainTag)),
    sourceName: asText(readCell(task, tasksTable, T.source)),
    sourceUrl: (readCell(task, tasksTable, T.sourceUrl) as string | null) ?? null,
    daysInState: daysSince(readCell(task, tasksTable, T.lastUpdated) as string | null),
    dueDate: (readCell(task, tasksTable, T.dueDate) as string | null) ?? null,
  });

  // ── Lanes of the current user ──────────────────────────────────────────────
  const myRows: LaneRow[] = useMemo(() => {
    if (!laneRecords || !currentUser) return [];
    return laneRecords
      .filter((r) => (readCell(r, lanesTable, L.user) as { id: string } | null)?.id === currentUser.id)
      .map((r) => {
        const links = readCell(r, lanesTable, L.task) as { id: string }[] | null;
        return {
          id: r.id,
          taskId: links && links.length ? links[0].id : null,
          lane: asText(readCell(r, lanesTable, L.lane)),
          rank: (readCell(r, lanesTable, L.rank) as number | null) ?? null,
          rankedAt: (readCell(r, lanesTable, L.rankedAt) as string | null) ?? null,
        };
      });
  }, [laneRecords, currentUser]);

  const fires = useMemo(() => activeFires(myRows), [myRows]);
  const fireTaskIds = useMemo(() => new Set(fires.map((f) => f.taskId).filter(Boolean) as string[]), [fires]);

  // Promotable: open tasks that are not already a fire (tasks in other lanes can be promoted again).
  const availableTasksForFire = useMemo(
    () => (tasksRecords ?? []).filter((t) => isOpen(t) && !fireTaskIds.has(t.id)),
    [tasksRecords, fireTaskIds]
  );

  // ── Needs You (unchanged until block 3b) ───────────────────────────────────
  const okTasks = useMemo(
    () => (tasksRecords ?? []).filter((r) => asText(readCell(r, tasksTable, T.sourceStatus)) === 'ok'),
    [tasksRecords]
  );
  const needsYouTasks = useMemo(
    () =>
      [...okTasks]
        .sort((a, b) => {
          const da = readCell(a, tasksTable, T.lastUpdated) as string | null;
          const db = readCell(b, tasksTable, T.lastUpdated) as string | null;
          if (!da || !db) return 0;
          return new Date(da).getTime() - new Date(db).getTime();
        })
        .slice(0, 10),
    [okTasks]
  );

  // ── Power Hour seed (unchanged until block 3c) ─────────────────────────────
  const powerHourSeed = useMemo(() => {
    const withDetails = availableTasksForFire.map((t) => ({ t, d: getTaskDetails(t) }));
    const short = withDetails.filter(({ d }) => d.title.length <= 60);
    const chosen = (short.length >= 5 ? short : withDetails).slice(0, 5);
    return chosen.map(({ t, d }) => ({ id: t.id, title: d.title, sourceName: d.sourceName }));
  }, [availableTasksForFire]);

  // ── Ranking operation ──────────────────────────────────────────────────────
  const runOp = async (op: RankOp): Promise<OpResult> => {
    if (!lanesTable || !currentUser) {
      return { status: 'dependency_failed', message: 'The task lanes table is not configured.' };
    }
    if (busyRef.current) return { status: 'validation_failed', message: 'Another change is still being saved.' };
    busyRef.current = true;
    setBusy(true);
    setLastResult(null);
    try {
      const service = new RankingService(lanesTable, new EventLog(eventsTable, currentUser.id), currentUser.id);
      const result = await service.run(op, myRows);
      setLastResult(result);
      return result;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleAddFire = async (taskId: string, title: string) => {
    const task = taskById.get(taskId);
    const result = await runOp({ kind: 'promote', taskId, taskOpen: task ? isOpen(task) : false });
    if (result.status === 'demotion_required') setPendingTaskToAdd({ id: taskId, title });
  };

  const handleDemoteAndAdd = async (rowIdToDemote: string) => {
    if (!pendingTaskToAdd) return;
    const task = taskById.get(pendingTaskToAdd.id);
    const result = await runOp({
      kind: 'promote',
      taskId: pendingTaskToAdd.id,
      taskOpen: task ? isOpen(task) : false,
      demoteRowId: rowIdToDemote,
    });
    if (result.status !== 'demotion_required') setPendingTaskToAdd(null);
  };

  const toggleStarted = (taskId: string) => {
    setStartedIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (errorState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <p style={{ color: RED }}>Error loading custom properties.</p>
      </div>
    );
  }
  if (!tasksTable || !lanesTable) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <p className="text-gray-400">Configure the Tasks and Task lanes tables in the properties panel.</p>
      </div>
    );
  }

  const missingRequired = [
    ...missingFields(tasksTable, 'command_center_tasks', REQUIRED_FIELDS.tasks),
    ...missingFields(lanesTable, 'task_lanes', REQUIRED_FIELDS.lanes),
  ];
  const missingLog = missingFields(eventsTable, 'priority_events', REQUIRED_FIELDS.events);
  if (missingRequired.length) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <p className="text-sm font-semibold mb-2" style={{ color: RED }}>
          Today cannot load: these fields are not available to the extension.
        </p>
        <p className="text-sm text-gray-400 mb-3">
          Enable them for this extension in the Interface designer (the extension's data / fields settings), then reload.
        </p>
        <ul className="text-sm text-gray-300 list-disc ml-5">
          {missingRequired.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    );
  }

  const staleCount = needsYouTasks.filter((t) => (getTaskDetails(t).daysInState ?? 0) > 7).length;

  const fireView = (row: LaneRow) => {
    const task = row.taskId ? taskById.get(row.taskId) : undefined;
    const d = task ? getTaskDetails(task) : null;
    return {
      title: d?.title ?? 'Task no longer available',
      domainTag: d?.domainTag ?? null,
      daysInState: d?.daysInState ?? null,
      details: d,
      closedInSource: task ? !isOpen(task) : false,
      missingTask: !task,
    };
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
              Today
            </p>
            <h1 className="text-3xl font-bold text-white">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {fires.length} fire{fires.length !== 1 ? 's' : ''} · {needsYouTasks.length} waiting on others · {staleCount} stale
            </p>
          </div>
          <button
            onClick={() => {
              if (addFiresRef.current) {
                addFiresRef.current.open = true;
                addFiresRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="text-sm text-white px-4 py-2 rounded-md font-medium flex-shrink-0"
            style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}
          >
            Add a fire
          </button>
        </header>

        <Notice result={lastResult} onClose={() => setLastResult(null)} />

        {missingLog.length > 0 && (
          <div className="mb-4 rounded-md border px-4 py-3 text-xs text-gray-300" style={{ borderColor: ORANGE }}>
            <span className="font-semibold" style={{ color: ORANGE }}>
              Event log unavailable:{' '}
            </span>
            changes still work but are not logged. Missing: {missingLog.join(', ')}
          </div>
        )}

        <section className="mb-8">
          <div className="flex items-baseline gap-3 mb-4">
            <p className="text-sm font-bold" style={{ color: ORANGE }}>
              ON FIRE
            </p>
            <p className="text-xs text-gray-500">Hard cap of three. A fourth costs you one.</p>
            {busy && <p className="text-xs" style={{ color: GREEN }}>Saving…</p>}
          </div>

          {fires.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center mb-3">
              <p className="text-gray-400 text-sm">No fires ranked yet. Pick one below to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              {fires.map((row, i) => {
                const v = fireView(row);
                return (
                  <FireCard
                    key={row.id}
                    rank={row.rank}
                    title={v.title}
                    owner={v.details?.owner ?? null}
                    domainTag={v.domainTag}
                    sourceName={v.details?.sourceName ?? null}
                    sourceUrl={v.details?.sourceUrl ?? null}
                    daysInState={v.daysInState}
                    dueDate={v.details?.dueDate ?? null}
                    closedInSource={v.closedInSource}
                    missingTask={v.missingTask}
                    isFirst={i === 0}
                    isLast={i === fires.length - 1}
                    busy={busy}
                    started={row.taskId ? startedIds.has(row.taskId) : false}
                    onStart={() => row.taskId && toggleStarted(row.taskId)}
                    onDemote={() => runOp({ kind: 'demote', rowId: row.id })}
                    onMove={(direction) => runOp({ kind: 'reorder', rowId: row.id, direction })}
                  />
                );
              })}
            </div>
          )}

          <details ref={addFiresRef} className="text-sm">
            <summary className="cursor-pointer text-gray-400">Add a fire from open tasks ({availableTasksForFire.length})</summary>
            <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
              {availableTasksForFire.length === 0 ? (
                <p className="text-xs text-gray-500">No available tasks to add.</p>
              ) : (
                availableTasksForFire.slice(0, 30).map((t) => {
                  const d = getTaskDetails(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleAddFire(t.id, d.title)}
                      disabled={busy}
                      className="flex w-full items-center justify-between gap-2 text-left text-xs text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded px-3 py-2 disabled:opacity-40"
                    >
                      <span className="truncate">{d.title}</span>
                      {d.sourceName && <Pill text={d.sourceName} />}
                    </button>
                  );
                })
              )}
            </div>
          </details>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <p className="text-sm font-bold text-white mb-3">Power Hour</p>
            <PowerHour seedTasks={powerHourSeed} />
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-bold text-white">Needs You</p>
              <p className="text-xs text-gray-500">You are the bottleneck here</p>
            </div>
            <div className="bg-gray-800 rounded-lg px-4">
              {needsYouTasks.length === 0 ? (
                <p className="text-sm py-4" style={{ color: MUTED }}>
                  Nothing needing attention.
                </p>
              ) : (
                needsYouTasks.map((t) => {
                  const d = getTaskDetails(t);
                  return (
                    <NeedsYouRow
                      key={t.id}
                      title={d.title}
                      domainTag={d.domainTag}
                      sourceName={d.sourceName}
                      days={d.daysInState ?? 0}
                      sourceUrl={d.sourceUrl}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {pendingTaskToAdd && (
        <DemoteModal
          pendingTaskTitle={pendingTaskToAdd.title}
          candidates={fires.map((row) => {
            const v = fireView(row);
            return { id: row.id, title: v.title, domainTag: v.domainTag, daysInState: v.daysInState, rank: row.rank };
          })}
          busy={busy}
          onDemote={handleDemoteAndAdd}
          onCancel={() => setPendingTaskToAdd(null)}
        />
      )}
    </div>
  );
}

initializeBlock({ interface: () => <TodayApp /> });
