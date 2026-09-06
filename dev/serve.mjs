// Dependency-free static server for the dev tooling.
//
// Used as a module by the Playwright runners, or standalone:
//   node dev/serve.mjs [port]
//
// The game is ES modules over HTTP, so a correct Content-Type on .js is not
// optional - a wrong MIME type makes the browser refuse the module outright.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Start a static server rooted at the project directory.
 * @param {number} port - 0 picks a free port, which is what the runners want
 *   so parallel batches never collide.
 * @returns {Promise<{server: import('node:http').Server, port: number, base: string, close: () => Promise<void>}>}
 */
export function startServer(port = 0, root = PROJECT_ROOT) {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
    // normalize() collapses traversal; anything still climbing out is refused
    if (rel.startsWith('..')) { res.writeHead(403).end('forbidden'); return; }
    try {
      const body = await readFile(join(root, rel));
      res.writeHead(200, {
        'Content-Type': MIME[extname(rel).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',  // a stale module between runs would be a nightmare to debug
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({
        server,
        port: actual,
        base: `http://127.0.0.1:${actual}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

// Standalone mode
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const { base } = await startServer(Number(process.argv[2]) || 8080);
  console.log(`serving ${PROJECT_ROOT}\n  ${base}\n  ${base}/?dev=1   (telemetry enabled)`);
}
