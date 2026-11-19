// Player vehicle controls: WASD throttle/steer, Space handbrake (drift), H horn, plus driving stats and crimes.
import { game } from '../core/gameState.js';
import { isKeyDown, wasKeyPressed, moveAxis } from '../core/input.js';
import { playSound } from '../core/cues.js';
import { reportCrime } from '../systems/wantedLevel.js';
import { emitEvent } from '../core/eventBus.js';

let redLightCooldown = 0;

export function updatePlayerDriving(dt) {
  const player = game.player, v = player.vehicle;
  if (!v) return;
  const c = v.controls, axis = game.flags.controlsLocked ? { x: 0, y: 0 } : moveAxis();
  c.throttle = axis.y;
  c.steer = -axis.x;
  c.handbrake = isKeyDown('Space') && !game.flags.controlsLocked;
  c.brake = 0;
  if (wasKeyPressed('KeyH')) { playSound('horn', v.pos); emitEvent('horn', { x: v.pos.x, z: v.pos.z, vehicle: v }); }
  // the player rides along with the car
  player.pos.copy(v.pos); player.heading = v.heading;
  game.stats.distance += Math.abs(v.speed) * dt;
  if (v.isPolice && wasKeyPressed('KeyE')) v.siren = !v.siren;
  // speeding past a patrol car draws attention
  redLightCooldown -= dt;
  if (Math.abs(v.speed) > 38 && redLightCooldown <= 0) { redLightCooldown = 6; reportCrime('speeding', v.pos); }
  if (v.wrecked || (v.burning > 0 && v.burning < 0.4)) emitEvent('playerVehicleDestroyed', v);
}

export function stopVehicle(v) { v.controls.throttle = 0; v.controls.steer = 0; v.controls.brake = 0.6; v.controls.handbrake = false; }
