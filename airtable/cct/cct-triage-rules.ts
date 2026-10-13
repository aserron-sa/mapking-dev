/**
 * cct-triage-rules — MapKMigGon38571
 *
 * Pure triage rules for command_center_tasks. No Airtable calls, no I/O, no AI:
 * same input → same output. Used by:
 *   - airtable/cct/automations/cct-triage-compute.ts (hourly automation; inlined by the build)
 *   - airtable/cct/interfaces/WorkQueuePage.tsx        (custom interface component; inlined by the build)
 *   - airtable/cct/tests/cct-triage-rules.test.ts      (node --test)
 *
 * Rules are specified in docs/stories/MapKMigGon38571/spec.md §4. Keep both in sync.
 *
 * Syntax note: only "erasable" TypeScript (types, interfaces, `as`, `type` imports).
 * No enums, namespaces or parameter properties, so Node 22 can run it directly and
 * the build can strip types without a compiler.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Lane = 'on_fire' | 'this_week' | 'waiting_on' | 'queued' | 'icebox';
export type SuggestedLane = Exclude<Lane, 'on_fire'>;
export type StaleState = 'stale' | 'fresh' | 'unknown' | 'excluded';
export type OwnerMatch = 'matched' | 'unmatched' | 'empty';
export type IdentityStatus = 'unique' | 'duplicate_candidate' | 'ambiguous';

export const LANES: readonly Lane[] = ['on_fire', 'this_week', 'waiting_on', 'queued', 'icebox'];
export const SUGGESTED_LANES: readonly SuggestedLane[] = ['this_week', 'waiting_on', 'queued', 'icebox'];
export const DOMAINS: readonly string[] = ['Sales', 'Delivery', 'Product', 'QA', 'Revenue', 'Ops'];
export const SOURCES: readonly string[] = ['Attio', 'Linear', 'Airtable', 'Google Calendar', 'Manual'];

/** One active row of triage_configs, already parsed. */
export interface TriageConfig {
  timezone: string;
  staleInactiveDays: number;
  staleOverdueDays: number;
  staleExcludeSources: string[];
  thisWeekHorizonDays: number;
  iceboxInactiveDays: number;
  waitingOnTags: string[];
  delegateExcludeTags: string[];
  delegateRequireSchedulable: boolean;
  delegateEmptyOwnerIsCeo: boolean;
  invalidRowsMaxPct: number;
}

/** One row of team_members, already parsed. */
export interface TeamMember {
  recordId: string;
  name: string;
  aliases: string[];
  email: string | null;
  isCeo: boolean;
  receivesDelegation: boolean;
  domains: string[];
  active: boolean;
}

/** The fields of a command_center_tasks row that the rules read. */
export interface TaskInput {
  recordId: string;
  taskId: string | null; // normalized_task_id
  source: string | null;
  domain: string | null; // domain_tag (Loom)
  owner: string | null; // raw owner (Loom)
  dueDate: string | null; // YYYY-MM-DD
  lastUpdatedAt: string | null; // ISO instant, source activity
  lifecycle: string | null; // open | closed | not_returned
  tags: string[]; // Loom AI tags
  schedulable: boolean; // Loom AI
}

export interface OwnerResult {
  canonical: string | null;
  match: OwnerMatch;
  member: TeamMember | null;
  /** Set when the raw owner matched more than one member. */
  ambiguousWith: string[];
}

export interface LaneResult {
  lane: SuggestedLane;
  rule: string;
}

export interface StaleResult {
  state: StaleState;
  reason: string;
}

export interface DelegateResult {
  eligible: boolean;
  reason: string;
  suggestedTo: string | null;
}

export interface IdentityResult {
  key: string | null;
  status: IdentityStatus;
}

export type IssueCode =
  | 'missing_task_id'
  | 'missing_source'
  | 'invalid_due_date'
  | 'invalid_last_updated_at'
  | 'owner_unmatched'
  | 'owner_ambiguous';

export interface Issue {
  code: IssueCode;
  recordId: string;
  detail: string;
}

/** Everything the automation writes to command_center_triages for an open task. */
export interface TriageResult {
  owner: OwnerResult;
  lane: LaneResult;
  stale: StaleResult;
  delegate: DelegateResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: TriageConfig = {
  timezone: 'America/Chicago',
  staleInactiveDays: 7,
  staleOverdueDays: 2,
  staleExcludeSources: ['Google Calendar'],
  thisWeekHorizonDays: 7,
  iceboxInactiveDays: 30,
  waitingOnTags: ['waiting-on-external'],
  delegateExcludeTags: ['needs-max'],
  delegateRequireSchedulable: true,
  delegateEmptyOwnerIsCeo: true,
  invalidRowsMaxPct: 10,
};

/**
 * Validate a parsed config. Returns the list of problems; empty = usable.
 * Raw Airtable values are parsed by the caller (field IDs live there).
 */
export function validateConfig(c: Partial<TriageConfig>): string[] {
  const problems: string[] = [];
  const nonNegInt = (k: keyof TriageConfig) => {
    const v = c[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) problems.push(`${k} must be an integer >= 0`);
  };
  nonNegInt('staleInactiveDays');
  nonNegInt('staleOverdueDays');
  nonNegInt('thisWeekHorizonDays');
  nonNegInt('iceboxInactiveDays');
  nonNegInt('invalidRowsMaxPct');
  if (typeof c.invalidRowsMaxPct === 'number' && c.invalidRowsMaxPct > 100) problems.push('invalidRowsMaxPct must be <= 100');
  if (!c.timezone || !isValidTimeZone(c.timezone)) problems.push(`timezone "${c.timezone ?? ''}" is not a valid IANA time zone`);
  for (const k of ['staleExcludeSources', 'waitingOnTags', 'delegateExcludeTags'] as const) {
    if (!Array.isArray(c[k])) problems.push(`${k} must be a list`);
  }
  for (const k of ['delegateRequireSchedulable', 'delegateEmptyOwnerIsCeo'] as const) {
    if (typeof c[k] !== 'boolean') problems.push(`${k} must be true or false`);
  }
  return problems;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates (calendar days in the configured time zone)
// ─────────────────────────────────────────────────────────────────────────────

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isDateOnly(s: string | null | undefined): s is string {
  if (!s) return false;
  const m = DATE_ONLY.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function dateInZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Whole calendar days from a to b (b − a). Both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const pa = DATE_ONLY.exec(a)!;
  const pb = DATE_ONLY.exec(b)!;
  const ta = Date.UTC(+pa[1], +pa[2] - 1, +pa[3]);
  const tb = Date.UTC(+pb[1], +pb[2] - 1, +pb[3]);
  return Math.round((tb - ta) / 86_400_000);
}

/** Calendar date of an ISO instant in the zone, or null when it does not parse. */
export function instantToDate(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return dateInZone(new Date(t), timeZone);
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner (spec §4.1)
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercase, strip accents, collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchOwner(raw: string | null, roster: TeamMember[]): OwnerResult {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return { canonical: null, match: 'empty', member: null, ambiguousWith: [] };
  const needle = normalizeName(trimmed);
  const hits = roster.filter((m) => {
    if (!m.active) return false;
    const keys = [m.name, ...m.aliases, ...(m.email ? [m.email] : [])].map(normalizeName);
    return keys.includes(needle);
  });
  if (hits.length === 1) return { canonical: hits[0].name, match: 'matched', member: hits[0], ambiguousWith: [] };
  return {
    canonical: trimmed,
    match: 'unmatched',
    member: null,
    ambiguousWith: hits.length > 1 ? hits.map((h) => h.name).sort() : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lane suggested (spec §4.2) — first rule that applies wins, never on_fire
// ─────────────────────────────────────────────────────────────────────────────

export function suggestLane(task: TaskInput, cfg: TriageConfig, today: string): LaneResult {
  const waitingTag = cfg.waitingOnTags.find((t) => task.tags.includes(t));
  if (waitingTag) return { lane: 'waiting_on', rule: `waiting_on_tag:${waitingTag}` };

  if (isDateOnly(task.dueDate)) {
    const daysToDue = daysBetween(today, task.dueDate);
    if (daysToDue < 0) return { lane: 'this_week', rule: 'overdue' };
    if (daysToDue <= cfg.thisWeekHorizonDays) return { lane: 'this_week', rule: `due_within:${cfg.thisWeekHorizonDays}d` };
    return { lane: 'queued', rule: 'default' };
  }

  const activity = instantToDate(task.lastUpdatedAt, cfg.timezone);
  if (activity && daysBetween(activity, today) >= cfg.iceboxInactiveDays) {
    return { lane: 'icebox', rule: `inactive_no_due:${cfg.iceboxInactiveDays}d` };
  }
  return { lane: 'queued', rule: 'default' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale (spec §4.3)
// ─────────────────────────────────────────────────────────────────────────────

export function staleState(task: TaskInput, cfg: TriageConfig, today: string): StaleResult {
  if (task.source && cfg.staleExcludeSources.includes(task.source)) {
    return { state: 'excluded', reason: `Source excluded (${task.source})` };
  }
  if (isDateOnly(task.dueDate)) {
    const overdue = daysBetween(task.dueDate, today);
    if (overdue >= cfg.staleOverdueDays && overdue > 0) {
      return { state: 'stale', reason: `Overdue ${overdue} days (limit ${cfg.staleOverdueDays})` };
    }
  }
  const activity = instantToDate(task.lastUpdatedAt, cfg.timezone);
  if (!activity) return { state: 'unknown', reason: 'No activity date' };
  const inactive = daysBetween(activity, today);
  if (inactive >= cfg.staleInactiveDays) {
    return { state: 'stale', reason: `${inactive} days without activity (limit ${cfg.staleInactiveDays})` };
  }
  return { state: 'fresh', reason: inactive <= 0 ? 'Active today' : `Active ${inactive} days ago` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delegation (spec §4.4)
// ─────────────────────────────────────────────────────────────────────────────

export function delegation(
  task: TaskInput,
  owner: OwnerResult,
  roster: TeamMember[],
  cfg: TriageConfig,
): DelegateResult {
  const no = (reason: string): DelegateResult => ({ eligible: false, reason: `Not delegable: ${reason}`, suggestedTo: null });

  if (task.lifecycle !== 'open') return no('task not open');

  let ownerReason: string;
  if (owner.match === 'empty') {
    if (!cfg.delegateEmptyOwnerIsCeo) return no('no owner');
    ownerReason = 'no owner (counted as CEO)';
  } else if (owner.member?.isCeo) {
    ownerReason = 'CEO-owned';
  } else {
    return no(`owner is ${owner.canonical ?? 'not the CEO'}`);
  }

  const blocking = cfg.delegateExcludeTags.find((t) => task.tags.includes(t));
  if (blocking) return no(`tag ${blocking}`);

  if (cfg.delegateRequireSchedulable && !task.schedulable) return no('not schedulable');

  const candidates = roster
    .filter((m) => m.active && m.receivesDelegation && !m.isCeo && !!task.domain && m.domains.includes(task.domain))
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b));

  const parts = [ownerReason];
  if (cfg.delegateRequireSchedulable) parts.push('schedulable');
  if (cfg.delegateExcludeTags.length) parts.push(`no ${cfg.delegateExcludeTags.join('/')} tag`);
  return { eligible: true, reason: parts.join(', '), suggestedTo: candidates[0] ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Row validation and per-task evaluation
// ─────────────────────────────────────────────────────────────────────────────

/** Problems that make a row unusable (it is skipped) plus data warnings. */
export function validateTask(task: TaskInput): { usable: boolean; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (code: IssueCode, detail: string) => issues.push({ code, recordId: task.recordId, detail });
  if (!task.taskId) add('missing_task_id', 'normalized_task_id is empty');
  if (!task.source) add('missing_source', 'source is empty');
  if (task.dueDate && !isDateOnly(task.dueDate)) add('invalid_due_date', `due_date "${task.dueDate}"`);
  if (task.lastUpdatedAt && Number.isNaN(Date.parse(task.lastUpdatedAt))) {
    add('invalid_last_updated_at', `last_updated_at "${task.lastUpdatedAt}"`);
  }
  const usable = issues.every((i) => i.code !== 'missing_task_id' && i.code !== 'missing_source');
  return { usable, issues };
}

/** Evaluate one open, usable task. */
export function evaluateTask(task: TaskInput, roster: TeamMember[], cfg: TriageConfig, today: string): TriageResult {
  const owner = matchOwner(task.owner, roster);
  return {
    owner,
    lane: suggestLane(task, cfg, today),
    stale: staleState(task, cfg, today),
    delegate: delegation(task, owner, roster, cfg),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-source identity (spec §4.5)
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentityInput {
  /** normalized_task_id of every OPEN task. */
  openTaskIds: string[];
  /** dev_tickets mirror tasks: task id (airtable:dev_tickets:<rec>) → Linear key (e.g. MAPKING-478). */
  devTicketLinearKey: Map<string, string>;
  /** approval tasks: task id (airtable:approvals:<rec>) → counterpart task ids (airtable:invoices:<rec>, airtable:follow_ups:<rec>). */
  approvalCounterparts: Map<string, string[]>;
}

/**
 * I1: dev_ticket ↔ open linear:<KEY>, key `linear:<KEY>`.
 * I2: approval ↔ open invoice / follow_up it links, key = counterpart task id.
 * A task with one counterpart (and that counterpart with one) → duplicate_candidate.
 * More than one counterpart on either side → ambiguous. Nothing is merged.
 */
export function resolveIdentities(input: IdentityInput): Map<string, IdentityResult> {
  const open = new Set(input.openTaskIds);
  const edges = new Map<string, Set<string>>();
  const keyOf = new Map<string, string>();
  const link = (a: string, b: string, key: string) => {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      if (!edges.has(x)) edges.set(x, new Set());
      edges.get(x)!.add(y);
      if (!keyOf.has(x)) keyOf.set(x, key);
    }
  };

  for (const [ticketId, linearKey] of input.devTicketLinearKey) {
    const linearId = `linear:${linearKey}`;
    if (open.has(ticketId) && open.has(linearId)) link(ticketId, linearId, linearId);
  }
  for (const [approvalId, counterparts] of input.approvalCounterparts) {
    if (!open.has(approvalId)) continue;
    for (const c of [...counterparts].sort()) if (open.has(c)) link(approvalId, c, c);
  }

  const out = new Map<string, IdentityResult>();
  for (const id of input.openTaskIds) {
    const peers = edges.get(id);
    if (!peers || peers.size === 0) {
      out.set(id, { key: null, status: 'unique' });
      continue;
    }
    const crowded = peers.size > 1 || [...peers].some((p) => (edges.get(p)?.size ?? 0) > 1);
    out.set(id, { key: keyOf.get(id) ?? null, status: crowded ? 'ambiguous' : 'duplicate_candidate' });
  }
  return out;
}
