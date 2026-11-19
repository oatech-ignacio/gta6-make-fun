// PALMERA HEAT, a gta6-01 entry (Node 22, standard library only).
//
// The game lives in game/: an original open-world crime game for desktop browsers, built from
// plain static ES modules that run offline. It has a procedurally generated coastal city with
// districts, traffic and pedestrians; cars to drive and take; police with escalating wanted
// levels; a string of story missions with a GPS route; weapons, shops, a HUD with minimap, and
// synthesised audio.
//
// This program hands the entry in. It checks that game/index.html exists and that screenshots/
// holds 3 to 4 images, copies game/ and screenshots/ from beside this file to /output, writes
// /output/dossier.json (the summary the judge reads) with the vendored make.fun library, and
// prints a one-line summary of what was handed in.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse to hand in an entry that has no game page, and warn on a bad screenshot count.
if (!existsSync(join(here, 'game', 'index.html'))) {
  console.error('PALMERA HEAT: game/index.html is missing, nothing to hand in.');
  process.exit(1);
}
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  console.warn(`PALMERA HEAT: expected 3 to 4 screenshots, found ${shots.length}.`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const gameFiles = readdirSync(join(out, 'game'), { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;
console.log(
  `PALMERA HEAT handed in: ${gameFiles} game files, ${shots.length} screenshots (cover ${shots[0] ?? 'none'}), dossier.json ${Buffer.byteLength(dossier)} bytes -> ${out}`,
);
