/**
 * cct-triage-compute — MapKMigGon38571 · v1.0 · 2026-10-12
 *
 * Airtable automation script ("Run a script" action) for base Map King Hub (appcdpGNTo0DouoqJ).
 * DO NOT paste this .ts file. Paste the built file instead:
 *     airtable/cct/dist/automations/cct-triage-compute.js   (node airtable/cct/tools/cct-build.ts)
 * The build inlines cct-triage-rules.ts + cct-triage-sync.ts and strips the TypeScript types,
 * because Airtable only accepts one self-contained JavaScript file.
 *
 * Automation: "command_center_triages · compute · hourly"
 *   Trigger:          At a scheduled time → every hour
 *   Input variables:  dryRun = "yes" | "no"   (typed text; anything but "no" is treated as yes)
 *
 * What it does, every run:
 *   1. Reads the active row of cct_triage_configs and validates it. None, more than one, or invalid
 *      values → stops before writing and logs triage_data_issue (validation_failed).
 *   2. Reads team_members, command_center_tasks, command_center_triages, dev_tickets, approvals.
 *      Checks that every field it needs exists; a missing field → stops and logs its id.
 *   3. Plans the 1:1 sync with planTriageSync (pure, unit-tested): create rows for new tasks,
 *      update only changed values, mark closed / orphan rows, report duplicate rows. Never deletes.
 *   4. Writes the plan in batches of 50 (creates first, then updates). A failed batch is retried
 *      once, then record by record; failures are listed in the run event. Stops starting new
 *      batches after WRITE_BUDGET_MS; the next run continues where this one stopped.
 *   5. Logs one triage_compute event with the counts, one triage_data_issue per issue type,
 *      and stamps cct_triage_configs.last_run_at / last_run_status / last_run_summary (heartbeat the
 *      Work · Queue page uses to tell "complete" from "partial").
 *
 * Writes ONLY: command_center_triages (all fields), priority_events (its own events),
 * cct_triage_configs heartbeat fields. Never writes command_center_tasks (Loom's table) or task_lanes.
 *
 * Rules: docs/stories/MapKMigGon38571/spec.md §4 · Schema and IDs: docs/stories/MapKMigGon38571/schema.md
 */
import { DOMAINS, dateInZone, validateConfig } from '../cct-triage-rules.ts';
import type { Issue, TaskInput, TeamMember, TriageConfig } from '../cct-triage-rules.ts';
import { planTriageSync } from '../cct-triage-sync.ts';
import type { ExistingTriage, SyncPlan, TaskRow, TriageValues } from '../cct-triage-sync.ts';

// Airtable scripting globals (provided by the automation runtime).
declare const base: any;
declare const input: any;
declare const output: any;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration: table and field ids (ids, not names: renames do not break the script)
// ─────────────────────────────────────────────────────────────────────────────

const CCT = {
  configs: {
    table: 'tblGZaFBg7KLbcuf7',
    active: 'fld9TdaRYZ0RqDoYi',
    timezone: 'fldbeKikUZMGaeamo',
    staleInactiveDays: 'fldYi5Zf1P1AQq6pg',
    staleOverdueDays: 'fldiZDW8iY83QkEhm',
    staleExcludeSources: 'fld9BwUH18MCo3Th0',
    thisWeekHorizonDays: 'fldiRwMC7U06E71Oo',
    iceboxInactiveDays: 'fldvkqfTjlbYp0izV',
    waitingOnTags: 'fld0smX0xKbmYJZaE',
    delegateExcludeTags: 'fldLfGTM3ytpZ3Ubt',
    delegateRequireSchedulable: 'fldf3J0NdBvqfirKq',
    delegateEmptyOwnerIsCeo: 'fldSgrMAML9QoBSf2',
    invalidRowsMaxPct: 'fldjXNwk0KSQXo8i8',
    // Heartbeat (optional: if missing, the run still works and logs a warning)
    lastRunAt: 'fldQkNOnM1kIMoaR1',
    lastRunStatus: 'fldiWWUK6iQB7DGMD',
    lastRunSummary: 'fld6TMgPDRAmq5FP1',
  },
  members: {
    table: 'tblA658S9otgj9p3n',
    name: 'fldeTXTbJVJnKmWzh',
    aliases: 'fldTG4itOjWus9IYo',
    email: 'fldMtIk99zcWwVPqT',
    isCeo: 'fldP5jwpZCJ91EFLm',
    receivesDelegation: 'fldkOiONCO7r1l3mM',
    domains: 'fldDQwk79VEfJwHAf',
    active: 'flduiUrc076re9UCr',
  },
  tasks: {
    table: 'tblX61yfIFroyhMTj',
    taskId: 'fldmSHhnTbC1Go3Dw',
    source: 'fldceaJIeHpA3Tdae',
    domain: 'fldejhIOeD3YCFRRP',
    owner: 'fldECSTk2LFWGIS6V',
    dueDate: 'fldld41zIqgdNXeyn',
    lastUpdatedAt: 'fldG6wphuQyvtHSIy',
    lifecycle: 'fldzqG2oVnK93COcW',
    tags: 'fldYqQehpEy918bve',
    schedulable: 'fldfxuYNvITcMIlFu',
    triage: 'fld0pXalwYvckZmQE',
  },
  triages: {
    table: 'tblaG64QpuRInrm5X',
    taskId: 'fldiFf8TT66Cr9EHF',
    task: 'fldQD8DWx6I4wzpg6',
    rowStatus: 'fldKSj0WnXERwtYru',
    ownerCanonical: 'fldW59XTy9PPKHS5M',
    ownerMatch: 'fldmlDSJYktdRQdeE',
    staleState: 'fldY5SrXInz4k7umK',
    staleReason: 'fldX2gyYPzFdk0Vnk',
    delegateEligible: 'fldyj9poKbR6Wjw5q',
    delegateReason: 'fldzjFQYIvse8OPkg',
    delegateSuggestedTo: 'fldxWbxEz73BmzTPc',
    laneSuggested: 'fldqnNhGlHehSXVQa',
    laneRule: 'fldw1TT44d9GR6ejY',
    identityKey: 'fld0CsVqOkhYnxr9h',
    identityStatus: 'fldu7Xjtn1T1r0mfT',
    computedAt: 'fldns5wX8gp8UEOlZ',
  },
  devTickets: { table: 'tblSWc1WrL5qjzTzs', linearIssueId: 'fldgPUKY9Gxe6qSKB' },
  approvals: { table: 'tblRilIMAIEiUSFof', linkedFollowUp: 'flduW72ClwFTKto3d', linkedInvoice: 'fldQoKUH8Mlh8hcFE' },
  events: {
    table: 'tbl0k4YFnduwhMJG2',
    summary: 'fldxNmEoRpB4SRouZ',
    eventType: 'fldu8UXkQBfrIHvZe',
    status: 'fldL2k5qUjcOasDxU',
    source: 'fldIj7BNfY7f13atJ',
    message: 'fldBZdiRQ4ThpYEgX',
  },
};

/** Maps TriageValues keys to command_center_triages field ids and the write format. */
const TRIAGE_WRITE: Record<keyof TriageValues, { id: string; kind: 'text' | 'select' | 'checkbox' | 'link' }> = {
  taskRecordId: { id: CCT.triages.task, kind: 'link' },
  rowStatus: { id: CCT.triages.rowStatus, kind: 'select' },
  ownerCanonical: { id: CCT.triages.ownerCanonical, kind: 'text' },
  ownerMatch: { id: CCT.triages.ownerMatch, kind: 'select' },
  staleState: { id: CCT.triages.staleState, kind: 'select' },
  staleReason: { id: CCT.triages.staleReason, kind: 'text' },
  delegateEligible: { id: CCT.triages.delegateEligible, kind: 'checkbox' },
  delegateReason: { id: CCT.triages.delegateReason, kind: 'text' },
  delegateSuggestedTo: { id: CCT.triages.delegateSuggestedTo, kind: 'text' },
  laneSuggested: { id: CCT.triages.laneSuggested, kind: 'select' },
  laneRule: { id: CCT.triages.laneRule, kind: 'text' },
  identityKey: { id: CCT.triages.identityKey, kind: 'text' },
  identityStatus: { id: CCT.triages.identityStatus, kind: 'select' },
};

const BATCH_SIZE = 50; // Airtable limit per createRecordsAsync / updateRecordsAsync call
const WRITE_BUDGET_MS = 22_000; // automation scripts are stopped at 30 s; keep room for logging
const MAX_IDS_IN_MESSAGE = 40;

// ─────────────────────────────────────────────────────────────────────────────
// Small cell readers
// ─────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const sel = (v: any): string | null => (v && typeof v === 'object' && typeof v.name === 'string' ? v.name : null);
const sels = (v: any): string[] => (Array.isArray(v) ? v.map((x) => x?.name).filter((x) => typeof x === 'string') : []);
const links = (v: any): string[] => (Array.isArray(v) ? v.map((x) => x?.id).filter((x) => typeof x === 'string') : []);
const lines = (v: unknown): string[] =>
  typeof v === 'string' ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

/** Format a TriageValues value for an Airtable write. */
function cell(kind: 'text' | 'select' | 'checkbox' | 'link', v: unknown): unknown {
  if (kind === 'checkbox') return !!v;
  if (kind === 'link') return v ? [{ id: v }] : [];
  if (kind === 'select') return v ? { name: v } : null;
  return v ?? null;
}

function toFields(values: Partial<TriageValues>, computedAt: string, taskId?: string): Record<string, unknown> {
  const f: Record<string, unknown> = { [CCT.triages.computedAt]: computedAt };
  if (taskId) f[CCT.triages.taskId] = taskId;
  for (const k of Object.keys(values) as (keyof TriageValues)[]) {
    const w = TRIAGE_WRITE[k];
    f[w.id] = cell(w.kind, values[k]);
  }
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event log (priority_events, append-only)
// ─────────────────────────────────────────────────────────────────────────────

async function logEvent(eventType: string, status: string, summary: string, message: string, dryRun: boolean) {
  const E = CCT.events;
  const fields: Record<string, unknown> = {
    [E.summary]: `${dryRun ? '[dry run] ' : ''}${summary}`.slice(0, 250),
    [E.eventType]: { name: eventType },
    [E.status]: { name: status },
    [E.source]: { name: 'automation' },
    [E.message]: message,
  };
  try {
    await base.getTable(E.table).createRecordAsync(fields);
  } catch (e) {
    console.error(`Could not log ${eventType}: ${(e as Error).message}`);
  }
}

function idsText(ids: string[]): string {
  const shown = ids.slice(0, MAX_IDS_IN_MESSAGE).join(', ');
  return ids.length > MAX_IDS_IN_MESSAGE ? `${shown} … (+${ids.length - MAX_IDS_IN_MESSAGE} more)` : shown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Field lookup that never throws. The automation scripting API has no getFieldIfExists
 * (that one belongs to the scripting extension), so search table.fields by id.
 */
function findField(table: AirtableScripting.Table, id: string): AirtableScripting.Field | null {
  return table.fields.find((f) => f.id === id) ?? null;
}

/** Ids (or names) of required fields missing in a table. Heartbeat fields are optional. */
function missingFields(tableId: string, fieldIds: string[]): string[] {
  const t = base.getTable(tableId);
  return fieldIds.filter((id) => !findField(t, id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

async function readConfig(): Promise<{ cfg: TriageConfig | null; recordId: string | null; problems: string[] }> {
  const C = CCT.configs;
  const q = await base.getTable(C.table).selectRecordsAsync({ fields: Object.values(C).filter((v) => v.startsWith('fld')) });
  const active = q.records.filter((r: any) => r.getCellValue(C.active) === true);
  if (active.length !== 1) {
    return { cfg: null, recordId: null, problems: [`cct_triage_configs must have exactly 1 active row; found ${active.length}`] };
  }
  const r = active[0];
  const cfg: TriageConfig = {
    timezone: str(r.getCellValue(C.timezone)) ?? '',
    staleInactiveDays: num(r.getCellValue(C.staleInactiveDays)) as number,
    staleOverdueDays: num(r.getCellValue(C.staleOverdueDays)) as number,
    staleExcludeSources: sels(r.getCellValue(C.staleExcludeSources)),
    thisWeekHorizonDays: num(r.getCellValue(C.thisWeekHorizonDays)) as number,
    iceboxInactiveDays: num(r.getCellValue(C.iceboxInactiveDays)) as number,
    waitingOnTags: sels(r.getCellValue(C.waitingOnTags)),
    delegateExcludeTags: sels(r.getCellValue(C.delegateExcludeTags)),
    delegateRequireSchedulable: r.getCellValue(C.delegateRequireSchedulable) === true,
    delegateEmptyOwnerIsCeo: r.getCellValue(C.delegateEmptyOwnerIsCeo) === true,
    invalidRowsMaxPct: num(r.getCellValue(C.invalidRowsMaxPct)) as number,
  };
  const problems = validateConfig(cfg);
  return { cfg: problems.length ? null : cfg, recordId: r.id, problems };
}

async function readRoster(): Promise<TeamMember[]> {
  const M = CCT.members;
  const q = await base.getTable(M.table).selectRecordsAsync({ fields: Object.values(M).filter((v) => v.startsWith('fld')) });
  return q.records.map((r: any) => ({
    recordId: r.id,
    name: str(r.getCellValue(M.name)) ?? '',
    aliases: lines(r.getCellValue(M.aliases)),
    email: str(r.getCellValue(M.email)),
    isCeo: r.getCellValue(M.isCeo) === true,
    receivesDelegation: r.getCellValue(M.receivesDelegation) === true,
    domains: sels(r.getCellValue(M.domains)).filter((d) => DOMAINS.includes(d)),
    active: r.getCellValue(M.active) === true,
  })).filter((m: TeamMember) => m.name);
}

async function readTasks(): Promise<TaskRow[]> {
  const T = CCT.tasks;
  const q = await base.getTable(T.table).selectRecordsAsync({ fields: Object.values(T).filter((v) => v.startsWith('fld')) });
  return q.records.map(
    (r: any): TaskRow => ({
      recordId: r.id,
      taskId: str(r.getCellValue(T.taskId)),
      source: sel(r.getCellValue(T.source)),
      domain: sel(r.getCellValue(T.domain)),
      owner: str(r.getCellValue(T.owner)),
      dueDate: str(r.getCellValue(T.dueDate)),
      lastUpdatedAt: str(r.getCellValue(T.lastUpdatedAt)),
      lifecycle: sel(r.getCellValue(T.lifecycle)),
      tags: sels(r.getCellValue(T.tags)),
      schedulable: r.getCellValue(T.schedulable) === true,
      triageLinks: links(r.getCellValue(T.triage)),
    }),
  );
}

async function readTriages(): Promise<ExistingTriage[]> {
  const X = CCT.triages;
  const q = await base.getTable(X.table).selectRecordsAsync({ fields: Object.values(X).filter((v) => v.startsWith('fld')) });
  return q.records.map(
    (r: any): ExistingTriage => ({
      recordId: r.id,
      normalizedTaskId: str(r.getCellValue(X.taskId)),
      values: {
        taskRecordId: links(r.getCellValue(X.task))[0] ?? null,
        rowStatus: (sel(r.getCellValue(X.rowStatus)) ?? 'active') as TriageValues['rowStatus'],
        ownerCanonical: str(r.getCellValue(X.ownerCanonical)),
        ownerMatch: sel(r.getCellValue(X.ownerMatch)),
        staleState: sel(r.getCellValue(X.staleState)),
        staleReason: str(r.getCellValue(X.staleReason)),
        delegateEligible: r.getCellValue(X.delegateEligible) === true,
        delegateReason: str(r.getCellValue(X.delegateReason)),
        delegateSuggestedTo: str(r.getCellValue(X.delegateSuggestedTo)),
        laneSuggested: sel(r.getCellValue(X.laneSuggested)),
        laneRule: str(r.getCellValue(X.laneRule)),
        identityKey: str(r.getCellValue(X.identityKey)),
        identityStatus: sel(r.getCellValue(X.identityStatus)),
      },
    }),
  );
}

async function readIdentitySources(): Promise<{ devTicketLinearKey: Map<string, string>; approvalCounterparts: Map<string, string[]> }> {
  const D = CCT.devTickets;
  const A = CCT.approvals;
  const devTicketLinearKey = new Map<string, string>();
  const dq = await base.getTable(D.table).selectRecordsAsync({ fields: [D.linearIssueId] });
  for (const r of dq.records) {
    const key = str(r.getCellValue(D.linearIssueId));
    if (key) devTicketLinearKey.set(`airtable:dev_tickets:${r.id}`, key.trim());
  }
  const approvalCounterparts = new Map<string, string[]>();
  const aq = await base.getTable(A.table).selectRecordsAsync({ fields: [A.linkedInvoice, A.linkedFollowUp] });
  for (const r of aq.records) {
    const ids = [
      ...links(r.getCellValue(A.linkedInvoice)).map((id) => `airtable:invoices:${id}`),
      ...links(r.getCellValue(A.linkedFollowUp)).map((id) => `airtable:follow_ups:${id}`),
    ];
    if (ids.length) approvalCounterparts.set(`airtable:approvals:${r.id}`, ids);
  }
  return { devTicketLinearKey, approvalCounterparts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

interface WriteResult {
  created: number;
  updated: number;
  failed: string[];
  skippedForTime: number;
}

/** Run `op` on batches of 50; retry a failed batch once, then item by item. Stops at the time budget. */
async function writeInBatches<T>(
  items: T[],
  label: (item: T) => string,
  op: (batch: T[]) => Promise<void>,
  deadline: number,
  result: WriteResult,
): Promise<number> {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    if (Date.now() > deadline) {
      result.skippedForTime += items.length - i;
      break;
    }
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      await op(batch);
      done += batch.length;
    } catch {
      try {
        await op(batch);
        done += batch.length;
      } catch {
        for (const item of batch) {
          try {
            await op([item]);
            done += 1;
          } catch (e) {
            result.failed.push(`${label(item)} (${(e as Error).message})`);
          }
        }
      }
    }
  }
  return done;
}

async function applyPlan(plan: SyncPlan, computedAt: string, deadline: number): Promise<WriteResult> {
  const table = base.getTable(CCT.triages.table);
  const result: WriteResult = { created: 0, updated: 0, failed: [], skippedForTime: 0 };
  result.created = await writeInBatches(
    plan.creates,
    (c) => c.normalizedTaskId,
    (batch) => table.createRecordsAsync(batch.map((c) => ({ fields: toFields(c.values, computedAt, c.normalizedTaskId) }))),
    deadline,
    result,
  );
  result.updated = await writeInBatches(
    plan.updates,
    (u) => u.recordId,
    (batch) => table.updateRecordsAsync(batch.map((u) => ({ id: u.recordId, fields: toFields(u.changes, computedAt) }))),
    deadline,
    result,
  );
  return result;
}

async function stampHeartbeat(recordId: string | null, status: string, summary: string, at: string, dryRun: boolean) {
  if (!recordId || dryRun) return;
  const C = CCT.configs;
  const t = base.getTable(C.table);
  const fAt = findField(t, C.lastRunAt);
  const fStatus = findField(t, C.lastRunStatus);
  const fSummary = findField(t, C.lastRunSummary);
  if (!fAt) {
    console.warn('cct_triage_configs.last_run_at (fldQkNOnM1kIMoaR1) not found: heartbeat not stamped (Work · Queue will show "triage pending").');
    return;
  }
  const fields: Record<string, unknown> = { [fAt.id]: at };
  if (fStatus) fields[fStatus.id] = { name: status };
  if (fSummary) fields[fSummary.id] = summary.slice(0, 1000);
  await t.updateRecordAsync(recordId, fields);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const started = Date.now();
  const deadline = started + WRITE_BUDGET_MS;
  const dryRun = String(input.config()?.dryRun ?? 'yes').trim().toLowerCase() !== 'no';
  const now = new Date(started).toISOString();

  // 1. Required fields
  const missing = [
    ...missingFields(CCT.tasks.table, Object.entries(CCT.tasks).filter(([k]) => k !== 'table').map(([, v]) => v)),
    ...missingFields(CCT.triages.table, Object.entries(CCT.triages).filter(([k]) => k !== 'table').map(([, v]) => v)),
    ...missingFields(CCT.members.table, Object.entries(CCT.members).filter(([k]) => k !== 'table').map(([, v]) => v)),
    ...missingFields(CCT.devTickets.table, [CCT.devTickets.linearIssueId]),
    ...missingFields(CCT.approvals.table, [CCT.approvals.linkedInvoice, CCT.approvals.linkedFollowUp]),
  ];
  if (missing.length) {
    const msg = `Missing or renamed fields: ${missing.join(', ')}. Nothing written. Check docs/stories/MapKMigGon38571/schema.md.`;
    await logEvent('triage_data_issue', 'validation_failed', 'triage · required fields missing', msg, dryRun);
    output.set('result', 'validation_failed');
    output.set('message', msg);
    return;
  }

  // 2. Config
  const { cfg, recordId: configRecordId, problems } = await readConfig();
  if (!cfg) {
    const msg = `cct_triage_configs invalid: ${problems.join('; ')}. Nothing written.`;
    await logEvent('triage_data_issue', 'validation_failed', 'triage · config invalid', msg, dryRun);
    await stampHeartbeat(configRecordId, 'failed', msg, now, dryRun);
    output.set('result', 'validation_failed');
    output.set('message', msg);
    return;
  }

  // 3. Read and plan
  const [roster, tasks, existing, identity] = await Promise.all([readRoster(), readTasks(), readTriages(), readIdentitySources()]);
  const today = dateInZone(new Date(started), cfg.timezone);
  const plan = planTriageSync({ tasks, existing, roster, cfg, today, ...identity });

  if (plan.aborted) {
    await logEvent('triage_data_issue', 'validation_failed', 'triage · too many invalid rows', plan.aborted, dryRun);
    await stampHeartbeat(configRecordId, 'failed', plan.aborted, now, dryRun);
    output.set('result', 'validation_failed');
    output.set('message', plan.aborted);
    return;
  }

  // 4. Write
  const written: WriteResult = dryRun
    ? { created: 0, updated: 0, failed: [], skippedForTime: 0 }
    : await applyPlan(plan, now, deadline);

  // 5. Log
  const byCode = new Map<string, Issue[]>();
  for (const i of plan.issues) {
    if (!byCode.has(i.code)) byCode.set(i.code, []);
    byCode.get(i.code)!.push(i);
  }
  for (const [code, list] of byCode) {
    const sample = list.slice(0, MAX_IDS_IN_MESSAGE).map((i) => `${i.recordId}: ${i.detail}`).join('\n');
    await logEvent('triage_data_issue', 'ok', `triage · ${code} × ${list.length}`, sample, dryRun);
  }
  if (plan.duplicates.length) {
    const msg = plan.duplicates.map((d) => `${d.normalizedTaskId}: keep ${d.keep}, extra ${d.extra.join(', ')}`).join('\n');
    await logEvent('triage_data_issue', 'ok', `triage · duplicate triage rows × ${plan.duplicates.length}`, msg, dryRun);
  }

  const c = plan.counts;
  const partial = written.failed.length > 0 || written.skippedForTime > 0;
  const status = dryRun ? 'dry_run' : partial ? 'partial' : 'ok';
  const summary = [
    `tasks ${c.tasks} · open ${c.open} · evaluated ${c.evaluated} · invalid open ${c.invalidOpen}`,
    `planned: create ${plan.creates.length} · update ${plan.updates.length} · unchanged ${plan.unchanged}`,
    `written: created ${written.created} · updated ${written.updated} · failed ${written.failed.length} · left for next run ${written.skippedForTime}`,
    `lanes ${JSON.stringify(c.byLane)} · stale ${JSON.stringify(c.byStale)}`,
    `delegable ${c.delegable} · duplicate candidates ${c.duplicateCandidates} · ambiguous ${c.ambiguous} · owner unmatched ${c.ownerUnmatched}`,
    `duplicate triage rows ${plan.duplicates.length} · issues ${plan.issues.length} · ${Date.now() - started} ms`,
  ].join('\n');
  const message = written.failed.length ? `${summary}\nFailed: ${idsText(written.failed)}` : summary;
  await logEvent('triage_compute', partial ? 'dependency_failed' : 'ok', `triage · run ${status}`, message, dryRun);
  await stampHeartbeat(configRecordId, status, summary, now, dryRun);

  output.set('result', status);
  output.set('created', written.created);
  output.set('updated', written.updated);
  output.set('plannedCreates', plan.creates.length);
  output.set('plannedUpdates', plan.updates.length);
  output.set('failed', written.failed.length);
  output.set('summary', summary);
}

await main();
