#!/usr/bin/env node
// DocPC runner. Each feature is a pipeline in pipelines/<name>/: one command runs all of its steps in order.
// The code stays in the skill; the document's own data (JSON, content, pseudocode, draw.io files) is in its Source/.
//
// Usage:
//   node <skill>/run.js                                 list the pipelines
//   node <skill>/run.js init [folder] [pipeline ...]    make Inputs/, Source/ and Outputs/ in the folder (default: here)
//                                                       and copy the example data of the pipelines (default: all);
//                                                       a file that exists is kept
//   node <skill>/run.js <pipeline> [pipeline ...] [args] [--source <Source folder>]
//                                                       run the pipelines in order; the args go to the last one
// The Source folder is --source, else ./Source if it exists, else the current folder.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

const SKILL = __dirname, PIPES = path.join(SKILL, 'pipelines');
const names = () => fs.readdirSync(PIPES).filter(n => fs.existsSync(path.join(PIPES, n, 'pipeline.js')));
// A pipeline module is loaded only after DOCPC_SOURCE is set, because lib/paths.js reads it once.
const load = name => require(path.join(PIPES, name, 'pipeline.js'));

function list() {
  console.log('DocPC pipelines (node run.js <pipeline>):\n');
  for (const n of names()) {
    const p = load(n);
    console.log(`  ${n.padEnd(12)} ${p.description}`);
    if (p.data.length) console.log(`  ${''.padEnd(12)} data: ${p.data.join(', ')}`);
    if (p.needs) console.log(`  ${''.padEnd(12)} needs: ${p.needs}`);
  }
}

// Copies pipelines/<name>/example/ into Source/, file by file, and never replaces a file.
function copyNew(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyNew(a, b); }
    else if (fs.existsSync(b)) console.log(`kept ${path.relative(path.dirname(to), b)}`);
    else { fs.copyFileSync(a, b); console.log(`copied ${path.relative(path.dirname(to), b)}`); }
  }
}

function init(args) {
  const all = names(), pipes = args.filter(a => all.includes(a)), rest = args.filter(a => !all.includes(a));
  const root = path.resolve(rest[0] || '.');
  for (const d of ['Inputs', 'Source', 'Outputs']) fs.mkdirSync(path.join(root, d), { recursive: true });
  for (const n of pipes.length ? pipes : all) {
    const ex = path.join(PIPES, n, 'example');
    if (fs.existsSync(ex)) copyNew(ex, path.join(root, 'Source'));
  }
  console.log(`ready: ${root} (Inputs/, Source/, Outputs/)`);
}

function sourceDir(args) {
  const at = args.indexOf('--source');
  if (at >= 0) { const dir = args[at + 1]; args.splice(at, 2); return path.resolve(dir); }
  return fs.existsSync('Source') ? path.resolve('Source') : process.cwd();
}

// What every pipeline gets: the folders, a path helper and a PowerShell runner. A step that fails stops the run.
// A step reports a problem with a line that starts with "problem:"; a check step (soft) reports with its exit code
// (the number of problems). Both only add to the count, so the other steps and checks still run.
function context(source) {
  const ctx = {
    skill: SKILL, source, outputs: path.join(source, '..', 'Outputs'), problems: 0,
    src: (...p) => path.join(source, ...p),
    ps(script, args = [], { soft = false } = {}) {
      const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
      if (r.error) throw r.error;
      process.stdout.write(r.stdout);
      ctx.problems += (r.stdout.match(/^problem: /gm) || []).length;
      if (r.status && !soft) throw new Error(`${path.basename(script)} stopped with exit code ${r.status}`);
      ctx.problems += soft ? r.status || 0 : 0;
      return r.status;
    },
  };
  return ctx;
}

async function main(argv) {
  const args = [...argv];
  if (!args.length) return list();
  if (args[0] === 'init') return init(args.slice(1));
  const source = sourceDir(args);
  process.env.DOCPC_SOURCE = source;
  const all = names(), pipes = [];
  while (args.length && all.includes(args[0])) pipes.push(args.shift());
  if (!pipes.length) throw new Error(`unknown pipeline "${args[0]}". Run "node run.js" for the list.`);
  const ctx = context(source);
  for (const n of pipes) {
    const p = load(n);
    for (const d of p.data) if (!fs.existsSync(ctx.src(d))) throw new Error(`${n}: ${ctx.src(d)} is missing. Run "node run.js init . ${n}" first.`);
    console.log(`\n== ${n}`);
    await p.run(ctx, n === pipes.at(-1) ? args : []);
  }
  if (ctx.problems) { console.log(`\nproblems: ${ctx.problems}`); process.exitCode = 1; }
}

main(process.argv.slice(2)).catch(e => { console.error(`error: ${e.message}`); process.exitCode = 1; });
