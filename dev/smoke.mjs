// Task 105 - throwaway Playwright platform smoke test.
// Proves Chromium installs and drives this game on this machine before any
// tooling is built on top of it (L0079). Self-contained on purpose: an inline
// static server rather than dev/serve.mjs, so a failure here implicates
// Playwright and nothing of ours.
//
//   node dev/smoke.mjs
//
// Exit 0 = approach B is viable. Exit 1 = stop and reconsider.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',  // ES modules are refused without this
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
    if (rel.startsWith('..')) { res.writeHead(403).end('forbidden'); return; }
    try {
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const { server, port } = await startServer();
const base = `http://127.0.0.1:${port}`;
console.log(`[smoke] serving ${ROOT} at ${base}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Collect everything the page complains about - the smoke test should report
// the page's real health, not just that a screenshot was produced.
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(e.message));
page.on('requestfailed', r => failedRequests.push(`${r.url()} - ${r.failure()?.errorText}`));

let ok = true;
try {
  // 'load', not 'networkidle' (L0052)
  await page.goto(base, { waitUntil: 'load' });

  // Positive invariants, not absence-of-crash (L0101): the level grid must
  // actually be populated, which only happens if the ES modules executed.
  await page.waitForSelector('#ls-grid', { state: 'visible', timeout: 10000 });
  const levelButtons = await page.locator('#ls-grid button').count();
  const matterLoaded = await page.evaluate(() => typeof window.Matter !== 'undefined');
  const canvasSize = await page.evaluate(() => {
    const c = document.getElementById('game-canvas');
    return c ? { w: c.width, h: c.height } : null;
  });

  console.log(`[smoke] level buttons rendered : ${levelButtons}`);
  console.log(`[smoke] window.Matter present  : ${matterLoaded}`);
  console.log(`[smoke] canvas backing store   : ${canvasSize ? `${canvasSize.w}x${canvasSize.h}` : 'MISSING'}`);

  await page.screenshot({ path: join(ROOT, 'dev', 'smoke-levelselect.png') });
  console.log('[smoke] screenshot -> dev/smoke-levelselect.png');

  if (levelButtons !== 9) { console.error(`[smoke] FAIL expected 9 level buttons, got ${levelButtons}`); ok = false; }
  if (!matterLoaded) { console.error('[smoke] FAIL Matter.js did not load'); ok = false; }
  if (!canvasSize) { console.error('[smoke] FAIL canvas missing'); ok = false; }
} catch (err) {
  console.error(`[smoke] FAIL ${err.message}`);
  ok = false;
} finally {
  await browser.close();
  server.close();
}

// Reported, not fatal: the known poly-decomp 404 (task 100) lives here, and
// the smoke test's job is to prove Playwright works, not to gate on that.
if (pageErrors.length) console.log(`[smoke] page errors (${pageErrors.length}):\n  ` + pageErrors.join('\n  '));
if (consoleErrors.length) console.log(`[smoke] console errors (${consoleErrors.length}):\n  ` + consoleErrors.join('\n  '));
if (failedRequests.length) console.log(`[smoke] failed requests (${failedRequests.length}):\n  ` + failedRequests.join('\n  '));

console.log(ok ? '[smoke] PASS - Playwright drives the game on this platform' : '[smoke] FAIL');
process.exit(ok ? 0 : 1);
