/**
 * cct-build — MapKMigGon38571
 *
 * Builds the paste-ready files Airtable needs from the TypeScript sources in airtable/cct.
 * Airtable accepts ONE self-contained file per automation script (JavaScript, no imports)
 * and ONE frontend/index.tsx per interface component, so local modules are inlined here.
 *
 * Usage (repo root, Node 22.18+, no dependencies):
 *     node airtable/cct/tools/cct-build.ts
 *
 * Outputs (git-ignored by the repo's `dist/` rule: rebuild before pasting, never edit by hand):
 *     airtable/cct/dist/automations/cct-triage-compute.js
 *
 * How it works:
 *   1. Concatenates the modules in dependency order (rules → sync → entry file).
 *   2. Removes `import … from './…'` / `'../…'` lines (local modules are now in the same file)
 *      and the `export` keyword at the start of declarations. Package imports are kept.
 *   3. For automations, strips TypeScript types with Node's built-in module.stripTypeScriptTypes
 *      (only erasable syntax is used in the sources, so no compiler is needed).
 *   4. Adds a header with the source files and their SHA-256, so the pasted code can be traced
 *      back to a commit.
 *   5. Checks the result: no remaining `import`/`export`, and the JS parses.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as nodeModule from 'node:module';

const CCT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CCT_DIR, '..', '..');

interface Target {
  name: string;
  sources: string[]; // relative to airtable/cct, dependency order, entry last
  out: string; // relative to airtable/cct
  stripTypes: boolean;
}

const TARGETS: Target[] = [
  {
    name: 'automation cct-triage-compute',
    sources: ['cct-triage-rules.ts', 'cct-triage-sync.ts', 'automations/cct-triage-compute.ts'],
    out: 'dist/automations/cct-triage-compute.js',
    stripTypes: true,
  },
];

// One import statement (may span lines, never crosses a `;`) whose specifier is relative.
const LOCAL_IMPORT = /^[ \t]*import\s+(type\s+)?[^;]*?\sfrom\s+['"]\.{1,2}\/[^'"]+['"];?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+(?=(async\s+)?(function|const|let|class|interface|type)\b)/gm;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function build(t: Target): string {
  const parts: string[] = [];
  const manifest: string[] = [];
  for (const rel of t.sources) {
    const abs = join(CCT_DIR, rel);
    const src = readFileSync(abs, 'utf8');
    manifest.push(` *   airtable/cct/${rel}  sha256:${sha256(src)}`);
    const body = src.replace(LOCAL_IMPORT, '').replace(EXPORT_DECL, '');
    parts.push(`// ───── airtable/cct/${rel} ─────\n${body.trim()}\n`);
  }
  let code = parts.join('\n');
  if (t.stripTypes) {
    const strip = (nodeModule as any).stripTypeScriptTypes;
    if (typeof strip !== 'function') throw new Error('This Node has no module.stripTypeScriptTypes (need Node 22.13+).');
    code = strip(code, { mode: 'strip' });
  }
  const header = [
    '/**',
    ` * GENERATED FILE — do not edit. Rebuild with: node airtable/cct/tools/cct-build.ts`,
    ` * Target: ${t.name} · built ${new Date().toISOString()}`,
    ' * Sources:',
    ...manifest,
    ' */',
    '',
  ].join('\n');
  return header + code;
}

function check(t: Target, code: string): void {
  if (/^\s*(import|export)\s/m.test(code)) throw new Error(`${t.out}: import/export left after inlining`);
  if (t.stripTypes) {
    // Parse as the body of an async function, which is how Airtable runs automation scripts (top-level await).
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    new AsyncFunction('base', 'input', 'output', code);
  }
}

let failed = false;
for (const t of TARGETS) {
  try {
    const code = build(t);
    check(t, code);
    const outAbs = join(CCT_DIR, t.out);
    mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, code);
    console.log(`✔ ${t.name} → ${relative(REPO, outAbs)} (${code.length} chars)`);
  } catch (e) {
    failed = true;
    console.error(`✘ ${t.name}: ${(e as Error).message}`);
  }
}
process.exitCode = failed ? 1 : 0;
