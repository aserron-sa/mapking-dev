import './style.css';
import React, { useState, useMemo } from 'react';
import {
    initializeBlock,
    useBase,
    useRecords,
    useSession,
    useCustomProperties,
} from '@airtable/blocks/interface/ui';
import { Table } from '@airtable/blocks/interface/models';

const ORANGE = '#f0883e';
const RED = '#f0625f';
const MUTED = '#6b7280';
const GREEN = '#3fb950';

const LANES = [
    { key: 'all', label: 'All' },
    { key: 'on_fire', label: 'On Fire' },
    { key: 'this_week', label: 'This Week' },
    { key: 'waiting_on', label: 'Waiting On' },
    { key: 'queued', label: 'Queued' },
    { key: 'icebox', label: 'Icebox' },
] as const;

const DOMAINS = ['All', 'Sales', 'Delivery', 'Product', 'QA', 'Revenue', 'Ops'];
const SOURCES = ['All', 'Attio', 'Linear', 'Airtable', 'Google Calendar', 'Manual'];

// Done/Drop/Reschedule only write back to the real source when it's
// Airtable, where we already have write access. Attio/Linear/Google
// Calendar stay local-only — Loom is read-only there by design.
const WRITABLE_SOURCES = new Set(['Airtable']);

function getCustomProperties(base: any) {
    const tasksTable = base.tables.find((t: Table) => t.id === 'tblX61yfIFroyhMTj');
    const lanesTable = base.tables.find((t: Table) => t.id === 'tblZhorxkVfKdsW3Z');
    return [
        { key: 'tasksTable', label: 'Tasks', type: 'table' as const, defaultValue: tasksTable },
        { key: 'lanesTable', label: 'Task lanes', type: 'table' as const, defaultValue: lanesTable },
    ];
}

function selectName(v: unknown): string | null {
    return v && typeof v === 'object' && 'name' in (v as any) ? (v as any).name : null;
}

function daysSince(dateString: string | null): number {
    if (!dateString) return 0;
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isPastDue(dateString: string | null): boolean {
    if (!dateString) return false;
    return new Date(dateString).getTime() < new Date().setHours(0, 0, 0, 0);
}

function Pill({
    text,
    active,
    onClick,
}: {
    text: string;
    active?: boolean;
    onClick?: () => void;
}) {
    const clickable = !!onClick;
    return (
        <button
            onClick={onClick}
            disabled={!clickable}
            className="text-xs rounded-full px-3 py-1"
            style={{
                backgroundColor: active ? ORANGE : '#1f2937',
                color: active ? 'white' : '#9ca3af',
                cursor: clickable ? 'pointer' : 'default',
            }}
        >
            {text}
        </button>
    );
}

function FilterGroup({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => (
                    <Pill key={opt} text={opt} active={value === opt} onClick={() => onChange(opt)} />
                ))}
            </div>
        </div>
    );
}

function TaskListRow({
    title,
    domainTag,
    sourceName,
    owner,
    stale,
    daysInState,
    dueDate,
    actionStatus,
    syncedToSource,
    selected,
    onToggleSelect,
    onOpen,
}: {
    title: string;
    domainTag: string | null;
    sourceName: string | null;
    owner: string | null;
    stale: boolean;
    daysInState: number;
    dueDate: string | null;
    actionStatus: string;
    syncedToSource: boolean;
    selected: boolean;
    onToggleSelect: () => void;
    onOpen: () => void;
}) {
    const dueLabel = dueDate
        ? isPastDue(dueDate)
            ? 'Overdue'
            : `Due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : null;

    return (
        <div className="bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 mb-2">
            <input type="checkbox" checked={selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} />
            <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
                <p className="text-sm text-white truncate">{title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {actionStatus !== 'none' && (
                        <Pill text={syncedToSource ? actionStatus : `${actionStatus} · local only`} />
                    )}
                    {domainTag && <Pill text={domainTag} />}
                    {owner && <Pill text={owner} />}
                    {sourceName && <Pill text={sourceName} />}
                    <span className="text-xs text-gray-500">{daysInState}d</span>
                    {stale && (
                        <span className="text-xs font-medium" style={{ color: RED }}>
                            Stale · no update {daysInState}d
                        </span>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 text-right">
                {dueLabel && (
                    <p className="text-xs font-medium" style={{ color: dueLabel === 'Overdue' ? RED : MUTED }}>
                        {dueLabel}
                    </p>
                )}
            </div>
        </div>
    );
}

function DetailPanel({
    task,
    onClose,
    onAction,
    onMoveLane,
    onDelegate,
}: {
    task: {
        title: string;
        domainTag: string | null;
        sourceName: string | null;
        owner: string | null;
        dueDate: string | null;
        daysInState: number;
        sourceUrl: string | null;
        actionStatus: string;
        syncedToSource: boolean;
        delegatedTo: string | null;
    };
    onClose: () => void;
    onAction: (action: 'done' | 'dropped' | 'rescheduled') => void;
    onMoveLane: (lane: string) => void;
    onDelegate: (name: string) => void;
}) {
    const [delegateName, setDelegateName] = useState('');
    const [showDelegate, setShowDelegate] = useState(false);

    return (
        <div className="w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 p-5 overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ORANGE }}>
                    Task
                </p>
                <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">
                    ✕
                </button>
            </div>
            <p className="text-lg font-bold text-white mb-3">{task.title}</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
                {task.domainTag && <Pill text={task.domainTag} />}
                {task.owner && <Pill text={task.owner} />}
                {task.sourceName && <Pill text={task.sourceName} />}
            </div>
            <p className="text-xs text-gray-500 mb-1">
                {task.dueDate
                    ? `Due ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'No due date'}{' '}
                · {task.daysInState}d since last update
            </p>
            {task.delegatedTo && <p className="text-xs text-gray-500 mb-1">Delegated to {task.delegatedTo}</p>}
            {task.actionStatus !== 'none' && (
                <p className="text-xs mb-1" style={{ color: task.syncedToSource ? GREEN : MUTED }}>
                    {task.actionStatus}
                    {!task.syncedToSource && ' · not synced to source'}
                </p>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-5 mb-2">Actions</p>
            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => onAction('done')}
                    className="text-xs text-white rounded px-3 py-1.5"
                    style={{ backgroundColor: GREEN }}
                >
                    Done
                </button>
                <button
                    onClick={() => onAction('dropped')}
                    className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-1.5"
                >
                    Drop
                </button>
                <button
                    onClick={() => onAction('rescheduled')}
                    className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-1.5"
                >
                    +7d
                </button>
            </div>

            <select
                defaultValue=""
                onChange={(e) => e.target.value && onMoveLane(e.target.value)}
                className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 mb-3"
            >
                <option value="">Move to…</option>
                {LANES.filter((l) => l.key !== 'all').map((l) => (
                    <option key={l.key} value={l.key}>
                        {l.label}
                    </option>
                ))}
            </select>

            {task.sourceUrl && (
                <a
                    href={task.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-center mb-3"
                >
                    Open in {task.sourceName ?? 'source'}
                </a>
            )}

            {!showDelegate ? (
                <button onClick={() => setShowDelegate(true)} className="text-xs text-gray-400 underline">
                    Delegate?
                </button>
            ) : (
                <div className="flex gap-1.5 mt-1">
                    <input
                        value={delegateName}
                        onChange={(e) => setDelegateName(e.target.value)}
                        placeholder="Name…"
                        className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                    />
                    <button
                        onClick={() => {
                            if (delegateName.trim()) onDelegate(delegateName.trim());
                            setShowDelegate(false);
                        }}
                        className="text-xs"
                        style={{ color: ORANGE }}
                    >
                        Confirm
                    </button>
                </div>
            )}
        </div>
    );
}

function WorkQueueApp(): React.ReactElement {
    const session = useSession();
    const currentUser = session.currentUser;
    const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);

    const tasksTable = customPropertyValueByKey.tasksTable as Table | undefined;
    const lanesTable = customPropertyValueByKey.lanesTable as Table | undefined;

    const tasksRecords = useRecords(tasksTable ?? null);
    const lanesRecords = useRecords(lanesTable ?? null);

    const [activePage, setActivePage] = useState<'queue' | 'delivery'>('queue');
    const [activeTab, setActiveTab] = useState<string>('all');
    const [domainFilter, setDomainFilter] = useState('All');
    const [ownerFilter, setOwnerFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);

    const titleField = tasksTable?.getFieldIfExists('title');
    const ownerField = tasksTable?.getFieldIfExists('owner');
    const domainTagField = tasksTable?.getFieldIfExists('domain_tag');
    const sourceField = tasksTable?.getFieldIfExists('source');
    const sourceUrlField = tasksTable?.getFieldIfExists('source_url');
    const sourceStatusField = tasksTable?.getFieldIfExists('source_status');
    const lastUpdatedField = tasksTable?.getFieldIfExists('last_updated_at');
    const dueDateField = tasksTable?.getFieldIfExists('due_date');

    const lUserField = lanesTable?.getFieldIfExists('user');
    const lTaskField = lanesTable?.getFieldIfExists('task');
    const lLaneField = lanesTable?.getFieldIfExists('lane');
    const lRankPositionField = lanesTable?.getFieldIfExists('rank_position');
    const lRankedAtField = lanesTable?.getFieldIfExists('ranked_at');
    const lActionStatusField = lanesTable?.getFieldIfExists('action_status');
    const lRescheduledDateField = lanesTable?.getFieldIfExists('rescheduled_date');
    const lSyncedField = lanesTable?.getFieldIfExists('synced_to_source');
    const lDelegatedToField = lanesTable?.getFieldIfExists('delegated_to');
    const lDomainOverrideField = lanesTable?.getFieldIfExists('domain_override');
    const lOwnerOverrideField = lanesTable?.getFieldIfExists('owner_override');

    const myLaneRows = useMemo(() => {
        if (!lanesRecords || !currentUser || !lUserField) return [];
        return lanesRecords.filter((r) => {
            const u = r.getCellValue(lUserField) as { id: string } | null;
            return u?.id === currentUser.id;
        });
    }, [lanesRecords, currentUser, lUserField]);

    const laneRowByTaskId = useMemo(() => {
        const map = new Map<string, any>();
        if (!lTaskField) return map;
        myLaneRows.forEach((r) => {
            const links = r.getCellValue(lTaskField) as { id: string }[] | null;
            if (links && links[0]) map.set(links[0].id, r);
        });
        return map;
    }, [myLaneRows, lTaskField]);

    const okTasks = useMemo(() => {
        if (!tasksRecords || !sourceStatusField) return [];
        return tasksRecords.filter((r) => selectName(r.getCellValue(sourceStatusField)) === 'ok');
    }, [tasksRecords, sourceStatusField]);

    const getDetails = (task: any) => {
        const laneRow = laneRowByTaskId.get(task.id);
        const rawDomain = domainTagField ? selectName(task.getCellValue(domainTagField)) : null;
        const rawOwner = ownerField ? (task.getCellValue(ownerField) as string | null) : null;
        const domainOverride =
            laneRow && lDomainOverrideField ? selectName(laneRow.getCellValue(lDomainOverrideField)) : null;
        const ownerOverride =
            laneRow && lOwnerOverrideField ? (laneRow.getCellValue(lOwnerOverrideField) as string | null) : null;
        const lane = laneRow && lLaneField ? selectName(laneRow.getCellValue(lLaneField)) ?? 'queued' : 'queued';
        const actionStatus =
            laneRow && lActionStatusField ? selectName(laneRow.getCellValue(lActionStatusField)) ?? 'none' : 'none';
        const syncedToSource = laneRow && lSyncedField ? !!laneRow.getCellValue(lSyncedField) : false;
        const delegatedTo =
            laneRow && lDelegatedToField ? (laneRow.getCellValue(lDelegatedToField) as string | null) : null;
        const dueDate = dueDateField ? (task.getCellValue(dueDateField) as string | null) : null;
        const lastUpdated = lastUpdatedField ? (task.getCellValue(lastUpdatedField) as string | null) : null;
        const daysInState = daysSince(lastUpdated);
        const stale = actionStatus === 'none' && isPastDue(dueDate) && daysInState >= 2;

        return {
            laneRow,
            title: titleField ? (task.getCellValue(titleField) as string) ?? 'Untitled' : 'Untitled',
            domainTag: domainOverride ?? rawDomain,
            owner: ownerOverride ?? rawOwner,
            sourceName: sourceField ? selectName(task.getCellValue(sourceField)) : null,
            sourceUrl: sourceUrlField ? (task.getCellValue(sourceUrlField) as string | null) : null,
            dueDate,
            daysInState,
            lane,
            actionStatus,
            syncedToSource,
            delegatedTo,
            stale,
        };
    };

    const ownersInData = useMemo(() => {
        const s = new Set<string>();
        okTasks.forEach((t) => {
            const o = ownerField ? (t.getCellValue(ownerField) as string | null) : null;
            if (o) s.add(o);
        });
        return ['All', ...Array.from(s).sort()];
    }, [okTasks, ownerField]);

    const laneCounts = useMemo(() => {
        const counts: Record<string, number> = { all: 0, on_fire: 0, this_week: 0, waiting_on: 0, queued: 0, icebox: 0 };
        okTasks.forEach((t) => {
            const d = getDetails(t);
            counts.all += 1;
            counts[d.lane] = (counts[d.lane] ?? 0) + 1;
        });
        return counts;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [okTasks, laneRowByTaskId]);

    const filteredTasks = useMemo(() => {
        return okTasks.filter((t) => {
            const d = getDetails(t);
            if (activeTab !== 'all' && d.lane !== activeTab) return false;
            if (domainFilter !== 'All' && d.domainTag !== domainFilter) return false;
            if (ownerFilter !== 'All' && d.owner !== ownerFilter) return false;
            if (sourceFilter !== 'All' && d.sourceName !== sourceFilter) return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [okTasks, activeTab, domainFilter, ownerFilter, sourceFilter, laneRowByTaskId]);

    const openTask = openTaskId ? okTasks.find((t) => t.id === openTaskId) : null;

    const upsertLaneRow = async (taskId: string, fields: Record<string, any>) => {
        if (!lanesTable || !currentUser || !lUserField || !lTaskField) return;
        const existing = laneRowByTaskId.get(taskId);
        if (existing) {
            if (!lanesTable.hasPermissionToUpdateRecords()) return;
            await lanesTable.updateRecordAsync(existing.id, fields);
        } else {
            if (!lanesTable.hasPermissionToCreateRecords()) return;
            await lanesTable.createRecordAsync({
                [lUserField.id]: { id: currentUser.id },
                [lTaskField.id]: [{ id: taskId }],
                ...fields,
            });
        }
    };

    const moveLane = (taskId: string, laneKey: string) => {
        if (!lLaneField) return;
        const fields: Record<string, any> = { [lLaneField.id]: { name: laneKey } };
        if (laneKey === 'on_fire' && lRankPositionField && lRankedAtField) {
            const count = myLaneRows.filter((r) => lLaneField && selectName(r.getCellValue(lLaneField)) === 'on_fire').length;
            fields[lRankPositionField.id] = count + 1;
            fields[lRankedAtField.id] = new Date().toISOString();
        }
        upsertLaneRow(taskId, fields);
    };

    const applyAction = (task: any, action: 'done' | 'dropped' | 'rescheduled') => {
        if (!lActionStatusField || !lSyncedField) return;
        const d = getDetails(task);
        const canSync = WRITABLE_SOURCES.has(d.sourceName ?? '');
        const fields: Record<string, any> = {
            [lActionStatusField.id]: { name: action },
            [lSyncedField.id]: canSync,
        };
        if (action === 'rescheduled' && lRescheduledDateField) {
            const next = new Date();
            next.setDate(next.getDate() + 7);
            fields[lRescheduledDateField.id] = next.toISOString().slice(0, 10);
        }
        upsertLaneRow(task.id, fields);
    };

    const delegate = (taskId: string, name: string) => {
        if (!lDelegatedToField) return;
        upsertLaneRow(taskId, { [lDelegatedToField.id]: name });
    };

    const toggleSelect = (taskId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(taskId) ? next.delete(taskId) : next.add(taskId);
            return next;
        });
    };

    const bulkRetag = async (domain: string) => {
        if (!lDomainOverrideField) return;
        const results = await Promise.allSettled(
            Array.from(selectedIds).map((id) => upsertLaneRow(id, { [lDomainOverrideField.id]: { name: domain } }))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) alert(`${failed} of ${selectedIds.size} items failed to retag — the rest succeeded.`);
        setSelectedIds(new Set());
    };

    const bulkReassign = async (owner: string) => {
        if (!lOwnerOverrideField) return;
        const results = await Promise.allSettled(
            Array.from(selectedIds).map((id) => upsertLaneRow(id, { [lOwnerOverrideField.id]: owner }))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) alert(`${failed} of ${selectedIds.size} items failed to reassign — the rest succeeded.`);
        setSelectedIds(new Set());
    };

    const bulkPushNextWeek = async () => {
        if (!lActionStatusField || !lSyncedField || !lRescheduledDateField) return;
        const next = new Date();
        next.setDate(next.getDate() + 7);
        const results = await Promise.allSettled(
            Array.from(selectedIds).map((id) =>
                upsertLaneRow(id, {
                    [lActionStatusField.id]: { name: 'rescheduled' },
                    [lSyncedField.id]: false,
                    [lRescheduledDateField.id]: next.toISOString().slice(0, 10),
                })
            )
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) alert(`${failed} of ${selectedIds.size} items failed to push — the rest succeeded.`);
        setSelectedIds(new Set());
    };

    if (errorState) {
        return (
            <div className="min-h-screen bg-black text-white p-6">
                <p style={{ color: RED }}>Error loading custom properties.</p>
            </div>
        );
    }
    if (!tasksTable || !lanesTable) {
        return (
            <div className="min-h-screen bg-black text-white p-6">
                <p className="text-gray-400">Configure the Tasks and Task Lanes tables in the properties panel.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex">
            <div className="flex-1 p-6 overflow-auto">
                <div className="flex gap-2 mb-5">
                    <button
                        onClick={() => setActivePage('queue')}
                        className="text-sm rounded-md px-4 py-2 font-medium"
                        style={{
                            backgroundColor: activePage === 'queue' ? '#1f2937' : 'transparent',
                            color: activePage === 'queue' ? 'white' : '#6b7280',
                            border: activePage === 'queue' ? `1px solid ${ORANGE}` : '1px solid #1f2937',
                        }}
                    >
                        Queue
                    </button>
                    <button
                        onClick={() => setActivePage('delivery')}
                        className="text-sm rounded-md px-4 py-2 font-medium"
                        style={{
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            border: '1px solid #1f2937',
                        }}
                    >
                        Delivery
                    </button>
                </div>

                {activePage === 'delivery' ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                        <p className="text-sm text-gray-400">
                            Coming soon — this is CC9 (Work · Delivery board with capacity meter), a separate
                            story that hasn't been built yet.
                        </p>
                    </div>
                ) : (
                    <>
                <header className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
                        Queue
                    </p>
                    <h1 className="text-3xl font-bold text-white mb-1">Everything, in one place</h1>
                    <p className="text-sm text-gray-500">
                        Aggregated from Attio, Linear and Airtable. Triage here, work there.
                    </p>
                </header>

                <div className="flex flex-wrap gap-2 mb-5">
                    {LANES.map((l) => (
                        <Pill
                            key={l.key}
                            text={`${l.label} ${laneCounts[l.key] ?? 0}`}
                            active={activeTab === l.key}
                            onClick={() => setActiveTab(l.key)}
                        />
                    ))}
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 bg-gray-900 border rounded-lg px-4 py-2 mb-4" style={{ borderColor: ORANGE }}>
                        <span className="text-sm text-white">{selectedIds.size} selected</span>
                        <select
                            onChange={(e) => e.target.value && bulkRetag(e.target.value)}
                            value=""
                            className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                        >
                            <option value="">Retag domain…</option>
                            {DOMAINS.filter((d) => d !== 'All').map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                const name = prompt('Reassign to:');
                                if (name) bulkReassign(name);
                            }}
                            className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-2 py-1"
                        >
                            Reassign owner…
                        </button>
                        <button
                            onClick={bulkPushNextWeek}
                            className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-2 py-1"
                        >
                            Push to next week
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 underline ml-auto">
                            Clear selection
                        </button>
                    </div>
                )}

                <div className="flex gap-6">
                    <div className="w-48 flex-shrink-0">
                        <FilterGroup label="Domain" options={DOMAINS} value={domainFilter} onChange={setDomainFilter} />
                        <FilterGroup label="Owner" options={ownersInData} value={ownerFilter} onChange={setOwnerFilter} />
                        <FilterGroup label="Source" options={SOURCES} value={sourceFilter} onChange={setSourceFilter} />
                        {(domainFilter !== 'All' || ownerFilter !== 'All' || sourceFilter !== 'All') && (
                            <button
                                onClick={() => {
                                    setDomainFilter('All');
                                    setOwnerFilter('All');
                                    setSourceFilter('All');
                                }}
                                className="text-xs text-gray-400 underline"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        {filteredTasks.length === 0 && (
                            <p className="text-sm text-gray-600">Nothing matches these filters.</p>
                        )}
                        {filteredTasks.map((t) => {
                            const d = getDetails(t);
                            return (
                                <TaskListRow
                                    key={t.id}
                                    title={d.title}
                                    domainTag={d.domainTag}
                                    sourceName={d.sourceName}
                                    owner={d.owner}
                                    stale={d.stale}
                                    daysInState={d.daysInState}
                                    dueDate={d.dueDate}
                                    actionStatus={d.actionStatus}
                                    syncedToSource={d.syncedToSource}
                                    selected={selectedIds.has(t.id)}
                                    onToggleSelect={() => toggleSelect(t.id)}
                                    onOpen={() => setOpenTaskId(t.id)}
                                />
                            );
                        })}
                    </div>
                </div>
                </>
                )}
            </div>

            {activePage === 'queue' && openTask && (
                <DetailPanel
                    task={getDetails(openTask)}
                    onClose={() => setOpenTaskId(null)}
                    onAction={(action) => applyAction(openTask, action)}
                    onMoveLane={(lane) => moveLane(openTask.id, lane)}
                    onDelegate={(name) => delegate(openTask.id, name)}
                />
            )}
        </div>
    );
}

initializeBlock({ interface: () => <WorkQueueApp /> });