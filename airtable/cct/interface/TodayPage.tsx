import React, { useState, useMemo, useRef } from 'react';
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

function getCustomProperties(base: any) {
  const tasksTable = base.tables.find((t: Table) => t.id === 'tblX61yfIFroyhMTj');
  const fireRanksTable = base.tables.find((t: Table) => t.id === 'tblZhorxkVfKdsW3Z');
  return [
    { key: 'tasksTable', label: 'Tasks', type: 'table' as const, defaultValue: tasksTable },
    { key: 'fireRanksTable', label: 'Fire ranks', type: 'table' as const, defaultValue: fireRanksTable },
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

function formatDueDate(dateString: string | null): string | null {
  if (!dateString) return null;
  const due = new Date(dateString);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(due).getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag pill — used for domain_tag / source badges on fire cards and Needs You
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ text }: { text: string }) {
  return (
    <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5">
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fire card
// ─────────────────────────────────────────────────────────────────────────────

function FireCard({
  position,
  title,
  owner,
  domainTag,
  sourceName,
  sourceUrl,
  daysInState,
  dueDate,
  started,
  onStart,
  onDemote,
}: {
  position: number;
  title: string;
  owner: string | null;
  domainTag: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  daysInState: number;
  dueDate: string | null;
  started: boolean;
  onStart: () => void;
  onDemote: () => void;
}) {
  const dueLabel = formatDueDate(dueDate);
  return (
    <div className="bg-gray-800 rounded-lg p-4 border-l-4" style={{ borderColor: ORANGE }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: ORANGE }}
        >
          {position}
        </span>
        <h3 className="text-lg font-bold text-white flex-1">{title}</h3>
      </div>
      <div className="flex gap-2 mb-3 ml-8">
        {domainTag && <Pill text={domainTag} />}
        {sourceName && <Pill text={sourceName} />}
      </div>
      <div className="text-xs text-gray-500 mb-3 ml-8">
        {owner ?? 'Unassigned'}
        {dueLabel && (
          <>
            {' · '}
            <span style={{ color: dueLabel === 'Overdue' ? RED : undefined }}>{dueLabel}</span>
          </>
        )}
        {' · '}
        {daysInState}d in state
        {daysInState > 3 && <span style={{ color: RED }}> · overdue</span>}
      </div>
      <div className="flex gap-3 ml-8">
        <button
          onClick={onStart}
          className="text-sm text-white px-4 py-2 rounded-md font-medium"
          style={{ backgroundColor: started ? '#3a3a3a' : ORANGE }}
        >
          {started ? 'Focus block running' : 'Start'}
        </button>
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
        <button onClick={onDemote} className="text-sm text-gray-500 hover:text-gray-300 self-center">
          Demote
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demote modal — copy matches the real prototype's tone
// ─────────────────────────────────────────────────────────────────────────────

function DemoteModal({
  pendingTaskTitle,
  candidates,
  onDemote,
  onCancel,
}: {
  pendingTaskTitle: string;
  candidates: { id: string; title: string; domainTag: string | null; daysInState: number; position: number }[];
  onDemote: (rankRecordId: string) => void;
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
          You want to add <span className="text-white font-medium">{pendingTaskTitle}</span>. Pick the
          fire it replaces — it drops back to This Week, it doesn't disappear.
        </p>
        <div className="space-y-2 mb-5">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between bg-gray-800 rounded-md px-4 py-3"
            >
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{c.position}</p>
                <p className="text-sm text-white">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {[c.domainTag, `${c.daysInState}d in state`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => onDemote(c.id)}
                className="text-sm font-medium"
                style={{ color: ORANGE }}
              >
                Demote
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-md px-4 py-2"
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

// ─────────────────────────────────────────────────────────────────────────────
// Needs You row
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Power Hour — seeded with real open tasks (not already fires). "Done" state
// is session-local, per the story's own resolved default for write-back.
// Item CONTENT is real; item COMPLETION is not persisted yet.
// ─────────────────────────────────────────────────────────────────────────────

function PowerHour({
  seedTasks,
}: {
  seedTasks: { id: string; title: string; sourceName: string | null }[];
}) {
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
        Seeded from your open tasks. Checkmarks are local to this session — persisting completion is a
        pending decision, not built yet.
      </p>
      <div className="space-y-2 mb-4">
        {seedTasks.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm text-gray-200" title={t.title}>
            <input type="checkbox" checked={doneIds.has(t.id)} onChange={() => toggleSeed(t.id)} />
            <span
              className={
                doneIds.has(t.id)
                  ? 'line-through text-gray-500 flex-1 truncate'
                  : 'flex-1 truncate'
              }
            >
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
        <button
          onClick={addCustom}
          className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5"
        >
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
  const fireRanksTable = customPropertyValueByKey.fireRanksTable as Table | undefined;

  const tasksRecords = useRecords(tasksTable ?? null);
  const fireRanksRecords = useRecords(fireRanksTable ?? null);

  const [addFiresExpanded, setAddFiresExpanded] = useState(false);
  const addFiresRef = useRef<HTMLDetailsElement>(null);
  const [demoteModalOpen, setDemoteModalOpen] = useState(false);
  const [pendingTaskToAdd, setPendingTaskToAdd] = useState<{ id: string; title: string } | null>(null);
  const [startedIds, setStartedIds] = useState<Set<string>>(new Set());

  const titleField = tasksTable?.getFieldIfExists('title');
  const ownerField = tasksTable?.getFieldIfExists('owner');
  const domainTagField = tasksTable?.getFieldIfExists('domain_tag');
  const sourceField = tasksTable?.getFieldIfExists('source');
  const sourceUrlField = tasksTable?.getFieldIfExists('source_url');
  const sourceStatusField = tasksTable?.getFieldIfExists('source_status');
  const lastUpdatedField = tasksTable?.getFieldIfExists('last_updated_at');

  const userField = fireRanksTable?.getFieldIfExists('user');
  const taskLinkField = fireRanksTable?.getFieldIfExists('task');
  const laneField = fireRanksTable?.getFieldIfExists('lane');
  const rankPositionField = fireRanksTable?.getFieldIfExists('rank_position');
  const rankedAtField = fireRanksTable?.getFieldIfExists('ranked_at');

  const dueDateField = tasksTable?.getFieldIfExists('due_date');

  const getTaskDetails = (task: any) => ({
    title: titleField ? (task.getCellValue(titleField) as string) ?? 'Untitled' : 'Untitled',
    owner: ownerField ? (task.getCellValue(ownerField) as string | null) : null,
    domainTag: domainTagField ? selectName(task.getCellValue(domainTagField)) : null,
    sourceName: sourceField ? selectName(task.getCellValue(sourceField)) : null,
    sourceUrl: sourceUrlField ? (task.getCellValue(sourceUrlField) as string | null) : null,
    daysInState: lastUpdatedField ? daysSince(task.getCellValue(lastUpdatedField) as string | null) : 0,
    dueDate: dueDateField ? (task.getCellValue(dueDateField) as string | null) : null,
  });

  const userFireRanks = useMemo(() => {
    if (!fireRanksRecords || !currentUser || !userField || !laneField) return [];
    return fireRanksRecords.filter((r) => {
      const user = r.getCellValue(userField) as { id: string } | null;
      const lane = selectName(r.getCellValue(laneField));
      return user?.id === currentUser.id && lane === 'on_fire';
    });
  }, [fireRanksRecords, currentUser, userField, laneField]);

  const sortedFireRanks = useMemo(() => {
    if (!rankPositionField) return userFireRanks;
    return [...userFireRanks].sort((a, b) => {
      const posA = (a.getCellValue(rankPositionField) as number) ?? 999;
      const posB = (b.getCellValue(rankPositionField) as number) ?? 999;
      return posA - posB;
    });
  }, [userFireRanks, rankPositionField]);

  const taskedIdsInFireRanks = useMemo(() => {
    const ids = new Set<string>();
    if (!fireRanksRecords || !taskLinkField || !userField || !currentUser) return ids;
    fireRanksRecords.forEach((r) => {
      const user = r.getCellValue(userField) as { id: string } | null;
      if (user?.id === currentUser.id) {
        const links = r.getCellValue(taskLinkField) as { id: string }[] | null;
        links?.forEach((l) => ids.add(l.id));
      }
    });
    return ids;
  }, [fireRanksRecords, taskLinkField, userField, currentUser]);

  const okTasks = useMemo(() => {
    if (!tasksRecords || !sourceStatusField) return [];
    return tasksRecords.filter((r) => selectName(r.getCellValue(sourceStatusField)) === 'ok');
  }, [tasksRecords, sourceStatusField]);

  const availableTasksForFire = useMemo(
    () => okTasks.filter((r) => !taskedIdsInFireRanks.has(r.id)),
    [okTasks, taskedIdsInFireRanks]
  );

  const needsYouTasks = useMemo(() => {
    if (!lastUpdatedField) return [];
    return [...okTasks]
      .sort((a, b) => {
        const da = a.getCellValue(lastUpdatedField) as string | null;
        const db = b.getCellValue(lastUpdatedField) as string | null;
        if (!da || !db) return 0;
        return new Date(da).getTime() - new Date(db).getTime();
      })
      .slice(0, 10);
  }, [okTasks, lastUpdatedField]);

  // Prefer short, concrete action items for Power Hour — long Attio task
  // descriptions read badly as a checklist. Fall back to whatever's available
  // if there aren't 5 short ones.
  const powerHourSeed = useMemo(() => {
    const withDetails = availableTasksForFire.map((t) => ({ t, d: getTaskDetails(t) }));
    const short = withDetails.filter(({ d }) => d.title.length <= 60);
    const chosen = (short.length >= 5 ? short : withDetails).slice(0, 5);
    return chosen.map(({ t, d }) => ({ id: t.id, title: d.title, sourceName: d.sourceName }));
  }, [availableTasksForFire]);

  const getTaskForFireRank = (fireRankRecord: any) => {
    if (!taskLinkField || !tasksRecords) return null;
    const links = fireRankRecord.getCellValue(taskLinkField) as { id: string }[] | null;
    if (!links || links.length === 0) return null;
    return tasksRecords.find((t) => t.id === links[0]?.id) ?? null;
  };

  const handleDemote = async (fireRankRecordId: string) => {
    if (!fireRanksTable || !laneField) return;
    if (!fireRanksTable.hasPermissionToUpdateRecords()) return;
    await fireRanksTable.updateRecordAsync(fireRankRecordId, { [laneField.id]: { name: 'this_week' } });
  };

  const handleAddFire = (taskId: string, taskTitle: string) => {
    if (sortedFireRanks.length >= 3) {
      setPendingTaskToAdd({ id: taskId, title: taskTitle });
      setDemoteModalOpen(true);
      return;
    }
    createFire(taskId, sortedFireRanks.length + 1);
  };

  const createFire = async (taskId: string, position: number) => {
    if (!fireRanksTable || !currentUser || !userField || !laneField || !taskLinkField || !rankPositionField || !rankedAtField)
      return;
    if (!fireRanksTable.hasPermissionToCreateRecords()) return;
    await fireRanksTable.createRecordAsync({
      [userField.id]: { id: currentUser.id },
      [laneField.id]: { name: 'on_fire' },
      [taskLinkField.id]: [{ id: taskId }],
      [rankPositionField.id]: position,
      [rankedAtField.id]: new Date().toISOString(),
    });
    setAddFiresExpanded(false);
  };

  const handleDemoteAndAdd = async (fireRankIdToDemote: string) => {
    if (!pendingTaskToAdd) return;
    await handleDemote(fireRankIdToDemote);
    await createFire(pendingTaskToAdd.id, 3);
    setDemoteModalOpen(false);
    setPendingTaskToAdd(null);
  };

  const toggleStarted = (taskId: string) => {
    setStartedIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  if (errorState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <p style={{ color: RED }}>Error loading custom properties.</p>
      </div>
    );
  }
  if (!tasksTable || !fireRanksTable) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <p className="text-gray-400">Configure the Tasks and Fire Ranks tables in the properties panel.</p>
      </div>
    );
  }

  const staleCount = needsYouTasks.filter((t) => getTaskDetails(t).daysInState > 7).length;

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
              {sortedFireRanks.length} fire{sortedFireRanks.length !== 1 ? 's' : ''} ·{' '}
              {needsYouTasks.length} waiting on others · {staleCount} stale
            </p>
          </div>
          <button
            onClick={() => {
              if (addFiresRef.current) {
                addFiresRef.current.open = true;
                addFiresRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              setAddFiresExpanded(true);
            }}
            className="text-sm text-white px-4 py-2 rounded-md font-medium flex-shrink-0"
            style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}
          >
            Add a fire
          </button>
        </header>

        <section className="mb-8">
          <div className="flex items-baseline gap-3 mb-4">
            <p className="text-sm font-bold" style={{ color: ORANGE }}>
              ON FIRE
            </p>
            <p className="text-xs text-gray-500">Hard cap of three. A fourth costs you one.</p>
          </div>

          {sortedFireRanks.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center mb-3">
              <p className="text-gray-400 text-sm">No fires ranked yet. Pick one below to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              {sortedFireRanks.map((rank, i) => {
                const task = getTaskForFireRank(rank);
                if (!task) return null;
                const d = getTaskDetails(task);
                return (
                  <FireCard
                    key={rank.id}
                    position={i + 1}
                    title={d.title}
                    owner={d.owner}
                    domainTag={d.domainTag}
                    sourceName={d.sourceName}
                    sourceUrl={d.sourceUrl}
                    daysInState={d.daysInState}
                    dueDate={d.dueDate}
                    started={startedIds.has(task.id)}
                    onStart={() => toggleStarted(task.id)}
                    onDemote={() => handleDemote(rank.id)}
                  />
                );
              })}
            </div>
          )}

          <details
            ref={addFiresRef}
            className="text-sm"
            onToggle={(e) => setAddFiresExpanded((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-gray-400">
              Add a fire from open tasks ({availableTasksForFire.length})
            </summary>
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
                      className="block w-full text-left text-xs text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded px-3 py-2"
                    >
                      {d.title}
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
                      days={d.daysInState}
                      sourceUrl={d.sourceUrl}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {demoteModalOpen && pendingTaskToAdd && (
        <DemoteModal
          pendingTaskTitle={pendingTaskToAdd.title}
          candidates={sortedFireRanks.map((rank, i) => {
            const task = getTaskForFireRank(rank);
            const d = task ? getTaskDetails(task) : { title: 'Untitled', domainTag: null, daysInState: 0 };
            return { id: rank.id, title: d.title, domainTag: d.domainTag, daysInState: d.daysInState, position: i + 1 };
          })}
          onDemote={handleDemoteAndAdd}
          onCancel={() => {
            setDemoteModalOpen(false);
            setPendingTaskToAdd(null);
          }}
        />
      )}
    </div>
  );
}

initializeBlock({ interface: () => <TodayApp /> });
