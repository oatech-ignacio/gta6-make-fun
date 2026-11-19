// Captures the entry's screenshots from the real game: serves game/ with node:http, opens the deterministic
// screenshot mode (index.html?shot=<name>&seed=1) in headless system Chrome and writes JPEGs to screenshots/.
//
//   npm install --no-save playwright-core
//   node tools/take-screenshots.mjs [--only chase,street] [--out .tools/shots] [--query "shot=chase&seed=1&hour=19"]
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('../game', import.meta.url)));
const repo = resolve(root, '..');
const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const outDir = resolve(repo, argValue('--out', 'screenshots'));
const only = argValue('--only', '');
const customQuery = argValue('--query', '');
const MAX_BYTES = 240 * 1024;

const SHOTS = [
  { file: '1-chase.jpg', name: 'chase' },
  { file: '2-street.jpg', name: 'street' },
  { file: '3-mission.jpg', name: 'mission' },
  { file: '4-map.jpg', name: 'map' },
];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

function startStaticServer() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(root, path === '/' ? 'index.html' : path));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function captureShot(page, base, shot) {
  const query = customQuery || `shot=${shot.name}&seed=1`;
  await page.goto(`${base}/index.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__shotReady === true', null, { timeout: 180000 });
  await page.waitForTimeout(400);
  let quality = 84, buffer;
  do {
    buffer = await page.screenshot({ type: 'jpeg', quality });
    quality -= 6;
  } while (buffer.length > MAX_BYTES && quality > 30);
  const target = join(outDir, shot.file);
  writeFileSync(target, buffer);
  console.log(`${shot.file}  ${(buffer.length / 1024).toFixed(1)} KiB  (quality ${quality + 6})`);
}

const server = await startStaticServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--hide-scrollbars'],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => { failed = true; console.log(`[page error] ${e.message}\n${e.stack || ''}`); });
  page.on('requestfailed', (r) => console.log(`[request failed] ${r.url()}`));
  for (const shot of SHOTS) {
    if (only && !only.split(',').includes(shot.name)) continue;
    await captureShot(page, base, customQuery ? { ...shot, file: argValue('--file', shot.file) } : shot);
    if (customQuery) break;
  }
} catch (err) {
  failed = true; console.error(err.message);
} finally {
  await browser.close(); server.close();
}
process.exit(failed ? 1 : 0);
