// Perceptual capture rig - drive the game to specific moments and screenshot
// them for human review.
//
//   node dev/shots.mjs                    both variants, shatter sequence
//   node dev/shots.mjs --level 4
//   node dev/shots.mjs --out some/dir
//
// Writes into history/screenshots/ (committed on purpose). The previous set
// was captured to a session temp directory and lost; anything meant for
// sign-off belongs in the repo.
//
// Automated tests verify the mechanism, never the experience (L0069) - these
// images exist to be looked at by a person, not asserted on.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer, PROJECT_ROOT } from './serve.mjs';

const argv = process.argv.slice(2);
const arg = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : dflt;
};
const level = Number(arg('--level', 1));
const outDir = join(PROJECT_ROOT, arg('--out', join('history', 'screenshots')));
const variants = arg('--variants', 'standard,heavy').split(',');

await mkdir(outDir, { recursive: true });

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT }).toString().trim();
} catch { /* fine */ }

const { base, close } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

await page.goto(`${base}/?dev=1`, { waitUntil: 'load' });
await page.waitForSelector('#ls-grid', { state: 'visible' });

const shot = async name => {
  const file = join(outDir, name);
  // Clip to the canvas: page chrome is not what anyone is reviewing.
  const box = await page.locator('#game-canvas').boundingBox();
  await page.screenshot({ path: file, clip: box });
  console.log(`  ${name}`);
  return file;
};

const captured = [];

for (const variant of variants) {
  console.log(`\n[${variant}] level ${level}`);

  // Fixed dt + fixed seed so a re-run produces a comparable image rather
  // than a different scatter every time.
  await page.evaluate(
    o => window.__ratsmash.beginRun(o),
    { level, variant, seed: 2026, source: 'shots' }
  );
  await page.evaluate(() => window.__ratsmash.setFixedDt(1 / 60));
  await page.waitForTimeout(400);
  captured.push(await shot(`L${level}-${variant}-01-start.png`));

  // Drive with the pump policy until HP crosses each damage-state threshold,
  // capturing on the way down - the four states are the thing under review.
  const thresholds = [
    { at: 0.70, name: '02-dazed' },
    { at: 0.45, name: '03-injured' },
    { at: 0.20, name: '04-critical' },
  ];

  const runPromise = page.evaluate(
    o => window.__ratsmash.runBot(o),
    { level, variant, seed: 2026, policy: 'pump', fixedDt: 1 / 60, timeoutMs: 90000, source: 'shots' }
  );

  for (const th of thresholds) {
    const reached = await page
      .waitForFunction(
        frac => {
          const s = window.__ratsmash.state();
          return s.hp / s.maxHp <= frac || !s.recording;
        },
        th.at,
        { timeout: 60000, polling: 16 }
      )
      .then(() => true)
      .catch(() => false);
    if (!reached) { console.log(`  (never reached ${th.name})`); continue; }
    const stillRunning = await page.evaluate(() => window.__ratsmash.state().recording);
    if (!stillRunning) { console.log(`  (run ended before ${th.name})`); break; }
    captured.push(await shot(`L${level}-${variant}-${th.name}.png`));
  }

  // The shatter itself: catch it while the giblets are still in the air, then
  // again once they have landed and painted their splats.
  await page.waitForFunction(() => window.__ratsmash.state().fragments > 0, null, { timeout: 60000, polling: 16 })
    .catch(() => console.log('  (no fragments observed)'));
  captured.push(await shot(`L${level}-${variant}-05-shatter-airborne.png`));

  await page.waitForFunction(
    () => {
      const s = window.__ratsmash.state();
      return s.fragments > 0 && s.fragmentsLanded >= Math.ceil(s.fragments / 2);
    },
    null,
    { timeout: 10000, polling: 16 }
  ).catch(() => console.log('  (giblets did not all land in time)'));
  captured.push(await shot(`L${level}-${variant}-06-giblets-landed.png`));

  const res = await runPromise;
  const s = res.document?.summary;
  console.log(`  run: ${s?.outcome} in ${s?.hitsToClear} hits`
    + `, ${res.document?.series.t.length ?? 0} series points`);

  const state = await page.evaluate(() => window.__ratsmash.state());
  console.log(`  giblets: ${state.fragments} pieces [${[...new Set(state.fragmentPieces)].join(', ')}]`
    + `, ${state.fragmentsLanded} landed`);

  await page.waitForTimeout(400);
  captured.push(await shot(`L${level}-${variant}-07-result.png`));
  await page.evaluate(() => window.__ratsmash.state());
}

await browser.close();
await close();

await writeFile(join(outDir, 'README.md'),
  `# Screenshots\n\nGenerated by \`node dev/shots.mjs\` at commit \`${gitCommit}\` `
  + `on ${new Date().toISOString().slice(0, 10)}.\n\n`
  + `Level ${level}, variants: ${variants.join(', ')}. Seed 2026, fixed 1/60 timestep, `
  + `so a re-run is comparable image-for-image.\n\n`
  + `These are for human perceptual review - automated tests verify the mechanism, `
  + `not the experience.\n\n`
  + captured.map(f => `- ${f.split(/[\\/]/).pop()}`).join('\n') + '\n');

console.log(`\nwrote ${captured.length} screenshots to ${outDir}`);
if (pageErrors.length) {
  console.log(`page errors (${pageErrors.length}):\n  ${pageErrors.join('\n  ')}`);
  process.exit(1);
}
