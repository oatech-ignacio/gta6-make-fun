// In-car radio: three synthesised stations (synthwave, tropical, bass) sequenced live with Web Audio.
// R cycles stations while driving; the HUD shows the station and track name.
import { game } from '../core/gameState.js';
import { wasKeyPressed } from '../core/input.js';
import { emitEvent } from '../core/eventBus.js';
import { getAudioContext, getMusicBus, getNoiseBuffer } from './audioEngine.js';
import { getSettings } from '../systems/settings.js';

export const RADIO_STATIONS = [
  { name: 'NEON DRIVE 98.5', genre: 'Synthwave', bpm: 104, root: 45, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], lead: 'sawtooth', tracks: ['Midnight on Corsair', 'Chrome Flamingo', 'Causeway Lights'] },
  { name: 'RADIO TROPICAL 101.1', genre: 'Tropical', bpm: 118, root: 48, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: 'triangle', tracks: ['Azucar y Sal', 'Hibiscus Sway', 'Benny Goes Fishing'] },
  { name: 'BAY BASS 88.8', genre: 'Bass', bpm: 92, root: 41, scale: [0, 3, 5, 6, 7, 10], chords: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-4, 0, 3]], lead: 'square', tracks: ['Rustwater Roll', 'Pier 9 Pressure', 'Two-Tone'] },
  { name: 'RADIO OFF', genre: '', off: true, tracks: [''] },
];

const radio = { station: 0, track: 0, step: 0, nextTime: 0, wasInVehicle: false, level: 0 };
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function note(ctx, t, freq, dur, type, gain, cutoff = 2400) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.3), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(getMusicBus()); o.start(t); o.stop(t + dur + 0.05);
}
function drum(ctx, t, kind) {
  const bus = getMusicBus();
  if (kind === 'kick') { const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.22); return; }
  const src = ctx.createBufferSource(); src.buffer = getNoiseBuffer(); const f = ctx.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const g = ctx.createGain(); const d = kind === 'hat' ? 0.04 : 0.16; g.gain.setValueAtTime(kind === 'hat' ? 0.16 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + d + 0.02);
}

/** Schedules one 16th-note step of the current station's pattern. */
function scheduleStep(ctx, st, step, t) {
  const bar = Math.floor(step / 16) % 4, s = step % 16, chord = st.chords[bar], sixteenth = 60 / st.bpm / 4;
  if (s % 4 === 0) drum(ctx, t, 'kick');
  if (s % 8 === 4) drum(ctx, t, 'snare');
  if (s % 2 === 0 || st.genre === 'Tropical') drum(ctx, t, 'hat');
  if (st.genre === 'Bass' && (s === 7 || s === 10)) drum(ctx, t, 'kick');
  // bass: driving eighths (synthwave), syncopated (tropical / bass)
  const bassOn = st.genre === 'Synthwave' ? s % 2 === 0 : [0, 3, 6, 8, 11, 14].includes(s);
  if (bassOn) note(ctx, t, midi(st.root + chord[0] - 12), sixteenth * 1.8, 'sawtooth', 0.34, 700);
  // arpeggio
  if (st.genre !== 'Bass' ? s % 2 === 1 || s % 4 === 0 : s % 4 === 2) note(ctx, t, midi(st.root + 12 + chord[(s + bar) % 3] + (s % 8 > 5 ? 12 : 0)), sixteenth * 1.6, st.lead, 0.11, 3200);
  // pad on the bar line
  if (s === 0) for (const c of chord) note(ctx, t, midi(st.root + c), sixteenth * 15, 'sawtooth', 0.045, 1200);
  // lead phrase every other bar
  if (bar % 2 === 1 && [0, 3, 6, 10, 12].includes(s)) note(ctx, t, midi(st.root + 24 + st.scale[(s * 3 + step) % st.scale.length]), sixteenth * 3, st.lead, 0.09, 4000);
}

export function getCurrentStation() { return RADIO_STATIONS[radio.station]; }
export function getCurrentTrackName() { const st = getCurrentStation(); return st.tracks[radio.track % st.tracks.length]; }

export function setRadioStation(index, announce = true) {
  radio.station = (index + RADIO_STATIONS.length) % RADIO_STATIONS.length;
  radio.track = Math.floor(game.time / 40 + radio.station) % 3; radio.step = 0; radio.nextTime = 0;
  if (announce) emitEvent('radioChanged', { name: getCurrentStation().name, track: getCurrentTrackName() });
}

export function updateRadio(dt) {
  const inVehicle = !!(game.player && game.player.vehicle) && game.mode === 'play';
  if (inVehicle && !radio.wasInVehicle) emitEvent('radioChanged', { name: getCurrentStation().name, track: getCurrentTrackName() });
  radio.wasInVehicle = inVehicle;
  if (inVehicle && !game.flags.controlsLocked && wasKeyPressed('KeyR')) setRadioStation(radio.station + 1);
  const ctx = getAudioContext();
  if (!ctx) return;
  const st = getCurrentStation();
  const want = inVehicle && !st.off && !game.paused ? getSettings().musicVolume * 0.55 : 0;
  getMusicBus().gain.setTargetAtTime(want, ctx.currentTime, 0.25);
  if (st.off || !inVehicle) { radio.nextTime = 0; return; }
  const sixteenth = 60 / st.bpm / 4;
  if (radio.nextTime < ctx.currentTime) radio.nextTime = ctx.currentTime + 0.05;
  while (radio.nextTime < ctx.currentTime + 0.18) { scheduleStep(ctx, st, radio.step, radio.nextTime); radio.step++; radio.nextTime += sixteenth; }
}
