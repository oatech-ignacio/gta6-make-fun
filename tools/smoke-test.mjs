// Job: headless gameplay smoke test. Starts a new game, walks, steals a car, drives, shoots, raises a wanted
// level, runs the first mission steps and opens the pause map, fast-forwarding the simulation; fails on any error.
//   node tools/smoke-test.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('../game', import.meta.url)));
const shots = resolve(root, '../.tools/shots'); mkdirSync(shots, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?seed=3`);
await page.waitForFunction('window.__game && window.__game.mode === "menu"', null, { timeout: 120000 });
const log = (label, value) => console.log(label.padEnd(26), JSON.stringify(value));
await page.screenshot({ path: join(shots, 'smoke-menu.jpg'), type: 'jpeg', quality: 80 });
await page.click('#ss-controls'); await page.click('#ss-settings'); await page.click('#ss-story'); await page.click('#ss-load');
log('start screen', await page.evaluate(() => ({ slots: document.querySelectorAll('#start-screen .slot').length, empty: document.querySelectorAll('#start-screen .slot.empty').length })));
await page.click('#ss-new');
await page.waitForFunction('window.__game.mode === "play"');
await page.evaluate(() => window.__debug.setManualStepping(true));
const ff = (seconds) => page.evaluate((s) => window.__debug.fastForward(s), seconds);

// walk and sprint
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await ff(3); await page.keyboard.up('ShiftLeft'); await page.keyboard.press('Space'); await ff(1); await page.keyboard.up('KeyW');
log('on foot', await page.evaluate(() => { const g = window.__game; return { x: g.player.pos.x.toFixed(1), z: g.player.pos.z.toFixed(1), peds: g.characters.length, cars: g.vehicles.length }; }));
// steal the nearest car: teleport next to it, press F, drive
await page.evaluate(() => { const g = window.__game; const v = g.vehicles.filter((c) => !c.isPolice).sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0]; g.player.pos.set(v.pos.x + Math.cos(v.heading) * 2.2, 0, v.pos.z - Math.sin(v.heading) * 2.2); });
await ff(0.1); await page.keyboard.press('KeyF'); await ff(0.2);
await page.keyboard.down('KeyW'); await ff(4); await page.keyboard.down('KeyA'); await page.keyboard.down('Space'); await ff(1); await page.keyboard.up('Space'); await page.keyboard.up('KeyA'); await ff(3); await page.keyboard.press('KeyR'); await page.keyboard.press('KeyH'); await page.keyboard.up('KeyW');
log('driving', await page.evaluate(() => { const g = window.__game, v = g.player.vehicle; return v ? { car: v.spec.name, speed: v.speed.toFixed(1), health: v.health.toFixed(0), stolen: g.stats.carsStolen } : 'NOT IN VEHICLE'; }));
await page.screenshot({ path: join(shots, 'smoke-drive.jpg'), type: 'jpeg', quality: 80 });
// wanted level, police response, roadblock, helicopter
await page.evaluate(async () => { const w = await import('./src/systems/wantedLevel.js'); w.setWantedLevel(4); window.__game.flags.wantedHold = true; });
await page.keyboard.down('KeyW'); await ff(14); await page.keyboard.up('KeyW');
log('police panel', await page.evaluate(async () => { const pu = await import('./src/police/policeUnits.js'); return { chip: document.getElementById('sight-chip').textContent, rows: document.querySelectorAll('#police-panel .pu').length, units: pu.getPoliceUnits().slice(0, 6).map((u) => `${u.callsign} ${Math.round(u.distance)}m ${u.status}`) }; }));
log('wanted', await page.evaluate(() => { const g = window.__game; return { stars: g.wanted.stars, police: g.vehicles.filter((v) => v.isPolice).length, cops: g.characters.filter((c) => c.kind === 'cop').length, heli: !!(g.helicopter && g.helicopter.active), health: g.player.health.toFixed(0) }; }));
await page.screenshot({ path: join(shots, 'smoke-wanted.jpg'), type: 'jpeg', quality: 80 });
// get out, shoot, punch
await page.evaluate(async () => { const w = await import('./src/combat/weaponCatalog.js'); w.giveWeapon('pistol', 60); w.giveWeapon('smg', 90); w.giveWeapon('shotgun', 12); w.selectWeapon('smg'); window.__game.player.health = 100; window.__game.player.armor = 100; });
await page.keyboard.press('KeyF'); await ff(2.5);
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); await page.mouse.down(); await ff(1.5); await page.mouse.up(); await page.keyboard.press('Digit4'); await page.mouse.down(); await ff(0.3); await page.mouse.up(); await page.keyboard.press('Digit1'); await page.mouse.down(); await ff(0.5); await page.mouse.up(); await page.mouse.up({ button: 'right' });
log('combat', await page.evaluate(() => { const g = window.__game; return { weapon: g.currentWeapon, smg: g.ammo.smg, health: g.player.health.toFixed(0), state: g.player.state }; }));
// let the cops finish the job: wasted or busted, then respawn
await page.evaluate(() => { window.__game.player.armor = 0; window.__game.player.health = 8; }); await ff(25);
log('after respawn', await page.evaluate(() => { const g = window.__game; return { health: g.player.health, stars: g.wanted.stars, wasted: g.stats.wastedCount, busted: g.stats.bustedCount, x: g.player.pos.x.toFixed(0), z: g.player.pos.z.toFixed(0) }; }));
// story: walk into Benny's marker, play through mission 1 by teleporting
await page.evaluate(async () => { const g = window.__game; g.flags.wantedHold = false; const w = await import('./src/systems/wantedLevel.js'); w.clearWantedLevel(); const pc = await import('./src/characters/playerController.js'); pc.teleportPlayer(421, 200, 0); });
await ff(1); for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await ff(0.3); }
log('mission 1', await page.evaluate(() => { const m = window.__game.activeMission; return m ? { title: m.def.title, step: m.step && m.step.type } : 'NO MISSION'; }));
await page.evaluate(() => { const g = window.__game, m = g.activeMission, v = m.vehicle; g.player.pos.set(v.pos.x + 2.4, 0, v.pos.z); });
await ff(0.1); await page.keyboard.press('KeyF'); await ff(0.5);
await page.evaluate(() => { const g = window.__game, v = g.player.vehicle; v.pos.set(-196, 0, 346); v.vx = v.vz = 0; }); await ff(2);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await ff(0.3); } await ff(2);
log('after mission 1', await page.evaluate(() => { const g = window.__game; return { missionIndex: g.missionIndex, money: g.money, respect: g.respect, active: !!g.activeMission, saved: !!localStorage.getItem('palmeraHeat.save.v2.auto') }; }));
// missions 2..8: play every stage to completion, doing what the player would do (teleporting instead of driving)
const solveStep = (index) => page.evaluate(async (expected) => {
  const g = window.__game, m = g.activeMission; if (!m || !m.step || m.index !== expected) return null;
  const ve = await import('./src/vehicles/vehicleEntry.js'), vp = await import('./src/vehicles/vehiclePhysics.js'), pc = await import('./src/characters/playerController.js');
  const dmg = await import('./src/combat/damageSystem.js'), wl = await import('./src/systems/wantedLevel.js');
  const p = g.player, type = m.step.type; p.health = 100;
  const onFootAt = (x, z) => { if (p.vehicle) ve.leaveVehicle(p); pc.teleportPlayer(x, z, 0); };
  const driveTo = (x, z) => { const v = p.vehicle; v.pos.set(x, 0, z); v.vx = v.vz = 0; v.speed = 0; };
  const needCar = () => { if (!p.vehicle) ve.enterVehicle(p, vp.spawnVehicle('sports', p.pos.x + 3, p.pos.z, 0)); };
  if (type === 'goto' || type === 'hold' || type === 'collect') onFootAt(m.marker.x, m.marker.z);
  else if (type === 'needVehicle') needCar();
  else if (type === 'stealVehicle') { if (p.vehicle) ve.leaveVehicle(p); ve.enterVehicle(p, m.vehicle); }
  else if (type === 'deliverVehicle') { if (p.vehicle !== m.vehicle) ve.enterVehicle(p, m.vehicle); driveTo(m.marker.x, m.marker.z); }
  else if (type === 'chase') m.target.health = m.step.damageTo;
  else if (type === 'eliminate') { for (const c of m.state.enemies) if (c.state !== 'dead') dmg.killCharacter(c, p); }
  else if (type === 'pickupPassenger') { needCar(); driveTo(m.state.npc.pos.x + 3, m.state.npc.pos.z); }
  else if (type === 'loseWanted') { g.wanted.seen = false; g.wanted.unseen = 999; }
  return type;
}, index);
for (let index = 1; index < 8; index++) {
  await page.evaluate(async (i) => { const g = window.__game; g.player.invulnerable = true; const mr = await import('./src/missions/missionRunner.js'); if (g.activeMission) mr.failMission('test'); const wl = await import('./src/systems/wantedLevel.js'); wl.clearWantedLevel(); g.missionIndex = i; mr.startMission(i); }, index);
  const seen = [], banners = new Set();
  for (let guard = 0; guard < 140; guard++) {
    const type = await solveStep(index);
    if (!type) break;
    if (seen[seen.length - 1] !== type) seen.push(type);
    if (type === 'dialogue') await page.keyboard.press('Enter');
    await ff(type === 'hold' ? 4 : 0.4);
    banners.add(await page.evaluate(() => document.getElementById('mission-stage').textContent));
  }
  const result = await page.evaluate(() => ({ missionIndex: window.__game.missionIndex, active: !!window.__game.activeMission }));
  log(`mission ${index + 1}`, { ...result, stages: [...banners].filter(Boolean).length, steps: seen.join('>') });
  if (result.missionIndex < index + 1) errors.push(`mission ${index + 1} could not be completed (stuck at ${seen[seen.length - 1]})`);
  await ff(1);
}
await page.evaluate(async () => { const g = window.__game; g.player.invulnerable = false; const mr = await import('./src/missions/missionRunner.js'); if (g.activeMission) mr.failMission('test'); const wl = await import('./src/systems/wantedLevel.js'); wl.clearWantedLevel(); });
log('progress', await page.evaluate(async () => { const pr = await import('./src/systems/progression.js'); const g = window.__game; return { percent: pr.getCompletion().percent, respect: g.respect, rank: document.getElementById('respect-rank').textContent, label: document.getElementById('respect-label').textContent, crew: Object.keys(g.crew).length, gangKills: g.stats.gangKills, escapes: g.stats.copsEscaped, weaponSlots: document.querySelectorAll('#weapon-bar .ws').length, locked: document.querySelectorAll('#weapon-bar .ws.locked').length }; }));
// crew: recruit the driver on foot with E, hire the others, then use all three abilities from the keyboard
await page.evaluate(async () => { const g = window.__game; g.money = 60000; const ve = await import('./src/vehicles/vehicleEntry.js'), pc = await import('./src/characters/playerController.js'), { CREW } = await import('./src/crew/crewRoster.js'); if (g.player.vehicle) ve.leaveVehicle(g.player); pc.teleportPlayer(CREW[0].spot.x + 1.5, CREW[0].spot.z, 0); });
await ff(0.3); await page.keyboard.press('KeyE'); await ff(0.3);
const recruited = await page.evaluate(async () => { const g = window.__game, ca = await import('./src/crew/crewAbilities.js'), wl = await import('./src/systems/wantedLevel.js'), vp = await import('./src/vehicles/vehiclePhysics.js'), ve = await import('./src/vehicles/vehicleEntry.js'); const byKey = !!g.allies.sable; ca.hireCrew('gus'); ca.hireCrew('wren'); const car = vp.spawnVehicle('muscle', g.player.pos.x + 3, g.player.pos.z, 0); ve.enterVehicle(g.player, car); car.health = 35; wl.setWantedLevel(3); return byKey; });
await ff(0.2); await page.keyboard.press('KeyZ'); await ff(0.2); await page.keyboard.press('KeyX'); await ff(0.2); await page.keyboard.press('KeyC'); await ff(0.4);
const crew = await page.evaluate(() => { const g = window.__game; return { recruitedWithE: null, stars: g.wanted.stars, carHealth: g.player.vehicle.health, jammed: g.flags.jamUntil > g.time, calls: g.stats.crewCalls, chips: [...document.querySelectorAll('#crew-panel .cw em')].map((e) => e.textContent), label: document.getElementById('wanted-label').textContent }; });
crew.recruitedWithE = recruited; log('crew', crew);
if (!recruited || crew.stars !== 2 || crew.carHealth < 100 || !crew.jammed || crew.chips.length !== 3) errors.push('crew recruiting or abilities failed: ' + JSON.stringify(crew));
// garage: drive into Odette's Respray, open the menu, repaint, buy one of each upgrade and swap plates
await page.evaluate(() => { const g = window.__game, v = g.player.vehicle; g.flags.jamUntil = 0; g.wanted.seen = false; v.pos.set(-100, 0, 347); v.vx = v.vz = 0; });
await ff(0.5); await page.keyboard.press('KeyE'); await ff(0.2);
for (const key of ['Digit2', 'Digit7', 'Digit8', 'Digit9', 'Digit0']) { await page.keyboard.press(key); await ff(0.1); }
const garage = await page.evaluate(async () => { const g = window.__game, v = g.player.vehicle, bay = await import('./src/render/garageBay.js'); return { open: !document.getElementById('garage-panel').classList.contains('hidden'), bay: bay.isGarageBayShown(), hudHidden: document.getElementById('hud').classList.contains('hidden'), rows: document.querySelectorAll('#garage-panel .g-row').length, swatches: document.querySelectorAll('#garage-panel .g-sw').length, garage: g.garage, topSpeed: +v.spec.maxSpeed.toFixed(1), stock: v.baseSpec.maxSpeed, paint: v.color.toString(16), stars: g.wanted.stars }; });
log('garage', garage); await page.screenshot({ path: join(shots, 'smoke-garage.jpg'), type: 'jpeg', quality: 80 });
await page.keyboard.press('KeyQ'); await ff(0.1);
const showroom = await page.evaluate(() => ({ tab: document.querySelector('#garage-panel .g-tabs .on')?.textContent, cars: document.querySelectorAll('#garage-panel .g-cars .g-row').length, owned: document.querySelectorAll('#garage-panel .g-cars .g-row.owned').length }));
log('garage showroom', showroom);
await page.keyboard.press('KeyE'); await ff(0.2);
const leftGarage = await page.evaluate(async () => { const bay = await import('./src/render/garageBay.js'); return { bay: bay.isGarageBayShown(), hud: !document.getElementById('hud').classList.contains('hidden') }; });
if (!garage.open || !garage.bay || !garage.hudHidden || garage.rows !== 5 || garage.swatches !== 5 || garage.garage.engine !== 1 || garage.garage.armor !== 1 || garage.garage.tyres !== 1 || garage.garage.plateSwaps !== 1 || garage.stars !== 0 || !(garage.topSpeed > garage.stock)) errors.push('garage failed: ' + JSON.stringify(garage));
if (!/SHOWROOM/.test(showroom.tab || '') || showroom.cars < 5 || showroom.owned < 1 || leftGarage.bay || !leftGarage.hud) errors.push('garage showroom / exit failed: ' + JSON.stringify({ showroom, leftGarage }));
// street race: enter the Neon Row Circuit with E, sit out the countdown, then take every checkpoint of both laps
await page.evaluate(async () => { const g = window.__game, v = g.player.vehicle, { RACES } = await import('./src/races/raceCatalog.js'); const s = RACES[1].start; v.pos.set(s.x, 0, s.z); v.heading = s.heading; v.vx = v.vz = 0; });
await ff(0.4); await page.keyboard.press('KeyE'); await ff(1);
const grid = await page.evaluate(async () => { const sr = await import('./src/races/streetRaces.js'); const s = sr.getRaceStatus(); return s && { phase: s.phase, countdown: s.countdown, racers: s.racers, hud: document.getElementById('race-hud').textContent.replace(/\s+/g, ' ').trim() }; });
log('race grid', grid); await ff(2.6);
let hudMidRace = '';
for (let i = 0; i < 30; i++) {
  const over = await page.evaluate(async () => { const sr = await import('./src/races/streetRaces.js'), s = sr.getRaceStatus(); if (!s) return true; const v = window.__game.player.vehicle; v.pos.set(s.target.x, 0, s.target.z); v.vx = v.vz = 0; return false; });
  if (over) break;
  await ff(0.3);
  if (i === 3) { hudMidRace = await page.evaluate(() => document.getElementById('race-hud').textContent.replace(/\s+/g, ' ').trim()); await page.screenshot({ path: join(shots, 'smoke-race.jpg'), type: 'jpeg', quality: 80 }); }
}
const raced = await page.evaluate(async () => { const g = window.__game, sr = await import('./src/races/streetRaces.js'); return { result: sr.getRaceResult(), wins: g.races.wins, best: g.races.best, racesWon: g.stats.racesWon, rivals: g.vehicles.filter((v) => v.ai && v.ai.mode === 'racer').length }; });
log('race', { hud: hudMidRace, ...raced });
if (!grid || grid.phase !== 'countdown' || grid.racers !== 4 || !raced.wins.neon || !raced.result || raced.result.position !== 1 || !/LAP/.test(hudMidRace)) errors.push('street race failed: ' + JSON.stringify({ grid, raced }));
await ff(9);
// taxi fares
await page.evaluate(async () => { const g = window.__game; const vp = await import('./src/vehicles/vehiclePhysics.js'); const ve = await import('./src/vehicles/vehicleEntry.js'); if (g.player.vehicle) ve.leaveVehicle(g.player); const t = vp.spawnVehicle('taxi', 48, 100, 0); ve.enterVehicle(g.player, t); });
await ff(0.2); await page.keyboard.press('KeyT'); await ff(3);
// pause map
await page.keyboard.press('KeyM'); await page.waitForFunction('window.__game.paused === true', null, { timeout: 20000 });
const paused = await page.evaluate(() => ({ paused: window.__game.paused, mapVisible: !document.getElementById('pause-map').classList.contains('hidden'), stats: [...document.querySelectorAll('#pause-map .pm-bigstats span')].map((s) => s.textContent), legend: document.querySelectorAll('#pause-map .pm-maplegend span').length }));
log('paused', paused);
if (paused.stats.length !== 6 || paused.legend < 6) errors.push('pause map stats header or legend missing: ' + JSON.stringify(paused));
await page.screenshot({ path: join(shots, 'smoke-map.jpg'), type: 'jpeg', quality: 80 });
for (const tab of ['STORY', 'STATS', 'CREW', 'SETTINGS', 'CONTROLS', 'SAVE']) { await page.click(`.pm-tabs button[data-tab="${tab}"]`); await page.screenshot({ path: join(shots, `smoke-pause-${tab.toLowerCase()}.jpg`), type: 'jpeg', quality: 80 }); }
await page.evaluate(async () => { const ve = await import('./src/vehicles/vehicleEntry.js'); ve.leaveVehicle(window.__game.player); });
await page.click('#pause-map .slot[data-slot="2"]');
log('save slots', await page.evaluate(() => ({ note: document.getElementById('pm-save-note').textContent, keys: Object.keys(localStorage).filter((k) => k.includes('save')).sort() })));
await page.click('#pm-resume'); await ff(1);
await page.evaluate(() => window.__debug.setManualStepping(false));
// real-time frames: measure the loop
const fps = await page.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 > 3000) ok(n / 3); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
log('fps (software GL)', fps.toFixed(1));
log('scene', await page.evaluate(() => { const g = window.__game, r = g.renderer; r.info.autoReset = false; r.info.reset(); window.__debug.renderOnce(); const i = { calls: r.info.render.calls, triangles: r.info.render.triangles, vehicles: g.vehicles.length, characters: g.characters.length }; r.info.autoReset = true; return i; }));
await browser.close(); server.close();
if (errors.length) { console.log('\nERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('\nsmoke test passed with no console errors');
