// Batch playtest runner - drives N seeded bot games in parallel headless
// Chromium contexts and aggregates the telemetry.
//
//   node dev/run-batch.mjs                          20 runs, level 1, both variants
//   node dev/run-batch.mjs --runs 40 --levels 1,2,3
//   node dev/run-batch.mjs --policy sweep --fixed-dt
//   node dev/run-batch.mjs --headed --workers 1     watch it play
//
// Results land in dev/runs/<timestamp>/ (gitignored). Bot numbers are valid
// for regression detection and relative A/B; absolute calibration needs
// human-run telemetry - see the 2026-09-06 decision entry.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer, PROJECT_ROOT } from './serve.mjs';

// --- args ----------------------------------------------------------------

function parseArgs(argv) {
  const a = {
    runs: 20, levels: [1], variants: ['standard', 'heavy'], policy: 'pump',
    workers: 4, timeoutMs: 60000, fixedDt: null, headed: false, out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--runs') a.runs = Number(next());
    else if (k === '--levels') a.levels = next().split(',').map(Number);
    else if (k === '--variants') a.variants = next().split(',');
    else if (k === '--policy') a.policy = next();
    else if (k === '--workers') a.workers = Number(next());
    else if (k === '--timeout') a.timeoutMs = Number(next());
    else if (k === '--fixed-dt') a.fixedDt = 1 / 60;
    else if (k === '--headed') a.headed = true;
    else if (k === '--out') a.out = next();
    else if (k === '--help') { console.log(HELP); process.exit(0); }
    else { console.error(`unknown argument: ${k}`); process.exit(2); }
  }
  return a;
}

const HELP = `dev/run-batch.mjs [options]
  --runs N         total runs (default 20)
  --levels a,b,c   level ids to cycle through (default 1)
  --variants a,b   rat variants to cycle (default standard,heavy)
  --policy name    pump | sweep (default pump)
  --workers N      parallel browser contexts (default 4)
  --timeout MS     per-run deadline (default 60000)
  --fixed-dt       fixed 1/60 timestep: reproducible, not real-time
  --headed         show the browser
  --out DIR        output directory (default dev/runs/<timestamp>)`;

const args = parseArgs(process.argv.slice(2));

// --- run plan ------------------------------------------------------------

// Cycle level x variant so a partial batch is still balanced rather than
// being all of one variant.
const plan = [];
for (let i = 0; i < args.runs; i++) {
  plan.push({
    index: i,
    level: args.levels[i % args.levels.length],
    variant: args.variants[Math.floor(i / args.levels.length) % args.variants.length],
    seed: 1000 + i,
  });
}

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT }).toString().trim();
} catch { /* not fatal - a run outside a git checkout is still a valid run */ }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = args.out ? join(PROJECT_ROOT, args.out) : join(PROJECT_ROOT, 'dev', 'runs', stamp);
await mkdir(outDir, { recursive: true });

console.log(`batch: ${args.runs} runs, levels [${args.levels}], variants [${args.variants}], `
  + `policy=${args.policy}, workers=${args.workers}, fixedDt=${args.fixedDt ?? 'real'}`);
console.log(`commit ${gitCommit} -> ${outDir}\n`);

// --- execution -----------------------------------------------------------

const { base, close } = await startServer();
const browser = await chromium.launch({ headless: !args.headed });
const wallStart = Date.now();
const results = [];
const queue = [...plan];

async function worker(id) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto(`${base}/?dev=1`, { waitUntil: 'load' });
  await page.waitForSelector('#ls-grid', { state: 'visible' });

  while (queue.length) {
    const job = queue.shift();
    if (!job) break;
    const before = pageErrors.length;
    const t0 = Date.now();
    let outcome;
    try {
      outcome = await page.evaluate(
        opts => window.__ratsmash.runBot(opts),
        {
          level: job.level, variant: job.variant, seed: job.seed,
          policy: args.policy, timeoutMs: args.timeoutMs, fixedDt: args.fixedDt,
        }
      );
    } catch (err) {
      outcome = { error: err.message, document: null };
    }
    const wallMs = Date.now() - t0;
    const doc = outcome.document;
    const newErrors = pageErrors.slice(before);

    results.push({ job, doc, timedOut: Boolean(outcome.timedOut), wallMs, pageErrors: newErrors, error: outcome.error ?? null });

    const tag = `[w${id}] run ${job.index + 1}/${plan.length} L${job.level} ${job.variant}`;
    if (doc) {
      const s = doc.summary;
      console.log(`${tag}: ${s.outcome} in ${s.hitsToClear ?? '-'} hits, ${s.timeToClearS}s `
        + `(peak ${s.speed.max}, wall ${(wallMs / 1000).toFixed(1)}s)`
        + (newErrors.length ? `  ERRORS ${newErrors.length}` : ''));
    } else {
      console.log(`${tag}: NO RESULT (timedOut=${outcome.timedOut}) ${outcome.error ?? ''}`);
    }

    if (doc) {
      await writeFile(
        join(outDir, `run-${String(job.index).padStart(3, '0')}-L${job.level}-${job.variant}.json`),
        JSON.stringify({ ...doc, meta: { ...doc.meta, gitCommit, policy: args.policy, fixedDt: args.fixedDt, wallMs } }, null, 2)
      );
    }
  }
  await context.close();
}

await Promise.all(
  Array.from({ length: Math.min(args.workers, plan.length) }, (_, i) => worker(i + 1))
);

const wallTotal = (Date.now() - wallStart) / 1000;
await browser.close();
await close();

// --- aggregation ---------------------------------------------------------

const stats = values => {
  const v = values.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = p => v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
  return {
    n: v.length, min: v[0], p50: at(50), p90: at(90), max: v[v.length - 1],
    mean: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100,
  };
};

const completed = results.filter(r => r.doc);
const shattered = completed.filter(r => r.doc.summary.outcome === 'SHATTER');
const fmt = s => (s ? `n=${s.n} min=${s.min} p50=${s.p50} p90=${s.p90} max=${s.max} mean=${s.mean}` : 'no data');

console.log('\n' + '='.repeat(72));
console.log(`BATCH SUMMARY   commit ${gitCommit}   policy ${args.policy}   dt ${args.fixedDt ?? 'real'}`);
console.log('='.repeat(72));
console.log(`runs planned      ${plan.length}`);
console.log(`runs completed    ${completed.length}`);
console.log(`shattered         ${shattered.length}  (${Math.round((shattered.length / plan.length) * 100)}%)`);
console.log(`timed out         ${results.filter(r => r.timedOut).length}`);
console.log(`runs with errors  ${results.filter(r => r.pageErrors.length).length}`);
console.log(`wall clock        ${wallTotal.toFixed(1)}s total, ${(wallTotal / plan.length).toFixed(1)}s per run`);
console.log('-'.repeat(72));
console.log(`hits to clear     ${fmt(stats(shattered.map(r => r.doc.summary.hitsToClear)))}`);
console.log(`time to clear (s) ${fmt(stats(shattered.map(r => r.doc.summary.timeToClearS)))}`);
console.log(`score             ${fmt(stats(shattered.map(r => r.doc.summary.score)))}`);
console.log(`peak speed        ${fmt(stats(completed.map(r => r.doc.summary.speed.max)))}`);
console.log(`p50 speed         ${fmt(stats(completed.map(r => r.doc.summary.speed.p50)))}`);
console.log(`damage p50        ${fmt(stats(completed.map(r => r.doc.summary.damage.p50)))}`);
console.log(`max combo         ${fmt(stats(completed.map(r => r.doc.summary.maxCombo)))}`);
console.log(`glancing hits     ${fmt(stats(completed.map(r => r.doc.summary.glancingHits)))}`);
console.log(`frame ms p95      ${fmt(stats(completed.map(r => r.doc.summary.frameMs.p95)))}`);
console.log(`long frames       ${fmt(stats(completed.map(r => r.doc.summary.longFrames)))}`);

// Per level x variant, since an aggregate over a mixed matrix hides the
// differences that matter for tuning.
console.log('-'.repeat(72));
console.log('per level/variant   n   hits(p50)  time(p50)  peakSpd(p50)  shatter%');
const groups = new Map();
for (const r of completed) {
  const key = `L${r.job.level} ${r.job.variant}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
for (const [key, rs] of [...groups].sort()) {
  const sh = rs.filter(r => r.doc.summary.outcome === 'SHATTER');
  const h = stats(sh.map(r => r.doc.summary.hitsToClear));
  const t = stats(sh.map(r => r.doc.summary.timeToClearS));
  const p = stats(rs.map(r => r.doc.summary.speed.max));
  console.log(
    `${key.padEnd(18)} ${String(rs.length).padStart(3)}  `
    + `${String(h?.p50 ?? '-').padStart(8)}  ${String(t?.p50 ?? '-').padStart(8)}  `
    + `${String(p?.p50 ?? '-').padStart(11)}  ${String(Math.round((sh.length / rs.length) * 100)).padStart(7)}%`
  );
}

const errorRuns = results.filter(r => r.pageErrors.length || r.error);
if (errorRuns.length) {
  console.log('-'.repeat(72));
  console.log('ERRORS');
  for (const r of errorRuns) {
    console.log(`  run ${r.job.index} L${r.job.level} ${r.job.variant}: ${[r.error, ...r.pageErrors].filter(Boolean).join(' | ')}`);
  }
}
console.log('='.repeat(72));

const indexPath = join(outDir, 'batch-summary.json');
await writeFile(indexPath, JSON.stringify({
  gitCommit, args, wallTotalS: wallTotal, planned: plan.length,
  completed: completed.length, shattered: shattered.length,
  aggregate: {
    hitsToClear: stats(shattered.map(r => r.doc.summary.hitsToClear)),
    timeToClearS: stats(shattered.map(r => r.doc.summary.timeToClearS)),
    peakSpeed: stats(completed.map(r => r.doc.summary.speed.max)),
    p50Speed: stats(completed.map(r => r.doc.summary.p50 ?? r.doc.summary.speed.p50)),
    damageP50: stats(completed.map(r => r.doc.summary.damage.p50)),
    frameMsP95: stats(completed.map(r => r.doc.summary.frameMs.p95)),
  },
  runs: results.map(r => ({
    ...r.job, outcome: r.doc?.summary.outcome ?? null,
    hitsToClear: r.doc?.summary.hitsToClear ?? null,
    timedOut: r.timedOut, errors: r.pageErrors.length, wallMs: r.wallMs,
  })),
}, null, 2));
console.log(`\nwrote ${completed.length} run files + batch-summary.json to ${outDir}`);
