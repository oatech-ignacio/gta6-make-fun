// Third-person camera: mouse orbit on foot, chase camera in vehicles, aim zoom, wall avoidance and shake.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { consumeMouseDelta, getMouse } from '../core/input.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/mathUtils.js';
import { raycastStatics } from '../world/collisionGrid.js';
import { getSettings } from '../systems/settings.js';

export const cameraRig = { yaw: 0, pitch: 0.22, distance: 5.2, fov: 62, idleLook: 0, aiming: false, override: null };
const target = new THREE.Vector3(), desired = new THREE.Vector3(), look = new THREE.Vector3();

export function snapCameraBehind(heading) { cameraRig.yaw = heading; cameraRig.pitch = 0.2; cameraRig.snap = true; }

/** Horizontal aim direction (unit vector on the ground plane) used by weapons and the player facing. */
export function getAimHeading() { return cameraRig.yaw; }
export function getAimPitch() { return cameraRig.pitch; }

export function updateFollowCamera(dt) {
  const cam = game.camera, player = game.player;
  if (cameraRig.override) {            // cinematic / screenshot camera
    const o = cameraRig.override;
    cam.position.set(o.x, o.y, o.z); cam.fov = o.fov || 55; cam.updateProjectionMatrix();
    cam.lookAt(o.tx, o.ty, o.tz);
    return;
  }
  if (!player) return;
  const sens = 0.0024 * getSettings().mouseSensitivity;
  const d = consumeMouseDelta();
  const moved = Math.abs(d.x) + Math.abs(d.y) > 0.5;
  cameraRig.yaw = wrapAngle(cameraRig.yaw - d.x * sens);
  cameraRig.pitch = clamp(cameraRig.pitch + d.y * sens, -0.35, 1.15);
  cameraRig.idleLook = moved ? 0 : cameraRig.idleLook + dt;
  const vehicle = player.vehicle;
  let dist, height, fov, shoulder = 0;
  if (vehicle) {
    const speed = Math.abs(vehicle.speed);
    if (cameraRig.idleLook > 1.2) {     // drift back behind the car, leading slightly into turns
      const back = vehicle.speed < -2 ? vehicle.heading + Math.PI : vehicle.heading;
      cameraRig.yaw = dampAngle(cameraRig.yaw, back, 3.2, dt);
      cameraRig.pitch = damp(cameraRig.pitch, 0.2, 2, dt);
    }
    dist = 8.2 + speed * 0.07 + vehicle.spec.length * 0.5; height = 1.3; fov = 60 + Math.min(22, speed * 0.42);
    target.set(vehicle.pos.x, vehicle.pos.y + 1.4, vehicle.pos.z);
  } else {
    cameraRig.aiming = getMouse().right && player.state !== 'down' && player.health > 0;
    dist = cameraRig.aiming ? 2.7 : 5.4; height = 1.55; fov = cameraRig.aiming ? 48 : 62; shoulder = cameraRig.aiming ? 0.75 : 0.45;
    target.set(player.pos.x, player.pos.y + height, player.pos.z);
  }
  cameraRig.distance = cameraRig.snap ? dist : damp(cameraRig.distance, dist, 6, dt);
  cameraRig.fov = cameraRig.snap ? fov : damp(cameraRig.fov, fov, 5, dt);
  const fx = Math.sin(cameraRig.yaw), fz = Math.cos(cameraRig.yaw), cp = Math.cos(cameraRig.pitch), sp = Math.sin(cameraRig.pitch);
  // shoulder offset to the right of the view direction
  target.x += -fz * shoulder; target.z += fx * shoulder;
  let dd = cameraRig.distance;
  const hit = raycastStatics(target.x, target.z, -fx, -fz, dd * cp + 0.6, 4);
  if (hit !== Infinity) dd = Math.max(1.2, (hit - 0.5) / Math.max(0.2, cp));
  desired.set(target.x - fx * cp * dd, Math.max(0.5, target.y + sp * dd + (vehicle ? 1.2 : 0.2)), target.z - fz * cp * dd);
  if (cameraRig.snap) cam.position.copy(desired); else cam.position.lerp(desired, 1 - Math.exp(-14 * dt));
  cameraRig.snap = false;
  if (game.cameraShake > 0.001) {
    const s = game.cameraShake;
    cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
    game.cameraShake = Math.max(0, s - dt * 2.2 - s * dt * 4);
  }
  look.set(target.x + fx * 14, target.y - sp * 14 * 0.9 + (vehicle ? 0.6 : 0.3), target.z + fz * 14);
  cam.fov = cameraRig.fov; cam.updateProjectionMatrix();
  cam.lookAt(look);
}
