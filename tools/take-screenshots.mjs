// Job: capture the entry's screenshots from the real game. Serves game/ with node:http, opens the deterministic
// screenshot mode (index.html?shot=<name>&seed=1) in headless system Chrome and writes JPEGs to screenshots/.
//
//   npm install --no-save playwright-core
//   node tools/take-screenshots.mjs [--only chase,onfoot] [--out .tools/shots] [--query "shot=chase&seed=1&hour=19"]
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
  { file: '2-onfoot.jpg', name: 'onfoot' },
  { file: '3-race.jpg', name: 'race' },
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
  const checks = await page.evaluate(async (name) => {
    const g = window.__game;
    const visible = (el) => el && !el.closest('.hidden') && el.getBoundingClientRect().width > 0;
    const errors = [];
    const pairs = [['mission-banner', 'radio-banner'], ['radio-banner', 'hud-topright'],
      ['weapon-bar', 'vehicle-panel'], ['weapon-bar', 'foot-panel'], ['dialogue', 'hud-bottomright'],
      ['objective', 'hud-bottomright'], ['dialogue', 'objective'], ['progress-wrap', 'dialogue'],
      ['police-panel', 'crew-panel'], ['crew-panel', 'weapon-bar'], ['crew-panel', 'hud-bottomright'], ['race-hud', 'hud-topright'], ['race-hud', 'mission-banner'], ['notifications', 'minimap-frame']];
    for (const [a, b] of pairs) {
      const ea = document.getElementById(a), eb = document.getElementById(b);
      if (!visible(ea) || !visible(eb)) continue;
      const x = ea.getBoundingClientRect(), y = eb.getBoundingClientRect();
      if (Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1) errors.push(`${a} overlaps ${b}`);
    }
    if (name === 'chase' && (!g.player.vehicle || g.wanted.stars !== 4 || !g.helicopter?.active)) errors.push('incomplete chase state');
    if (name === 'chase' && (g.vehicles.filter((v) => v.isPolice && v.siren).length < 5 || document.querySelectorAll('#crew-panel .cw').length !== 3)) errors.push('chase needs five cruisers and the crew panel');
    if (name === 'race' && (!g.player.vehicle || document.getElementById('race-hud').classList.contains('hidden') || g.vehicles.filter((v) => v.ai && v.ai.mode === 'racer').length !== 3)) errors.push('incomplete race state');
    if (name === 'onfoot' && (g.player.vehicle || g.wanted.stars !== 2 || g.activeMission?.step.type !== 'eliminate')) errors.push('incomplete gunfight state');
    if (name === 'map' || name === 'start') {
      const selector = name === 'map' ? '#pause-map .slot' : '#start-screen .slot';
      const slots = [...document.querySelectorAll(selector)];
      if (slots.length !== 3 || slots.filter((s) => s.classList.contains('empty')).length !== 1) errors.push('expected two saves and one empty slot');
      for (const slot of slots) if (slot.getBoundingClientRect().bottom > 647 && name === 'map') errors.push('clipped map save slot');
    }
    return { errors, vehicles: g.vehicles.length, pedestrians: g.characters.filter((c) => c.kind === 'ped').length };
  }, shot.name);
  if (checks.errors.length) throw new Error(`${shot.name}: ${checks.errors.join('; ')}`);

  let quality = 84, buffer;
  do {
    buffer = await page.screenshot({ type: 'jpeg', quality });
    quality -= 6;
  } while (buffer.length > MAX_BYTES && quality > 30);
  if (buffer.length > MAX_BYTES) throw new Error(`${shot.file} exceeds 240 KiB`);
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
