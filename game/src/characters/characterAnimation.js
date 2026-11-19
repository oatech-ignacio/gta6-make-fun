// Procedural character animation: walk/run cycles, aiming, punching, panic, knock-down ragdoll-ish falls, riding.
import { damp } from '../core/mathUtils.js';

function setLimbs(parts, armL, armR, legL, legR, k) {
  parts.armL.rotation.x = damp(parts.armL.rotation.x, armL, 18, k);
  parts.armR.rotation.x = damp(parts.armR.rotation.x, armR, 18, k);
  parts.legL.rotation.x = damp(parts.legL.rotation.x, legL, 18, k);
  parts.legR.rotation.x = damp(parts.legR.rotation.x, legR, 18, k);
}

export function animateCharacter(c, dt) {
  const parts = c.mesh.userData.parts, body = parts.body;
  const speed = c.moveSpeed || 0;
  c.animPhase += dt * (3.2 + speed * 1.55);
  const swing = Math.sin(c.animPhase), down = c.state === 'down' || c.state === 'dead';
  // fall over backwards (or onto the face) and lie on the ground
  const fallTarget = down ? (c.fallDir || -1) * Math.PI / 2 : 0;
  body.rotation.x = damp(body.rotation.x, fallTarget + (!down && speed > 5 ? 0.16 : 0), down ? 9 : 12, dt);
  body.position.y = damp(body.position.y, down ? 0.16 : (c.jumpY || 0), down ? 9 : 30, dt);
  body.rotation.z = damp(body.rotation.z, down ? (c.id % 5 - 2) * 0.12 : 0, 8, dt);
  parts.gun.visible = !down && c.weapon && c.weapon !== 'fists' && !c.vehicle;
  parts.armL.rotation.z = 0; parts.armR.rotation.z = 0;
  if (down) {
    setLimbs(parts, -2.6 + (c.id % 3) * 0.5, -0.6, 0.25, -0.3, dt);
    parts.armL.rotation.z = 0.6; parts.armR.rotation.z = -0.5;
    return;
  }
  if (c.vehicle) {                 // only visible on motorbikes
    setLimbs(parts, -1.15, -1.15, -1.35, -1.35, dt); body.position.y = -0.18; body.rotation.x = 0.25;
    return;
  }
  if (c.punchTime > 0) {
    c.punchTime -= dt;
    const t = Math.sin(Math.max(0, c.punchTime) / 0.32 * Math.PI);
    setLimbs(parts, -0.6, -1.7 * t - 0.2, swing * 0.2, -swing * 0.2, dt * 3);
    body.rotation.y = damp(body.rotation.y, 0.5 * t, 20, dt);
    return;
  }
  body.rotation.y = damp(body.rotation.y, 0, 12, dt);
  if (c.aiming || c.fireAnim > 0) {
    c.fireAnim = Math.max(0, (c.fireAnim || 0) - dt);
    const recoil = c.recoil ? (c.recoil = Math.max(0, c.recoil - dt * 6)) * 0.35 : 0;
    const pitch = -(c.aimPitch || 0) * 0.8;
    const legAmp = Math.min(0.7, speed * 0.16);
    setLimbs(parts, -1.45 + pitch - recoil, -1.52 + pitch - recoil, swing * legAmp, -swing * legAmp, dt * 2);
    parts.armL.rotation.z = -0.42;
    return;
  }
  if (c.state === 'flee' || c.panic > 0) {
    setLimbs(parts, -2.7 + swing * 0.3, -2.7 - swing * 0.3, swing * 0.95, -swing * 0.95, dt);
    parts.armL.rotation.z = 0.3; parts.armR.rotation.z = -0.3;
    return;
  }
  if (c.handsUp) { setLimbs(parts, -3.0, -3.0, 0, 0, dt); return; }
  if (speed > 0.3) {
    const amp = Math.min(1.0, 0.28 + speed * 0.11);
    setLimbs(parts, -swing * amp * 0.9, swing * amp * 0.9, swing * amp, -swing * amp, dt * 2);
  } else {
    const breathe = Math.sin(c.animPhase * 0.35) * 0.04;
    setLimbs(parts, breathe, -breathe, 0, 0, dt);
  }
}
