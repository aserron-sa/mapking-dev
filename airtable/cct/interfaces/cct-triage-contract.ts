/**
 * cct-triage-contract — MapKMigGon38571
 *
 * Pure logic for the Work · Queue page (spec §5). No Airtable calls, no React, no I/O:
 * the page reads Airtable records, converts them to the plain input types below, and calls
 * these functions. Same input → same output.
 *
 *   buildTriageRows()   one TriageRow per OPEN task: effective lane, owner/domain with
 *                       provenance, stale, delegation, identity (spec 5.1)
 *   validateFilters()   drops invalid filter values and reports each one (spec 5.2)
 *   applyFilters()      OR inside a dimension, AND across dimensions
 *   completeness()      complete / partial and the reasons for the banner (spec 5.3)
 *   checkRequiredFields()  names every missing field (spec 5.4)
 *   laneCounts(), identityGroups(), groupAdjacent(), compareRows(), showStaleBadge()  helpers for the page
 *
 * Triage values (owner, stale, delegate, lane suggestion, identity) are NOT recomputed here:
 * they come from command_center_triages, written by cct-triage-compute.ts. This module only
 * combines them with the user's own task_lanes row (manual lane, overrides, delegation).
 *
 * Used by: airtable/cct/interfaces/WorkQueuePage.tsx (inlined by the build)
 * Tested by: airtable/cct/tests/cct-triage-contract.test.ts
 *
 * Syntax note: only "erasable" TypeScript, same as the other cct-* modules.
 */
import { DOMAINS, LANES, SOURCES } from '../cct-triage-rules.ts';
import type { IdentityStatus, Lane, OwnerMatch, StaleState } from '../cct-triage-rules.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Input types (what the page reads from Airtable, already parsed)
// ─────────────────────────────────────────────────────────────────────────────

/** A command_center_tasks row (Loom's table). */
export interface TaskRecord {
  recordId: string;
  taskId: string | null; // normalized_task_id
  title: string | null;
  source: string | null;
  sourceTable: string | null;
  sourceUrl: string | null;
  statusRaw: string | null;
  dueDate: string | null; // YYYY-MM-DD
  lastUpdatedAt: string | null; // ISO instant
  lifecycle: string | null; // open | closed | not_returned
  sourceStatus: string | null; // ok | stale | unavailable
  domain: string | null; // domain_tag (Loom)
  owner: string | null; // raw owner (Loom)
  category: string | null; // Loom AI
  tags: string[]; // Loom AI
  schedulable: boolean; // Loom AI
}

/** A command_center_triages row (written by cct-triage-compute.ts). */
export interface TriageRecord {
  recordId: string;
  taskRecordId: string | null; // the linked command_center_tasks record
  rowStatus: string | null; // active | closed | orphan
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

/** The CURRENT USER's task_lanes row for a task (the page filters by user before calling). */
export interface LaneRecord {
  recordId: string;
  taskRecordId: string | null;
  lane: string | null;
  rankPosition: number | null;
  actionStatus: string | null; // none | done | dropped | rescheduled
  delegatedTo: string | null;
  domainOverride: string | null;
  ownerOverride: string | null;
}

/** A loom_sync_runs row. */
export interface LoomRun {
  status: string | null; // running | success | partial | failure | rejected_busy | abandoned
  startedAt: string | null; // ISO instant
}

/** Heartbeat fields of the active cct_triage_configs row. */
export interface Heartbeat {
  lastRunAt: string | null; // ISO instant
  lastRunStatus: string | null; // ok | partial | failed
}

// ─────────────────────────────────────────────────────────────────────────────
// Output types (spec 5.1)
// ─────────────────────────────────────────────────────────────────────────────

export type Provenance = 'source' | 'ai' | 'override' | 'rule' | 'manual';

export interface TriageRow {
  recordId: string; // command_center_tasks record
  triageRecordId: string | null; // null until the first run after Loom adds the task
  taskId: string;
  title: string;
  source: string | null;
  sourceTable: string | null;
  sourceUrl: string | null;
  statusRaw: string | null;
  dueDate: string | null;
  lastActivityAt: string | null;
  sourceStatus: string | null;
  domain: { value: string | null; from: 'source' | 'override' };
  owner: { value: string | null; raw: string | null; match: OwnerMatch; from: 'source' | 'override' };
  lane: { value: Lane; basis: 'manual' | 'rule'; rule: string | null; rank: number | null };
  stale: { state: StaleState; reason: string | null };
  delegate: { eligible: boolean; reason: string | null; suggestedTo: string | null; delegatedTo: string | null };
  identity: { key: string | null; status: IdentityStatus };
  ai: { category: string | null; tags: string[]; schedulable: boolean };
  actionStatus: string; // none | done | dropped | rescheduled
  laneRecordId: string | null; // the user's task_lanes row, if any
}

// ─────────────────────────────────────────────────────────────────────────────
// Small guards
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_MATCHES: readonly string[] = ['matched', 'unmatched', 'empty'];
const STALE_STATES: readonly string[] = ['stale', 'fresh', 'unknown', 'excluded'];
const IDENTITY_STATUSES: readonly string[] = ['unique', 'duplicate_candidate', 'ambiguous'];

function oneOf<T extends string>(v: string | null, allowed: readonly string[], fallback: T): T {
  return v !== null && allowed.includes(v) ? (v as T) : fallback;
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Triage rows (spec 5.1)
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildInput {
  tasks: TaskRecord[];
  triages: TriageRecord[];
  /** The current user's task_lanes rows. */
  lanes: LaneRecord[];
}

/**
 * One row per open task with a usable key. Closed and not_returned tasks are left out
 * (Carlos's version listed them: 691 closed vs 146 open on 2026-10-12).
 *
 * Lane: the user's task_lanes row has a lane → manual. Otherwise the suggested lane from
 * command_center_triages → rule. Neither (the script has not run yet) → queued / fallback.
 * Domain and owner: the user's override wins, then the triage owner_canonical, then the raw
 * source value.
 */
export function buildTriageRows(input: BuildInput): TriageRow[] {
  const triageByTask = new Map<string, TriageRecord>();
  for (const t of input.triages) {
    // Only live rows. If a task somehow has two, keep the lowest record id (stable).
    if (!t.taskRecordId || t.rowStatus !== 'active') continue;
    const prev = triageByTask.get(t.taskRecordId);
    if (!prev || t.recordId < prev.recordId) triageByTask.set(t.taskRecordId, t);
  }
  const laneByTask = new Map<string, LaneRecord>();
  for (const l of input.lanes) {
    if (!l.taskRecordId) continue;
    const prev = laneByTask.get(l.taskRecordId);
    if (!prev || l.recordId < prev.recordId) laneByTask.set(l.taskRecordId, l);
  }

  const rows: TriageRow[] = [];
  for (const task of input.tasks) {
    if (task.lifecycle !== 'open' || !task.taskId) continue;
    const triage = triageByTask.get(task.recordId) ?? null;
    const lane = laneByTask.get(task.recordId) ?? null;

    // Lane
    const manualLane = lane?.lane && LANES.includes(lane.lane as Lane) ? (lane.lane as Lane) : null;
    const suggested = triage?.laneSuggested && LANES.includes(triage.laneSuggested as Lane) ? (triage.laneSuggested as Lane) : null;
    let laneOut: TriageRow['lane'];
    if (manualLane) {
      laneOut = { value: manualLane, basis: 'manual', rule: null, rank: lane?.rankPosition ?? null };
    } else if (suggested) {
      laneOut = { value: suggested, basis: 'rule', rule: clean(triage?.laneRule), rank: null };
    } else {
      laneOut = { value: 'queued', basis: 'rule', rule: 'fallback', rank: null };
    }

    // Domain
    const domainOverride = clean(lane?.domainOverride);
    const domain: TriageRow['domain'] = domainOverride
      ? { value: domainOverride, from: 'override' }
      : { value: clean(task.domain), from: 'source' };

    // Owner
    const ownerOverride = clean(lane?.ownerOverride);
    const rawOwner = clean(task.owner);
    let owner: TriageRow['owner'];
    if (ownerOverride) {
      owner = { value: ownerOverride, raw: rawOwner, match: 'matched', from: 'override' };
    } else {
      const value = clean(triage?.ownerCanonical) ?? rawOwner;
      const match = triage ? oneOf<OwnerMatch>(triage.ownerMatch, OWNER_MATCHES, rawOwner ? 'unmatched' : 'empty') : rawOwner ? 'unmatched' : 'empty';
      owner = { value, raw: rawOwner, match, from: 'source' };
    }

    rows.push({
      recordId: task.recordId,
      triageRecordId: triage?.recordId ?? null,
      taskId: task.taskId,
      title: clean(task.title) ?? 'Untitled',
      source: task.source,
      sourceTable: task.sourceTable,
      sourceUrl: clean(task.sourceUrl),
      statusRaw: task.statusRaw,
      dueDate: task.dueDate,
      lastActivityAt: task.lastUpdatedAt,
      sourceStatus: task.sourceStatus,
      domain,
      owner,
      lane: laneOut,
      stale: {
        state: triage ? oneOf<StaleState>(triage.staleState, STALE_STATES, 'unknown') : 'unknown',
        reason: triage ? clean(triage.staleReason) : null,
      },
      delegate: {
        eligible: triage?.delegateEligible === true,
        reason: triage ? clean(triage.delegateReason) : null,
        suggestedTo: triage ? clean(triage.delegateSuggestedTo) : null,
        delegatedTo: clean(lane?.delegatedTo),
      },
      identity: {
        key: triage ? clean(triage.identityKey) : null,
        status: triage ? oneOf<IdentityStatus>(triage.identityStatus, IDENTITY_STATUSES, 'unique') : 'unique',
      },
      ai: { category: task.category, tags: task.tags, schedulable: task.schedulable },
      actionStatus: clean(lane?.actionStatus) ?? 'none',
      laneRecordId: lane?.recordId ?? null,
    });
  }
  return rows;
}

/** The stale badge and the forced Done / Drop / Reschedule prompt are hidden once the user acted. */
export function showStaleBadge(row: TriageRow): boolean {
  return row.stale.state === 'stale' && row.actionStatus === 'none';
}

/** Where each visible value comes from, for the provenance marks in the detail panel. */
export function provenance(row: TriageRow): { lane: Provenance; domain: Provenance; owner: Provenance; category: Provenance } {
  return {
    lane: row.lane.basis === 'manual' ? 'manual' : 'rule',
    domain: row.domain.from === 'override' ? 'override' : 'source',
    owner: row.owner.from === 'override' ? 'override' : 'source',
    category: 'ai',
  };
}

/** Rank (manual order) first, then due date, then title. Stable and total. */
export function compareRows(a: TriageRow, b: TriageRow): number {
  const ra = a.lane.rank ?? Number.POSITIVE_INFINITY;
  const rb = b.lane.rank ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra < rb ? -1 : 1;
  const da = a.dueDate ?? '9999-99-99';
  const db = b.dueDate ?? '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  const t = a.title.localeCompare(b.title);
  return t !== 0 ? t : a.taskId.localeCompare(b.taskId);
}

/** Rows per lane for the tab badges. Every lane is present, even with 0. */
export function laneCounts(rows: TriageRow[]): Record<Lane, number> {
  const out = { on_fire: 0, this_week: 0, waiting_on: 0, queued: 0, icebox: 0 } as Record<Lane, number>;
  for (const r of rows) out[r.lane.value] += 1;
  return out;
}

/** Rows that share an identity key (duplicate candidates and ambiguous), grouped by key. */
export function identityGroups(rows: TriageRow[]): Map<string, TriageRow[]> {
  const groups = new Map<string, TriageRow[]>();
  for (const r of rows) {
    if (r.identity.status === 'unique' || !r.identity.key) continue;
    if (!groups.has(r.identity.key)) groups.set(r.identity.key, []);
    groups.get(r.identity.key)!.push(r);
  }
  for (const g of groups.values()) g.sort(compareRows);
  return groups;
}

/**
 * Keep the given order, but pull the rows that share an identity key next to each other
 * (right after the first member that appears). Only members present in `rows` move, so a
 * filter that hides one half of a pair does not bring it back. Rows are never merged or dropped.
 */
export function groupAdjacent(rows: TriageRow[]): TriageRow[] {
  const byKey = new Map<string, TriageRow[]>();
  for (const r of rows) {
    if (r.identity.status === 'unique' || !r.identity.key) continue;
    if (!byKey.has(r.identity.key)) byKey.set(r.identity.key, []);
    byKey.get(r.identity.key)!.push(r);
  }
  const out: TriageRow[] = [];
  const placed = new Set<string>();
  for (const r of rows) {
    if (placed.has(r.recordId)) continue;
    const group = r.identity.status !== 'unique' && r.identity.key ? byKey.get(r.identity.key)! : [r];
    for (const g of group) {
      placed.add(g.recordId);
      out.push(g);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters (spec 5.2)
// ─────────────────────────────────────────────────────────────────────────────

/** Matches an empty domain ("No domain") or an empty owner ("Unassigned"). */
export const NONE = '__none__';

export interface Filters {
  domain?: string[];
  owner?: string[];
  source?: string[];
  lane?: Lane[];
}

export interface FilterIssue {
  param: string;
  value: string;
  reason: string;
}

const FILTER_PARAMS = ['domain', 'owner', 'source', 'lane'] as const;

/** Distinct, non-empty owners present in the rows (what the owner filter may contain), sorted. */
export function ownersPresent(rows: TriageRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.owner.value) set.add(r.owner.value);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Validate filters restored from saved page state or a URL. Anything unknown is dropped and
 * reported; the page shows each issue and logs one triage_filter_invalid event per page load.
 * Accepts a string or a list per dimension.
 */
export function validateFilters(raw: unknown, allowedOwners: string[]): { valid: Filters; issues: FilterIssue[] } {
  const valid: Filters = {};
  const issues: FilterIssue[] = [];
  if (raw === null || raw === undefined || raw === '') return { valid, issues };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid, issues: [{ param: 'filters', value: String(raw), reason: 'filters must be an object' }] };
  }
  const allowed: Record<(typeof FILTER_PARAMS)[number], readonly string[]> = {
    domain: [...DOMAINS, NONE],
    owner: [...allowedOwners, NONE],
    source: SOURCES,
    lane: LANES,
  };
  for (const [param, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(FILTER_PARAMS as readonly string[]).includes(param)) {
      issues.push({ param, value: JSON.stringify(value), reason: 'unknown filter' });
      continue;
    }
    const key = param as (typeof FILTER_PARAMS)[number];
    const values = Array.isArray(value) ? value : [value];
    const kept: string[] = [];
    for (const v of values) {
      if (typeof v !== 'string') {
        issues.push({ param, value: JSON.stringify(v), reason: 'value must be text' });
        continue;
      }
      if (!allowed[key].includes(v)) {
        issues.push({ param, value: v, reason: `not a valid ${key}` });
        continue;
      }
      if (!kept.includes(v)) kept.push(v);
    }
    if (kept.length) (valid as Record<string, string[]>)[key] = kept;
  }
  return { valid, issues };
}

function matches(selected: string[] | undefined, value: string | null): boolean {
  if (!selected || selected.length === 0) return true;
  if (value === null || value === '') return selected.includes(NONE);
  return selected.includes(value);
}

/** OR inside a dimension, AND across dimensions. No match is an empty list, never an error. */
export function applyFilters(rows: TriageRow[], f: Filters): TriageRow[] {
  return rows.filter(
    (r) =>
      matches(f.domain, r.domain.value) &&
      matches(f.owner, r.owner.value) &&
      matches(f.source, r.source) &&
      matches(f.lane, r.lane.value),
  );
}

/** True when at least one filter dimension has a value (drives the "Clear filters" button). */
export function hasActiveFilters(f: Filters): boolean {
  return FILTER_PARAMS.some((p) => (f[p]?.length ?? 0) > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Completeness (spec 5.3)
// ─────────────────────────────────────────────────────────────────────────────

export interface Completeness {
  status: 'complete' | 'partial';
  reasons: string[];
}

export interface CompletenessInput {
  /** Open tasks as read from command_center_tasks (before the user's filters). */
  tasks: TaskRecord[];
  triages: TriageRecord[];
  /** null = the page cannot read loom_sync_runs (table or fields not exposed). */
  loomRuns: LoomRun[] | null;
  /** null = the page cannot read the cct_triage_configs heartbeat. */
  heartbeat: Heartbeat | null;
  /** The current instant (injected so the function stays pure). */
  now: Date;
  /** Heartbeat older than this is "triage not computed" (spec: 2 hours). */
  maxTriageAgeHours?: number;
}

const FINISHED_LOOM_STATUSES = ['success', 'partial', 'failure'];

export function completeness(input: CompletenessInput): Completeness {
  const reasons: string[] = [];
  const open = input.tasks.filter((t) => t.lifecycle === 'open' && !!t.taskId);

  // 1. Last finished Loom run not clean. running / rejected_busy / abandoned are skipped.
  const finished = (input.loomRuns ?? [])
    .filter((r) => r.status !== null && FINISHED_LOOM_STATUSES.includes(r.status) && !!r.startedAt)
    .sort((a, b) => Date.parse(b.startedAt!) - Date.parse(a.startedAt!));
  const last = finished[0];
  if (input.loomRuns === null) reasons.push('Loom sync status cannot be read');
  else if (last && last.status !== 'success') reasons.push(`Last Loom sync was ${last.status}`);

  // 2. Sources unavailable, named by source.
  const unavailable = new Map<string, number>();
  for (const t of open) {
    if (t.sourceStatus === 'unavailable') unavailable.set(t.source ?? 'Unknown source', (unavailable.get(t.source ?? 'Unknown source') ?? 0) + 1);
  }
  for (const [source, n] of [...unavailable].sort((a, b) => a[0].localeCompare(b[0]))) {
    reasons.push(`${source} unavailable (${n} ${n === 1 ? 'task' : 'tasks'})`);
  }

  // 3. Triage not computed.
  const liveTriage = new Set(input.triages.filter((t) => t.rowStatus === 'active' && t.taskRecordId).map((t) => t.taskRecordId!));
  const missing = open.filter((t) => !liveTriage.has(t.recordId)).length;
  if (missing > 0) reasons.push(`${missing} open ${missing === 1 ? 'task has' : 'tasks have'} no triage yet`);
  const maxAgeMs = (input.maxTriageAgeHours ?? 2) * 3_600_000;
  if (input.heartbeat === null) {
    reasons.push('Triage freshness cannot be read');
  } else {
    const at = input.heartbeat.lastRunAt ? Date.parse(input.heartbeat.lastRunAt) : NaN;
    if (Number.isNaN(at)) {
      reasons.push('Triage has not run yet');
    } else if (input.now.getTime() - at > maxAgeMs) {
      reasons.push(`Triage last ran more than ${input.maxTriageAgeHours ?? 2} hours ago`);
    }
    if (input.heartbeat.lastRunStatus !== null && input.heartbeat.lastRunStatus !== 'ok') {
      reasons.push(`Last triage run was ${input.heartbeat.lastRunStatus}`);
    }
  }

  return { status: reasons.length ? 'partial' : 'complete', reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Required fields (spec 5.4)
// ─────────────────────────────────────────────────────────────────────────────

export interface RequiredFieldsInput {
  /** Table label → ids the page needs → ids that exist and are visible to the extension. */
  tables: { label: string; required: Array<{ id: string; label: string }>; available: string[] }[];
}

/** One message per missing field ("tasks.due_date is not available"). Empty = all present. */
export function checkRequiredFields(input: RequiredFieldsInput): string[] {
  const out: string[] = [];
  for (const t of input.tables) {
    const have = new Set(t.available);
    for (const f of t.required) if (!have.has(f.id)) out.push(`${t.label}.${f.label} (${f.id}) is not available`);
  }
  return out;
}
