// Regression gate - the fast pass/fail to run after a change.
//
//   npm run gate          (or: node dev/gate.mjs)
//   node dev/gate.mjs --headed
//
// Exit 0 = every invariant held. Exit 1 = something regressed.
//
// These are POSITIVE invariants, not absence-of-crash: a silently dead
// wiring path produces no error at all, and a gate that only watches for
// exceptions would pass straight over it (L0101). Runs use a fixed timestep
// so a failure means a real change, not frame-timing noise.

import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const headed = process.argv.includes('--headed');
const FIXED_DT = 1 / 60;

// Seeded, fixed-dt cases. Bounds are deliberately wide: the gate catches
// regressions, it does not enforce balance. Tightening these into balance
// assertions would make every intentional tuning change look like a failure.
const CASES = [
  { level: 1, variant: 'standard', seed: 42, maxHits: 25 },
  { level: 1, variant: 'heavy', seed: 42, maxHits: 25 },
  { level: 4, variant: 'standard', seed: 7, maxHits: 40 },  // Act 2 - shields
  { level: 7, variant: 'standard', seed: 7, maxHits: 40 },  // Act 3 - bumpers
];

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const { base, close } = await startServer();
const browser = await chromium.launch({ headless: !headed });
const t0 = Date.now();

// --- non-dev play --------------------------------------------------------
// Runs first and without the flag: if the dev seam broke the shipped path,
// nothing else is worth knowing.
{
  console.log('\n[non-dev] the game as a player gets it');
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('#ls-grid', { state: 'visible' });

  const levelButtons = await page.locator('#ls-grid button').count();
  check('level select renders 9 levels', levelButtons === 9, `${levelButtons}`);

  const globals = await page.evaluate(() => ({
    t: typeof window.__ratsmashTelemetry, h: typeof window.__ratsmash,
  }));
  check('no dev globals without ?dev=1', globals.t === 'undefined' && globals.h === 'undefined', JSON.stringify(globals));

  await page.locator('#ls-grid button').first().click();
  await page.waitForSelector('#rat-picker', { state: 'visible' });
  await page.locator('#start-btn').click();
  await page.waitForTimeout(300);

  const readHp = () => page.evaluate(() => {
    const c = document.getElementById('game-canvas');
    const px = c.getContext('2d').getImageData(c.width - 180, c.height - 62, 160, 1).data;
    let filled = 0;
    for (let i = 0; i < 160; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (Math.max(r, g, b) > 90 && Math.max(r, g, b) - Math.min(r, g, b) > 40) filled++;
    }
    return filled / 160;
  });

  const hpBefore = await readHp();
  const rect = await page.evaluate(() => {
    const r = document.getElementById('game-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  // Amplitude and centre are aimed at Level 1's target (x=726); a sweep that
  // only spans 140-660 never connects and makes this check flaky.
  const swingStart = Date.now();
  while (Date.now() - swingStart < 16000) {
    const ph = ((Date.now() - swingStart) / 1000) * 1.1;
    await page.mouse.move(
      rect.left + (520 + Math.sin(ph * Math.PI * 2) * 270) * (rect.width / 1100),
      rect.top + (300 + Math.cos(ph * Math.PI * 2) * 40) * (rect.height / 620)
    );
    await page.waitForTimeout(16);
  }
  const hpAfter = await readHp();

  check('HP bar starts full', hpBefore > 0.9, hpBefore.toFixed(3));

  // HP drop is REPORTED, not asserted. Landing hits needs closed-loop
  // steering, which is impossible here by design - the harness is absent
  // without the flag - so this open-loop sweep connects by luck: observed
  // 1.9%, 49%, 7.5% and 3.1% across runs of the same code. Any threshold
  // would be fitting the check to that noise. The hit path itself is covered
  // by the four seeded bot cases below, which execute the same handler.
  console.log(`  INFO  HP drop this run: ${hpBefore.toFixed(3)} -> ${hpAfter.toFixed(3)}`);

  // What the non-dev path actually needs to prove is that the seam - a
  // top-level await, a dynamic import and no-op call sites - did not break
  // the shipped game. That fails as an exception or a frozen frame, so
  // "the canvas is still animating in response to input" is the invariant.
  const frameHash = () => page.evaluate(() => {
    const c = document.getElementById('game-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 997 * 4) h = (h * 31 + d[i] + d[i + 1] * 3) | 0;
    return h;
  });
  const h1 = await frameHash();
  await page.mouse.move(rect.left + 300 * (rect.width / 1100), rect.top + 200 * (rect.height / 620));
  await page.waitForTimeout(400);
  const h2 = await frameHash();
  check('canvas animates under input (seam did not freeze the game)', h1 !== h2, `${h1} vs ${h2}`);
  check('no page errors in non-dev play', errors.length === 0, errors.join(' | '));
  await page.close();
}

// --- bot cases -----------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?dev=1`, { waitUntil: 'load' });
  await page.waitForSelector('#ls-grid', { state: 'visible' });
  check('harness installs under ?dev=1', await page.evaluate(() => typeof window.__ratsmash === 'object'));

  for (const c of CASES) {
    console.log(`\n[L${c.level} ${c.variant} seed=${c.seed}]`);
    const before = errors.length;

    // Spawn invariants, checked mid-run rather than inferred from the result
    await page.evaluate(o => window.__ratsmash.beginRun(o), { ...c, source: 'gate' });
    await page.waitForTimeout(200);
    const spawn = await page.evaluate(() => window.__ratsmash.state());
    check('rat body exists after start', Boolean(spawn.rat), spawn.rat ? `at ${Math.round(spawn.rat.x)},${Math.round(spawn.rat.y)}` : 'null');
    check('targets spawned', spawn.targets.length > 0, `${spawn.targets.length}`);
    check('HP starts at max', spawn.hp === spawn.maxHp, `${spawn.hp}/${spawn.maxHp}`);
    check('telemetry is recording', spawn.recording === true);

    // Fail fast: with no rat or no targets the run cannot possibly finish,
    // and waiting out the deadline turns a broken build into a 6-minute gate.
    if (!spawn.rat || spawn.targets.length === 0) {
      check('run is attemptable', false, 'skipped - spawn invariants already failed');
      continue;
    }

    const res = await page.evaluate(
      o => window.__ratsmash.runBot(o),
      { ...c, policy: 'pump', fixedDt: FIXED_DT, timeoutMs: 90000, source: 'gate' }
    );
    const doc = res.document;

    if (!doc) {
      check(`run completes within deadline`, false, `timedOut=${res.timedOut} live=${JSON.stringify(res.liveSnapshot)}`);
      continue;
    }
    const s = doc.summary;
    check('run completes', !res.timedOut, `${s.timeToClearS}s`);
    check('outcome is SHATTER', s.outcome === 'SHATTER', String(s.outcome));
    check('damaging hits recorded', s.damagingHits > 0, `${s.damagingHits}`);
    check('damage is non-zero', s.damage.max > 0, `max ${s.damage.max}`);
    check('speed sampled while swinging', s.speed.n > 0 && s.speed.max > 0, `n=${s.speed.n} peak=${s.speed.max}`);
    check('score is positive', s.score > 0, `${s.score}`);
    check(`hits within sane bound`, s.hitsToClear > 0 && s.hitsToClear <= c.maxHits, `${s.hitsToClear} (max ${c.maxHits})`);
    check('no errors captured in run', s.errors === 0, `${s.errors}`);

    // Giblets (tasks 101-103): bodies spawn, carry piece types, and land.
    const post = await page.evaluate(() => window.__ratsmash.state());
    const types = new Set(post.fragmentPieces);
    check('fragments spawned on shatter', post.fragments > 0, `${post.fragments}`);
    check('fragments carry piece types', !types.has('none') && types.size > 0, [...types].join(','));
    check('bone/organ/gut all present', ['bone', 'organ', 'gut'].every(t => types.has(t)), [...types].join(','));

    check('no page errors', errors.length === before, errors.slice(before).join(' | '));
  }
  await page.close();
}

await browser.close();
await close();

const failed = checks.filter(c => !c.pass);
console.log('\n' + '='.repeat(60));
console.log(`GATE: ${checks.length - failed.length}/${checks.length} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(`  - ${f.name}  ${f.detail}`);
}
console.log('='.repeat(60));
process.exit(failed.length ? 1 : 0);
