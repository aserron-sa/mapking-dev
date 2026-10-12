/**
 * Needs-You one-time backfill — MapKMigGon38570
 *
 * Run ONCE, before enabling needs-you-waiting-since.js. Paste into an automation's
 * "Run a script" step (any trigger) and use "Test" to run it, or into the
 * Scripting extension (replace input.config() with a constant).
 * Input variable: dryRun = "yes" (only reports) or "no" (writes).
 *
 * For every task already in Needs-You (needs_you_signals not empty) with no
 * waiting_since:
 *   - manual signal with a mark time → waiting_since = needs_you_manual_at, basis manual
 *   - otherwise → waiting_since = last_updated_at, basis estimated
 *     (the best available source timestamp; never invented — tasks without
 *     last_updated_at are reported and left empty)
 */

const CFG = {
  tasksTable: 'tblX61yfIFroyhMTj',
  lanesTable: 'tblZhorxkVfKdsW3Z',
  tasks: {
    normalizedId: 'fldmSHhnTbC1Go3Dw',
    signals: 'fld7byISqz2gObpzl',
    waitingSince: 'fldyg45qTxIIhESfp',
    basis: 'fldi2U965ciOBxxws',
    lastUpdatedAt: 'fldG6wphuQyvtHSIy',
    lanesLink: 'flde8Nn7pNUnFcWkE',
  },
  lanes: {
    needsYouManual: 'fldo0KraIpsDzzgZj',
    needsYouManualAt: 'fldLG8JroDCqtIkyS',
  },
};

const { dryRun } = input.config();
const write = String(dryRun).toLowerCase() === 'no';
const T = CFG.tasks;
const L = CFG.lanes;

const lanes = await base.getTable(CFG.lanesTable).selectRecordsAsync({ fields: [L.needsYouManual, L.needsYouManualAt] });
const marks = new Map(
  lanes.records.filter((r) => r.getCellValue(L.needsYouManual)).map((r) => [r.id, r.getCellValue(L.needsYouManualAt)])
);

const tasksTable = base.getTable(CFG.tasksTable);
const tasks = await tasksTable.selectRecordsAsync({
  fields: [T.normalizedId, T.signals, T.waitingSince, T.lastUpdatedAt, T.lanesLink],
});

const updates = [];
const skipped = [];
for (const r of tasks.records) {
  const signals = (r.getCellValueAsString(T.signals) || '').trim();
  if (!signals || r.getCellValue(T.waitingSince)) continue;

  const isManual = signals.split(',').map((s) => s.trim()).includes('manual');
  const manualAt = isManual
    ? ((r.getCellValue(T.lanesLink) || []).map((l) => marks.get(l.id)).filter(Boolean).sort()[0] ?? null)
    : null;
  const lastUpdated = r.getCellValue(T.lastUpdatedAt);

  if (manualAt) {
    updates.push({ id: r.id, fields: { [T.waitingSince]: manualAt, [T.basis]: { name: 'manual' } } });
  } else if (lastUpdated) {
    updates.push({ id: r.id, fields: { [T.waitingSince]: lastUpdated, [T.basis]: { name: 'estimated' } } });
  } else {
    skipped.push(r.getCellValueAsString(T.normalizedId));
  }
}

if (write) {
  for (let i = 0; i < updates.length; i += 50) {
    await tasksTable.updateRecordsAsync(updates.slice(i, i + 50));
  }
}

output.set('mode', write ? 'write' : 'dry-run');
output.set('toBackfill', updates.length);
output.set('skippedNoTimestamp', skipped.join(', ') || 'none');
