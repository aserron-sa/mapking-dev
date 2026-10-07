import React, { useState, useEffect } from 'react';
import { initializeBlock, useBase, useRecords, useSession } from '@airtable/blocks/interface/ui';

const ORANGE = '#f0883e';
const RED = '#f0625f';
const MUTED = '#6b7280';
const BLUE = '#58a6ff';

const TASKS_TABLE_ID = 'tblX61yfIFroyhMTj';
const BASELINE_TABLE_ID = 'tblOkKSZroaOk8kQ3';

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
        <div
            className={`bg-gray-800 rounded-lg p-5 flex flex-col ${
                large ? 'min-h-[210px]' : 'min-h-[160px]'
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {label}
                </p>
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
type DiffStatus = 'first_view' | 'changed' | 'unchanged' | 'unavailable';

function DiffBadge({ status }: { status: DiffStatus }) {
    if (status === 'unavailable') return null;
    const config: Record<Exclude<DiffStatus, 'unavailable'>, { text: string; color: string }> = {
        first_view: { text: 'First view', color: BLUE },
        changed: { text: 'Updated since last visit', color: ORANGE },
        unchanged: { text: 'No change since last visit', color: MUTED },
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

// ─────────────────────────────────────────────────────────────────────────────
// Large card
// ─────────────────────────────────────────────────────────────────────────────

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
    diffStatus?: DiffStatus;
}) {
    return (
        <CardShell label={label} navLabel={navLabel} large>
            {placeholder ? (
                <p className="text-sm" style={{ color: MUTED }}>
                    {placeholder}
                </p>
            ) : (
                <>
                    <p className="text-xl font-semibold text-white mb-3 leading-snug">
                        {title ?? 'Untitled'}
                    </p>
                    {insight && (
                        <p
                            className="text-sm text-gray-200 pl-3 mb-3"
                            style={{ borderLeft: `2px solid ${accentColor}` }}
                        >
                            {insight}
                        </p>
                    )}
                    {meta && <p className="text-xs text-gray-500">{meta}</p>}
                    {diffStatus && <DiffBadge status={diffStatus} />}
                    <ExternalLinkButton label={moreLabel ?? 'More'} url={moreUrl} />
                </>
            )}
        </CardShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small card
// ─────────────────────────────────────────────────────────────────────────────

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
    diffStatus?: DiffStatus;
}) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = !!detailItems && detailItems.length > 0;

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
                    {diffStatus && <DiffBadge status={diffStatus} />}
                    {expanded && hasDetails && <DetailList items={detailItems!} />}
                    {hasDetails && (
                        <ToggleButton expanded={expanded} onClick={() => setExpanded((e) => !e)} />
                    )}
                </>
            )}
        </CardShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// "The Brief" block — still placeholder; unrelated to the per-tile diff below.
// ─────────────────────────────────────────────────────────────────────────────

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
                        A narrative summary here needs CC12. The per-tile change indicators below
                        (the small "Updated since last visit" / "No change" lines on each card) are
                        the real, mechanical version of this — built for Story MapKMigGon38569.
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
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
function formatTime(dateString: string | null): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function formatRelative(dateString: string | null): string {
    if (!dateString) return '';
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
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
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────

function CEODashboard(): React.ReactElement {
    const base = useBase();
    const session = useSession();
    const currentUserId = session?.currentUser?.id ?? null;

    const tasksTable = base.getTableByIdIfExists(TASKS_TABLE_ID);
    const allTasks = useRecords(tasksTable);

    const baselineTable = base.getTableByIdIfExists(BASELINE_TABLE_ID);
    const baselineRecords = useRecords(baselineTable);

    const titleField = tasksTable?.getFieldIfExists('fld4JRaVYnwttmi4P');
    const ownerField = tasksTable?.getFieldIfExists('fldECSTk2LFWGIS6V');
    const lastUpdatedField = tasksTable?.getFieldIfExists('fldG6wphuQyvtHSIy');
    const sourceStatusField = tasksTable?.getFieldIfExists('fldXpO4TchBQJVkhm');
    const sourceUrlField = tasksTable?.getFieldIfExists('fldqoka4e1FLKxJ6x');
    const sourceField = tasksTable?.getFieldIfExists('fldceaJIeHpA3Tdae');
    const sourceTableField = tasksTable?.getFieldIfExists('fldzYRdrxSjCpSQsk');
    const dueDateField = tasksTable?.getFieldIfExists('fldld41zIqgdNXeyn');

    const baselineUserField = baselineTable?.getFieldIfExists('fldwcKIxj6ErUtTFC');
    const baselineTileIdField = baselineTable?.getFieldIfExists('fldZRM66FUY6VyEI8');
    const baselineSnapshotField = baselineTable?.getFieldIfExists('fldqsYdDnBJXVIRtF');
    const baselineLastViewedField = baselineTable?.getFieldIfExists('fldlBlHkMRHXR5ZNj');

    const selectName = (v: unknown): string | null =>
        v && typeof v === 'object' && 'name' in (v as any) ? (v as any).name : null;

    const sortByOldest = <T extends { getCellValue: (f: any) => unknown }>(records: T[]): T[] =>
        [...records].sort((a, b) => {
            const da = lastUpdatedField ? (a.getCellValue(lastUpdatedField) as string | null) : null;
            const db = lastUpdatedField ? (b.getCellValue(lastUpdatedField) as string | null) : null;
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return new Date(da).getTime() - new Date(db).getTime();
        });

    const okTasks = allTasks.filter(
        (r) => sourceStatusField && selectName(r.getCellValue(sourceStatusField)) === 'ok'
    );

    // ---- NEEDS YOU ----
    const needsYouSorted = sortByOldest(okTasks);
    const needsYouTask = needsYouSorted[0] ?? null;
    const needsYouTitle = needsYouTask && titleField ? (needsYouTask.getCellValue(titleField) as string | null) : null;
    const needsYouOwner = needsYouTask && ownerField ? (needsYouTask.getCellValue(ownerField) as string | null) : null;
    const needsYouLastUpdated = needsYouTask && lastUpdatedField ? (needsYouTask.getCellValue(lastUpdatedField) as string | null) : null;
    const needsYouSourceUrl = needsYouTask && sourceUrlField ? (needsYouTask.getCellValue(sourceUrlField) as string | null) : null;
    const needsYouSourceName = needsYouTask && sourceField ? selectName(needsYouTask.getCellValue(sourceField)) : null;
    const needsYouDays = getDaysSince(needsYouLastUpdated);
    const needsYouInsight =
        needsYouDays !== null
            ? `${needsYouDays} day${needsYouDays !== 1 ? 's' : ''} waiting — the longest of anything currently open.`
            : null;
    const needsYouMeta = [needsYouOwner ? `Owner: ${needsYouOwner}` : null, needsYouSourceName]
        .filter(Boolean)
        .join(' · ');
    const needsYouSnapshot = `${needsYouTitle ?? 'none'}|${needsYouInsight ?? ''}`;

    // ---- RIGHT NOW ----
    const calendarTasks = allTasks.filter((r) => {
        if (!sourceField || !dueDateField) return false;
        const dueDate = r.getCellValue(dueDateField) as string | null;
        return selectName(r.getCellValue(sourceField)) === 'Google Calendar' && isToday(dueDate);
    });
    const calendarSorted = [...calendarTasks].sort((a, b) => {
        const da = dueDateField ? (a.getCellValue(dueDateField) as string | null) : null;
        const db = dueDateField ? (b.getCellValue(dueDateField) as string | null) : null;
        if (!da || !db) return 0;
        return new Date(da).getTime() - new Date(db).getTime();
    });
    const nextEvent = calendarSorted[0] ?? null;
    const nextEventTitle = nextEvent && titleField ? (nextEvent.getCellValue(titleField) as string | null) : null;
    const nextEventTime = nextEvent && dueDateField ? formatTime(nextEvent.getCellValue(dueDateField) as string | null) : '';
    const calendarDetails: DetailItem[] = calendarSorted.slice(1).map((r) => ({
        label: (titleField ? (r.getCellValue(titleField) as string) : 'Untitled') ?? 'Untitled',
        meta: dueDateField ? formatTime(r.getCellValue(dueDateField) as string | null) : undefined,
    }));
    const rightNowSnapshot = `${nextEvent ? nextEventTitle : 'none'}|${nextEventTime}`;

    // ---- APPROVALS ----
    const approvalsTasks = allTasks.filter(
        (r) =>
            sourceField &&
            sourceTableField &&
            selectName(r.getCellValue(sourceField)) === 'Airtable' &&
            r.getCellValue(sourceTableField) === 'approvals'
    );
    const approvalsSorted = sortByOldest(approvalsTasks);
    const approvalsDetails: DetailItem[] = approvalsSorted.map((r) => ({
        label: (titleField ? (r.getCellValue(titleField) as string) : 'Untitled') ?? 'Untitled',
        meta: lastUpdatedField ? formatRelative(r.getCellValue(lastUpdatedField) as string | null) : undefined,
    }));
    const approvalsSnapshot = `${approvalsTasks.length} pending`;

    // ---- QA ----
    const qaTasks = allTasks.filter((r) => {
        if (!sourceField || !sourceTableField) return false;
        const st = r.getCellValue(sourceTableField) as string | null;
        return selectName(r.getCellValue(sourceField)) === 'Airtable' && (st === 'ticket_candidates' || st === 'dev_tickets');
    });
    const qaSorted = sortByOldest(qaTasks);
    const qaDetails: DetailItem[] = qaSorted.map((r) => ({
        label: (titleField ? (r.getCellValue(titleField) as string) : 'Untitled') ?? 'Untitled',
        meta: lastUpdatedField ? formatRelative(r.getCellValue(lastUpdatedField) as string | null) : undefined,
    }));
    const qaSnapshot = `${qaTasks.length} untriaged`;

    // ─────────────────────────────────────────────────────────────────────
    // DIFF LOGIC — "Since You Last Opened It" (Story MapKMigGon38569 AC)
    // Compares each real tile's current snapshot string against the current
    // user's stored baseline. Never throws: a missing/corrupt/unscoped
    // baseline just reads as "first_view" rather than blocking the dashboard.
    // ─────────────────────────────────────────────────────────────────────

    const getBaselineRecord = (tileId: string) => {
        if (!currentUserId || !baselineUserField || !baselineTileIdField) return null;
        return (
            baselineRecords.find((r) => {
                const u = r.getCellValue(baselineUserField) as { id?: string } | null;
                const t = r.getCellValue(baselineTileIdField) as string | null;
                return u?.id === currentUserId && t === tileId;
            }) ?? null
        );
    };

    const diffFor = (tileId: string, currentSnapshot: string): DiffStatus => {
        if (!currentUserId || !baselineTable) return 'unavailable';
        const baseline = getBaselineRecord(tileId);
        if (!baseline || !baselineSnapshotField) return 'first_view';
        const prevSnapshot = baseline.getCellValue(baselineSnapshotField) as string | null;
        if (prevSnapshot === null || prevSnapshot === undefined || prevSnapshot === '') return 'first_view';
        return prevSnapshot === currentSnapshot ? 'unchanged' : 'changed';
    };

    const needsYouDiff = diffFor('needs_you', needsYouSnapshot);
    const rightNowDiff = diffFor('right_now', rightNowSnapshot);
    const approvalsDiff = diffFor('approvals', approvalsSnapshot);
    const qaDiff = diffFor('qa', qaSnapshot);

    // Write the new baseline AFTER a successful render — never before, and
    // never if something upstream looks broken (missing table/user/fields).
    useEffect(() => {
        if (!currentUserId || !baselineTable || !baselineUserField || !baselineTileIdField || !baselineSnapshotField || !baselineLastViewedField) {
            return; // config incomplete — skip silently, dashboard still renders fine without the diff
        }

        const upsert = async (tileId: string, snapshot: string) => {
            try {
                const existing = getBaselineRecord(tileId);
                const payload = {
                    [baselineSnapshotField.id]: snapshot,
                    [baselineLastViewedField.id]: new Date().toISOString(),
                };
                if (existing) {
                    await baselineTable.updateRecordAsync(existing.id, payload);
                } else {
                    await baselineTable.createRecordAsync({
                        [baselineUserField.id]: { id: currentUserId },
                        [baselineTileIdField.id]: tileId,
                        ...payload,
                    });
                }
            } catch (err) {
                // Never let a baseline write failure break the dashboard.
                // eslint-disable-next-line no-console
                console.error(`dashboard_tile_baseline upsert failed for ${tileId}:`, err);
            }
        };

        upsert('needs_you', needsYouSnapshot);
        upsert('right_now', rightNowSnapshot);
        upsert('approvals', approvalsSnapshot);
        upsert('qa', qaSnapshot);
        // Intentionally NOT depending on baselineRecords itself, to avoid a
        // write-triggers-refetch-triggers-write loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsYouSnapshot, rightNowSnapshot, approvalsSnapshot, qaSnapshot, currentUserId]);

    const subtitleParts = [
        `${approvalsTasks.length} approval${approvalsTasks.length !== 1 ? 's' : ''} pending`,
        `${qaTasks.length} QA item${qaTasks.length !== 1 ? 's' : ''} open`,
    ];

    return (
        <div className="min-h-screen bg-black p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
                        Dashboard
                    </p>
                    <h1 className="text-3xl font-bold text-white mb-2">{formatDate(new Date())}</h1>
                    <p className="text-sm text-gray-500">{subtitleParts.join(' · ')}</p>
                </header>

                <BriefBlock />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <LargeInsightCard
                        label="ON FIRE"
                        navLabel="Today →"
                        placeholder="Coming soon — ranking logic not built yet (CC3)."
                    />
                    <LargeInsightCard
                        label="NEEDS YOU"
                        navLabel="Today →"
                        title={needsYouTitle}
                        insight={needsYouInsight}
                        meta={needsYouMeta || null}
                        moreLabel="Open in source"
                        moreUrl={needsYouSourceUrl}
                        placeholder={needsYouTask ? undefined : 'No tasks needing attention.'}
                        diffStatus={needsYouTask ? needsYouDiff : undefined}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <SmallStatCard
                        label="RIGHT NOW"
                        navLabel="Calendar →"
                        headline={nextEvent ? nextEventTitle : null}
                        headlineColor={ORANGE}
                        subtext={nextEvent ? `Next at ${nextEventTime}` : null}
                        detailItems={calendarDetails}
                        placeholder={nextEvent ? undefined : 'Nothing on the calendar today.'}
                        diffStatus={nextEvent ? rightNowDiff : undefined}
                    />
                    <SmallStatCard
                        label="REVENUE MIX"
                        navLabel="Revenue →"
                        placeholder="Coming soon — pending Stripe integration."
                    />
                    <SmallStatCard
                        label="APPROVALS"
                        navLabel="Approvals →"
                        headline={`${approvalsTasks.length} pending`}
                        headlineColor={ORANGE}
                        subtext={approvalsTasks.length === 0 ? 'Nothing waiting on you.' : undefined}
                        detailItems={approvalsDetails}
                        diffStatus={approvalsDiff}
                    />
                    <SmallStatCard
                        label="QA"
                        navLabel="QA reports →"
                        headline={`${qaTasks.length} untriaged`}
                        headlineColor={RED}
                        subtext={qaTasks.length === 0 ? 'Nothing pending review.' : undefined}
                        detailItems={qaDetails}
                        diffStatus={qaDiff}
                    />
                    <SmallStatCard
                        label="AUDIT DECISIONS"
                        navLabel="Audits →"
                        placeholder="Coming soon — pending the audit workflow (CC19)."
                    />
                </div>
            </div>
        </div>
    );
}

initializeBlock({ interface: () => <CEODashboard /> });