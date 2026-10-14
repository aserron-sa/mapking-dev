#!/usr/bin/env node
// tools/commit/commit.mjs — one command to commit with a message from a flag, a pipe,
// a template, or the current message file. Node 22+, no dependencies.
//
//   node tools/commit/commit.mjs                      message from current_msg.md
//   node tools/commit/commit.mjs -m "feat(x): y"      message from a flag
//   cat msg.md | node tools/commit/commit.mjs         message from a pipe (wins over file)
//   node tools/commit/commit.mjs -t feat              message from tpls/feat.md
//   node tools/commit/commit.mjs -a                   git add -A first (default: only what is staged)
//   node tools/commit/commit.mjs --add src/x.ts       stage a path first (repeatable)
//   node tools/commit/commit.mjs --dry                show message and staged files, change nothing
//   node tools/commit/commit.mjs --no-hooks           skip pre and post hooks
//
// Message precedence: -m, then piped stdin, then -t, then current_msg.md (-f to change the file).
// Hooks, trailers and branch rules live in config.mjs.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = /^TODO:/;

function die(msg, code = 1) {
  console.error(`commit: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const o = {
    message: null, tpl: null, file: join(HERE, 'current_msg.md'),
    add: [], all: false, dry: false, hooks: true, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) die(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case '-m': case '--message': o.message = val(); break;
      case '-t': case '--tpl': o.tpl = val(); break;
      case '-f': case '--file': o.file = resolve(val()); break;
      case '--add': o.add.push(val()); break;
      case '-a': case '--all': o.all = true; break;
      case '--dry': o.dry = true; break;
      case '--no-hooks': o.hooks = false; break;
      case '-h': case '--help': o.help = true; break;
      default: die(`unknown option ${a} (see --help)`);
    }
  }
  return o;
}

function usage() {
  console.log(`Usage: node tools/commit/commit.mjs [-m msg | -t tpl | -f file] [-a | --add path]... [--dry] [--no-hooks]
Message from: -m text, piped stdin, -t tpls/<tpl>.md, or current_msg.md (default).`);
}

function git(args, cwd) {
  return execFileSync('git', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}

function readStdin() {
  if (process.stdin.isTTY) return null;
  try {
    const s = readFileSync(0, 'utf8');
    return s.trim() ? s : null;
  } catch {
    return null;
  }
}

function loadMessage(o) {
  if (o.message !== null) return { text: o.message, source: '-m' };
  const piped = readStdin();
  if (piped) return { text: piped, source: 'stdin' };
  if (o.tpl) {
    const p = join(HERE, 'tpls', `${o.tpl}.md`);
    if (!existsSync(p)) die(`template not found: tpls/${o.tpl}.md`);
    return { text: readFileSync(p, 'utf8'), source: `tpls/${o.tpl}.md` };
  }
  if (!existsSync(o.file)) die(`message file not found: ${o.file}`);
  return { text: readFileSync(o.file, 'utf8'), source: o.file };
}

// Fill {{vars}}, trim trailing spaces, drop surrounding blank lines, add config trailers.
// Uses --cleanup=verbatim at commit time, so markdown headers ("## Why") are kept.
function finishMessage(raw, vars) {
  let t = raw.replace(/\r\n/g, '\n').replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);
  t = t.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
  const present = new Set(t.split('\n').map((l) => l.trim()));
  const extra = (config.trailers ?? []).filter((tr) => !present.has(tr));
  if (extra.length) t += `\n\n${extra.join('\n')}`;
  return `${t}\n`;
}

async function runHooks(phase, ctx) {
  for (const h of config.hooks?.[phase] ?? []) {
    const hook = typeof h === 'string' ? { run: h } : h;
    const label = hook.name ?? (typeof hook.run === 'string' ? hook.run : 'hook');
    console.log(`[${phase}] ${label}`);
    let ok = true;
    if (typeof hook.run === 'function') {
      try {
        ok = (await hook.run(ctx)) !== false;
      } catch (e) {
        console.error(e?.message ?? e);
        ok = false;
      }
    } else {
      const r = spawnSync(hook.run, {
        cwd: ctx.root, shell: true, stdio: 'inherit',
        env: { ...process.env, COMMIT_BRANCH: ctx.branch, COMMIT_SUBJECT: ctx.subject, COMMIT_SHA: ctx.sha ?? '' },
      });
      ok = r.status === 0;
    }
    if (!ok) {
      if (phase === 'pre' && !hook.optional) die(`pre hook failed: ${label}. Nothing committed.`);
      console.error(`[${phase}] failed (ignored): ${label}`);
    }
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { usage(); return; }

  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  } catch {
    die('not inside a git repository');
  }

  const branch = git(['branch', '--show-current'], root).trim();
  if (!branch) die('detached HEAD. Check out a branch first.');
  if (config.allowedBranches && !config.allowedBranches.test(branch)) {
    die(`branch "${branch}" is not in allowedBranches (config.mjs)`);
  }

  const { text, source } = loadMessage(o);
  const vars = { date: new Date().toISOString().slice(0, 10), branch, ...(config.vars ?? {}) };
  const message = finishMessage(text, vars);
  const subject = message.split('\n')[0].trim();

  if (!subject) die(`empty message (source: ${source})`);
  if (PLACEHOLDER.test(subject)) die(`message still has the placeholder (source: ${source}). Write the subject first.`);
  if (subject.length > 72) console.warn(`commit: warning, subject is ${subject.length} chars (72 max is the usual limit)`);

  console.log(`Message from: ${source}`);
  console.log('----------------------------------------');
  console.log(message.trimEnd());
  console.log('----------------------------------------');

  const ctx = { root, branch, subject };

  if (o.dry) {
    console.log('Dry run: nothing staged, hooks skipped, nothing committed.');
    if (o.all || o.add.length) console.log('(with --all or --add the paths would be staged first)');
    console.log(git(['--no-pager', 'diff', '--cached', '--stat'], root).trimEnd() || '(nothing staged)');
    return;
  }

  if (o.hooks) await runHooks('pre', ctx);

  if (o.all) git(['add', '-A'], root);
  else if (o.add.length) git(['add', '--', ...o.add], root);

  const nothingStaged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root }).status === 0;
  if (nothingStaged) die('nothing staged. Stage files, or use --all / --add <path>.');

  console.log('Staged:');
  console.log(git(['--no-pager', 'diff', '--cached', '--stat'], root).trimEnd());

  const r = spawnSync('git', ['commit', '--cleanup=verbatim', '-F', '-'], {
    cwd: root, input: message, stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (r.status !== 0) die('git commit failed');

  const sha = git(['rev-parse', 'HEAD'], root).trim();
  ctx.sha = sha;
  console.log(git(['--no-pager', 'log', '--oneline', '-1'], root).trim());

  if (o.hooks) await runHooks('post', ctx);
}

main().catch((e) => die(e?.message ?? String(e)));
