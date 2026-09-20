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
// Safe to import in Node: levels.js has no module-scope dependencies, and its
// localStorage use is inside functions this never calls.
import { LEVELS } from '../js/levels.js';

const headed = process.argv.includes('--headed');
const FIXED_DT = 1 / 60;

// Seeded, fixed-dt cases. Bounds are deliberately wide: the gate catches
// regressions, it does not enforce balance. Tightening these into balance
// assertions would make every intentional tuning change look like a failure.
// yankEvery models a competent player, and every case yanks.
//
// Cases are chosen by PURPOSE - the mechanic each one exercises - and pinned to
// a level id only through that purpose. They were once "L4 = shields, L7 =
// bumpers, L8 = needs the yank", and the 2026-09-19 re-lay (LAYOUT_VERSION 2)
// moved every one of those mechanics to a different id. Seeds are the ones
// probed to SHATTER deterministically at fixed dt; a seed is part of the case.
//
// There is no longer a "needs the yank" case. The nine-level L8 was unwinnable
// without yanking (6/6 failures), which proved the yank worked by the level
// being impossible otherwise. Nothing in layout 2 needs it - Deflector cleared
// 4/4 seeds and the finale 3/3 with no yank at all - so the yank path is
// asserted DIRECTLY instead: every case must register yanks (see the checks).
const CASES = [
  { purpose: 'the swing',        level: 1,  variant: 'standard', seed: 42,  maxHits: 30, yankEvery: 1.5 },
  { purpose: 'the swing, heavy', level: 1,  variant: 'heavy',    seed: 42,  maxHits: 30, yankEvery: 1.5 },
  { purpose: 'shield gate',      level: 8,  variant: 'standard', seed: 42,  maxHits: 45, yankEvery: 1.5, needsShieldBreak: true },
  { purpose: 'bumper',           level: 11, variant: 'standard', seed: 7,   maxHits: 45, yankEvery: 1.5 },
  { purpose: 'blade, uncut',     level: 12, variant: 'standard', seed: 7,   maxHits: 45, yankEvery: 1.5 },
  // The movement zone. This slot held the L12 finale until its floor blade was
  // made deliberately lethal (the bot loses 8/8 there by design), then L9, the
  // mixed zone+shield level - which FAILED the gate twice after passing once,
  // the bot ending at rest with 24k rope contacts inside that narrow column.
  // A case that flaky asserts nothing, and L9 is where the bot is weakest
  // (3 of 4 timeouts in an earlier batch) while humans cleared it 6/6. L6 is
  // the zone in its simplest form and cleared in 3-4s in every probe.
  { purpose: 'movement zone',    level: 7,  variant: 'standard', seed: 7,   maxHits: 45, yankEvery: 1.5 },
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
  // A dead CDN tag is invisible to 'pageerror': a 404'd script is a failed
  // resource, not an exception. poly-decomp 404'd on every page load for two
  // months (task 100) with this gate green throughout.
  const failedLoads = [];
  page.on('response', r => { if (r.status() >= 400) failedLoads.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => failedLoads.push(`${r.failure()?.errorText} ${r.url()}`));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('#ls-grid', { state: 'visible' });
  check('every resource on page load succeeds', failedLoads.length === 0, failedLoads.join(' | '));

  const levelButtons = await page.locator('#ls-grid button').count();
  check(`level select renders all ${LEVELS.length} levels`, levelButtons === LEVELS.length, `${levelButtons}`);

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
  // The rat now starts on the ground and must be picked up by the tail before
  // the game will run at all, so the non-dev path has to perform the grab. The
  // position is computable rather than observed because the pre-grab pose is
  // frozen (physics.js freezeForGrab): rat at pivot.x, tail base 0.85r to its
  // left, tip one rope-length beyond that. This path has no harness to ask.
  // Derived from the level data rather than copied from it. These were once
  // hardcoded as 0.22 / 130, and re-laying Act 1 silently invalidated them -
  // caught only because the HP-drop assertion below is a positive check. A copy
  // of a value the artifact already holds is a copy that will drift.
  const L1 = LEVELS.find(l => l.id === 1);
  const RAT_R = 18, GROUND_INSET = 40;   // standard variant; drawGround's inset
  const tipX = L1.pivot.x * 1100 - RAT_R * 0.85 + (L1.pushStringLength || L1.stringLength);
  const tipY = 620 - GROUND_INSET - RAT_R + RAT_R * 0.22;
  await page.mouse.click(
    rect.left + tipX * (rect.width / 1100),
    rect.top + tipY * (rect.height / 620)
  );
  await page.waitForTimeout(120);

  // What the non-dev path actually needs to prove is that the seam - a
  // top-level await, a dynamic import and no-op call sites - did not break
  // the shipped game. That fails as an exception or a frozen frame, so
  // "the canvas is still animating in response to input" is the invariant.
  //
  // Sampled BEFORE the sweep, not after. Since DAMAGE_SCALE dropped to 80 the
  // sweep usually lands enough hits to shatter the rat outright (HP drop was
  // 1.9-49%, now routinely 100%), and the RESULT screen it ends on is
  // legitimately static - sampling there failed ~43% of runs for no real fault.
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

  // This one IS asserted, unlike the drop magnitude above, because the grab is
  // a hard prerequisite: a frozen rat cannot take a single hit, so any HP loss
  // at all proves the pick-up was accepted. It is the positive invariant for the
  // new mandatory affordance (L0101) - a silently missed grab would otherwise
  // leave every check below passing against a game that never started.
  check('tail grab started the game (HP dropped at all)', hpAfter < hpBefore - 0.001,
    `${hpBefore.toFixed(3)} -> ${hpAfter.toFixed(3)}`);

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
  // The level grid renders before main.js finishes awaiting its dynamic import
  // of the harness, so waiting on the grid alone is a race.
  const harnessReady = await page
    .waitForFunction(() => typeof window.__ratsmash === 'object', null, { timeout: 10000 })
    .then(() => true).catch(() => false);
  check('harness installs under ?dev=1', harnessReady);

  for (const c of CASES) {
    console.log(`\n[L${c.level} ${c.variant} seed=${c.seed} - ${c.purpose}]`);
    const before = errors.length;

    // Spawn invariants, checked mid-run rather than inferred from the result
    await page.evaluate(o => window.__ratsmash.beginRun(o), { ...c, source: 'gate' });
    await page.waitForTimeout(200);
    const spawn = await page.evaluate(() => window.__ratsmash.state());
    check('rat body exists after start', Boolean(spawn.rat), spawn.rat ? `at ${Math.round(spawn.rat.x)},${Math.round(spawn.rat.y)}` : 'null');
    check('targets spawned', spawn.targets.length > 0, `${spawn.targets.length}`);
    check('HP starts at max', spawn.hp === spawn.maxHp, `${spawn.hp}/${spawn.maxHp}`);
    check('telemetry is recording', spawn.recording === true);
    check('rope is the default tail', spawn.rope.length > 0, `${spawn.rope.length} segments`);

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
    // The yank is the only way to free a snagged tail; with no level left that
    // is unwinnable without it, this is what proves the input still lands.
    if (c.yankEvery > 0) check('yank input registered', s.yanks > 0, `${s.yanks}`);
    // A gate level cannot be won without a break, so SHATTER implies one - but
    // asserted separately so a failure names the shield path, not "no shatter".
    if (c.needsShieldBreak) {
      check('a shield was broken', s.shieldBreaks > 0, `${s.shieldBreaks}`);
      // The caged target cannot legitimately be hit until a panel is gone, so a
      // damaging hit before the first break means the rat crossed a 14px panel
      // inside one step. That happened in 3 of 16 bot runs before sweepRat.
      const brk = (doc.hits || []).filter(h => h.kind === 'shield-break').map(h => h.t);
      const firstBreak = brk.length ? Math.min(...brk) : Infinity;
      const early = (doc.hits || []).filter(h => h.kind === 'damage' && h.t < firstBreak);
      check('nothing reached the caged target through its cage',
        early.length === 0, early.map(h => `t=${h.t} @${Math.round(h.speed)}px/step`).join(' '));
    }

    // Giblets (tasks 101-103): bodies spawn, carry piece types, and land.
    const post = await page.evaluate(() => window.__ratsmash.state());
    const types = new Set(post.fragmentPieces);
    check('fragments spawned on shatter', post.fragments > 0, `${post.fragments}`);
    check('fragments carry piece types', !types.has('none') && types.size > 0, [...types].join(','));
    check('bone/organ/gut all present', ['bone', 'organ', 'gut'].every(t => types.has(t)), [...types].join(','));

    check('no page errors', errors.length === before, errors.slice(before).join(' | '));
  }

  // --- Arena containment ---------------------------------------------------
  // The rat gets no continuous collision (only the rope is swept), so nothing
  // keeps it inside except geometry thicker than it can cross in one step, and
  // there was no ceiling at all until 2026-09-16 - the rat was observed leaving
  // the top of the canvas at y = -21.
  //
  // This is asserted STRUCTURALLY, not behaviourally. A first version whipped
  // the hand at the boundaries and watched the rat's position, and it passed
  // with the ceiling deliberately removed: the escape had taken 90 iterations to
  // reproduce and the check ran 80. A containment test that can pass while the
  // containment is missing is worse than none, so what is asserted is that the
  // bodies exist and are thicker than anything can cross in one step. The whip
  // is kept below as an INFO line, on the same footing as the HP-drop report.
  {
    console.log('\n[arena containment]');
    await page.evaluate(o => window.__ratsmash.beginRun(o),
      // Any level serves the structural checks, but the whip below needs one
      // WITHOUT a handZone, or the zone clamps the hand before it reaches a wall.
      { level: 13, variant: 'heavy', source: 'gate', seed: 1 });
    await page.waitForTimeout(250);

    const w = await page.evaluate(() => window.__ratsmash.state().world);
    // Measured rat peaks run 250-460 px/step, so anything thinner than that can
    // be crossed in a single step. The old 50px walls were far under it.
    const MIN_THICKNESS = 500;
    check('ceiling exists (the rat left through the top without one)', w.hasCeiling);
    check('ground and side walls exist', w.hasGround && w.hasWalls);
    check('every boundary is thicker than one step of travel',
      w.ceiling.h >= MIN_THICKNESS && w.leftWall.w >= MIN_THICKNESS && w.rightWall.w >= MIN_THICKNESS,
      `ceiling ${w.ceiling.h}  walls ${w.leftWall.w}/${w.rightWall.w}  (min ${MIN_THICKNESS})`);

    const rect = await page.evaluate(() => {
      const r = document.getElementById('game-canvas').getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const to = (cx, cy) => [rect.left + cx * (rect.width / 1100), rect.top + cy * (rect.height / 620)];
    const corners = [[40, 60], [1060, 60], [40, 540], [1060, 540]];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 100; i++) {
      await page.mouse.move(...to(...corners[i % 4]));
      const r = await page.evaluate(() => window.__ratsmash.state().rat);
      if (r) {
        minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x);
        minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y);
      }
    }
    const inside = minX >= 0 && maxX <= 1100 && minY >= 0 && maxY <= 620;
    console.log(`  INFO  whip test: rat reached x ${minX.toFixed(0)}..${maxX.toFixed(0)} ` +
                `y ${minY.toFixed(0)}..${maxY.toFixed(0)} - ${inside ? 'inside' : 'ESCAPED'}`);
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
