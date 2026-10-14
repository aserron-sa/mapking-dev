/**
 * soc2-evidence-contract — MapMigGon37539 (base) · MapKMigGon39261 (P01 sources) · MapKMigGon39264 (P02 export)
 *
 * Types and constants of the SOC 2 evidence contract. No Airtable calls, no I/O, no AI.
 * Shared by the evidence module, the source adapters, the capture automations and the tests.
 *
 * STATUS: provisional. Map MigGon37539 owns the final contract (soc2-evidence.ts: validation,
 * normalization, idempotency, retries). When that module lands, align this file with it and
 * record the change in "Versions" below. Requirements it must meet for P01 and P02 are in
 * stories/MapMigGon37539/implementation-plan.md §9.
 *
 * Data flow (target):
 *   loom_sync_runs / activity_runs  --(adapter: qualify | skip | invalid)-->  evidence module
 *     --> soc2_evidences (confirmed only after a re-read)  +  soc2_capture_runs (evidenced | skipped | failed)
 *
 * Rules fixed by the stories:
 *   - Idempotency key = source_type + run_id. A run already evidenced is a no-op, never an update.
 *   - evidence.source_type is a LINK to the source types table (soc2_control_mappings); the value
 *     names below are the row names.
 *   - evidence.confirmed is set by the evidence module only after the re-read confirms the write.
 *     Unconfirmed records are kept for reprocessing and never shown as evidence.
 *   - Only ids, statuses, timestamps, trigger, actor, counts and outcome. No transcripts, ticket
 *     bodies, prompts or Loom reports.
 *   - Producers only log their run (activity_runs, append-only). They never write evidence.
 *
 * Syntax note: only "erasable" TypeScript (types, interfaces, `as`, `type` imports).
 * No enums, namespaces or parameter properties, so Node 22 can run it directly and the
 * build can strip types without a compiler.
 *
 * Versions:
 *   0.1 · 2026-10-14 · skeleton: provisional contract from the P01 acceptance criteria.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────

/** Row names of the source types table (soc2_control_mappings). */
export const SOURCE_TYPES = ['approval', 'loom', 'ingestion', 'automation', 'ticket_review'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Source types written by producers to activity_runs (Loom has its own log; approvals are 37539). */
export const ACTIVITY_RUN_SOURCE_TYPES = ['ingestion', 'automation', 'ticket_review'] as const;
export type ActivityRunSourceType = (typeof ACTIVITY_RUN_SOURCE_TYPES)[number];

/** The two run logs that feed evidence capture in P01. */
export const RUN_LOG_TABLES = ['loom_sync_runs', 'activity_runs'] as const;
export type RunLogTable = (typeof RUN_LOG_TABLES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Statuses
// ─────────────────────────────────────────────────────────────────────────────

/** Terminal statuses of loom_sync_runs. "running" is evidenced once it becomes terminal. */
export const LOOM_TERMINAL_STATUSES = ['success', 'partial', 'failure', 'abandoned'] as const;
export type LoomTerminalStatus = (typeof LOOM_TERMINAL_STATUSES)[number];

/** activity_runs rows are written once, when the run finishes, always with a terminal status. */
export const ACTIVITY_RUN_STATUSES = ['success', 'partial', 'failure'] as const;
export type ActivityRunStatus = (typeof ACTIVITY_RUN_STATUSES)[number];

export const AI_OUTPUT_STATES = ['present', 'missing', 'malformed'] as const;
export type AiOutputState = (typeof AI_OUTPUT_STATES)[number];

/** Per-run result kept in soc2_capture_runs (not in the source run logs: one writer per table). */
export const CAPTURE_OUTCOMES = ['evidenced', 'skipped', 'failed'] as const;
export type CaptureOutcome = (typeof CAPTURE_OUTCOMES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Source rows (already parsed from Airtable)
// ─────────────────────────────────────────────────────────────────────────────

export interface RunCounts {
  created?: number;
  updated?: number;
  closed?: number;
  failed?: number;
}

/** One row of loom_sync_runs (existing table, written only by Loom). Status is free text here on purpose. */
export interface LoomSyncRunRow {
  recordId: string;
  runId: string | null;
  status: string | null;
  /** "schedule", "slack:#ingestion <requester>" or the panel's value; kept exactly as Loom records it. */
  trigger: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  counts: RunCounts;
}

/** One row of activity_runs (new, append-only). */
export interface ActivityRunRow {
  recordId: string;
  runId: string | null;
  sourceType: string | null;
  sourceName: string | null;
  sourceRecordId: string | null;
  /** Ticket reviews only. Id only, never ticket content. */
  ticketId: string | null;
  status: string | null;
  outcome: string | null;
  actor: string | null;
  trigger: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  counts: RunCounts;
  /** Raw AI output as the producer logged it; absent when the run had none. Parsed by the adapter. */
  aiOutputRaw: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence payload and adapter result
// ─────────────────────────────────────────────────────────────────────────────

/** Fields the evidence module needs. Observed metadata and AI content are kept apart. */
export interface EvidencePayload {
  sourceType: SourceType;
  runId: string;
  sourceTable: RunLogTable;
  /** Record id of the source run row, for traceability. */
  sourceRecordId: string;
  sourceName: string | null;
  ticketId: string | null;
  status: string;
  trigger: string | null;
  actor: string | null;
  outcome: string | null;
  startedAt: string | null;
  finishedAt: string;
  counts: RunCounts;
  aiOutputState: AiOutputState;
  /** Valid AI fields only; empty when aiOutputState is "missing" or "malformed". */
  aiFields: Record<string, unknown>;
}

/** Fields without which no evidence is created (validation failure listing the missing ones). */
export const REQUIRED_CORE_FIELDS = ['run_id', 'source_type', 'finished_at', 'status'] as const;
export type RequiredCoreField = (typeof REQUIRED_CORE_FIELDS)[number];

/** What an adapter returns for one source row. Adapters are pure: same row → same result. */
export type AdapterResult =
  | { kind: 'qualify'; payload: EvidencePayload; parseError: string | null }
  | { kind: 'skip'; reason: string; rule: string }
  | { kind: 'invalid'; missing: RequiredCoreField[] };

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency
// ─────────────────────────────────────────────────────────────────────────────

/** Idempotency key shared by the triggered and the hourly automation. */
export function idempotencyKey(sourceType: SourceType, runId: string): string {
  return `${sourceType}:${runId}`;
}
