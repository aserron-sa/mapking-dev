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
 * Block 3b: Needs-You.
 *   - Rule (2026-10-11): an open task is in Needs-You when needs_you_signals (formula
 *     on command_center_tasks) lists at least one of the 5 signals: approval_pending,
 *     ticket_needs_max, linear_label, ai_tag, manual.
 *   - Days waiting = now − waiting_since (stamped by the hourly automation, or here
 *     when Max marks a task). Sorted longest first; red past 3 days.
 *   - Each row shows why it is listed (its signals) and how its date was obtained
 *     (manual / first_seen / estimated). Missing or invalid dates go to the end and
 *     are logged once per session as needs_you_data_issue.
 *   - Max can mark any open task as needing him (signal 5, task_lanes.needs_you_manual)
 *     and unmark it; both are logged as needs_you_mark.
 * 
 * Block 3c: persisted Power Hour.
 *   - Today's checklist lives in power_hour_items (one row per item, per user and
 *     day): order (position), completion (done / done_at), and either a link to a
 *     task or a manual text. It survives reloads; nothing is written to the source.
 *   - Max builds the list: open tasks from a search picker, or manual items.
 *     Suggestions (short open tasks) are advisory only: one click adds them.
 *   - Toggle, reorder (▲▼) and remove; every change is logged as power_hour_update.
 *   - If the power_hour_items fields are not visible to the extension, only this
 *     section shows the missing list; fires and Needs-You keep working.
 *
 * Schema and IDs: docs/38570/schema.md
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  powerTable: 'tblwFsPqbejWWYPmf',
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
    needsYouSignals: 'fld7byISqz2gObpzl',
    waitingSince: 'fldyg45qTxIIhESfp',
    waitingBasis: 'fldi2U965ciOBxxws',
  },
  lanes: {
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
    task: 'fldxIN69YVqXAWn0e',
    laneRecordIds: 'fldZTy7U9ktOaIB7L',
    before: 'fldiVSNDCHL5lHjTd',
    after: 'fldxLPzLdJMIP5LoR',
    message: 'fldBZdiRQ4ThpYEgX',
  },
  power: {
    itemKey: 'fld1uNujJmPLYGMdp',
    user: 'fldRsb0SvtZRsl9DI',
    date: 'fldfPO5yng5qoz5gB',
    position: 'fldYkzdKbVee1UqJL',
    done: 'fldLie1uMaPVSG5C4',
    task: 'fldfuzhbRFcdSjdkM',
    manualText: 'fldSY9AxNxlOECBK3',
    doneAt: 'fldGUZLB1bxB2wTlc',
  },
};

const MAX_FIRES = 3;
const ON_FIRE = 'on_fire';
const DEMOTE_LANE = 'this_week';
/** Lane for a task_lanes row created only to hold Max's manual Needs-You mark (prototype: Waiting On · Blocked on you). */
const NEEDS_YOU_LANE = 'waiting_on';
const NEEDS_YOU_RED_DAYS = 3;

const SIGNAL_LABELS: Record<string, string> = {
  approval_pending: 'Approval pending',
  ticket_needs_max: 'Needs Max input',
  linear_label: 'needs-max label',
  ai_tag: 'AI: needs Max',
  manual: 'Marked by you',
};

const BASIS_LABELS: Record<string, string> = {
  manual: 'since you marked it',
  first_seen: 'since first seen',
  estimated: 'estimated from last update',
};

/**
 * Fields the page reads, by table. Interface Extensions only see the fields that
 * are enabled for the extension in the Interface designer; a field that is not
 * enabled behaves as if it did not exist. Missing fields are listed on screen
 * instead of crashing the page.
 */
const REQUIRED_FIELDS: Record<'tasks' | 'lanes' | 'events' | 'power', Record<string, string>> = {
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
    [IDS.tasks.needsYouSignals]: 'needs_you_signals',
    [IDS.tasks.waitingSince]: 'waiting_since',
    [IDS.tasks.waitingBasis]: 'waiting_since_basis',
  },
  lanes: {
    [IDS.lanes.user]: 'user',
    [IDS.lanes.task]: 'task',
    [IDS.lanes.lane]: 'lane',
    [IDS.lanes.rank]: 'rank_position',
    [IDS.lanes.rankedAt]: 'ranked_at',
    [IDS.lanes.needsYouManual]: 'needs_you_manual',
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
  power: {
    [IDS.power.itemKey]: 'item_key',
    [IDS.power.user]: 'user',
    [IDS.power.date]: 'date',
    [IDS.power.position]: 'position',
    [IDS.power.done]: 'done',
    [IDS.power.task]: 'task',
    [IDS.power.manualText]: 'manual_text',
    [IDS.power.doneAt]: 'done_at',
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
    { key: 'powerHourTable', label: 'Power hour items', type: 'table' as const, defaultValue: find(IDS.powerTable) },
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
  needsYouManual?: boolean;
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
// Needs-You service — Max's manual mark (signal 5)
// ─────────────────────────────────────────────────────────────────────────────

class NeedsYouService {
  constructor(
    private lanes: Table,
    private tasks: Table,
    private log: EventLog,
    private userId: string
  ) {}

  /**
   * Mark or unmark a task as needing Max. Upsert per user + task on task_lanes:
   * an existing row only gets needs_you_manual changed (its lane and rank are
   * untouched); a new row is created in the Waiting On lane. When marking a task
   * that has no waiting date yet, waiting_since is stamped now (basis manual) so
   * the row shows 0 days immediately instead of waiting for the hourly automation.
   */
  async setManual(taskId: string, mark: boolean, rows: LaneRow[], hasWaitingSince: boolean): Promise<OpResult> {
    const L = IDS.lanes;
    const T = IDS.tasks;
    const existing = rows.find((r) => r.taskId === taskId);

    if (!existing && !mark) return { status: 'ok', message: '' };
    if (existing && Boolean(existing.needsYouManual) === mark) return { status: 'ok', message: '' };

    const canWrite = existing ? this.lanes.hasPermissionToUpdateRecords() : this.lanes.hasPermissionToCreateRecords();
    if (!canWrite) {
      const message = "You don't have permission to change Needs-You.";
      await this.log.write({ type: 'validation_failed', status: 'validation_failed', taskId, message });
      return { status: 'validation_failed', message };
    }

    let laneId = existing?.id ?? null;

    // Stamp the date BEFORE the mark: the formula adds the 'manual' signal as soon as
    // the mark lands, and a signal without a date would read as a data issue. If the
    // mark then fails, the hourly automation clears the orphan date. Best effort:
    // the hourly automation stamps the date anyway if this write fails.
    if (mark && !hasWaitingSince && this.tasks.hasPermissionToUpdateRecords()) {
      try {
        await this.tasks.updateRecordAsync(taskId, {
          [T.waitingSince]: new Date().toISOString(),
          [T.waitingBasis]: { name: 'manual' },
        });
      } catch (e) {
        console.warn('waiting_since stamp failed; the hourly automation will stamp it', e);
      }
    }

    try {
      if (existing) {
        await this.lanes.updateRecordAsync(existing.id, { [L.needsYouManual]: mark });
      } else {
        laneId = await this.lanes.createRecordAsync({
          [L.user]: { id: this.userId },
          [L.task]: [{ id: taskId }],
          [L.lane]: { name: NEEDS_YOU_LANE },
          [L.needsYouManual]: true,
        });
      }
    } catch (error: any) {
      const message = `Airtable rejected the change (${error?.message ?? 'unknown error'}). Nothing was changed.`;
      await this.log.write({ type: 'airtable_error', status: 'dependency_failed', taskId, laneIds: laneId ? [laneId] : [], message });
      return { status: 'dependency_failed', message };
    }

    await this.log.write({
      type: 'needs_you_mark',
      status: 'ok',
      taskId,
      laneIds: laneId ? [laneId] : [],
      before: { needs_you_manual: existing ? Boolean(existing.needsYouManual) : null },
      after: { needs_you_manual: mark, lane: existing ? existing.lane : NEEDS_YOU_LANE },
      message: mark ? 'Marked as needing you' : 'Unmarked',
    });
    return { status: 'ok', message: '' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Power Hour service — persisted checklist (power_hour_items)
// ─────────────────────────────────────────────────────────────────────────────

type PowerItem = {
  id: string;
  position: number;
  done: boolean;
  taskId: string | null;
  manualText: string | null;
  title: string;
  sourceName: string | null;
  closedInSource: boolean;
  missingTask: boolean;
};

/** Local calendar day of the viewer, as Airtable stores a date field: YYYY-MM-DD. */
function localDay(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

class PowerHourService {
  constructor(private table: Table, private log: EventLog, private userId: string) {}

  private key(day: string, position: number) {
    return `${day} · ${position}`;
  }

  private async ok(message: string, taskId: string | null, ids: string[], before?: unknown, after?: unknown): Promise<OpResult> {
    await this.log.write({ type: 'power_hour_update', status: 'ok', taskId, laneIds: ids, before, after, message });
    return { status: 'ok', message: '' };
  }

  private async failed(error: any, taskId: string | null, ids: string[]): Promise<OpResult> {
    const message = `Airtable rejected the change (${error?.message ?? 'unknown error'}). Nothing was changed.`;
    await this.log.write({ type: 'airtable_error', status: 'dependency_failed', taskId, laneIds: ids, message });
    return { status: 'dependency_failed', message };
  }

  private async denied(taskId: string | null): Promise<OpResult> {
    const message = "You don't have permission to change the Power Hour.";
    await this.log.write({ type: 'validation_failed', status: 'validation_failed', taskId, message });
    return { status: 'validation_failed', message };
  }

  /** Add a task (link only, no content copied) or a manual item at the end of today's list. */
  async add(day: string, items: PowerItem[], entry: { taskId?: string; text?: string }): Promise<OpResult> {
    const P = IDS.power;
    const text = entry.text?.trim() ?? '';
    if (!entry.taskId && !text) return { status: 'validation_failed', message: 'Write something to add.' };
    const normalize = (s: string | null) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const duplicate = entry.taskId
      ? items.some((i) => i.taskId === entry.taskId)
      : items.some((i) => !i.taskId && normalize(i.manualText) === normalize(text));
    if (duplicate) {
      const message = entry.taskId
        ? "This task is already in today's power hour."
        : "An item with this text is already in today's power hour.";
      await this.log.write({ type: 'validation_failed', status: 'validation_failed', taskId: entry.taskId ?? null, message });
      return { status: 'validation_failed', message };
    }
    if (!this.table.hasPermissionToCreateRecords()) return this.denied(entry.taskId ?? null);

    const position = items.reduce((max, i) => Math.max(max, i.position), 0) + 1;
    try {
      const id = await this.table.createRecordAsync({
        [P.itemKey]: this.key(day, position),
        [P.user]: { id: this.userId },
        [P.date]: day,
        [P.position]: position,
        [P.done]: false,
        ...(entry.taskId ? { [P.task]: [{ id: entry.taskId }] } : { [P.manualText]: text }),
      });
      return this.ok(entry.taskId ? `add task → position ${position}` : `add manual item → position ${position}`, entry.taskId ?? null, [id], undefined, {
        position,
        manual: !entry.taskId,
      });
    } catch (e) {
      return this.failed(e, entry.taskId ?? null, []);
    }
  }

  async toggle(item: PowerItem, done: boolean): Promise<OpResult> {
    const P = IDS.power;
    if (!this.table.hasPermissionToUpdateRecords()) return this.denied(item.taskId);
    try {
      await this.table.updateRecordAsync(item.id, { [P.done]: done, [P.doneAt]: done ? new Date().toISOString() : null });
      return this.ok(done ? 'checked' : 'unchecked', item.taskId, [item.id], { done: item.done }, { done });
    } catch (e) {
      return this.failed(e, item.taskId, [item.id]);
    }
  }

  /** Swap with the neighbour and renumber 1..n in one batch, so the order never has gaps or duplicates. */
  async move(day: string, items: PowerItem[], itemId: string, direction: 'up' | 'down'): Promise<OpResult> {
    const P = IDS.power;
    const index = items.findIndex((i) => i.id === itemId);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= items.length) {
      return { status: 'validation_failed', message: `This item is already ${direction === 'up' ? 'first' : 'last'}.` };
    }
    if (!this.table.hasPermissionToUpdateRecords()) return this.denied(items[index].taskId);
    const reordered = [...items];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    const changes = reordered.flatMap((item, i) =>
      item.position === i + 1 ? [] : [{ id: item.id, fields: { [P.position]: i + 1, [P.itemKey]: this.key(day, i + 1) } }]
    );
    try {
      if (changes.length) await this.table.updateRecordsAsync(changes);
      return this.ok(`reorder ${index + 1} → ${swapWith + 1}`, items[index].taskId, changes.map((c) => c.id),
        items.map((i) => ({ id: i.id, position: i.position })),
        reordered.map((i, n) => ({ id: i.id, position: n + 1 })));
    } catch (e) {
      return this.failed(e, items[index].taskId, changes.map((c) => c.id));
    }
  }

  /** Remove an item from today's list, then close the gap (best effort). */
  async remove(day: string, items: PowerItem[], itemId: string): Promise<OpResult> {
    const P = IDS.power;
    const item = items.find((i) => i.id === itemId);
    if (!item) return { status: 'validation_failed', message: 'This item is no longer on the list.' };
    if (!this.table.hasPermissionToDeleteRecords()) return this.denied(item.taskId);
    try {
      await this.table.deleteRecordAsync(item.id);
    } catch (e) {
      return this.failed(e, item.taskId, [item.id]);
    }
    const rest = items.filter((i) => i.id !== itemId);
    const changes = rest.flatMap((r, i) =>
      r.position === i + 1 ? [] : [{ id: r.id, fields: { [P.position]: i + 1, [P.itemKey]: this.key(day, i + 1) } }]
    );
    try {
      if (changes.length) await this.table.updateRecordsAsync(changes);
    } catch (e) {
      console.warn('power hour renumber after remove failed; order is still consistent', e);
    }
    return this.ok('remove', item.taskId, [item.id], { position: item.position, done: item.done, manual: !item.taskId }, null);
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

// ── Task picker and Needs You ─────────────────────────────────────

/** Shared by "Add a fire" and "Mark a task as needing you". */
function TaskPicker({
  tasks,
  getDetails,
  busy,
  onPick,
  emptyText,
}: {
  tasks: any[];
  getDetails: (task: any) => { title: string; sourceName: string | null };
  busy: boolean;
  onPick: (taskId: string, title: string) => void;
  emptyText: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = tasks
    .map((t) => ({ t, d: getDetails(t) }))
    .filter(({ d }) => !q || d.title.toLowerCase().includes(q))
    .slice(0, 30);
  return (
    <div className="mt-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search open tasks…"
        className="w-full mb-2 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-white"
      />
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">{emptyText}</p>
        ) : (
          rows.map(({ t, d }) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id, d.title)}
              disabled={busy}
              className="flex w-full items-center justify-between gap-2 text-left text-xs text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded px-3 py-2 disabled:opacity-40"
            >
              <span className="truncate">{d.title}</span>
              {d.sourceName && <Pill text={d.sourceName} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

type NeedsYouItem = {
  taskId: string;
  title: string;
  domainTag: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  signals: string[];
  waitingSince: string | null;
  basis: string | null;
  days: number | null;
  issue: string | null;
};

function NeedsYouRow({ item, busy, onUnmark }: { item: NeedsYouItem; busy: boolean; onUnmark: () => void }) {
  const red = item.days != null && item.days > NEEDS_YOU_RED_DAYS;
  const estimated = item.basis === 'estimated';
  const sinceText = item.waitingSince
    ? `${BASIS_LABELS[item.basis ?? ''] ?? 'since'} · ${new Date(item.waitingSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : item.issue ?? '';
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.signals.map((s) => (
            <Pill key={s} text={SIGNAL_LABELS[s] ?? s} color={ORANGE} />
          ))}
          {item.domainTag && <span className="text-xs text-gray-500">{item.domainTag}</span>}
          {item.sourceName && <Pill text={item.sourceName} />}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        <div className="text-right" title={sinceText}>
          <p className="text-lg font-bold" style={{ color: red ? RED : MUTED }}>
            {item.days == null ? '—' : `${estimated ? '~' : ''}${item.days}`}
          </p>
          <p className="text-[10px] text-gray-500">{item.days == null ? 'date pending' : 'days waiting'}</p>
        </div>
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5"
          >
            Unblock
          </a>
        )}
        {item.signals.includes('manual') && (
          <button
            onClick={onUnmark}
            disabled={busy}
            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
            title="Remove your manual mark"
          >
            Unmark
          </button>
        )}
      </div>
    </div>
  );
}

// ── Power Hour (persisted) ──────

function PowerHour({
  items,
  suggestions,
  pickerTasks,
  getDetails,
  busy,
  unavailable,
  onAddTask,
  onAddManual,
  onToggle,
  onMove,
  onRemove,
}: {
  items: PowerItem[];
  suggestions: { id: string; title: string; sourceName: string | null }[];
  pickerTasks: any[];
  getDetails: (task: any) => { title: string; sourceName: string | null };
  busy: boolean;
  unavailable: string[];
  onAddTask: (taskId: string) => void;
  onAddManual: (text: string) => Promise<OpResult>;
  onToggle: (item: PowerItem) => void;
  onMove: (item: PowerItem, direction: 'up' | 'down') => void;
  onRemove: (item: PowerItem) => void;
}) {
  const [draft, setDraft] = useState('');

  if (unavailable.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Power Hour</p>
        <p className="text-sm mb-2" style={{ color: ORANGE }}>
          The Power Hour cannot load: enable these fields for the extension, then reload.
        </p>
        <ul className="text-xs text-gray-300 list-disc ml-5">
          {unavailable.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    );
  }

  const doneCount = items.filter((i) => i.done).length;
  const addManual = async () => {
    if (!draft.trim()) return;
    const result = await onAddManual(draft);
    if (result.status === 'ok') setDraft('');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Power Hour</p>
        <p className="text-xs text-gray-500">
          {doneCount} of {items.length} done
        </p>
      </div>
      <p className="text-xs mb-4" style={{ color: MUTED }}>
        Today's quick wins. Saved as you go: order and checkmarks stay when you come back.
      </p>

      <div className="space-y-2 mb-4">
        {items.length === 0 && (
          <p className="text-sm" style={{ color: MUTED }}>
            Nothing queued for this power hour yet.
          </p>
        )}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 text-sm text-gray-200" title={item.title}>
            <input type="checkbox" checked={item.done} disabled={busy} onChange={() => onToggle(item)} />
            <span className={item.done ? 'line-through text-gray-500 flex-1 truncate' : 'flex-1 truncate'}>{item.title}</span>
            {item.closedInSource && <Pill text="Closed in source" color={RED} />}
            {item.missingTask && <Pill text="Task no longer available" color={RED} />}
            {item.taskId ? item.sourceName && <Pill text={item.sourceName} /> : <Pill text="Manual" />}
            <button
              onClick={() => onMove(item, 'up')}
              disabled={busy || i === 0}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-30"
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={() => onMove(item, 'down')}
              disabled={busy || i === items.length - 1}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-30"
              title="Move down"
            >
              ▼
            </button>
            <button
              onClick={() => onRemove(item)}
              disabled={busy}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
              title="Remove from today's power hour"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Suggested · short open tasks</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => onAddTask(s.id)}
                disabled={busy}
                className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-2 py-1 hover:text-white disabled:opacity-40 max-w-full truncate"
                title={`Add: ${s.title}`}
              >
                + {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManual()}
          placeholder="Add a manual item…"
          disabled={busy}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
        />
        <button
          onClick={addManual}
          disabled={busy}
          className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <details className="text-sm mt-3">
        <summary className="cursor-pointer text-gray-400">Add an open task</summary>
        <TaskPicker
          tasks={pickerTasks}
          getDetails={getDetails}
          busy={busy}
          onPick={(taskId) => onAddTask(taskId)}
          emptyText="No open tasks to add."
        />
      </details>
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
  const powerTable = customPropertyValueByKey.powerHourTable as Table | undefined;

  const tasksRecords = useRecords(tasksTable ?? null);
  const laneRecords = useRecords(lanesTable ?? null);
  const powerRecords = useRecords(powerTable ?? null);

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
          needsYouManual: Boolean(readCell(r, lanesTable, L.needsYouManual)),
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

  // ── Needs You ─────────────────────────────────────────────────────────────────────
  // Open tasks with at least one signal. Valid dates sort longest-waiting first;
  // missing or invalid dates go to the end with the reason in `issue`.
  const needsYouItems: NeedsYouItem[] = useMemo(() => {
    const nowMs = Date.now();
    const items = (tasksRecords ?? [])
      .filter((t) => isOpen(t))
      .map((t) => {
        const signals = String(readCell(t, tasksTable, T.needsYouSignals) ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (!signals.length) return null;
        const d = getTaskDetails(t);
        const waitingSince = (readCell(t, tasksTable, T.waitingSince) as string | null) ?? null;
        const basis = asText(readCell(t, tasksTable, T.waitingBasis));
        const ms = waitingSince ? new Date(waitingSince).getTime() : NaN;
        let issue: string | null = null;
        let days: number | null = null;
        if (!waitingSince) issue = 'waiting_since not stamped yet (hourly automation pending)';
        else if (Number.isNaN(ms)) issue = `waiting_since is not a valid date (${waitingSince})`;
        else if (ms > nowMs + 60_000) issue = `waiting_since ${waitingSince} is in the future`;
        else days = Math.floor((nowMs - ms) / (1000 * 60 * 60 * 24));
        return {
          taskId: t.id,
          title: d.title,
          domainTag: d.domainTag,
          sourceName: d.sourceName,
          sourceUrl: d.sourceUrl,
          signals,
          waitingSince,
          basis,
          days,
          issue,
        } as NeedsYouItem;
      })
      .filter(Boolean) as NeedsYouItem[];
    return items.sort((a, b) => {
      if (a.days == null && b.days == null) return a.title.localeCompare(b.title);
      if (a.days == null) return 1;
      if (b.days == null) return -1;
      if (a.days !== b.days) return b.days - a.days;
      return a.title.localeCompare(b.title);
    });
  }, [tasksRecords, tasksTable]);

  const needsYouTaskIds = useMemo(() => new Set(needsYouItems.map((i) => i.taskId)), [needsYouItems]);
  const markableTasks = useMemo(
    () => (tasksRecords ?? []).filter((t) => isOpen(t) && !needsYouTaskIds.has(t.id)),
    [tasksRecords, needsYouTaskIds]
  );
  const overThreeDays = needsYouItems.filter((i) => i.days != null && i.days > NEEDS_YOU_RED_DAYS).length;

  // Data-quality log: each missing/invalid date is logged once per page session.
  // Skipped while a change is being saved, so intermediate states are not logged.
  const loggedIssues = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUser || busy) return;
    const fresh = needsYouItems.filter((i) => i.issue && !loggedIssues.current.has(`${i.taskId}|${i.issue}`));
    if (!fresh.length) return;
    const log = new EventLog(eventsTable, currentUser.id);
    fresh.forEach((i) => {
      loggedIssues.current.add(`${i.taskId}|${i.issue}`);
      log.write({ type: 'needs_you_data_issue', status: 'validation_failed', taskId: i.taskId, message: i.issue ?? '' });
    });
  }, [needsYouItems, eventsTable, currentUser, busy]);

  // ── Power Hour (persisted in power_hour_items) ────────────────────────────────────
  const today = localDay();
  const PW = IDS.power;
  const powerMissing = missingFields(powerTable, 'power_hour_items', REQUIRED_FIELDS.power);

  // Today's items of the current user, in their stored order.
  const powerItems: PowerItem[] = useMemo(() => {
    if (!powerRecords || !currentUser || powerMissing.length) return [];
    return powerRecords
      .filter(
        (r) =>
          (readCell(r, powerTable, PW.user) as { id: string } | null)?.id === currentUser.id &&
          readCell(r, powerTable, PW.date) === today
      )
      .map((r) => {
        const links = readCell(r, powerTable, PW.task) as { id: string }[] | null;
        const taskId = links && links.length ? links[0].id : null;
        const task = taskId ? taskById.get(taskId) : undefined;
        const manualText = (readCell(r, powerTable, PW.manualText) as string | null) ?? null;
        return {
          id: r.id,
          position: (readCell(r, powerTable, PW.position) as number | null) ?? Number.MAX_SAFE_INTEGER,
          done: Boolean(readCell(r, powerTable, PW.done)),
          taskId,
          manualText,
          title: task ? getTaskDetails(task).title : taskId ? 'Task no longer available' : manualText ?? 'Untitled',
          sourceName: task ? getTaskDetails(task).sourceName : null,
          closedInSource: task ? !isOpen(task) : false,
          missingTask: Boolean(taskId) && !task,
        };
      })
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }, [powerRecords, currentUser, powerTable, today, taskById, powerMissing.length]);

  const powerTaskIds = useMemo(() => new Set(powerItems.map((i) => i.taskId).filter(Boolean) as string[]), [powerItems]);

  // Open tasks that can be added (not fires, not already in today's list).
  const powerPickerTasks = useMemo(
    () => availableTasksForFire.filter((t) => !powerTaskIds.has(t.id)),
    [availableTasksForFire, powerTaskIds]
  );

  // Advisory suggestions: short titles read as quick wins. One click adds them; nothing is added automatically.
  const powerSuggestions = useMemo(
    () =>
      powerPickerTasks
        .map((t) => ({ id: t.id, ...getTaskDetails(t) }))
        .filter((d) => d.title.length <= 60)
        .slice(0, 4)
        .map((d) => ({ id: d.id, title: d.title, sourceName: d.sourceName })),
    [powerPickerTasks]
  );

  // ── Operations (one at a time: double clicks are blocked synchronously) ────────
  const guarded = async (fn: () => Promise<OpResult>): Promise<OpResult> => {
    if (busyRef.current) return { status: 'validation_failed', message: 'Another change is still being saved.' };
    busyRef.current = true;
    setBusy(true);
    setLastResult(null);
    try {
      const result = await fn();
      setLastResult(result);
      return result;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const runOp = async (op: RankOp): Promise<OpResult> => {
    if (!lanesTable || !currentUser) {
      return { status: 'dependency_failed', message: 'The task lanes table is not configured.' };
    }
    return guarded(() =>
      new RankingService(lanesTable, new EventLog(eventsTable, currentUser.id), currentUser.id).run(op, myRows)
    );
  };

  const setNeedsYou = async (taskId: string, mark: boolean): Promise<OpResult> => {
    if (!lanesTable || !tasksTable || !currentUser) {
      return { status: 'dependency_failed', message: 'The task lanes table is not configured.' };
    }
    const task = taskById.get(taskId);
    if (mark && (!task || !isOpen(task))) {
      const result: OpResult = { status: 'validation_failed', message: 'This task is no longer open in its source.' };
      setLastResult(result);
      return result;
    }
    const hasWaitingSince = task ? Boolean(readCell(task, tasksTable, T.waitingSince)) : false;
    return guarded(() =>
      new NeedsYouService(lanesTable, tasksTable, new EventLog(eventsTable, currentUser.id), currentUser.id).setManual(
        taskId,
        mark,
        myRows,
        hasWaitingSince
      )
    );
  };

  const powerOp = (fn: (service: PowerHourService) => Promise<OpResult>): Promise<OpResult> => {
    if (!powerTable || !currentUser || powerMissing.length) {
      return Promise.resolve({ status: 'dependency_failed', message: 'The power hour table is not available.' } as OpResult);
    }
    return guarded(() => fn(new PowerHourService(powerTable, new EventLog(eventsTable, currentUser.id), currentUser.id)));
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
              {fires.length} fire{fires.length !== 1 ? 's' : ''} · {needsYouItems.length} need{needsYouItems.length === 1 ? 's' : ''} you ·{' '}
              {overThreeDays} waiting over {NEEDS_YOU_RED_DAYS} days
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
            <TaskPicker
              tasks={availableTasksForFire}
              getDetails={getTaskDetails}
              busy={busy}
              onPick={handleAddFire}
              emptyText="No available tasks to add."
            />
          </details>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <p className="text-sm font-bold text-white mb-3">Power Hour</p>
            <PowerHour
              items={powerItems}
              suggestions={powerSuggestions}
              pickerTasks={powerPickerTasks}
              getDetails={getTaskDetails}
              busy={busy}
              unavailable={powerMissing}
              onAddTask={(taskId) => powerOp((s) => s.add(today, powerItems, { taskId }))}
              onAddManual={(text) => powerOp((s) => s.add(today, powerItems, { text }))}
              onToggle={(item) => powerOp((s) => s.toggle(item, !item.done))}
              onMove={(item, direction) => powerOp((s) => s.move(today, powerItems, item.id, direction))}
              onRemove={(item) => powerOp((s) => s.remove(today, powerItems, item.id))}
            />
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-bold text-white">Needs You</p>
              <p className="text-xs text-gray-500">People waiting on you · longest first</p>
            </div>
            <div className="bg-gray-800 rounded-lg px-4">
              {needsYouItems.length === 0 ? (
                <p className="text-sm py-4" style={{ color: MUTED }}>
                  Nobody is waiting on you right now.
                </p>
              ) : (
                needsYouItems.map((item) => (
                  <NeedsYouRow key={item.taskId} item={item} busy={busy} onUnmark={() => setNeedsYou(item.taskId, false)} />
                ))
              )}
            </div>
            <details className="text-sm mt-3">
              <summary className="cursor-pointer text-gray-400">Mark a task as needing you</summary>
              <TaskPicker
                tasks={markableTasks}
                getDetails={getTaskDetails}
                busy={busy}
                onPick={(taskId) => setNeedsYou(taskId, true)}
                emptyText="No open tasks to mark."
              />
            </details>
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
