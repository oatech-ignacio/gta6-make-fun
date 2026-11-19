// Officers on foot: chase the suspect, make arrests at one star (BUSTED), open fire at two or more,
// keep their distance while shooting, and stand down when the wanted level clears.
import { game } from '../core/gameState.js';
import { emitEvent } from '../core/eventBus.js';
import { moveToward, faceToward, removeCharacter } from '../characters/characterEntity.js';
import { hasLineOfSight } from '../world/collisionGrid.js';
import { npcShootAt } from '../combat/weaponFire.js';
import { playSound } from '../audio/soundEffects.js';

export function updatePoliceOfficer(cop, dt) {
  if (cop.state === 'down' || cop.state === 'dead') { cop.aiming = false; return; }
  const player = game.player, stars = game.wanted.stars;
  const target = player.vehicle ? player.vehicle.pos : player.pos;
  const dx = target.x - cop.pos.x, dz = target.z - cop.pos.z, dist = Math.hypot(dx, dz);
  if (cop.recall && cop.homeVehicle && !cop.homeVehicle.removed) {         // run back to the cruiser
    const hv = cop.homeVehicle;
    if (moveToward(cop, hv.pos.x, hv.pos.z, 5.5, dt) < 2.6) removeCharacter(cop);
    return;
  }
  if ((stars === 0 && !cop.hostile) || player.health <= 0) {
    cop.vel.x = cop.vel.z = 0; cop.aiming = false; cop.state = 'idle'; cop.arrestTimer = 0;
    return;
  }
  cop.losTimer = (cop.losTimer || 0) - dt;
  if (cop.losTimer <= 0) { cop.losTimer = 0.35; cop.los = hasLineOfSight(cop.pos.x, cop.pos.z, target.x, target.z); }
  const lethal = stars >= 2 || cop.hostile;
  if (!lethal) {
    // one star: run the suspect down and cuff them
    cop.aiming = dist < 9 && dist > 2;
    const playerSlow = player.vehicle ? Math.abs(player.vehicle.speed) < 2.5 : true;
    if (dist > 1.5) { moveToward(cop, target.x, target.z, 5.6, dt); cop.state = 'run'; }
    else { cop.vel.x = cop.vel.z = 0; faceToward(cop, target.x, target.z, 10, dt); }
    if (dist < (player.vehicle ? 3.4 : 1.9) && playerSlow) {
      cop.arrestTimer = (cop.arrestTimer || 0) + dt;
      if (cop.arrestTimer > 1.1) { cop.arrestTimer = 0; emitEvent('playerBusted', { cop }); }
    } else cop.arrestTimer = Math.max(0, (cop.arrestTimer || 0) - dt * 0.5);
    if (dist < 12 && !cop.shouted) { cop.shouted = true; playSound('freeze', cop.pos); }
    return;
  }
  const range = cop.weapon === 'smg' ? 30 : 24;
  if (dist > range || !cop.los) {
    moveToward(cop, target.x, target.z, 5.4, dt); cop.state = 'run'; cop.aiming = false;
  } else {
    // hold position, strafe a little, and shoot
    faceToward(cop, target.x, target.z, 12, dt);
    cop.strafe = (cop.strafe || 0) - dt;
    if (cop.strafe <= 0) { cop.strafe = 1.2 + Math.random() * 1.8; cop.strafeDir = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
    const sx = -dz / (dist || 1) * cop.strafeDir, sz = dx / (dist || 1) * cop.strafeDir;
    const back = dist < 7 ? -1.6 : 0;
    cop.vel.x = sx * 1.6 + dx / (dist || 1) * back; cop.vel.z = sz * 1.6 + dz / (dist || 1) * back;
    cop.aiming = true; cop.state = 'aim';
    cop.aimPitch = 0;
    npcShootAt(cop, player, 0.3 + stars * 0.07);
  }
}
