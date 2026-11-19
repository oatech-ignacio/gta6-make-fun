// Synthesised sound effects (no audio files): gunshots, crashes, explosions, doors, UI stings,
// plus continuous engine hum, tyre screech and police sirens that follow the action.
import { game } from '../core/gameState.js';
import { getAudioContext, getSfxBus, getNoiseBuffer } from './audioEngine.js';
import { clamp } from '../core/mathUtils.js';
import { onEvent } from '../core/eventBus.js';

function noiseBurst(ctx, out, t, dur, freq, q, gain, type = 'lowpass', sweepTo = null) {
  const src = ctx.createBufferSource(); src.buffer = getNoiseBuffer(); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.02);
}
function tone(ctx, out, t, dur, freq, gain, type = 'sine', freqTo = null) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}

const RECIPES = {
  pistol: (c, o, t) => { noiseBurst(c, o, t, 0.16, 2600, 0.7, 0.9, 'lowpass', 500); tone(c, o, t, 0.1, 190, 0.7, 'triangle', 60); },
  smg: (c, o, t) => { noiseBurst(c, o, t, 0.09, 3200, 0.8, 0.7, 'lowpass', 700); tone(c, o, t, 0.06, 230, 0.5, 'square', 80); },
  shotgun: (c, o, t) => { noiseBurst(c, o, t, 0.35, 1800, 0.5, 1.2, 'lowpass', 200); tone(c, o, t, 0.2, 120, 0.9, 'triangle', 40); },
  crash: (c, o, t) => { noiseBurst(c, o, t, 0.3, 1200, 0.6, 0.9, 'lowpass', 150); tone(c, o, t, 0.15, 90, 0.7, 'square', 40); },
  explosion: (c, o, t) => { noiseBurst(c, o, t, 1.4, 700, 0.4, 1.6, 'lowpass', 60); tone(c, o, t, 0.8, 70, 1.2, 'sine', 25); },
  thud: (c, o, t) => { tone(c, o, t, 0.14, 110, 0.9, 'sine', 45); noiseBurst(c, o, t, 0.08, 500, 1, 0.4); },
  punch: (c, o, t) => { tone(c, o, t, 0.09, 160, 0.8, 'sine', 60); noiseBurst(c, o, t, 0.05, 900, 1, 0.5); },
  swing: (c, o, t) => noiseBurst(c, o, t, 0.14, 500, 2, 0.25, 'bandpass', 1800),
  door: (c, o, t) => { tone(c, o, t, 0.07, 140, 0.6, 'square', 70); noiseBurst(c, o, t + 0.02, 0.06, 1500, 1, 0.3); },
  horn: (c, o, t) => { tone(c, o, t, 0.45, 392, 0.3, 'sawtooth'); tone(c, o, t, 0.45, 494, 0.3, 'sawtooth'); },
  cash: (c, o, t) => { tone(c, o, t, 0.09, 1320, 0.3, 'square'); tone(c, o, t + 0.08, 0.16, 1760, 0.3, 'square'); },
  pickup: (c, o, t) => { tone(c, o, t, 0.1, 660, 0.3, 'triangle'); tone(c, o, t + 0.09, 0.14, 990, 0.3, 'triangle'); },
  reload: (c, o, t) => { noiseBurst(c, o, t, 0.04, 3000, 2, 0.4, 'bandpass'); noiseBurst(c, o, t + 0.18, 0.05, 2200, 2, 0.5, 'bandpass'); },
  empty: (c, o, t) => noiseBurst(c, o, t, 0.03, 4000, 3, 0.3, 'bandpass'),
  yell: (c, o, t) => tone(c, o, t, 0.35, 520 + Math.random() * 200, 0.25, 'sawtooth', 300),
  freeze: (c, o, t) => { tone(c, o, t, 0.12, 300, 0.3, 'square', 340); tone(c, o, t + 0.15, 0.2, 260, 0.3, 'square', 220); },
  talk: (c, o, t) => { for (let k = 0; k < 4; k++) tone(c, o, t + k * 0.07, 0.05, 240 + Math.random() * 160, 0.12, 'triangle'); },
  radio: (c, o, t) => { noiseBurst(c, o, t, 0.25, 2500, 4, 0.3, 'bandpass'); tone(c, o, t + 0.25, 0.08, 1200, 0.2, 'square'); },
  rotor: (c, o, t) => noiseBurst(c, o, t, 0.1, 160, 1.2, 0.5, 'lowpass'),
  spray: (c, o, t) => noiseBurst(c, o, t, 0.9, 5000, 1, 0.4, 'highpass'),
  missionStart: (c, o, t) => [392, 494, 587].forEach((f, i) => tone(c, o, t + i * 0.1, 0.3, f, 0.25, 'sawtooth')),
  missionPassed: (c, o, t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, o, t + i * 0.13, 0.5, f, 0.28, 'triangle')),
  missionFailed: (c, o, t) => [392, 330, 262, 196].forEach((f, i) => tone(c, o, t + i * 0.2, 0.5, f, 0.28, 'sawtooth')),
  wasted: (c, o, t) => { tone(c, o, t, 1.6, 220, 0.4, 'sawtooth', 55); },
  busted: (c, o, t) => { [330, 262, 330, 262].forEach((f, i) => tone(c, o, t + i * 0.22, 0.2, f, 0.3, 'square')); },
};

/** Play a one-shot effect; volume falls off with distance from the camera's subject. */
export function playSound(name, pos = null, volume = 1) {
  const ctx = getAudioContext(), recipe = RECIPES[name];
  if (!ctx || !recipe || game.mode === 'shot') return;
  let gain = volume;
  if (pos && game.player) {
    const d = Math.hypot(pos.x - game.player.pos.x, pos.z - game.player.pos.z);
    gain *= clamp(1 - d / 110, 0, 1) ** 2;
    if (gain < 0.02) return;
  }
  const g = ctx.createGain(); g.gain.value = gain * 0.6; g.connect(getSfxBus());
  recipe(ctx, g, ctx.currentTime + 0.005);
}

export function initSoundEffects() { onEvent('cue:sound', (e) => playSound(e.name, e.pos, e.volume)); }

// ---- continuous sounds ----
const loops = { engine: null, siren: null, screech: null, surf: null };

function ensureLoops(ctx) {
  if (loops.engine) return;
  const bus = getSfxBus();
  const eo = ctx.createOscillator(); eo.type = 'sawtooth'; const eo2 = ctx.createOscillator(); eo2.type = 'square';
  const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500;
  const eg = ctx.createGain(); eg.gain.value = 0;
  eo.connect(ef); eo2.connect(ef); ef.connect(eg); eg.connect(bus); eo.start(); eo2.start();
  loops.engine = { o1: eo, o2: eo2, filter: ef, gain: eg };
  const so = ctx.createOscillator(); so.type = 'sawtooth'; const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1100; sf.Q.value = 1.5;
  const sg = ctx.createGain(); sg.gain.value = 0; so.connect(sf); sf.connect(sg); sg.connect(bus); so.start();
  loops.siren = { osc: so, gain: sg };
  const mk = (type, freq, q) => { const src = ctx.createBufferSource(); src.buffer = getNoiseBuffer(); src.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(bus); src.start(); return { filter: f, gain: g }; };
  loops.screech = mk('bandpass', 1900, 6);
  loops.surf = mk('lowpass', 420, 0.5);
}

export function updateContinuousSounds(dt) {
  const ctx = getAudioContext();
  if (!ctx || !game.player) return;
  ensureLoops(ctx);
  const t = ctx.currentTime, player = game.player, v = player.vehicle, quiet = game.paused || game.mode !== 'play';
  const speed = v ? Math.abs(v.speed) : 0;
  const rpm = v ? 55 + (speed % 17) * 5.5 + speed * 1.6 + Math.abs(v.controls.throttle) * 18 : 50;
  loops.engine.o1.frequency.setTargetAtTime(rpm, t, 0.05); loops.engine.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.05);
  loops.engine.filter.frequency.setTargetAtTime(300 + speed * 22, t, 0.1);
  loops.engine.gain.gain.setTargetAtTime(v && !quiet && !v.wrecked ? 0.07 + Math.abs(v.controls.throttle) * 0.05 : 0, t, 0.08);
  loops.screech.gain.gain.setTargetAtTime(v && v.drifting && !quiet ? 0.12 : 0, t, 0.05);
  // nearest active siren
  let nearest = Infinity;
  for (const o of game.vehicles) if (o.siren && !o.wrecked) nearest = Math.min(nearest, Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z));
  const wail = 650 + Math.sin(game.time * 3.4) * 280;
  loops.siren.osc.frequency.setTargetAtTime(wail, t, 0.03);
  loops.siren.gain.gain.setTargetAtTime(nearest < 150 && !quiet ? 0.09 * (1 - nearest / 150) : 0, t, 0.1);
  loops.surf.gain.gain.setTargetAtTime(!quiet ? clamp((player.pos.x - 380) / 120, 0, 1) * 0.1 * (0.7 + 0.3 * Math.sin(game.time * 0.7)) : 0, t, 0.3);
}
