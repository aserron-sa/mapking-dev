import React, { useEffect, useRef, useState } from 'react';
import {
    initializeBlock,
    useBase,
    useCustomProperties,
    useRecords,
    useRunInfo,
    useSession,
} from '@airtable/blocks/interface/ui';
import type { Record as AtRecord, Table } from '@airtable/blocks/interface/models';

/**
 * CEO Command Center — Landing Dashboard (Story MapKMigGon38569) · v3 · 2026-10-07
 *
 * Airtable Interface Extension (Map King Hub → Interface 2 → "CEO Command Center").
 * Renders 7 fixed tiles, each showing the single most important state of one area, plus a
 * per-tile "since you last opened it" indicator for the signed-in user.
 *
 * Data flow:
 *   command_center_tasks (written by the Loom agent) ──read──▶ tile states ──▶ render
 *   dashboard_tile_baseline (one row per user × tile)  ◀─write─ after a successful read
 *
 * v3 fixes the defects in the QA report of 2026-09-18:
 *   D-01  the baseline was never persisted
 *   D-02  a failed read must not advance the baseline (now testable with a QA toggle)
 *   D-03  the diff after a state change always read "No change"
 *   D-04  every one of the 7 tiles shows a diff state
 * and D-05: tiles only count tasks whose lifecycle is "open".
 */

const ORANGE = '#f0883e';
const RED = '#f0625f';
const MUTED = '#6b7280';
const BLUE = '#58a6ff';

const TASKS_TABLE_ID = 'tblX61yfIFroyhMTj';
const BASELINE_TABLE_ID = 'tblOkKSZroaOk8kQ3';

// Field ids in command_center_tasks (tblX61yfIFroyhMTj). Ids, not names, so renames don't break the extension.
const T = {
    title: 'fld4JRaVYnwttmi4P',
    owner: 'fldECSTk2LFWGIS6V',
    lastUpdated: 'fldG6wphuQyvtHSIy',
    sourceStatus: 'fldXpO4TchBQJVkhm',
    sourceUrl: 'fldqoka4e1FLKxJ6x',
    source: 'fldceaJIeHpA3Tdae',
    sourceTable: 'fldzYRdrxSjCpSQsk',
    dueDate: 'fldld41zIqgdNXeyn',
    lifecycle: 'fldzqG2oVnK93COcW',
};
// Field ids in dashboard_tile_baseline (tblOkKSZroaOk8kQ3).
const B = {
    user: 'fldwcKIxj6ErUtTFC', // singleCollaborator: written as {id: 'usr…'}
    tileId: 'fldZRM66FUY6VyEI8',
    snapshot: 'fldqsYdDnBJXVIRtF', // versioned JSON, see snapshotOf()
    lastViewed: 'fldlBlHkMRHXR5ZNj', // dateTime: written as an ISO string
};
const SNAPSHOT_VERSION = 1; // bump when the snapshot shape changes; older baselines then read as 'unavailable' instead of a false diff

// The 7 tiles, in render order. Ids are stable: they are the tile_id stored in the baseline table.
const TILE_ORDER = ['on_fire', 'needs_you', 'right_now', 'revenue_mix', 'approvals', 'qa', 'audit_decisions'] as const;
type TileId = (typeof TILE_ORDER)[number];
const TILE_CONFIG_ERROR =
    TILE_ORDER.length !== 7 || new Set(TILE_ORDER).size !== 7
        ? `Tile configuration must define exactly 7 unique tiles (found ${TILE_ORDER.length}).`
        : null;

// Adds a toggle to the element's properties panel so QA can simulate a failed read (D-02)
// without touching code. Defined at top level so its identity is stable, as useCustomProperties requires.
function getCustomProperties() {
    return [
        {
            key: 'qaForceReadFailure',
            label: 'QA: simulate a failed read (baseline is not updated)',
            type: 'boolean' as const,
            defaultValue: false,
        },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline / diff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ok          the tile has data
 * empty       the tile's source has no open items
 * unavailable the tile has no data source yet (by design)
 * error       the tile's data could not be read; its baseline is not advanced
 */
type TileStatus = 'ok' | 'empty' | 'unavailable' | 'error';
type DiffStatus = 'first_view' | 'changed' | 'unchanged' | 'unavailable';
/**
 * Normalized state of one tile, used only for the diff. `value` must change only when the tile
 * meaningfully changes: record ids and counts, never relative times like "3 days waiting",
 * which change every day and would flag the tile as updated on every visit.
 */
type TileState = { tileId: TileId; status: TileStatus; value: string | null };
type CommitState = 'pending' | 'done' | 'skipped' | 'failed';

const newLoadId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const log = (loadId: string, msg: string, extra?: unknown) =>
    // eslint-disable-next-line no-console
    console.info(`[CEODashboard ${loadId}] ${msg}`, extra ?? '');

const snapshotOf = (t: TileState) => JSON.stringify({ v: SNAPSHOT_VERSION, status: t.status, value: t.value });

function parseSnapshot(raw: unknown): { status: string; value: string | null } | null {
    if (typeof raw !== 'string' || !raw) return null;
    try {
        const s = JSON.parse(raw);
        return s && s.v === SNAPSHOT_VERSION ? { status: s.status, value: s.value ?? null } : null;
    } catch {
        return null;
    }
}

/** Latest baseline row per tile for the given user. Other users' rows are ignored. */
function baselinesByTile(records: AtRecord[], userId: string): Map<string, AtRecord> {
    const out = new Map<string, AtRecord>();
    const ts = (r: AtRecord) => String(r.getCellValue(B.lastViewed) ?? '');
    for (const r of records) {
        const user = r.getCellValue(B.user) as { id?: string } | null;
        if (user?.id !== userId) continue;
        const tileId = r.getCellValueAsString(B.tileId);
        if (!tileId) continue;
        const prev = out.get(tileId);
        if (!prev || ts(r) > ts(prev)) out.set(tileId, r);
    }
    return out;
}

/** Compares each tile's current state with the user's stored baseline. */
function computeDiffs(tiles: TileState[], records: AtRecord[], userId: string): Map<TileId, DiffStatus> {
    const byTile = baselinesByTile(records, userId);
    const out = new Map<TileId, DiffStatus>();
    for (const t of tiles) {
        const rec = byTile.get(t.tileId);
        if (t.status === 'error') out.set(t.tileId, 'unavailable');
        else if (!rec) out.set(t.tileId, 'first_view');
        else {
            const prev = parseSnapshot(rec.getCellValue(B.snapshot));
            if (!prev) out.set(t.tileId, 'unavailable'); // corrupt, or written by an older snapshot version
            else out.set(t.tileId, prev.status === t.status && prev.value === t.value ? 'unchanged' : 'changed');
        }
    }
    return out;
}

/**
 * Writes the current tile states as the user's new baseline: updates existing rows, creates
 * missing ones. Checks write permission first and returns the reason when it can't write.
 */
async function commitBaselines(
    table: Table,
    records: AtRecord[],
    userId: string,
    tiles: TileState[],
    loadId: string,
): Promise<{ ok: boolean; reason?: string }> {
    const create = table.checkPermissionsForCreateRecords();
    const update = table.checkPermissionsForUpdateRecords();
    if (!create.hasPermission || !update.hasPermission) {
        const reason =
            (!create.hasPermission && create.reasonDisplayString) ||
            (!update.hasPermission && update.reasonDisplayString) ||
            'No write permission on dashboard_tile_baseline';
        log(loadId, 'baseline NOT written: permissions', reason);
        return { ok: false, reason };
    }
    const byTile = baselinesByTile(records, userId);
    const now = new Date().toISOString();
    const toCreate: { fields: { [k: string]: unknown } }[] = [];
    const toUpdate: { id: string; fields: { [k: string]: unknown } }[] = [];
    for (const t of tiles) {
        if (t.status === 'error') continue; // a tile that could not be read keeps its previous baseline
        const fields = { [B.snapshot]: snapshotOf(t), [B.lastViewed]: now };
        const rec = byTile.get(t.tileId);
        if (rec) toUpdate.push({ id: rec.id, fields });
        else toCreate.push({ fields: { ...fields, [B.user]: { id: userId }, [B.tileId]: t.tileId } });
    }
    try {
        if (toCreate.length) await table.createRecordsAsync(toCreate);
        if (toUpdate.length) await table.updateRecordsAsync(toUpdate);
        log(loadId, 'baseline written', { created: toCreate.length, updated: toUpdate.length });
        return { ok: true };
    } catch (e) {
        log(loadId, 'baseline NOT written: error', String(e));
        return { ok: false, reason: String(e) };
    }
}

/**
 * Computes the diffs once per dashboard open, freezes them, then writes the new baseline.
 *
 * The freeze is the fix for D-03: useRecords is live, so once the new baseline is written the
 * baseline records update. Recomputing against them would turn every tile into "No change".
 *
 * Nothing is written when the read failed (D-02). `commit` and `reason` are shown in edit mode
 * so a failed write is visible without opening the browser console (D-01).
 */
function useBaselineDiff(p: {
    baselineTable: Table | null;
    baselineRecords: AtRecord[] | null;
    userId: string | null;
    tiles: TileState[] | null;
    readFailed: boolean;
}) {
    const loadId = useRef(newLoadId()).current;
    const frozen = useRef<Map<TileId, DiffStatus> | null>(null);
    const [commit, setCommit] = useState<CommitState>('pending');
    const [reason, setReason] = useState<string | null>(null);

    useEffect(() => {
        if (frozen.current || commit !== 'pending') return;
        if (p.readFailed) {
            log(loadId, 'read failed; baseline left unchanged');
            setCommit('skipped');
            return;
        }
        if (!p.tiles) return;
        if (!p.baselineTable || !p.baselineRecords || !p.userId) {
            const why = !p.userId ? 'No signed-in user' : 'dashboard_tile_baseline is not accessible';
            log(loadId, 'baseline NOT written', why);
            setReason(why);
            setCommit('failed');
            return;
        }
        frozen.current = computeDiffs(p.tiles, p.baselineRecords, p.userId);
        log(loadId, 'diffs', Array.from(frozen.current).map(([k, v]) => `${k}:${v}`).join(' '));
        commitBaselines(p.baselineTable, p.baselineRecords, p.userId, p.tiles, loadId).then((r) => {
            setReason(r.reason ?? null);
            setCommit(r.ok ? 'done' : 'failed');
        });
    }, [p.tiles, p.baselineRecords, p.baselineTable, p.userId, p.readFailed, commit, loadId]);

    const diffFor = (id: TileId): DiffStatus => frozen.current?.get(id) ?? 'unavailable';
    return { diffFor, commit, reason, loadId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

function CardShell({
    label,
    navLabel,
    large = false,
    children,
}: {
    label: string;
    navLabel?: string;
    large?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className={`bg-gray-800 rounded-lg p-5 flex flex-col ${large ? 'min-h-[210px]' : 'min-h-[160px]'}`}>
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                {navLabel && (
                    <span className="text-xs font-medium" style={{ color: ORANGE }}>
                        {navLabel}
                    </span>
                )}
            </div>
            <div className="flex-1 flex flex-col">{children}</div>
        </div>
    );
}

type DetailItem = { label: string; meta?: string };

// Always renders, including 'unavailable', so all 7 tiles show a diff state (D-04).
function DiffBadge({ status }: { status: DiffStatus }) {
    const config: { [K in DiffStatus]: { text: string; color: string } } = {
        first_view: { text: 'First view', color: BLUE },
        changed: { text: 'Updated since last visit', color: ORANGE },
        unchanged: { text: 'No change since last visit', color: MUTED },
        unavailable: { text: 'Change tracking unavailable', color: MUTED },
    };
    const { text, color } = config[status];
    return (
        <p className="text-[11px] mt-2" style={{ color }}>
            ● {text}
        </p>
    );
}

function DetailList({ items }: { items: DetailItem[] }) {
    if (!items.length) return null;
    return (
        <div className="border-t border-gray-700 mt-3 pt-3 space-y-1.5">
            {items.map((item, i) => (
                <p key={i} className="text-xs text-gray-400">
                    {item.label}
                    {item.meta ? ` · ${item.meta}` : ''}
                </p>
            ))}
        </div>
    );
}

function ExternalLinkButton({ label, url }: { label: string; url?: string | null }) {
    if (!url) return null;
    return (
        <div className="mt-4">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-gray-300 bg-gray-900 hover:bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5"
            >
                {label}
            </a>
        </div>
    );
}

function ToggleButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
    return (
        <div className="mt-4">
            <button
                onClick={onClick}
                className="text-xs text-gray-300 bg-gray-900 hover:bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5"
            >
                {expanded ? 'Less' : 'More'}
            </button>
        </div>
    );
}

function LargeInsightCard({
    label,
    navLabel,
    title,
    insight,
    meta,
    accentColor = ORANGE,
    moreLabel,
    moreUrl,
    placeholder,
    diffStatus,
}: {
    label: string;
    navLabel?: string;
    title?: string | null;
    insight?: string | null;
    meta?: string | null;
    accentColor?: string;
    moreLabel?: string;
    moreUrl?: string | null;
    placeholder?: string;
    diffStatus: DiffStatus;
}) {
    return (
        <CardShell label={label} navLabel={navLabel} large>
            {placeholder ? (
                <p className="text-sm" style={{ color: MUTED }}>
                    {placeholder}
                </p>
            ) : (
                <>
                    <p className="text-xl font-semibold text-white mb-3 leading-snug">{title ?? 'Untitled'}</p>
                    {insight && (
                        <p className="text-sm text-gray-200 pl-3 mb-3" style={{ borderLeft: `2px solid ${accentColor}` }}>
                            {insight}
                        </p>
                    )}
                    {meta && <p className="text-xs text-gray-500">{meta}</p>}
                </>
            )}
            <DiffBadge status={diffStatus} />
            {!placeholder && <ExternalLinkButton label={moreLabel ?? 'More'} url={moreUrl} />}
        </CardShell>
    );
}

function SmallStatCard({
    label,
    navLabel,
    headline,
    headlineColor = '#e6edf3',
    subtext,
    detailItems,
    placeholder,
    diffStatus,
}: {
    label: string;
    navLabel?: string;
    headline?: string | null;
    headlineColor?: string;
    subtext?: string | null;
    detailItems?: DetailItem[];
    placeholder?: string;
    diffStatus: DiffStatus;
}) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = !placeholder && !!detailItems && detailItems.length > 0;

    return (
        <CardShell label={label} navLabel={navLabel}>
            {placeholder ? (
                <p className="text-sm" style={{ color: MUTED }}>
                    {placeholder}
                </p>
            ) : (
                <>
                    <p className="text-2xl font-bold mb-1" style={{ color: headlineColor }}>
                        {headline ?? '—'}
                    </p>
                    {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
                </>
            )}
            <DiffBadge status={diffStatus} />
            {expanded && hasDetails && <DetailList items={detailItems!} />}
            {hasDetails && <ToggleButton expanded={expanded} onClick={() => setExpanded((e) => !e)} />}
        </CardShell>
    );
}

function BriefBlock() {
    return (
        <div className="border border-gray-800 rounded-lg p-6 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ORANGE }}>
                The Brief
            </p>
            <p className="text-sm mb-6" style={{ color: MUTED }}>
                Coming soon — pending the Morning Brief agent (CC12).
            </p>
            <div className="border-t border-gray-800 pt-5 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                        Since You Last Opened It
                    </p>
                    <p className="text-sm" style={{ color: MUTED }}>
                        A narrative summary here needs CC12. The per-tile change indicators below are the real,
                        mechanical version of this — built for Story MapKMigGon38569.
                    </p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ORANGE }}>
                        Do This First
                    </p>
                    <p className="text-sm" style={{ color: MUTED }}>
                        Coming soon — pending the Morning Brief agent (CC12).
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function getDaysSince(dateString: string | null): number | null {
    if (!dateString) return null;
    return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}
function formatTime(dateString: string | null): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function formatRelative(dateString: string | null): string {
    if (!dateString) return '';
    const diffHours = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? 'yesterday' : `${diffDays}d ago`;
}
function isToday(dateString: string | null): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data loading. useRecords requires a non-null table and hooks can't be called conditionally,
// so a missing table is handled here and reaches the dashboard as `null` (a failed read).
// ─────────────────────────────────────────────────────────────────────────────

function LoadedRecords({ table, children }: { table: Table; children: (r: AtRecord[]) => React.ReactElement }) {
    const records = useRecords(table);
    return children(records);
}
function WithRecords({
    table,
    children,
}: {
    table: Table | null;
    children: (r: AtRecord[] | null) => React.ReactElement;
}) {
    return table ? <LoadedRecords table={table}>{children}</LoadedRecords> : children(null);
}

function CEODashboard(): React.ReactElement {
    const base = useBase();
    const tasksTable = base.getTableByIdIfExists(TASKS_TABLE_ID);
    const baselineTable = base.getTableByIdIfExists(BASELINE_TABLE_ID);
    return (
        <WithRecords table={tasksTable}>
            {(tasks) => (
                <WithRecords table={baselineTable}>
                    {(baseline) => (
                        <Dashboard
                            tasksTable={tasksTable}
                            tasks={tasks}
                            baselineTable={baselineTable}
                            baselineRecords={baseline}
                        />
                    )}
                </WithRecords>
            )}
        </WithRecords>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({
    tasksTable,
    tasks,
    baselineTable,
    baselineRecords,
}: {
    tasksTable: Table | null;
    tasks: AtRecord[] | null;
    baselineTable: Table | null;
    baselineRecords: AtRecord[] | null;
}): React.ReactElement {
    const session = useSession();
    const userId = session?.currentUser?.id ?? null;
    const { isPageElementInEditMode } = useRunInfo();
    const { customPropertyValueByKey } = useCustomProperties(getCustomProperties);
    const qaForceReadFailure = customPropertyValueByKey.qaForceReadFailure === true;

    // A read is valid only if the table is accessible, returned records and has every field used below.
    // Any failure (or the QA toggle) blanks the tiles and skips the baseline write.
    const missingFields = tasksTable ? Object.values(T).filter((id) => !tasksTable.getFieldIfExists(id)) : [];
    const realReadError = !tasksTable
        ? 'command_center_tasks is not accessible'
        : !tasks
          ? 'command_center_tasks returned no data'
          : missingFields.length
            ? `Missing fields in command_center_tasks: ${missingFields.join(', ')}`
            : null;
    const readError =
        TILE_CONFIG_ERROR ?? realReadError ?? (qaForceReadFailure ? 'Simulated read failure (QA mode)' : null);
    const readFailed = readError !== null;

    const text = (r: AtRecord, f: string) => r.getCellValueAsString(f) || null;
    const raw = (r: AtRecord, f: string) => (r.getCellValue(f) as string | null) ?? null;
    const byOldest = (rs: AtRecord[]) =>
        [...rs].sort((a, b) => {
            const da = raw(a, T.lastUpdated);
            const db = raw(b, T.lastUpdated);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return new Date(da).getTime() - new Date(db).getTime();
        });
    const idsOf = (rs: AtRecord[]) => rs.map((r) => r.id).sort().join(',');

    // Only open tasks (D-05). Loom keeps closed rows as lifecycle = not_returned/closed, e.g. Linear issues
    // in "Ready for QA" and test data; without this filter they leak into every tile.
    const openTasks = readFailed ? [] : tasks!.filter((r) => text(r, T.lifecycle) === 'open');

    // ---- NEEDS YOU ---- the open task waiting longest (oldest last_updated_at) from a healthy source
    const needsYouTask = byOldest(openTasks.filter((r) => text(r, T.sourceStatus) === 'ok'))[0] ?? null;
    const needsYouTitle = needsYouTask ? text(needsYouTask, T.title) : null;
    const needsYouOwner = needsYouTask ? text(needsYouTask, T.owner) : null;
    const needsYouDays = needsYouTask ? getDaysSince(raw(needsYouTask, T.lastUpdated)) : null;
    const needsYouInsight =
        needsYouDays !== null
            ? `${needsYouDays} day${needsYouDays !== 1 ? 's' : ''} waiting — the longest of anything currently open.`
            : null;
    const needsYouMeta = [needsYouOwner ? `Owner: ${needsYouOwner}` : null, needsYouTask ? text(needsYouTask, T.source) : null]
        .filter(Boolean)
        .join(' · ');

    // ---- RIGHT NOW ---- today's calendar events, earliest first
    const calendarSorted = openTasks
        .filter((r) => text(r, T.source) === 'Google Calendar' && isToday(raw(r, T.dueDate)))
        .sort((a, b) => new Date(raw(a, T.dueDate) ?? 0).getTime() - new Date(raw(b, T.dueDate) ?? 0).getTime());
    const nextEvent = calendarSorted[0] ?? null;
    const nextEventTitle = nextEvent ? text(nextEvent, T.title) : null;
    const nextEventTime = nextEvent ? formatTime(raw(nextEvent, T.dueDate)) : '';
    const calendarDetails: DetailItem[] = calendarSorted.slice(1).map((r) => ({
        label: text(r, T.title) ?? 'Untitled',
        meta: formatTime(raw(r, T.dueDate)),
    }));

    // ---- APPROVALS ---- pending items from the Airtable approvals table, oldest first
    const approvalsSorted = byOldest(
        openTasks.filter((r) => text(r, T.source) === 'Airtable' && text(r, T.sourceTable) === 'approvals'),
    );
    const approvalsDetails: DetailItem[] = approvalsSorted.map((r) => ({
        label: text(r, T.title) ?? 'Untitled',
        meta: formatRelative(raw(r, T.lastUpdated)),
    }));

    // ---- QA ---- untriaged findings from ticket_candidates and dev_tickets, oldest first
    const qaSorted = byOldest(
        openTasks.filter((r) => {
            const st = text(r, T.sourceTable);
            return text(r, T.source) === 'Airtable' && (st === 'ticket_candidates' || st === 'dev_tickets');
        }),
    );
    const qaDetails: DetailItem[] = qaSorted.map((r) => ({
        label: text(r, T.title) ?? 'Untitled',
        meta: formatRelative(raw(r, T.lastUpdated)),
    }));

    // Normalized state per tile for the diff, in TILE_ORDER. null while the read is failed.
    const tiles: TileState[] | null = readFailed
        ? null
        : TILE_ORDER.map((tileId): TileState => {
              switch (tileId) {
                  case 'needs_you':
                      return { tileId, status: needsYouTask ? 'ok' : 'empty', value: needsYouTask?.id ?? null };
                  case 'right_now':
                      return { tileId, status: nextEvent ? 'ok' : 'empty', value: idsOf(calendarSorted) || null };
                  case 'approvals':
                      return { tileId, status: approvalsSorted.length ? 'ok' : 'empty', value: `${approvalsSorted.length}|${idsOf(approvalsSorted)}` };
                  case 'qa':
                      return { tileId, status: qaSorted.length ? 'ok' : 'empty', value: `${qaSorted.length}|${idsOf(qaSorted)}` };
                  default: // on_fire, revenue_mix, audit_decisions: no data source yet
                      return { tileId, status: 'unavailable', value: null };
              }
          });

    const { diffFor, commit, reason, loadId } = useBaselineDiff({
        baselineTable,
        baselineRecords,
        userId,
        tiles,
        readFailed,
    });

    // Placeholder text shown in every tile when the read failed.
    const failed = (label: string) => (readFailed ? `Couldn't load ${label}. Your last-visit baseline was not updated.` : undefined);

    const subtitle = readFailed
        ? 'Data unavailable'
        : [
              `${approvalsSorted.length} approval${approvalsSorted.length !== 1 ? 's' : ''} pending`,
              `${qaSorted.length} QA item${qaSorted.length !== 1 ? 's' : ''} open`,
          ].join(' · ');

    return (
        <div className="min-h-screen bg-black p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
                        Dashboard
                    </p>
                    <h1 className="text-3xl font-bold text-white mb-2">{formatDate(new Date())}</h1>
                    <p className="text-sm text-gray-500">{subtitle}</p>
                </header>

                {readError && (
                    <div className="border rounded-lg p-4 mb-4 text-sm" style={{ borderColor: RED, color: RED }}>
                        {readError}. Change tracking is paused and your last-visit baseline was not updated.
                    </div>
                )}

                {isPageElementInEditMode && (
                    <p className="text-[11px] mb-4" style={{ color: MUTED }}>
                        Baseline: {commit}
                        {reason ? ` — ${reason}` : ''} · load {loadId}
                    </p>
                )}

                <BriefBlock />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <LargeInsightCard
                        label="ON FIRE"
                        navLabel="Today →"
                        placeholder={failed('On Fire') ?? 'Unavailable — ranking logic not built yet (CC3).'}
                        diffStatus={diffFor('on_fire')}
                    />
                    <LargeInsightCard
                        label="NEEDS YOU"
                        navLabel="Today →"
                        title={needsYouTitle}
                        insight={needsYouInsight}
                        meta={needsYouMeta || null}
                        moreLabel="Open in source"
                        moreUrl={needsYouTask ? text(needsYouTask, T.sourceUrl) : null}
                        placeholder={failed('Needs You') ?? (needsYouTask ? undefined : 'No tasks needing attention.')}
                        diffStatus={diffFor('needs_you')}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <SmallStatCard
                        label="RIGHT NOW"
                        navLabel="Calendar →"
                        headline={nextEventTitle}
                        headlineColor={ORANGE}
                        subtext={nextEvent ? `Next at ${nextEventTime}` : null}
                        detailItems={calendarDetails}
                        placeholder={failed('Right Now') ?? (nextEvent ? undefined : 'Nothing on the calendar today.')}
                        diffStatus={diffFor('right_now')}
                    />
                    <SmallStatCard
                        label="REVENUE MIX"
                        navLabel="Revenue →"
                        placeholder={failed('Revenue Mix') ?? 'Unavailable — pending Stripe integration.'}
                        diffStatus={diffFor('revenue_mix')}
                    />
                    <SmallStatCard
                        label="APPROVALS"
                        navLabel="Approvals →"
                        headline={`${approvalsSorted.length} pending`}
                        headlineColor={ORANGE}
                        subtext={approvalsSorted.length === 0 ? 'Nothing waiting on you.' : undefined}
                        detailItems={approvalsDetails}
                        placeholder={failed('Approvals')}
                        diffStatus={diffFor('approvals')}
                    />
                    <SmallStatCard
                        label="QA"
                        navLabel="QA reports →"
                        headline={`${qaSorted.length} untriaged`}
                        headlineColor={RED}
                        subtext={qaSorted.length === 0 ? 'Nothing pending review.' : undefined}
                        detailItems={qaDetails}
                        placeholder={failed('QA')}
                        diffStatus={diffFor('qa')}
                    />
                    <SmallStatCard
                        label="AUDIT DECISIONS"
                        navLabel="Audits →"
                        placeholder={failed('Audit Decisions') ?? 'Unavailable — pending the audit workflow (CC19).'}
                        diffStatus={diffFor('audit_decisions')}
                    />
                </div>
            </div>
        </div>
    );
}

initializeBlock({ interface: () => <CEODashboard /> });