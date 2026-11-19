// Small 2D/angle helpers shared by every system (the world is flat: x = east, z = south).
export const TAU = Math.PI * 2;
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
export function angleDiff(from, to) { return wrapAngle(to - from); }
export function dampAngle(a, b, lambda, dt) { return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt)); }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function distSq2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
/** Heading convention: forward = (sin h, cos h); mesh.rotation.y = h. */
export function headingTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }
export function forwardX(h) { return Math.sin(h); }
export function forwardZ(h) { return Math.cos(h); }
export function formatMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function formatClock(hours) {
  const h = Math.floor(hours) % 24, m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function formatTimer(sec) { const s = Math.max(0, Math.ceil(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
