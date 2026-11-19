// Shared soft radial glow sprite texture (lamps, sirens, headlights, muzzle flashes, pickups), drawn on a canvas.
import * as THREE from 'three';

export function createGlowTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let sharedGlow = null;
export function getGlowTexture() { if (!sharedGlow) sharedGlow = createGlowTexture(); return sharedGlow; }
