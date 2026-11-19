// The player on foot: camera-relative WASD movement, Shift sprint, Space jump, F to enter/steal vehicles.
import { game } from '../core/gameState.js';
import { isKeyDown, wasKeyPressed, moveAxis, getMouse } from '../core/input.js';
import { dampAngle, damp } from '../core/mathUtils.js';
import { spawnCharacter } from './characterEntity.js';
import { cameraRig, snapCameraBehind } from '../render/followCamera.js';
import { handleEnterExitKey, findEnterableVehicle } from '../vehicles/vehicleEntry.js';
import { updatePlayerDriving } from '../vehicles/playerDriving.js';
import { updatePlayerCombat } from '../combat/weaponFire.js';
import { setPrompt } from '../core/cues.js';

const WALK = 2.3, JOG = 4.7, SPRINT = 7.6;

export function createPlayer(x, z, heading = 0) {
  const p = spawnCharacter({ x, z, heading, kind: 'player', look: 'dez', health: 100, name: 'Dez Marlowe' });
  p.maxHealth = 100; p.stamina = 1;
  game.player = p;
  snapCameraBehind(heading);
  return p;
}

export function teleportPlayer(x, z, heading = 0) {
  const p = game.player;
  if (p.vehicle) { p.vehicle.driver = null; p.vehicle = null; p.mesh.visible = true; }
  p.pos.set(x, 0, z); p.heading = heading; p.vel.x = p.vel.z = 0; p.state = 'idle';
  snapCameraBehind(heading);
}

function updateOnFoot(p, dt) {
  const locked = game.flags.controlsLocked || p.state === 'down' || p.health <= 0;
  const axis = locked ? { x: 0, y: 0 } : moveAxis();
  const yaw = cameraRig.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
  let mx = fx * axis.y - fz * axis.x, mz = fz * axis.y + fx * axis.x;
  const len = Math.hypot(mx, mz);
  const aiming = !locked && (getMouse().right || p.fireAnim > 0);
  p.aiming = aiming && p.weapon !== 'fists';
  p.aimPitch = cameraRig.pitch;
  if (p.state !== 'down') {
    if (len > 0.01) {
      mx /= len; mz /= len;
      const sprinting = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
      p.stamina = Math.max(0, Math.min(1, p.stamina + (sprinting ? -dt * 0.07 : dt * 0.18)));
      const speed = aiming ? WALK * 1.3 : isKeyDown('AltLeft') ? WALK : sprinting && p.stamina > 0.02 ? SPRINT : JOG;
      p.vel.x = damp(p.vel.x, mx * speed, 14, dt); p.vel.z = damp(p.vel.z, mz * speed, 14, dt);
      if (!aiming) p.heading = dampAngle(p.heading, Math.atan2(mx, mz), 12, dt);
      p.state = speed > JOG ? 'run' : 'walk';
    } else {
      p.vel.x = damp(p.vel.x, 0, 16, dt); p.vel.z = damp(p.vel.z, 0, 16, dt);
      p.stamina = Math.min(1, p.stamina + dt * 0.25);
      p.state = 'idle';
    }
    if (aiming) p.heading = dampAngle(p.heading, yaw, 22, dt);
    if (!locked && wasKeyPressed('Space') && p.jumpY === 0) p.jumpVel = 5.6;
  }
}

export function updatePlayer(dt) {
  const p = game.player;
  if (!p) return;
  if (!game.flags.controlsLocked && wasKeyPressed('KeyF')) handleEnterExitKey();
  if (p.vehicle) updatePlayerDriving(dt);
  else {
    updateOnFoot(p, dt);
    const v = p.health > 0 ? findEnterableVehicle(p, 4.2) : null;
    if (v) setPrompt('vehicle', `<kbd>F</kbd>${v.ai && v.ai.hasDriver ? 'Jack the' : v.playerOwned ? 'Get in the' : 'Steal the'} ${v.spec.name}`);
    else setPrompt('vehicle', null);
  }
  if (p.vehicle) setPrompt('vehicle', null);
  updatePlayerCombat(dt);
}
