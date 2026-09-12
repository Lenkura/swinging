// Rope vs no-rope A/B (task 120).
//
//   node dev/ab.mjs                       all 9 levels, both variants, 3 seeds
//   node dev/ab.mjs --seeds 5 --levels 7,8,9
//
// Both arms run the SAME seeds on the SAME page, switching only
// setRopeSegments between them, on a fixed timestep. One variable, controlled:
// anything that differs is the rope.
//
// Bot swings are not human swings, so these numbers are valid for detecting
// what the rope changed, not for setting an absolute difficulty.

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer, PROJECT_ROOT } from './serve.mjs';

const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const LEVELS = arg('--levels', '1,2,3,4,5,6,7,8,9').split(',').map(Number);
const VARIANTS = arg('--variants', 'standard,heavy').split(',');
const SEED_COUNT = Number(arg('--seeds', 3));
const ROPE_N = Number(arg('--rope', 10));
const WORKERS = Number(arg('--workers', 4));
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => 500 + i * 37);

const jobs = [];
for (const level of LEVELS) {
  for (const variant of VARIANTS) {
    for (const seed of SEEDS) {
      for (const rope of [0, ROPE_N]) jobs.push({ level, variant, seed, rope });
    }
  }
}

let gitCommit = 'unknown';
try { gitCommit = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT }).toString().trim(); } catch {}

console.log(`A/B: ${jobs.length} runs (${LEVELS.length} levels x ${VARIANTS.length} variants x ${SEEDS.length} seeds x 2 arms)`);
console.log(`commit ${gitCommit}, rope=${ROPE_N}, fixed dt, ${WORKERS} workers\n`);

const { base, close } = await startServer();
const browser = await chromium.launch();
const queue = [...jobs];
const results = [];
const t0 = Date.now();

async function worker() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?dev=1&rope=${ROPE_N}`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ratsmash === 'object');

  while (queue.length) {
    const job = queue.shift();
    if (!job) break;
    const before = errors.length;
    const out = await page.evaluate(async o => {
      window.__ratsmash.setRopeSegments(o.rope);
      const r = await window.__ratsmash.runBot({
        level: o.level, variant: o.variant, seed: o.seed,
        policy: 'pump', fixedDt: 1 / 60, timeoutMs: 45000, source: 'ab',
      });
      const s = r.document?.summary;
      return s ? {
        cleared: s.outcome === 'SHATTER', hits: s.hitsToClear, t: s.timeToClearS,
        p50: s.speed.p50, peak: s.speed.max, glancing: s.glancingHits,
        damaging: s.damagingHits, contacts: s.ropeContacts,
        bendMax: s.ropeBend?.max ?? 0, bendMean: s.ropeBend?.mean ?? 0,
      } : { cleared: false, timedOut: r.timedOut };
    }, job);
    results.push({ ...job, ...out, errors: errors.length - before });
  }
  await page.close();
}
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, worker));
await browser.close();
await close();

// --- reporting -----------------------------------------------------------

const med = a => { const v = a.filter(n => Number.isFinite(n)).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
const fmt = n => n == null ? '  -' : (Math.round(n * 10) / 10).toString();
const arm = (rope, filter = () => true) => results.filter(r => r.rope === rope && filter(r));
const stat = rows => {
  const cl = rows.filter(r => r.cleared);
  const glancePct = cl.length ? cl.reduce((a, r) => a + (r.damaging ? r.glancing / r.damaging : 0), 0) / cl.length * 100 : null;
  return {
    n: rows.length, clearPct: rows.length ? (cl.length / rows.length) * 100 : 0,
    hits: med(cl.map(r => r.hits)), t: med(cl.map(r => r.t)),
    p50: med(cl.map(r => r.p50)), peak: med(cl.map(r => r.peak)),
    glancePct, contacts: med(rows.map(r => r.contacts)), bend: med(rows.map(r => r.bendMax)),
  };
};

const line = '-'.repeat(94);
console.log('\n' + '='.repeat(94));
console.log(`ROPE vs NO-ROPE   commit ${gitCommit}   ${((Date.now() - t0) / 1000).toFixed(0)}s wall`);
console.log('='.repeat(94));

const A = stat(arm(0)), B = stat(arm(ROPE_N));
const delta = (a, b) => (a == null || b == null) ? '   -' : ((b - a) >= 0 ? '+' : '') + (Math.round((b - a) * 10) / 10);
const pct = (a, b) => (a == null || b == null || a === 0) ? '  -' : ((b - a) / a >= 0 ? '+' : '') + Math.round(((b - a) / a) * 100) + '%';

console.log('metric              no-rope      rope     delta     rel');
console.log(line);
for (const [label, key] of [['clear rate %', 'clearPct'], ['hits to clear', 'hits'], ['time to clear s', 't'],
                            ['sustained p50', 'p50'], ['peak speed', 'peak'], ['glancing %', 'glancePct'],
                            ['rope contacts', 'contacts'], ['peak bend rad', 'bend']]) {
  console.log(`${label.padEnd(18)} ${fmt(A[key]).padStart(7)}   ${fmt(B[key]).padStart(7)}   ${delta(A[key], B[key]).toString().padStart(7)}   ${pct(A[key], B[key]).padStart(5)}`);
}

console.log('\nPER LEVEL (median hits to clear / clear rate)');
console.log('lvl        no-rope          rope           delta   contacts(rope)');
console.log(line);
for (const level of LEVELS) {
  const a = stat(arm(0, r => r.level === level));
  const b = stat(arm(ROPE_N, r => r.level === level));
  console.log(
    `L${String(level).padEnd(3)} ${fmt(a.hits).padStart(6)} (${String(Math.round(a.clearPct)).padStart(3)}%)   `
    + `${fmt(b.hits).padStart(6)} (${String(Math.round(b.clearPct)).padStart(3)}%)   `
    + `${delta(a.hits, b.hits).toString().padStart(6)}   ${fmt(b.contacts).padStart(8)}`
  );
}

console.log('\nPER VARIANT');
for (const v of VARIANTS) {
  const a = stat(arm(0, r => r.variant === v)), b = stat(arm(ROPE_N, r => r.variant === v));
  console.log(`  ${v.padEnd(9)} hits ${fmt(a.hits)} -> ${fmt(b.hits)}   clear ${Math.round(a.clearPct)}% -> ${Math.round(b.clearPct)}%   p50 ${fmt(a.p50)} -> ${fmt(b.p50)}`);
}

const failures = results.filter(r => !r.cleared);
if (failures.length) {
  console.log(`\nNON-CLEARING RUNS: ${failures.length}`);
  const byArm = {};
  for (const f of failures) { const k = `rope=${f.rope}`; byArm[k] = (byArm[k] || 0) + 1; }
  console.log('  ' + JSON.stringify(byArm));
  for (const f of failures.slice(0, 10)) console.log(`    L${f.level} ${f.variant} seed ${f.seed} rope=${f.rope} timedOut=${f.timedOut}`);
}
const errored = results.filter(r => r.errors > 0);
console.log(`\nruns with page errors: ${errored.length}`);
console.log('='.repeat(94));

const outDir = join(PROJECT_ROOT, 'dev', 'runs');
await mkdir(outDir, { recursive: true });
const outPath = join(outDir, `ab-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await writeFile(outPath, JSON.stringify({ gitCommit, ropeN: ROPE_N, seeds: SEEDS, levels: LEVELS, variants: VARIANTS, overall: { noRope: A, rope: B }, results }, null, 2));
console.log(`wrote ${outPath}`);
