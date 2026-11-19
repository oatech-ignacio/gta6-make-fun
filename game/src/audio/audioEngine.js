// Web Audio plumbing: one AudioContext unlocked by the first click/key, master + music buses, noise buffer.
import { getSettings } from '../systems/settings.js';

let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuffer = null;

export function initAudio() {
  const unlock = () => { resumeAudio(); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
}

export function resumeAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (err) { return null; }
    master = ctx.createGain(); master.gain.value = getSettings().masterVolume;
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.ratio.value = 8;
    master.connect(limiter); limiter.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function getAudioContext() { return ctx && ctx.state === 'running' ? ctx : null; }
export function getSfxBus() { return sfxBus; }
export function getMusicBus() { return musicBus; }
export function getNoiseBuffer() { return noiseBuffer; }
export function setMasterVolume(v) { if (master) master.gain.value = v; }
export function suspendAudio(paused) { if (!ctx) return; if (paused) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); }
