/**
 * Work · Queue — triage list by lanes (MapKMigGon38571)
 *
 * Airtable Interface custom component for Interface 2 → Work · Queue
 * (page pag03n2LkOElxV9qW). In Airtable's code editor this file is `frontend/index.tsx`;
 * `style.css` and `package.json` are in ./extension-template/.
 *
 * DO NOT paste this file as is: it imports the cct-* modules, and Airtable accepts one file.
 * Paste the built file instead:
 *     airtable/cct/dist/interfaces/WorkQueuePage.tsx      (npm run cct:build)
 *
 * History: original by Carlos Olivares (2026-09-17). Reworked by Andrés Serrón for story
 * MapKMigGon38571 (spec §5): the triage values come from command_center_triages (written by
 * the hourly automation) and are combined with the user's task_lanes row by
 * cct-triage-contract.ts. This file only reads Airtable, calls the contract and draws it.
 *
 * What changed against the original (spec §5.5):
 *   - Only OPEN tasks are listed (the original listed 691 closed rows next to 146 open).
 *   - Tasks whose source is stale or unavailable are listed, with a "partial" banner.
 *   - Every task has a lane: the user's manual lane, else the rule suggestion, else queued.
 *   - Stale comes from the triage row (configurable), not from a hard-coded rule.
 *   - Owner is the canonical team_members name; the raw source value is in the detail panel.
 *   - Filters allow several values per dimension, "No domain" / "Unassigned", and values
 *     restored from the URL are validated (invalid ones are shown and logged).
 *   - "Delegate to X?" prompt when the triage suggests a person.
 *   - Fields are looked up by ID, and a missing field is named instead of showing an empty list.
 *   - Bulk actions, lane moves and delegation are logged as `triage_action` in priority_events.
 *
 * Still the same: Queue / Delivery toggle (Delivery is the CC9 placeholder), lane tabs,
 * detail panel, Done / Drop / +7d, Move to, Open in <source>, bulk retag / reassign / push.
 * The page writes only to task_lanes (per user) and priority_events, never to
 * command_center_tasks or command_center_triages.
 *
 * Docs: docs/stories/MapKMigGon38571/{spec,schema,implementation-plan}.md
 * Fields the page needs must be visible in the page's Data panel (step 7b).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    initializeBlock,
    useRecords,
    useSession,
    useCustomProperties,
} from '@airtable/blocks/interface/ui';
import type { Table } from '@airtable/blocks/interface/models';
import { DOMAINS, LANES, SOURCES } from '../cct-triage-rules.ts';
import type { Lane } from '../cct-triage-rules.ts';
import {
    NONE,
    applyFilters,
    buildTriageRows,
    checkRequiredFields,
    compareRows,
    completeness,
    groupAdjacent,
    hasActiveFilters,
    laneCounts,
    ownersPresent,
    provenance,
    showStaleBadge,
    validateFilters,
} from './cct-triage-contract.ts';
import type {
    Filters,
    FilterIssue,
    Heartbeat,
    LaneRecord,
    LoomRun,
    TaskRecord,
    TriageRecord,
    TriageRow,
} from './cct-triage-contract.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Ids (tables and fields by ID, never by name: a rename does not break the page)
// Source of truth: docs/stories/MapKMigGon38571/schema.md
// ─────────────────────────────────────────────────────────────────────────────

const IDS = {
    tasks: {
        table: 'tblX61yfIFroyhMTj', // command_center_tasks
        fields: {
            taskId: 'fldmSHhnTbC1Go3Dw',
            title: 'fld4JRaVYnwttmi4P',
            source: 'fldceaJIeHpA3Tdae',
            sourceTable: 'fldzYRdrxSjCpSQsk',
            sourceUrl: 'fldqoka4e1FLKxJ6x',
            statusRaw: 'fldaxkMZkAAjQOWgQ',
            dueDate: 'fldld41zIqgdNXeyn',
            lastUpdatedAt: 'fldG6wphuQyvtHSIy',
            lifecycle: 'fldzqG2oVnK93COcW',
            sourceStatus: 'fldXpO4TchBQJVkhm',
            domain: 'fldejhIOeD3YCFRRP',
            owner: 'fldECSTk2LFWGIS6V',
            category: 'fldTamXky2fjceS9C',
            tags: 'fldYqQehpEy918bve',
            schedulable: 'fldfxuYNvITcMIlFu',
        },
    },
    lanes: {
        table: 'tblZhorxkVfKdsW3Z', // task_lanes
        fields: {
            user: 'fldv531mBAE9KL2Yk',
            task: 'fldXRxxIcIxWbZ7ai',
            lane: 'fldHBsnLRIT7RrGv0',
            rankPosition: 'fld1PKtXTsBK17pxD',
            rankedAt: 'fld15soq5jo4j3jxC',
            actionStatus: 'fldUUl05OfOEZy1Nt',
            rescheduledDate: 'fldaPimUjnyoeYLYD',
            synced: 'fld82YkHLJoNjNStK',
            delegatedTo: 'fldDoK9FlyVQOx0S7',
            domainOverride: 'fldF2CxDSlbxTSlxf',
            ownerOverride: 'fldL97Nv2R8y0dh3g',
        },
    },
    triages: {
        table: 'tblaG64QpuRInrm5X', // command_center_triages
        fields: {
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
        },
    },
    // Optional: when not readable the page says so in the "partial" banner instead of failing.
    runs: {
        table: 'tblLnaOIEzNbIWp9S', // loom_sync_runs
        fields: { status: 'fldYvWnWj7QkqY8yy', startedAt: 'fldzIMcCyDHB4Nf29' },
    },
    configs: {
        table: 'tblGZaFBg7KLbcuf7', // cct_triage_configs
        fields: { active: 'fld9TdaRYZ0RqDoYi', lastRunAt: 'fldQkNOnM1kIMoaR1', lastRunStatus: 'fldiWWUK6iQB7DGMD' },
    },
    events: {
        table: 'tbl0k4YFnduwhMJG2', // priority_events
        fields: {
            summary: 'fldxNmEoRpB4SRouZ',
            eventType: 'fldu8UXkQBfrIHvZe',
            status: 'fldL2k5qUjcOasDxU',
            source: 'fldIj7BNfY7f13atJ',
            message: 'fldBZdiRQ4ThpYEgX',
            user: 'fldzCkpn3zNyG6Ehm',
            task: 'fldxIN69YVqXAWn0e',
        },
    },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Look and constants
// ─────────────────────────────────────────────────────────────────────────────

const ORANGE = '#f0883e';
const RED = '#f0625f';
const MUTED = '#6b7280';
const GREEN = '#3fb950';
const AMBER = '#d29922';

const LANE_TABS: ReadonlyArray<{ key: 'all' | Lane; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'on_fire', label: 'On Fire' },
    { key: 'this_week', label: 'This Week' },
    { key: 'waiting_on', label: 'Waiting On' },
    { key: 'queued', label: 'Queued' },
    { key: 'icebox', label: 'Icebox' },
];

const LANE_LABEL: Record<Lane, string> = {
    on_fire: 'On Fire',
    this_week: 'This Week',
    waiting_on: 'Waiting On',
    queued: 'Queued',
    icebox: 'Icebox',
};

// Done/Drop/Reschedule only write back to the real source when it's
// Airtable, where we already have write access. Attio/Linear/Google
// Calendar stay local-only — Loom is read-only there by design.
const WRITABLE_SOURCES = new Set(['Airtable']);

// ─────────────────────────────────────────────────────────────────────────────
// Reading Airtable cells
// ─────────────────────────────────────────────────────────────────────────────

type FieldMap = Record<string, any | null>;

/** Resolve fields by ID. A field that does not exist or is not visible to the page is null. */
function resolveFields(table: Table, ids: Record<string, string>): FieldMap {
    const out: FieldMap = {};
    for (const [key, id] of Object.entries(ids)) out[key] = (table as any).getFieldIfExists(id) ?? null;
    return out;
}

const cell = (record: any, field: any | null): unknown => (field ? record.getCellValue(field) : null);
const selectName = (v: unknown): string | null =>
    v && typeof v === 'object' && typeof (v as any).name === 'string' ? (v as any).name : null;
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const textList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (x as any)?.name).filter((x) => typeof x === 'string') : []);
const linkIds = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (x as any)?.id).filter((x) => typeof x === 'string') : []);

/** Fields as `{id, label}` for the required-field check, and the ids that resolved. */
const requiredOf = (ids: Record<string, string>) => Object.entries(ids).map(([label, id]) => ({ id, label }));
const availableOf = (ids: Record<string, string>, map: FieldMap) => Object.entries(ids).filter(([k]) => map[k]).map(([, id]) => id);

function readUrlFilters(): Record<string, string[]> | null {
    try {
        const q = new URLSearchParams(window.location.search);
        const raw: Record<string, string[]> = {};
        for (const key of ['domain', 'owner', 'source', 'lane']) {
            const values = q.getAll(key).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
            if (values.length) raw[key] = values;
        }
        return Object.keys(raw).length ? raw : null;
    } catch {
        return null;
    }
}

function nextWeekDate(): string {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    return next.toISOString().slice(0, 10);
}

function dueLabel(dueDate: string | null): { text: string; overdue: boolean } | null {
    if (!dueDate) return null;
    const due = new Date(dueDate).getTime();
    if (due < new Date().setHours(0, 0, 0, 0)) return { text: 'Overdue', overdue: true };
    return { text: `Due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, overdue: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ text, active, onClick, title }: { text: string; active?: boolean; onClick?: () => void; title?: string }) {
    const clickable = !!onClick;
    return (
        <button
            onClick={onClick}
            disabled={!clickable}
            title={title}
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

/** A small label that says where a value comes from (AI, manual, rule, edited). */
function Tag({ text, color, title }: { text: string; color?: string; title?: string }) {
    return (
        <span
            title={title}
            className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5"
            style={{ border: `1px solid ${color ?? '#374151'}`, color: color ?? '#9ca3af' }}
        >
            {text}
        </span>
    );
}

function FilterGroup({
    label,
    options,
    selected,
    onToggle,
}: {
    label: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    selected: string[];
    onToggle: (value: string) => void;
}) {
    return (
        <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                    <Pill key={o.value} text={o.label} active={selected.includes(o.value)} onClick={() => onToggle(o.value)} />
                ))}
            </div>
        </div>
    );
}

function Banner({ title, lines, color }: { title: string; lines: string[]; color: string }) {
    return (
        <div className="rounded-lg px-4 py-3 mb-4 bg-gray-900" style={{ border: `1px solid ${color}` }}>
            <p className="text-sm font-medium mb-1" style={{ color }}>
                {title}
            </p>
            <ul className="text-xs text-gray-400 list-disc pl-5">
                {lines.map((l) => (
                    <li key={l}>{l}</li>
                ))}
            </ul>
        </div>
    );
}

function TaskListRow({
    row,
    selected,
    onToggleSelect,
    onOpen,
}: {
    row: TriageRow;
    selected: boolean;
    onToggleSelect: () => void;
    onOpen: () => void;
}) {
    const due = dueLabel(row.dueDate);
    const stale = showStaleBadge(row);
    const syncedToSource = WRITABLE_SOURCES.has(row.source ?? '');
    return (
        <div className="bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 mb-2">
            <input type="checkbox" checked={selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} />
            <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
                <p className="text-sm text-white truncate">{row.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {row.actionStatus !== 'none' && (
                        <Pill text={syncedToSource ? row.actionStatus : `${row.actionStatus} · local only`} />
                    )}
                    {row.domain.value && <Pill text={row.domain.value} title={row.domain.from === 'override' ? 'Edited by you' : 'From the source'} />}
                    {row.owner.value && <Pill text={row.owner.value} title={row.owner.match === 'unmatched' ? 'Not in team_members' : undefined} />}
                    {row.source && <Pill text={row.source} />}
                    <Tag
                        text={row.lane.basis === 'manual' ? 'manual lane' : 'suggested'}
                        color={row.lane.basis === 'manual' ? ORANGE : undefined}
                        title={row.lane.basis === 'manual' ? 'You placed this task' : `Rule: ${row.lane.rule ?? 'none'}`}
                    />
                    {row.ai.category && <Tag text={`AI · ${row.ai.category}`} title="Category inferred by Loom (AI), not from the source" />}
                    {row.identity.status !== 'unique' && (
                        <Tag
                            text={row.identity.status === 'ambiguous' ? 'ambiguous match' : 'possible duplicate'}
                            color={AMBER}
                            title={`Shares ${row.identity.key ?? 'a key'} with other rows. Nothing is merged.`}
                        />
                    )}
                    {row.delegate.delegatedTo && <Tag text={`delegated · ${row.delegate.delegatedTo}`} color={GREEN} />}
                    {!row.delegate.delegatedTo && row.delegate.eligible && <Tag text="delegable" color={GREEN} title={row.delegate.reason ?? undefined} />}
                    {stale && (
                        <span className="text-xs font-medium" style={{ color: RED }} title={row.stale.reason ?? undefined}>
                            Stale · {row.stale.reason ?? 'no recent update'}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 text-right">
                {due && (
                    <p className="text-xs font-medium" style={{ color: due.overdue ? RED : MUTED }}>
                        {due.text}
                    </p>
                )}
            </div>
        </div>
    );
}

function DetailPanel({
    row,
    group,
    onClose,
    onAction,
    onMoveLane,
    onDelegate,
}: {
    row: TriageRow;
    group: TriageRow[];
    onClose: () => void;
    onAction: (action: 'done' | 'dropped' | 'rescheduled') => void;
    onMoveLane: (lane: Lane) => void;
    onDelegate: (name: string) => void;
}) {
    const [delegateName, setDelegateName] = useState('');
    const [showDelegate, setShowDelegate] = useState(false);
    const prov = provenance(row);
    const syncedToSource = WRITABLE_SOURCES.has(row.source ?? '');
    const due = dueLabel(row.dueDate);
    const others = group.filter((g) => g.recordId !== row.recordId);

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
            <p className="text-lg font-bold text-white mb-3">{row.title}</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
                {row.domain.value && <Pill text={row.domain.value} />}
                {row.owner.value && <Pill text={row.owner.value} />}
                {row.source && <Pill text={row.source} />}
            </div>

            <p className="text-xs text-gray-500 mb-1">
                {row.dueDate ? `Due ${new Date(row.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No due date'}
                {due?.overdue ? ' · overdue' : ''}
            </p>
            <p className="text-xs text-gray-500 mb-1">
                Lane: {LANE_LABEL[row.lane.value]} ({prov.lane === 'manual' ? 'you placed it' : `suggested${row.lane.rule ? ` · ${row.lane.rule}` : ''}`})
            </p>
            {row.stale.state !== 'unknown' && (
                <p className="text-xs mb-1" style={{ color: showStaleBadge(row) ? RED : MUTED }}>
                    {row.stale.state}
                    {row.stale.reason ? ` · ${row.stale.reason}` : ''}
                </p>
            )}
            {row.owner.from === 'source' && row.owner.raw && row.owner.raw !== row.owner.value && (
                <p className="text-xs text-gray-500 mb-1">Owner in the source: {row.owner.raw}</p>
            )}
            {row.owner.from === 'override' && <p className="text-xs text-gray-500 mb-1">Owner edited by you (source: {row.owner.raw ?? 'none'})</p>}
            {row.domain.from === 'override' && <p className="text-xs text-gray-500 mb-1">Domain edited by you</p>}
            {row.ai.category && (
                <p className="text-xs text-gray-500 mb-1">
                    <Tag text="AI" /> {row.ai.category}
                    {row.ai.tags.length ? ` · ${row.ai.tags.join(', ')}` : ''}
                </p>
            )}
            {row.statusRaw && <p className="text-xs text-gray-500 mb-1">Status in the source: {row.statusRaw}</p>}
            {row.sourceStatus && row.sourceStatus !== 'ok' && (
                <p className="text-xs mb-1" style={{ color: AMBER }}>
                    Source {row.sourceStatus}: this task may be out of date
                </p>
            )}
            {row.delegate.delegatedTo && <p className="text-xs text-gray-500 mb-1">Delegated to {row.delegate.delegatedTo}</p>}
            {row.actionStatus !== 'none' && (
                <p className="text-xs mb-1" style={{ color: syncedToSource ? GREEN : MUTED }}>
                    {row.actionStatus}
                    {!syncedToSource && ' · not synced to source'}
                </p>
            )}

            {others.length > 0 && (
                <div className="mt-3 mb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: AMBER }}>
                        {row.identity.status === 'ambiguous' ? 'Ambiguous match' : 'Possible duplicate'}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">Same key ({row.identity.key}). Nothing is merged or hidden.</p>
                    {others.map((o) => (
                        <p key={o.recordId} className="text-xs text-gray-400 truncate">
                            · {o.title} ({o.source ?? 'unknown'})
                        </p>
                    ))}
                </div>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-5 mb-2">Actions</p>
            <div className="flex gap-2 mb-3">
                <button onClick={() => onAction('done')} className="text-xs text-white rounded px-3 py-1.5" style={{ backgroundColor: GREEN }}>
                    Done
                </button>
                <button onClick={() => onAction('dropped')} className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-1.5">
                    Drop
                </button>
                <button onClick={() => onAction('rescheduled')} className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-1.5">
                    +7d
                </button>
            </div>

            <select
                value=""
                onChange={(e) => e.target.value && onMoveLane(e.target.value as Lane)}
                className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 mb-3"
            >
                <option value="">Move to…</option>
                {LANES.map((l) => (
                    <option key={l} value={l}>
                        {LANE_LABEL[l]}
                    </option>
                ))}
            </select>

            {row.sourceUrl && (
                <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-center mb-3"
                >
                    Open in {row.source ?? 'source'}
                </a>
            )}

            {/* Delegation: a suggested person, an eligible task with nobody suggested, or manual. */}
            {!row.delegate.delegatedTo && row.delegate.eligible && row.delegate.suggestedTo && (
                <div className="bg-gray-800 rounded p-3 mb-2">
                    <p className="text-xs text-gray-300 mb-2">Delegate to {row.delegate.suggestedTo}?</p>
                    <p className="text-[11px] text-gray-500 mb-2">{row.delegate.reason}</p>
                    <button onClick={() => onDelegate(row.delegate.suggestedTo as string)} className="text-xs text-white rounded px-3 py-1" style={{ backgroundColor: ORANGE }}>
                        Yes, delegate
                    </button>
                </div>
            )}
            {!row.delegate.delegatedTo && row.delegate.eligible && !row.delegate.suggestedTo && (
                <p className="text-xs text-gray-400 mb-2">Delegable ({row.delegate.reason}). Delegate to whom?</p>
            )}
            {!row.delegate.eligible && row.delegate.reason && <p className="text-[11px] text-gray-600 mb-2">{row.delegate.reason}</p>}

            {!showDelegate ? (
                <button onClick={() => setShowDelegate(true)} className="text-xs text-gray-400 underline">
                    Delegate to someone else?
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

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_KEYS = ['tasks', 'lanes', 'triages', 'runs', 'configs', 'events'] as const;

function getCustomProperties(base: any) {
    const find = (id: string) => base.tables.find((t: Table) => t.id === id);
    return [
        { key: 'tasks', label: 'Tasks', type: 'table' as const, defaultValue: find(IDS.tasks.table) },
        { key: 'lanes', label: 'Task lanes', type: 'table' as const, defaultValue: find(IDS.lanes.table) },
        { key: 'triages', label: 'Triages', type: 'table' as const, defaultValue: find(IDS.triages.table) },
        { key: 'runs', label: 'Loom sync runs', type: 'table' as const, defaultValue: find(IDS.runs.table) },
        { key: 'configs', label: 'Triage configs', type: 'table' as const, defaultValue: find(IDS.configs.table) },
        { key: 'events', label: 'Priority events', type: 'table' as const, defaultValue: find(IDS.events.table) },
    ];
}

function WorkQueueApp(): React.ReactElement {
    const { customPropertyValueByKey, errorState } = useCustomProperties(getCustomProperties);
    if (errorState) {
        return (
            <div className="min-h-screen bg-black text-white p-6">
                <p style={{ color: RED }}>Error loading custom properties.</p>
            </div>
        );
    }
    const tables = customPropertyValueByKey as Record<string, Table | undefined>;
    const missing = TABLE_KEYS.filter((k) => !tables[k]);
    if (missing.length) {
        return (
            <div className="min-h-screen bg-black text-white p-6">
                <p className="text-gray-400">Configure these tables in the properties panel: {missing.join(', ')}.</p>
            </div>
        );
    }
    return (
        <WorkQueue
            tasksTable={tables.tasks as Table}
            lanesTable={tables.lanes as Table}
            triagesTable={tables.triages as Table}
            runsTable={tables.runs as Table}
            configsTable={tables.configs as Table}
            eventsTable={tables.events as Table}
        />
    );
}

function WorkQueue(props: {
    tasksTable: Table;
    lanesTable: Table;
    triagesTable: Table;
    runsTable: Table;
    configsTable: Table;
    eventsTable: Table;
}): React.ReactElement {
    const { tasksTable, lanesTable, triagesTable, runsTable, configsTable, eventsTable } = props;
    const session = useSession();
    const currentUser = session.currentUser;

    const tasksRecords = useRecords(tasksTable);
    const lanesRecords = useRecords(lanesTable);
    const triagesRecords = useRecords(triagesTable);
    const runsRecords = useRecords(runsTable);
    const configsRecords = useRecords(configsTable);

    const [activePage, setActivePage] = useState<'queue' | 'delivery'>('queue');
    const [filters, setFilters] = useState<Filters>({});
    const [filterIssues, setFilterIssues] = useState<FilterIssue[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const restoredFilters = useRef(false);

    // Fields by ID ----------------------------------------------------------
    const F = useMemo(
        () => ({
            tasks: resolveFields(tasksTable, IDS.tasks.fields),
            lanes: resolveFields(lanesTable, IDS.lanes.fields),
            triages: resolveFields(triagesTable, IDS.triages.fields),
            runs: resolveFields(runsTable, IDS.runs.fields),
            configs: resolveFields(configsTable, IDS.configs.fields),
            events: resolveFields(eventsTable, IDS.events.fields),
        }),
        [tasksTable, lanesTable, triagesTable, runsTable, configsTable, eventsTable],
    );

    const missingFields = useMemo(
        () =>
            checkRequiredFields({
                tables: [
                    { label: 'command_center_tasks', required: requiredOf(IDS.tasks.fields), available: availableOf(IDS.tasks.fields, F.tasks) },
                    { label: 'task_lanes', required: requiredOf(IDS.lanes.fields), available: availableOf(IDS.lanes.fields, F.lanes) },
                    { label: 'command_center_triages', required: requiredOf(IDS.triages.fields), available: availableOf(IDS.triages.fields, F.triages) },
                ],
            }),
        [F],
    );

    // Records → contract input -----------------------------------------------
    const tasks = useMemo<TaskRecord[]>(
        () =>
            (tasksRecords ?? []).map((r: any) => ({
                recordId: r.id,
                taskId: text(cell(r, F.tasks.taskId)),
                title: text(cell(r, F.tasks.title)),
                source: selectName(cell(r, F.tasks.source)),
                sourceTable: text(cell(r, F.tasks.sourceTable)),
                sourceUrl: text(cell(r, F.tasks.sourceUrl)),
                statusRaw: text(cell(r, F.tasks.statusRaw)),
                dueDate: text(cell(r, F.tasks.dueDate)),
                lastUpdatedAt: text(cell(r, F.tasks.lastUpdatedAt)),
                lifecycle: selectName(cell(r, F.tasks.lifecycle)),
                sourceStatus: selectName(cell(r, F.tasks.sourceStatus)),
                domain: selectName(cell(r, F.tasks.domain)),
                owner: text(cell(r, F.tasks.owner)),
                category: selectName(cell(r, F.tasks.category)),
                tags: textList(cell(r, F.tasks.tags)),
                schedulable: cell(r, F.tasks.schedulable) === true,
            })),
        [tasksRecords, F],
    );

    const triages = useMemo<TriageRecord[]>(
        () =>
            (triagesRecords ?? []).map((r: any) => ({
                recordId: r.id,
                taskRecordId: linkIds(cell(r, F.triages.task))[0] ?? null,
                rowStatus: selectName(cell(r, F.triages.rowStatus)),
                ownerCanonical: text(cell(r, F.triages.ownerCanonical)),
                ownerMatch: selectName(cell(r, F.triages.ownerMatch)),
                staleState: selectName(cell(r, F.triages.staleState)),
                staleReason: text(cell(r, F.triages.staleReason)),
                delegateEligible: cell(r, F.triages.delegateEligible) === true,
                delegateReason: text(cell(r, F.triages.delegateReason)),
                delegateSuggestedTo: text(cell(r, F.triages.delegateSuggestedTo)),
                laneSuggested: selectName(cell(r, F.triages.laneSuggested)),
                laneRule: text(cell(r, F.triages.laneRule)),
                identityKey: text(cell(r, F.triages.identityKey)),
                identityStatus: selectName(cell(r, F.triages.identityStatus)),
            })),
        [triagesRecords, F],
    );

    // The current user's own task_lanes rows (record objects kept for writes).
    const myLaneRecords = useMemo(() => {
        if (!lanesRecords || !currentUser || !F.lanes.user) return [];
        return lanesRecords.filter((r: any) => (cell(r, F.lanes.user) as { id?: string } | null)?.id === currentUser.id);
    }, [lanesRecords, currentUser, F]);

    const lanes = useMemo<LaneRecord[]>(
        () =>
            myLaneRecords.map((r: any) => ({
                recordId: r.id,
                taskRecordId: linkIds(cell(r, F.lanes.task))[0] ?? null,
                lane: selectName(cell(r, F.lanes.lane)),
                rankPosition: typeof cell(r, F.lanes.rankPosition) === 'number' ? (cell(r, F.lanes.rankPosition) as number) : null,
                actionStatus: selectName(cell(r, F.lanes.actionStatus)),
                delegatedTo: text(cell(r, F.lanes.delegatedTo)),
                domainOverride: selectName(cell(r, F.lanes.domainOverride)),
                ownerOverride: text(cell(r, F.lanes.ownerOverride)),
            })),
        [myLaneRecords, F],
    );

    const laneRecordByTask = useMemo(() => {
        const map = new Map<string, any>();
        for (const r of myLaneRecords) {
            const id = linkIds(cell(r, F.lanes.task))[0];
            if (id) map.set(id, r);
        }
        return map;
    }, [myLaneRecords, F]);

    // loom_sync_runs / heartbeat: null when the page cannot read them (reported in the banner).
    const loomRuns = useMemo<LoomRun[] | null>(() => {
        if (!F.runs.status || !F.runs.startedAt) return null;
        return (runsRecords ?? []).map((r: any) => ({ status: selectName(cell(r, F.runs.status)), startedAt: text(cell(r, F.runs.startedAt)) }));
    }, [runsRecords, F]);

    const heartbeat = useMemo<Heartbeat | null>(() => {
        if (!F.configs.active || !F.configs.lastRunAt || !F.configs.lastRunStatus) return null;
        const active = (configsRecords ?? []).find((r: any) => cell(r, F.configs.active) === true);
        if (!active) return { lastRunAt: null, lastRunStatus: null };
        return { lastRunAt: text(cell(active, F.configs.lastRunAt)), lastRunStatus: selectName(cell(active, F.configs.lastRunStatus)) };
    }, [configsRecords, F]);

    // Contract -------------------------------------------------------------
    const rows = useMemo(() => buildTriageRows({ tasks, triages, lanes }), [tasks, triages, lanes]);
    const owners = useMemo(() => ownersPresent(rows), [rows]);
    const banner = useMemo(() => completeness({ tasks, triages, loomRuns, heartbeat, now: new Date() }), [tasks, triages, loomRuns, heartbeat]);

    const counts = useMemo(() => laneCounts(applyFilters(rows, { ...filters, lane: undefined })), [rows, filters]);
    const totalInTabs = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
    const visibleRows = useMemo(() => groupAdjacent(applyFilters(rows, filters).sort(compareRows)), [rows, filters]);
    const openRow = openTaskId ? rows.find((r) => r.recordId === openTaskId) ?? null : null;
    const openGroup = useMemo(
        () => (openRow && openRow.identity.key ? rows.filter((r) => r.identity.key === openRow.identity.key) : []),
        [rows, openRow],
    );
    const activeTab: 'all' | Lane = filters.lane && filters.lane.length === 1 ? filters.lane[0] : 'all';

    // Event log (priority_events) -------------------------------------------
    const logEvent = async (eventType: 'triage_action' | 'triage_filter_invalid', summary: string, message: string, taskRecordId?: string) => {
        const E = F.events;
        if (!E.summary || !E.eventType || !E.status || !E.source) return;
        if (!(eventsTable as any).hasPermissionToCreateRecords()) return;
        const fields: Record<string, unknown> = {
            [E.summary.id]: summary.slice(0, 250),
            [E.eventType.id]: { name: eventType },
            [E.status.id]: { name: 'ok' },
            [E.source.id]: { name: 'extension' },
        };
        if (E.message) fields[E.message.id] = message;
        if (E.user && currentUser) fields[E.user.id] = { id: currentUser.id };
        if (E.task && taskRecordId) fields[E.task.id] = [{ id: taskRecordId }];
        try {
            await (eventsTable as any).createRecordAsync(fields);
        } catch (e) {
            console.warn(`Could not log ${eventType}`, e);
        }
    };

    // Restore filters from the URL once, validate them, report what was dropped.
    useEffect(() => {
        if (restoredFilters.current || rows.length === 0) return;
        restoredFilters.current = true;
        const raw = readUrlFilters();
        if (!raw) return;
        const { valid, issues } = validateFilters(raw, owners);
        setFilters(valid);
        setFilterIssues(issues);
        if (issues.length) {
            logEvent('triage_filter_invalid', `filters · ${issues.length} invalid value${issues.length === 1 ? '' : 's'} ignored`, issues.map((i) => `${i.param}=${i.value}: ${i.reason}`).join('\n'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows.length]);

    // Writes (task_lanes only) ---------------------------------------------
    const upsertLaneRow = async (taskRecordId: string, fields: Record<string, unknown>) => {
        const L = F.lanes;
        if (!currentUser || !L.user || !L.task) return;
        const existing = laneRecordByTask.get(taskRecordId);
        if (existing) {
            if (!(lanesTable as any).hasPermissionToUpdateRecords()) throw new Error('No permission to update task_lanes');
            await (lanesTable as any).updateRecordAsync(existing.id, fields);
        } else {
            if (!(lanesTable as any).hasPermissionToCreateRecords()) throw new Error('No permission to create task_lanes rows');
            await (lanesTable as any).createRecordAsync({
                [L.user.id]: { id: currentUser.id },
                [L.task.id]: [{ id: taskRecordId }],
                ...fields,
            });
        }
    };

    const moveLane = async (row: TriageRow, lane: Lane) => {
        const L = F.lanes;
        if (!L.lane) return;
        const fields: Record<string, unknown> = { [L.lane.id]: { name: lane } };
        if (lane === 'on_fire' && L.rankPosition && L.rankedAt) {
            const onFire = lanes.filter((l) => l.lane === 'on_fire').length;
            fields[L.rankPosition.id] = onFire + 1;
            fields[L.rankedAt.id] = new Date().toISOString();
        }
        try {
            await upsertLaneRow(row.recordId, fields);
            logEvent('triage_action', `move · ${row.taskId} → ${lane}`, `Lane ${row.lane.value} (${row.lane.basis}) → ${lane}`, row.recordId);
        } catch (e) {
            alert(`Could not move the task: ${(e as Error).message}`);
        }
    };

    const applyAction = async (row: TriageRow, action: 'done' | 'dropped' | 'rescheduled') => {
        const L = F.lanes;
        if (!L.actionStatus || !L.synced) return;
        const fields: Record<string, unknown> = {
            [L.actionStatus.id]: { name: action },
            [L.synced.id]: WRITABLE_SOURCES.has(row.source ?? ''),
        };
        if (action === 'rescheduled' && L.rescheduledDate) fields[L.rescheduledDate.id] = nextWeekDate();
        try {
            await upsertLaneRow(row.recordId, fields);
        } catch (e) {
            alert(`Could not save the action: ${(e as Error).message}`);
        }
    };

    const delegate = async (row: TriageRow, name: string) => {
        const L = F.lanes;
        if (!L.delegatedTo) return;
        try {
            await upsertLaneRow(row.recordId, { [L.delegatedTo.id]: name });
            const suggested = row.delegate.suggestedTo;
            logEvent(
                'triage_action',
                `delegate · ${row.taskId} → ${name}`,
                suggested ? (suggested === name ? `Accepted the suggestion (${name})` : `Suggested ${suggested}, delegated to ${name}`) : `Delegated to ${name} (no suggestion)`,
                row.recordId,
            );
        } catch (e) {
            alert(`Could not delegate: ${(e as Error).message}`);
        }
    };

    const toggleSelect = (id: string) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    /** Same write for every selected task. Reports how many failed; the rest succeed. */
    const bulk = async (label: string, build: () => Record<string, unknown> | null) => {
        const fields = build();
        if (!fields) return;
        const ids = Array.from(selectedIds);
        const results = await Promise.allSettled(ids.map((id) => upsertLaneRow(id, fields)));
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) alert(`${failed} of ${ids.length} items failed to ${label} — the rest succeeded.`);
        logEvent('triage_action', `bulk ${label} · ${ids.length - failed} of ${ids.length}`, `${label}: ${ids.length - failed} written, ${failed} failed`);
        setSelectedIds(new Set());
    };

    const bulkRetag = (domain: string) => bulk('retag', () => (F.lanes.domainOverride ? { [F.lanes.domainOverride.id]: { name: domain } } : null));
    const bulkReassign = (owner: string) => bulk('reassign', () => (F.lanes.ownerOverride ? { [F.lanes.ownerOverride.id]: owner } : null));
    const bulkPush = () =>
        bulk('push', () => {
            const L = F.lanes;
            if (!L.actionStatus || !L.synced || !L.rescheduledDate) return null;
            return { [L.actionStatus.id]: { name: 'rescheduled' }, [L.synced.id]: false, [L.rescheduledDate.id]: nextWeekDate() };
        });

    // Filters UI ---------------------------------------------------------------
    const toggleFilter = (dimension: 'domain' | 'owner' | 'source', value: string) =>
        setFilters((prev) => {
            const current = prev[dimension] ?? [];
            const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
            return { ...prev, [dimension]: next };
        });

    const setTab = (key: 'all' | Lane) => setFilters((prev) => ({ ...prev, lane: key === 'all' ? undefined : [key] }));

    // Render -------------------------------------------------------------------
    if (missingFields.length) {
        return (
            <div className="min-h-screen bg-black text-white p-6">
                <Banner
                    title="Work · Queue cannot show a complete list: some fields are not available to this page."
                    lines={[...missingFields, 'Expose them in the page Data panel (see docs/stories/MapKMigGon38571/schema.md).']}
                    color={RED}
                />
            </div>
        );
    }

    const domainOptions = [...DOMAINS.map((d) => ({ value: d, label: d })), { value: NONE, label: 'No domain' }];
    const ownerOptions = [...owners.map((o) => ({ value: o, label: o })), { value: NONE, label: 'Unassigned' }];
    const sourceOptions = SOURCES.map((s) => ({ value: s, label: s }));

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
                        style={{ backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #1f2937' }}
                    >
                        Delivery
                    </button>
                </div>

                {activePage === 'delivery' ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
                        <p className="text-sm text-gray-400">
                            Coming soon — this is CC9 (Work · Delivery board with capacity meter), a separate story that hasn't been built
                            yet.
                        </p>
                    </div>
                ) : (
                    <>
                        <header className="mb-5">
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
                                Queue
                            </p>
                            <h1 className="text-3xl font-bold text-white mb-1">Everything, in one place</h1>
                            <p className="text-sm text-gray-500">Aggregated from Attio, Linear and Airtable. Triage here, work there.</p>
                        </header>

                        {banner.status === 'partial' && <Banner title="This list may be incomplete or out of date." lines={banner.reasons} color={AMBER} />}
                        {filterIssues.length > 0 && (
                            <Banner
                                title="Some filter values were ignored."
                                lines={filterIssues.map((i) => `${i.param} = ${i.value}: ${i.reason}`)}
                                color={AMBER}
                            />
                        )}

                        <div className="flex flex-wrap gap-2 mb-5">
                            {LANE_TABS.map((l) => (
                                <Pill
                                    key={l.key}
                                    text={`${l.label} ${l.key === 'all' ? totalInTabs : counts[l.key as Lane] ?? 0}`}
                                    active={activeTab === l.key}
                                    onClick={() => setTab(l.key)}
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
                                    {DOMAINS.map((d) => (
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
                                <button onClick={bulkPush} className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-2 py-1">
                                    Push to next week
                                </button>
                                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 underline ml-auto">
                                    Clear selection
                                </button>
                            </div>
                        )}

                        <div className="flex gap-6">
                            <div className="w-48 flex-shrink-0">
                                <FilterGroup label="Domain" options={domainOptions} selected={filters.domain ?? []} onToggle={(v) => toggleFilter('domain', v)} />
                                <FilterGroup label="Owner" options={ownerOptions} selected={filters.owner ?? []} onToggle={(v) => toggleFilter('owner', v)} />
                                <FilterGroup label="Source" options={sourceOptions} selected={filters.source ?? []} onToggle={(v) => toggleFilter('source', v)} />
                                {hasActiveFilters(filters) && (
                                    <button
                                        onClick={() => {
                                            setFilters({});
                                            setFilterIssues([]);
                                        }}
                                        className="text-xs text-gray-400 underline"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {rows.length === 0 && <p className="text-sm text-gray-600">No open tasks.</p>}
                                {rows.length > 0 && visibleRows.length === 0 && <p className="text-sm text-gray-600">Nothing matches these filters.</p>}
                                {visibleRows.map((r) => (
                                    <TaskListRow
                                        key={r.recordId}
                                        row={r}
                                        selected={selectedIds.has(r.recordId)}
                                        onToggleSelect={() => toggleSelect(r.recordId)}
                                        onOpen={() => setOpenTaskId(r.recordId)}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {activePage === 'queue' && openRow && (
                <DetailPanel
                    row={openRow}
                    group={openGroup}
                    onClose={() => setOpenTaskId(null)}
                    onAction={(action) => applyAction(openRow, action)}
                    onMoveLane={(lane) => moveLane(openRow, lane)}
                    onDelegate={(name) => delegate(openRow, name)}
                />
            )}
        </div>
    );
}

initializeBlock({ interface: () => <WorkQueueApp /> });
