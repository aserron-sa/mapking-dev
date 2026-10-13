/**
 * cct-build — MapKMigGon38571
 *
 * Builds the paste-ready files Airtable needs from the TypeScript sources in airtable/cct.
 * Airtable accepts ONE self-contained file per automation script (JavaScript, no imports)
 * and ONE frontend/index.tsx per interface component, so local modules are inlined here.
 *
 * Usage (repo root, Node 22.18+, after `npm install` once):
 *     node airtable/cct/tools/cct-build.ts      (or: npm run cct:build)
 *
 * Outputs (git-ignored by the repo's `dist/` rule: rebuild before pasting, never edit by hand):
 *     airtable/cct/dist/automations/cct-triage-compute.js     (paste in the Run a script action)
 *     airtable/cct/dist/interfaces/WorkQueuePage.tsx          (paste as frontend/index.tsx of the extension)
 *
 * How it works:
 *   1. Concatenates the modules in dependency order (rules → sync → entry file).
 *   2. Removes `import … from './…'` / `'../…'` lines (local modules are now in the same file)
 *      and the `export` keyword at the start of declarations. Package imports are kept.
 *   3. For the interface (TSX) the types are KEPT (the Airtable editor compiles TSX) and the package
 *      imports of the page are moved to the top of the file. For automations, removes the TypeScript types with the TypeScript compiler's transpiler
 *      (devDependency `typescript`). The output is meant to be READ and PASTED in Airtable by
 *      people, so it keeps every comment, uses normal indentation (4 spaces) and leaves no
 *      blank "holes" where types used to be; doc comments of removed types/interfaces are
 *      dropped together with them.
 *   4. Adds a header with the source files and their SHA-256, so the pasted code can be traced
 *      back to a commit.
 *   5. Checks the result: no remaining `import`/`export`, and the JS parses.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const CCT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CCT_DIR, '..', '..');

interface Target {
  name: string;
  sources: string[]; // relative to airtable/cct, dependency order, entry last
  out: string; // relative to airtable/cct
  stripTypes: boolean;
  /** `tsx`: keep types, hoist package imports, drop the entry file's header comment. */
  kind?: 'js' | 'tsx';
}

const TARGETS: Target[] = [
  {
    name: 'automation cct-triage-compute',
    sources: ['cct-triage-rules.ts', 'cct-triage-sync.ts', 'automations/cct-triage-compute.ts'],
    out: 'dist/automations/cct-triage-compute.js',
    stripTypes: true,
  },
  {
    name: 'interface WorkQueuePage',
    sources: ['cct-triage-rules.ts', 'interfaces/cct-triage-contract.ts', 'interfaces/WorkQueuePage.tsx'],
    out: 'dist/interfaces/WorkQueuePage.tsx',
    stripTypes: false,
    kind: 'tsx',
  },
];

// One import statement (may span lines, never crosses a `;`) whose specifier is relative.
const LOCAL_IMPORT = /^[ \t]*import\s+(type\s+)?[^;]*?\sfrom\s+['"]\.{1,2}\/[^'"]+['"];?[ \t]*$/gm;
// A package import (specifier does not start with a dot), possibly multi-line.
const PACKAGE_IMPORT = /^import\s+(?:type\s+)?[^;]*?\sfrom\s+['"][^.'"][^'"]*['"];?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+(?=(async\s+)?(function|const|let|class|interface|type)\b)/gm;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * TypeScript → readable JavaScript. Types are removed; comments, line breaks and names stay.
 * transpileModule works file by file (no type checking: `npm run typecheck` does that).
 */
function toReadableJs(ts_source: string): string {
  const require = createRequire(import.meta.url);
  let ts: typeof import('typescript');
  try {
    ts = require('typescript');
  } catch {
    throw new Error('Cannot find the "typescript" package. Run `npm install` at the repo root first.');
  }
  const out = ts.transpileModule(ts_source, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      newLine: ts.NewLineKind.LineFeed,
    },
  });
  const errors = (out.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; '));
  return tidy(out.outputText);
}

/**
 * Remove what is left behind when a type disappears: one-line `/** … *\/` doc comments that
 * documented a removed type (they are followed by another comment, a blank line or the end),
 * then collapse runs of blank lines.
 */
function tidy(js: string): string {
  const lines = js.split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const oneLineDoc = /^\s*\/\*\*.*\*\/\s*$/.test(line);
    if (oneLineDoc) {
      const next = (lines[i + 1] ?? '').trim();
      if (next === '' || next.startsWith('//') || next.startsWith('/**')) continue;
    }
    kept.push(line.replace(/\s+$/, ''));
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function build(t: Target): string {
  const parts: string[] = [];
  const manifest: string[] = [];
  const packageImports: string[] = [];
  for (const rel of t.sources) {
    const abs = join(CCT_DIR, rel);
    const src = readFileSync(abs, 'utf8');
    manifest.push(` *   airtable/cct/${rel}  sha256:${sha256(src)}`);
    const body = src.replace(LOCAL_IMPORT, '').replace(EXPORT_DECL, '');
    if (t.stripTypes) {
      // Transpile file by file, then put the file's header comment back: the compiler drops
      // comments that sit in front of a removed type, and that is where headers usually are.
      const header = src.match(/^\s*(\/\*\*[\s\S]*?\*\/)/)?.[1] ?? '';
      const js = toReadableJs(body.replace(header, ''));
      parts.push(`// ───── airtable/cct/${rel} ─────\n${header ? header + '\n' : ''}${js}`);
    } else {
      let tsx = body;
      if (t.kind === 'tsx') {
        // Package imports go to the top of the file (once each).
        for (const m of tsx.match(PACKAGE_IMPORT) ?? []) if (!packageImports.includes(m.trim())) packageImports.push(m.trim());
        tsx = tsx.replace(PACKAGE_IMPORT, '');
        // The entry file's header explains the repo layout and says "do not paste": not useful here.
        if (rel === t.sources[t.sources.length - 1]) tsx = tsx.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, '');
      }
      parts.push(`// ───── airtable/cct/${rel} ─────\n${tsx.replace(/\n{3,}/g, '\n\n').trim()}\n`);
    }
  }
  const code = (packageImports.length ? packageImports.join('\n') + '\n\n' : '') + parts.join('\n');
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
  if (t.kind === 'tsx') {
    if (/^\s*export\s/m.test(code)) throw new Error(`${t.out}: export left after inlining`);
    if (/\bfrom\s+['"]\.{1,2}\//.test(code)) throw new Error(`${t.out}: local import left after inlining`);
    const require = createRequire(import.meta.url);
    const ts: typeof import('typescript') = require('typescript');
    const r = ts.transpileModule(code, { reportDiagnostics: true, fileName: 'index.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    const errors = (r.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; '));
    return;
  }
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
