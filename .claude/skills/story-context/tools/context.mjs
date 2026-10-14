#!/usr/bin/env node
// context.mjs - build, validate, search and slice the rich context of the story-split-derive skill.
// Node 22+, no dependencies. The context lives in ../context (override with --dir).
//
//   node context.mjs init                 create the folder skeleton and _meta.json
//   node context.mjs index                rebuild index.json and INDEX.md (generated, never hand-edit)
//   node context.mjs check                validate nodes, links, contracts, dependencies, generated files, schema version
//   node context.mjs find <words> [--type t] [--tag x] [--status s]
//   node context.mjs slice <id> [--full]  node + one-hop neighbors (a context pack for one story or artifact)
//   node context.mjs deps <story id>      what must be ready before this story can start
//   node context.mjs merge <lite-dir>     adopt the nodes of a lite context (new ids are copied; differing ids are reported, never overwritten)
//   node context.mjs seal                 record the sha256 of SKILL.md in _meta.json (after you reviewed a skill change)
//
// Facts live once. Edges are stored in one direction only (see SKILL.md, "Context structure");
// reverse edges are derived into index.json.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_MD = join(HERE, '..', 'SKILL.md');
const GATES = ['defined', 'in_progress', 'ready_for_qa', 'qa_passed', 'done'];
const START_GATE = 'ready_for_qa'; // a consumed artifact's producer must be at least here before the consumer starts
const TYPE_DIR = {
  table: 'data/tables', agent: 'data/agents', automation: 'data/automations', interface: 'data/interfaces',
  source: 'data/sources', story: 'stories', epic: 'epics', decision: 'decisions', note: 'notes',
};
const ROOT_TYPES = { project: 'project.md', glossary: 'glossary.md' };
const COMMON = ['id', 'type', 'title', 'summary', 'status', 'updated', 'confidence'];
const REQUIRED = {
  project: ['id', 'type', 'title', 'summary', 'updated'],
  glossary: ['id', 'type', 'title', 'summary', 'updated'],
  table: [...COMMON, 'fields', 'writer'],
  agent: [...COMMON, 'goal', 'triggers'],
  automation: [...COMMON, 'trigger'],
  interface: [...COMMON],
  source: [...COMMON],
  story: [...COMMON, 'key', 'ss_status', 'concern', 'epic'],
  epic: [...COMMON, 'key_project'],
  decision: ['id', 'type', 'title', 'summary', 'updated', 'decided_by'],
  note: ['id', 'type', 'title', 'summary', 'updated', 'confidence', 'provenance'],
};
const NON_NODES = new Set(['INDEX.md', 'CHANGELOG.md']);
const STATUS = new Set(['existing', 'planned', 'deprecated', 'open', 'decided']);
const CONFIDENCE = new Set(['verified', 'inferred', 'assumed']);
const DEFAULT_STATUS_MAP = {
  'Suggested by Resource': 'defined', 'Nueva': 'defined', 'New': 'defined', 'Backlog': 'defined',
  'In Progress': 'in_progress', 'Stuck': 'in_progress',
  'Ready for QA': 'ready_for_qa', 'In QA': 'ready_for_qa', 'QA': 'ready_for_qa',
  'QA Passed': 'qa_passed', 'Approved': 'qa_passed',
  'Done': 'done', 'Closed': 'done', 'Released': 'done',
};

// ---------- small helpers ----------
const sha = (s) => createHash('sha256').update(s).digest('hex');
const nl = (s) => s.replace(/\r\n/g, '\n');
const unq = (s) => s.replace(/^(["'])(.*)\1$/, '$2');
const die = (m) => { console.error(`context: ${m}`); process.exit(2); };
const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]);

function splitList(v) {
  const inner = v.slice(1, v.lastIndexOf(']'));
  return inner.split(',').map((x) => unq(x.trim())).filter(Boolean);
}

function parseFrontmatter(text) {
  const m = nl(text).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const data = {};
  let key = null;
  for (const raw of m[1].split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item && key) { if (!Array.isArray(data[key])) data[key] = []; data[key].push(unq(item[1].trim())); continue; }
    const kv = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) throw new Error(`cannot parse frontmatter line: ${raw}`);
    key = kv[1];
    const v = kv[2].trim();
    data[key] = v === '' ? [] : v.startsWith('[') ? splitList(v) : unq(v);
  }
  return { data, body: m[2] };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

function parseRef(s) {
  const m = String(s).match(/^([a-z]+:[\w-]+)(?:\.([\w-]+):([\w-]+))?$/);
  return m ? { ref: m[1], field: m[2] ?? null, ftype: m[3] ?? null } : null;
}

function contextDir(argv) {
  const i = argv.indexOf('--dir');
  return resolve(i >= 0 ? argv[i + 1] : join(HERE, '..', 'context'));
}

// ---------- load ----------
function load(dir) {
  const nodes = new Map();
  const problems = [];
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split(sep).join('/');
    if (NON_NODES.has(basename(file)) && !rel.includes('/')) continue;
    let fm;
    try { fm = parseFrontmatter(readFileSync(file, 'utf8')); } catch (e) { problems.push({ level: 'error', path: rel, msg: e.message }); continue; }
    if (!fm) { problems.push({ level: 'error', path: rel, msg: 'no frontmatter (every .md under context/ is a node, except INDEX.md and CHANGELOG.md)' }); continue; }
    const raw = nl(readFileSync(file, 'utf8'));
    const d = fm.data;
    const node = { ...d, path: rel, body: fm.body, hash: sha(raw).slice(0, 12), lines: raw.split('\n').length };
    if (nodes.has(d.id)) { problems.push({ level: 'error', path: rel, msg: `duplicate id ${d.id} (also ${nodes.get(d.id).path})` }); continue; }
    nodes.set(d.id ?? `?${rel}`, node);
  }
  return { nodes, problems };
}

function derive(nodes) {
  // reverse edges, computed only; never stored in node files
  const refsOut = new Map(), refsIn = new Map();
  const add = (from, to, kind) => {
    if (!nodes.has(to)) return;
    (refsOut.get(from) ?? refsOut.set(from, []).get(from)).push({ to, kind });
    (refsIn.get(to) ?? refsIn.set(to, []).get(to)).push({ from, kind });
  };
  for (const n of nodes.values()) {
    for (const x of arr(n.depends_on)) add(n.id, x.split('@')[0], 'depends_on');
    for (const x of arr(n.consumes)) { const p = parseRef(x); if (p) add(n.id, p.ref, 'consumes'); }
    for (const k of ['produced_by', 'epic', 'writer', 'parent', 'derived_from']) for (const x of arr(n[k])) add(n.id, x, k);
    for (const x of arr(n.populated_by)) add(n.id, x, 'populated_by');
  }
  return { refsOut, refsIn };
}

// ---------- validation ----------
function validate(dir) {
  const { nodes, problems } = load(dir);
  const err = (n, msg) => problems.push({ level: 'error', path: n.path, msg });
  const warn = (n, msg) => problems.push({ level: 'warn', path: n.path, msg });
  const meta = readMeta(dir);
  const lite = meta.mode === 'lite';

  for (const n of nodes.values()) {
    const req = REQUIRED[n.type];
    if (!req) { err(n, `unknown type "${n.type}"`); continue; }
    for (const k of req) if (n[k] === undefined || (Array.isArray(n[k]) && n[k].length === 0) || n[k] === '') err(n, `missing required key: ${k}`);
    if (n.summary && n.summary.length > 160) warn(n, `summary is ${n.summary.length} chars (max 160, it is shown in search results)`);
    if (n.status && !STATUS.has(n.status)) err(n, `status "${n.status}" not in ${[...STATUS].join(', ')}`);
    if (n.confidence && !CONFIDENCE.has(n.confidence)) err(n, `confidence "${n.confidence}" not in ${[...CONFIDENCE].join(', ')}`);
    if (n.lines > 300) warn(n, `${n.lines} lines; split it so a slice stays small (max about 300)`);
    if (!lite && n.updated && Date.now() - Date.parse(n.updated) > 45 * 86400e3 && n.status !== 'deprecated') warn(n, `not updated since ${n.updated}; re-verify or touch`);
    // id and path agree
    if (ROOT_TYPES[n.type]) { if (n.path !== ROOT_TYPES[n.type] || n.id !== n.type) err(n, `${n.type} must be ${ROOT_TYPES[n.type]} with id "${n.type}"`); }
    else if (TYPE_DIR[n.type]) {
      const slug = basename(n.path, '.md');
      if (n.id !== `${n.type}:${slug}`) err(n, `id must be ${n.type}:${slug}`);
      if (!n.path.startsWith(`${TYPE_DIR[n.type]}/`)) err(n, `${n.type} nodes live under ${TYPE_DIR[n.type]}/`);
    }
    if (n.type === 'table') {
      for (const f of arr(n.fields)) if (!/^[\w-]+:[\w-]+$/.test(f)) err(n, `field "${f}" must be name:type`);
      const writers = arr(n.writer);
      if (writers.length !== 1 && n.append_only !== 'true') err(n, 'a table has one writer component; several writers only when append_only: true (each writer creates its own rows and never edits)');
      if (!n.updated) err(n, 'missing updated');
      if (n.status === 'planned' && arr(n.produced_by).length === 0) err(n, 'a planned table needs produced_by (the story that creates it)');
    }
    if (n.type === 'story') {
      for (const d of arr(n.depends_on)) {
        const [ref, gate] = d.split('@');
        if (!gate || !GATES.includes(gate)) err(n, `depends_on "${d}" must be story:<key>@<${GATES.join('|')}>`);
        else if (!ref.startsWith('story:')) err(n, `depends_on "${d}" must point to a story`);
      }
    }
  }

  // reference resolution
  const need = (n, key, ref) => { if (ref === 'human' && key === 'writer') return; if (!nodes.has(ref)) err(n, `${key} -> ${ref} does not exist`); };
  for (const n of nodes.values()) {
    for (const k of ['produced_by', 'epic', 'writer', 'parent', 'derived_from', 'about']) for (const r of arr(n[k])) need(n, k, r);
    for (const r of arr(n.populated_by)) need(n, 'populated_by', r);
    for (const d of arr(n.depends_on)) need(n, 'depends_on', d.split('@')[0]);
    for (const c of arr(n.consumes)) {
      const p = parseRef(c);
      if (!p) { err(n, `consumes "${c}" must be <type>:<slug> or <type>:<slug>.<field>:<type>`); continue; }
      const t = nodes.get(p.ref);
      if (!t) { err(n, `consumes -> ${p.ref} does not exist`); continue; }
      if (p.field) {
        const found = arr(t.fields).find((f) => f.split(':')[0] === p.field);
        if (!found) err(n, `consumes ${c}: ${p.ref} has no field ${p.field}`);
        else if (found.split(':')[1] !== p.ftype) err(n, `consumes ${c}: field type is ${found.split(':')[1]}, not ${p.ftype}`);
      }
    }
  }

  // dependency graph: cycles, undeclared and under-gated dependencies
  const stories = [...nodes.values()].filter((n) => n.type === 'story');
  const direct = new Map(stories.map((s) => [s.id, new Map(arr(s.depends_on).map((d) => d.split('@')))]));
  const reach = (from, seen = new Set()) => { for (const to of direct.get(from)?.keys() ?? []) if (!seen.has(to)) { seen.add(to); reach(to, seen); } return seen; };
  for (const s of stories) if (reach(s.id).has(s.id)) err(s, 'dependency cycle through this story');
  for (const s of stories) {
    const byProducer = new Map();
    for (const req of requiredStories(nodes, s)) (byProducer.get(req.story) ?? byProducer.set(req.story, []).get(req.story)).push(req.via);
    for (const [prod, vias] of byProducer) {
      const gate = direct.get(s.id).get(prod);
      const list = vias.join(', ');
      if (!gate && !reach(s.id).has(prod)) err(s, `consumes ${list} produced by ${prod} but has no depends_on for it (add ${prod}@${START_GATE})`);
      else if (gate && GATES.indexOf(gate) < GATES.indexOf(START_GATE)) err(s, `depends_on ${prod}@${gate}: consumed ${list} needs at least ${START_GATE}`);
    }
  }

  // generated files are current and not hand-edited
  const built = buildIndex(nodes);
  for (const [name, content] of [['index.json', built.json], ['INDEX.md', built.md]]) {
    const p = join(dir, name);
    if (!existsSync(p)) { if (!lite) problems.push({ level: 'error', path: name, msg: `missing; run: node tools/context.mjs index` }); }
    else if (nl(readFileSync(p, 'utf8')) !== content) problems.push({ level: 'error', path: name, msg: 'out of date; run: node tools/context.mjs index (never edit generated files)' });
  }

  // skill and context stay in sync
  if (existsSync(SKILL_MD)) {
    const skill = nl(readFileSync(SKILL_MD, 'utf8'));
    const v = skill.match(/Context schema version:\s*(\d+)/)?.[1];
    if (!v) problems.push({ level: 'error', path: 'SKILL.md', msg: 'no "Context schema version: N" line' });
    else if (String(meta.schema_version) !== v) problems.push({ level: 'error', path: '_meta.json', msg: `schema_version ${meta.schema_version} differs from SKILL.md (${v}); migrate the context, then update _meta.json` });
    const sib = join(HERE, '..', '..', 'story-split-derive', 'SKILL.md');
    if (existsSync(sib) && v) {
      const sv = nl(readFileSync(sib, 'utf8')).match(/Requires story-context schema version:\s*(\d+)/)?.[1];
      if (!sv) problems.push({ level: 'warn', path: 'story-split-derive/SKILL.md', msg: 'no "Requires story-context schema version: N" line' });
      else if (sv !== v) problems.push({ level: 'error', path: 'story-split-derive/SKILL.md', msg: `targets schema ${sv} but story-context is schema ${v}; update both skills together` });
    }
    if (meta.skill_sha256 && meta.skill_sha256 !== sha(skill)) problems.push({ level: 'warn', path: '_meta.json', msg: 'SKILL.md changed since the last seal; run check, review, then: node tools/context.mjs seal' });
  } else problems.push({ level: 'error', path: 'SKILL.md', msg: 'not found next to tools/ (local install is incomplete)' });

  return { nodes, problems, meta };
}

// every story that must be done before `s` can start: producers of everything it consumes
function requiredStories(nodes, s) {
  const out = [];
  for (const c of arr(s.consumes)) {
    const p = parseRef(c);
    const t = p && nodes.get(p.ref);
    if (!t) continue;
    const via = c;
    const producers = new Set([...arr(t.produced_by)]);
    for (const a of arr(t.populated_by)) for (const pb of arr(nodes.get(a)?.produced_by)) producers.add(pb);
    for (const pb of producers) if (pb !== s.id && nodes.get(pb)?.type === 'story') out.push({ story: pb, via });
  }
  return out;
}

// ---------- generated files ----------
function buildIndex(nodes) {
  const { refsOut, refsIn } = derive(nodes);
  const list = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const json = JSON.stringify({
    schema: 1,
    nodes: list.map((n) => ({
      id: n.id, type: n.type, title: n.title, summary: n.summary, status: n.status ?? null, tags: arr(n.tags),
      path: n.path, hash: n.hash,
      out: (refsOut.get(n.id) ?? []).map((e) => `${e.kind}>${e.to}`).sort(),
      in: (refsIn.get(n.id) ?? []).map((e) => `${e.kind}<${e.from}`).sort(),
    })),
  }, null, 2) + '\n';
  const by = (t) => list.filter((n) => n.type === t);
  const row = (n) => `| [${n.id}](${n.path}) | ${n.status ?? ''} | ${n.summary} |`;
  const lines = [
    '<!-- GENERATED by tools/context.mjs index. Do not edit; edit the nodes and rebuild. -->',
    '# Context index', '',
    'Start here: [project.md](project.md) (what this is), [glossary.md](glossary.md) (terms and banned words).',
    'Search: `node tools/context.mjs find <words>`. One story with its neighbors: `node tools/context.mjs slice <id>`. What blocks a story: `node tools/context.mjs deps <story id>`.', '',
    `Nodes: ${list.length} (${Object.keys(TYPE_DIR).map((t) => `${t} ${by(t).length}`).join(', ')}).`, '',
  ];
  for (const t of ['epic', 'story', 'table', 'agent', 'automation', 'interface', 'source', 'decision', 'note']) {
    const ns = by(t);
    if (!ns.length) continue;
    lines.push(`## ${t}`, '', '| id | status | summary |', '|---|---|---|', ...ns.map(row), '');
  }
  const edges = [];
  for (const s of by('story')) for (const d of arr(s.depends_on)) { const [to, g] = d.split('@'); edges.push(`  ${s.key} -->|needs ${g}| ${nodes.get(to)?.key ?? to}`); }
  if (edges.length) lines.push('## Story dependencies', '', '```mermaid', 'flowchart LR', ...edges.sort(), '```', '');
  return { json, md: lines.join('\n') };
}

// ---------- commands ----------
function readMeta(dir) {
  const p = join(dir, '_meta.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

function cmdInit(dir) {
  for (const d of ['', ...Object.values(TYPE_DIR), 'notes/slack', 'notes/drive', 'notes/provided']) mkdirSync(join(dir, d), { recursive: true });
  const schema = readFileSync(SKILL_MD, 'utf8').match(/Context schema version:\s*(\d+)/)?.[1] ?? '1';
  const p = join(dir, '_meta.json');
  if (!existsSync(p)) writeFileSync(p, JSON.stringify({ schema_version: Number(schema), skill_sha256: sha(nl(readFileSync(SKILL_MD, 'utf8'))), mode: 'full', scope: { project: '', key_projects: [] }, status_map: DEFAULT_STATUS_MAP, last_deep_scan: null }, null, 2) + '\n');
  const c = join(dir, 'CHANGELOG.md');
  if (!existsSync(c)) writeFileSync(c, '# Context changelog\n\nAppend only. One line per change: date, thread or story, what changed, why.\n');
  console.log(`initialized ${dir}`);
}

function cmdIndex(dir) {
  const { nodes, problems } = load(dir);
  const fatal = problems.filter((p) => p.level === 'error');
  if (fatal.length) { fatal.forEach((p) => console.error(`error ${p.path}: ${p.msg}`)); die('fix node errors before indexing'); }
  const { json, md } = buildIndex(nodes);
  writeFileSync(join(dir, 'index.json'), json);
  writeFileSync(join(dir, 'INDEX.md'), md);
  console.log(`indexed ${nodes.size} nodes`);
}

function cmdCheck(dir) {
  const { nodes, problems } = validate(dir);
  const errs = problems.filter((p) => p.level === 'error'), warns = problems.filter((p) => p.level === 'warn');
  for (const p of [...errs, ...warns]) console.log(`${p.level.padEnd(5)} ${p.path}: ${p.msg}`);
  console.log(`${nodes.size} nodes, ${errs.length} errors, ${warns.length} warnings`);
  process.exit(errs.length ? 1 : 0);
}

function cmdFind(dir, argv) {
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const skip = new Set(['--type', '--tag', '--status', '--dir']);
  const words = argv.filter((a, i) => !a.startsWith('--') && !skip.has(argv[i - 1])).map((w) => w.toLowerCase());
  const { nodes } = load(dir);
  const res = [];
  for (const n of nodes.values()) {
    if (opt('--type') && n.type !== opt('--type')) continue;
    if (opt('--status') && n.status !== opt('--status')) continue;
    if (opt('--tag') && !arr(n.tags).includes(opt('--tag'))) continue;
    const head = `${n.id} ${n.title} ${n.summary} ${arr(n.tags).join(' ')}`.toLowerCase();
    const body = n.body.toLowerCase();
    let score = 0;
    for (const w of words) { if (head.includes(w)) score += 5; score += Math.min(3, body.split(w).length - 1); }
    if (!words.length || score > 0) res.push({ n, score });
  }
  res.sort((a, b) => b.score - a.score || a.n.id.localeCompare(b.n.id));
  for (const { n } of res.slice(0, 20)) console.log(`${n.id}  [${n.type}${n.status ? '/' + n.status : ''}]  ${n.summary}  (${n.path})`);
  if (!res.length) console.log('no match');
}

function cmdSlice(dir, argv) {
  const id = argv.find((a) => !a.startsWith('--') && a !== dir);
  const full = argv.includes('--full');
  const { nodes } = load(dir);
  const n = nodes.get(id);
  if (!n) die(`unknown id ${id}`);
  const { refsOut, refsIn } = derive(nodes);
  const show = (x, withBody) => `### ${x.id} - ${x.title}\n${x.path} | ${x.type}${x.status ? '/' + x.status : ''}${x.ss_status ? ' | SS: ' + x.ss_status : ''}\n${x.summary}\n${arr(x.fields).length ? 'fields: ' + arr(x.fields).join(', ') + '\n' : ''}${withBody ? '\n' + x.body.trim() + '\n' : ''}`;
  const out = [`# Context pack for ${id}`, '', show(n, true)];
  const neigh = new Map();
  for (const e of [...(refsOut.get(id) ?? []), ...(refsIn.get(id) ?? [])]) neigh.set(e.to ?? e.from, true);
  for (const c of arr(n.consumes)) { const p = parseRef(c); if (p) neigh.set(p.ref, true); }
  const groups = { 'Depends on / blocks': [], 'Artifacts': [], 'Other': [] };
  for (const k of neigh.keys()) {
    const x = nodes.get(k);
    if (!x) continue;
    (x.type === 'story' ? groups['Depends on / blocks'] : ['table', 'agent', 'automation', 'interface', 'source'].includes(x.type) ? groups.Artifacts : groups.Other).push(x);
  }
  for (const [g, xs] of Object.entries(groups)) if (xs.length) out.push(`## ${g}`, '', ...xs.map((x) => show(x, full)));
  const gl = nodes.get('glossary');
  if (gl) out.push('## Glossary', '', gl.summary, `(full: context/${gl.path})`);
  console.log(out.join('\n'));
}

function cmdDeps(dir, argv) {
  const id = argv.find((a) => !a.startsWith('--'));
  const { nodes, meta } = validate(dir);
  const s = nodes.get(id);
  if (!s || s.type !== 'story') die(`unknown story ${id}`);
  const map = { ...DEFAULT_STATUS_MAP, ...(meta.status_map ?? {}) };
  const rank = (x) => { const g = map[x.ss_status]; return g ? GATES.indexOf(g) : -1; };
  const need = new Map();
  for (const d of arr(s.depends_on)) { const [to, g] = d.split('@'); need.set(to, { gate: g, why: ['declared'] }); }
  for (const r of requiredStories(nodes, s)) {
    const cur = need.get(r.story) ?? { gate: START_GATE, why: [] };
    cur.why.push(`consumes ${r.via}`);
    if (GATES.indexOf(cur.gate) < GATES.indexOf(START_GATE)) cur.gate = START_GATE;
    need.set(r.story, cur);
  }
  let ok = true;
  console.log(`Readiness of ${id} (${s.ss_status})`);
  for (const [to, v] of need) {
    const p = nodes.get(to);
    const r = p ? rank(p) : -1;
    const good = r >= GATES.indexOf(v.gate);
    if (!good) ok = false;
    console.log(`${good ? 'ready  ' : 'BLOCKED'} ${to} needs ${v.gate}; now ${p?.ss_status ?? '?'}${r < 0 ? ' (unmapped status: add it to _meta.json status_map)' : ''}  [${v.why.join('; ')}]`);
  }
  if (!need.size) console.log('no dependencies');
  console.log(ok ? 'can start: yes' : 'can start: no');
  process.exit(ok ? 0 : 1);
}

function cmdMerge(dir, argv) {
  const srcArg = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dir');
  if (!srcArg) die('merge needs the lite context folder');
  const src = resolve(srcArg);
  if (!existsSync(src)) die(`not found: ${src}`);
  const a = load(src), b = load(dir);
  const fatal = a.problems.filter((p) => p.level === 'error');
  if (fatal.length) { fatal.forEach((p) => console.error(`error ${p.path}: ${p.msg}`)); die('fix the lite context first'); }
  let added = 0, same = 0;
  const conflicts = [];
  for (const n of a.nodes.values()) {
    const ex = b.nodes.get(n.id);
    if (!ex) {
      const dst = join(dir, n.path);
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, readFileSync(join(src, n.path)));
      added++;
    } else if (ex.hash === n.hash) same++;
    else conflicts.push(`${n.id}: lite (${n.confidence ?? '-'}) differs from full (${ex.confidence ?? '-'}) at ${ex.path}; resolve by hand, then remove the lite node`);
  }
  console.log(`merged: ${added} added, ${same} identical, ${conflicts.length} conflicts`);
  conflicts.forEach((c) => console.log(`conflict ${c}`));
  cmdIndex(dir);
}

function cmdSeal(dir) {
  const meta = readMeta(dir);
  meta.skill_sha256 = sha(nl(readFileSync(SKILL_MD, 'utf8')));
  writeFileSync(join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log('sealed SKILL.md hash in _meta.json');
}

const argv = process.argv.slice(2);
const cmd = argv.shift();
const dir = contextDir(argv);
const handlers = { init: cmdInit, index: cmdIndex, check: cmdCheck, find: cmdFind, slice: cmdSlice, deps: cmdDeps, merge: cmdMerge, seal: cmdSeal };
if (!handlers[cmd]) { console.log('usage: node tools/context.mjs <init|index|check|find|slice|deps|merge|seal> [args] [--dir path]'); process.exit(cmd ? 2 : 0); }
if (cmd !== 'init' && !existsSync(dir)) die(`context folder not found: ${dir}`);
handlers[cmd](dir, argv);
