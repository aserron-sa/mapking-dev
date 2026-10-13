/**
 * Smoke test for the BUILT automation (airtable/cct/dist/automations/cct-triage-compute.js) —
 * MapKMigGon38571 (spec §9, A1/A2/A4 offline).
 *
 * Runs the exact file that gets pasted into Airtable against an in-memory fake of the Airtable
 * scripting API (base / input / output), so a broken build or a wrong field id fails here
 * instead of in production.
 *
 * Run from the repo root (build first):
 *     node airtable/cct/tools/cct-build.ts
 *     node --test airtable/cct/tests/cct-triage-compute.smoke.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'automations', 'cct-triage-compute.js');

// ── Minimal fake of the Airtable scripting API ───────────────────────────────

type Cells = Record<string, unknown>;
interface FakeRecord { id: string; cells: Cells }

class FakeTable {
  records: FakeRecord[] = [];
  id: string;
  fields: { id: string }[];
  private prefix: string;
  private seq = 0;
  constructor(id: string, fields: string[], prefix: string) {
    this.id = id;
    this.fields = fields.map((id) => ({ id }));
    this.prefix = prefix;
  }
  // Same as the real automation API: no getFieldIfExists; getField throws when missing.
  getField(idOrName: string) {
    const f = this.fields.find((x) => x.id === idOrName);
    if (!f) throw new Error(`No field ${idOrName}`);
    return f;
  }
  async selectRecordsAsync(_opts?: unknown) {
    return { records: this.records.map((r) => ({ id: r.id, getCellValue: (f: string) => r.cells[f] ?? null })) };
  }
  private newId() {
    this.seq += 1;
    return `${this.prefix}${String(this.seq).padStart(14 - this.prefix.length + 3, '0')}`;
  }
  async createRecordAsync(fields: Cells) {
    const id = this.newId();
    this.records.push({ id, cells: { ...fields } });
    return id;
  }
  async createRecordsAsync(list: { fields: Cells }[]) {
    assert.ok(list.length <= 50, 'batch over 50');
    return Promise.all(list.map((r) => this.createRecordAsync(r.fields)));
  }
  async updateRecordAsync(id: string, fields: Cells) {
    const r = this.records.find((x) => x.id === id);
    assert.ok(r, `update of unknown record ${id}`);
    Object.assign(r!.cells, fields);
  }
  async updateRecordsAsync(list: { id: string; fields: Cells }[]) {
    assert.ok(list.length <= 50, 'batch over 50');
    for (const u of list) await this.updateRecordAsync(u.id, u.fields);
  }
}

const IDS = {
  configs: ['fld9TdaRYZ0RqDoYi', 'fldbeKikUZMGaeamo', 'fldYi5Zf1P1AQq6pg', 'fldiZDW8iY83QkEhm', 'fld9BwUH18MCo3Th0', 'fldiRwMC7U06E71Oo',
    'fldvkqfTjlbYp0izV', 'fld0smX0xKbmYJZaE', 'fldLfGTM3ytpZ3Ubt', 'fldf3J0NdBvqfirKq', 'fldSgrMAML9QoBSf2', 'fldjXNwk0KSQXo8i8',
    'fldQkNOnM1kIMoaR1', 'fldiWWUK6iQB7DGMD', 'fld6TMgPDRAmq5FP1'],
  members: ['fldeTXTbJVJnKmWzh', 'fldTG4itOjWus9IYo', 'fldMtIk99zcWwVPqT', 'fldP5jwpZCJ91EFLm', 'fldkOiONCO7r1l3mM', 'fldDQwk79VEfJwHAf', 'flduiUrc076re9UCr'],
  tasks: ['fldmSHhnTbC1Go3Dw', 'fldceaJIeHpA3Tdae', 'fldejhIOeD3YCFRRP', 'fldECSTk2LFWGIS6V', 'fldld41zIqgdNXeyn', 'fldG6wphuQyvtHSIy',
    'fldzqG2oVnK93COcW', 'fldYqQehpEy918bve', 'fldfxuYNvITcMIlFu', 'fld0pXalwYvckZmQE'],
  triages: ['fldiFf8TT66Cr9EHF', 'fldQD8DWx6I4wzpg6', 'fldKSj0WnXERwtYru', 'fldW59XTy9PPKHS5M', 'fldmlDSJYktdRQdeE', 'fldY5SrXInz4k7umK',
    'fldX2gyYPzFdk0Vnk', 'fldyj9poKbR6Wjw5q', 'fldzjFQYIvse8OPkg', 'fldxWbxEz73BmzTPc', 'fldqnNhGlHehSXVQa', 'fldw1TT44d9GR6ejY',
    'fld0CsVqOkhYnxr9h', 'fldu7Xjtn1T1r0mfT', 'fldns5wX8gp8UEOlZ'],
  dev: ['fldgPUKY9Gxe6qSKB'],
  approvals: ['flduW72ClwFTKto3d', 'fldQoKUH8Mlh8hcFE'],
  events: ['fldxNmEoRpB4SRouZ', 'fldu8UXkQBfrIHvZe', 'fldL2k5qUjcOasDxU', 'fldIj7BNfY7f13atJ', 'fldBZdiRQ4ThpYEgX'],
};

function makeBase(opts: { activeConfigs?: number; dropTaskField?: string } = {}) {
  const t = {
    configs: new FakeTable('tblGZaFBg7KLbcuf7', IDS.configs, 'recCfg'),
    members: new FakeTable('tblA658S9otgj9p3n', IDS.members, 'recMem'),
    tasks: new FakeTable('tblX61yfIFroyhMTj', IDS.tasks.filter((f) => f !== opts.dropTaskField), 'recTsk'),
    triages: new FakeTable('tblaG64QpuRInrm5X', IDS.triages, 'recTri'),
    dev: new FakeTable('tblSWc1WrL5qjzTzs', IDS.dev, 'recDev'),
    approvals: new FakeTable('tblRilIMAIEiUSFof', IDS.approvals, 'recApp'),
    events: new FakeTable('tbl0k4YFnduwhMJG2', IDS.events, 'recEvt'),
  };
  const n = opts.activeConfigs ?? 1;
  for (let i = 0; i < Math.max(n, 1); i++) {
    t.configs.records.push({
      id: `recCfg${i}`,
      cells: {
        fld9TdaRYZ0RqDoYi: i < n ? true : null,
        fldbeKikUZMGaeamo: 'America/Chicago',
        fldYi5Zf1P1AQq6pg: 7, fldiZDW8iY83QkEhm: 2, fld9BwUH18MCo3Th0: [{ name: 'Google Calendar' }],
        fldiRwMC7U06E71Oo: 7, fldvkqfTjlbYp0izV: 30, fld0smX0xKbmYJZaE: [{ name: 'waiting-on-external' }],
        fldLfGTM3ytpZ3Ubt: [{ name: 'needs-max' }], fldf3J0NdBvqfirKq: true, fldSgrMAML9QoBSf2: true, fldjXNwk0KSQXo8i8: 10,
      },
    });
  }
  t.members.records.push({ id: 'recMemKyle', cells: { fldeTXTbJVJnKmWzh: 'Kyle', fldMtIk99zcWwVPqT: 'kyle@mapking.ai', fldkOiONCO7r1l3mM: true,
    fldDQwk79VEfJwHAf: [{ name: 'Sales' }], flduiUrc076re9UCr: true } });
  const task = (id: string, key: string, over: Cells = {}) => ({
    id,
    cells: { fldmSHhnTbC1Go3Dw: key, fldceaJIeHpA3Tdae: { name: 'Linear' }, fldejhIOeD3YCFRRP: { name: 'Sales' },
      fldG6wphuQyvtHSIy: new Date(Date.now() - 86_400_000).toISOString(), fldzqG2oVnK93COcW: { name: 'open' },
      fldfxuYNvITcMIlFu: true, ...over },
  });
  t.tasks.records.push(
    task('recTskA', 'linear:MAPKING-478'),
    task('recTskB', 'airtable:dev_tickets:recDevX', { fldceaJIeHpA3Tdae: { name: 'Airtable' } }),
    task('recTskC', 'attio:closed-one', { fldceaJIeHpA3Tdae: { name: 'Attio' }, fldzqG2oVnK93COcW: { name: 'closed' } }),
  );
  t.dev.records.push({ id: 'recDevX', cells: { fldgPUKY9Gxe6qSKB: 'MAPKING-478' } });
  const base = { getTable: (id: string) => Object.values(t).find((x) => x.id === id) ?? assert.fail(`unknown table ${id}`) };
  return { base, t };
}

async function run(base: unknown, dryRun: 'yes' | 'no') {
  const code = readFileSync(DIST, 'utf8');
  const out: Record<string, unknown> = {};
  const output = { set: (k: string, v: unknown) => { out[k] = v; } };
  const input = { config: () => ({ dryRun }) };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction('base', 'input', 'output', 'console', code)(base, input, output, { ...console, log() {}, warn() {} });
  return out;
}

test('A1 dry run: plans but writes no triage rows; logs the run', async () => {
  const { base, t } = makeBase();
  const out = await run(base, 'yes');
  assert.equal(out.result, 'dry_run');
  assert.equal(out.plannedCreates, 3);
  assert.equal(t.triages.records.length, 0);
  assert.ok(t.events.records.some((e) => (e.cells.fldxNmEoRpB4SRouZ as string).startsWith('[dry run] triage · run')));
  assert.equal(t.configs.records[0].cells.fldQkNOnM1kIMoaR1, undefined); // no heartbeat on dry run
});

test('A2 live twice: creates one row per task, second run writes nothing', async () => {
  const { base, t } = makeBase();
  const first = await run(base, 'no');
  assert.deepEqual([first.result, first.created, first.updated], ['ok', 3, 0]);
  assert.equal(t.triages.records.length, 3);

  const byKey = Object.fromEntries(t.triages.records.map((r) => [r.cells.fldiFf8TT66Cr9EHF, r.cells]));
  assert.deepEqual(byKey['linear:MAPKING-478'].fldQD8DWx6I4wzpg6, [{ id: 'recTskA' }]);
  assert.deepEqual(byKey['linear:MAPKING-478'].fldu7Xjtn1T1r0mfT, { name: 'duplicate_candidate' });
  assert.equal(byKey['linear:MAPKING-478'].fld0CsVqOkhYnxr9h, 'linear:MAPKING-478');
  assert.deepEqual(byKey['attio:closed-one'].fldKSj0WnXERwtYru, { name: 'closed' });
  assert.equal(byKey['linear:MAPKING-478'].fldyj9poKbR6Wjw5q, true); // empty owner counts as CEO
  assert.equal(byKey['linear:MAPKING-478'].fldxWbxEz73BmzTPc, 'Kyle'); // Sales → Kyle
  assert.ok(t.configs.records[0].cells.fldQkNOnM1kIMoaR1, 'heartbeat stamped');

  // Fake the inverse link Airtable would maintain, then run again.
  for (const r of t.triages.records) {
    const taskId = (r.cells.fldQD8DWx6I4wzpg6 as { id: string }[])[0]?.id;
    const task = t.tasks.records.find((x) => x.id === taskId);
    if (task) task.cells.fld0pXalwYvckZmQE = [{ id: r.id }];
  }
  const second = await run(base, 'no');
  assert.deepEqual([second.created, second.updated, second.plannedCreates, second.plannedUpdates], [0, 0, 0, 0]);
});

test('A4 config: no active row → stops, logs validation_failed, writes nothing', async () => {
  const { base, t } = makeBase({ activeConfigs: 0 });
  const out = await run(base, 'no');
  assert.equal(out.result, 'validation_failed');
  assert.equal(t.triages.records.length, 0);
  assert.ok(t.events.records.some((e) => (e.cells.fldu8UXkQBfrIHvZe as { name: string }).name === 'triage_data_issue'));
});

test('required field missing → stops and names the field', async () => {
  const { base, t } = makeBase({ dropTaskField: 'fldzqG2oVnK93COcW' });
  const out = await run(base, 'no');
  assert.equal(out.result, 'validation_failed');
  assert.match(String(out.message), /fldzqG2oVnK93COcW/);
  assert.equal(t.triages.records.length, 0);
});
