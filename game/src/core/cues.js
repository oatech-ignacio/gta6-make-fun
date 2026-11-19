// Fire-and-forget presentation cues. Simulation code asks for a sound, a particle effect, a HUD prompt or a
// hit marker by name; the audio, effects and HUD modules subscribe. This keeps gameplay logic independent of
// Web Audio, three.js sprites and the DOM.
import { emitEvent } from './eventBus.js';

export function playSound(name, pos = null, volume = 1) { emitEvent('cue:sound', { name, pos, volume }); }
/** kind: 'muzzleFlash' | 'tracer' | 'sparks' | 'blood' | 'smoke' | 'tyreSmoke' | 'explosion' | 'cashBurst'. */
export function spawnEffect(kind, ...args) { emitEvent('cue:effect', { kind, args }); }
/** Context prompt such as "F Steal the Marlin RS"; channels keep vehicles, shops and activities apart. */
export function setPrompt(channel, html) { emitEvent('cue:prompt', { channel, html }); }
export function flashCrosshair() { emitEvent('cue:hit'); }
