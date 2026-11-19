// Job: spawn and drive the rival racers. They are real vehicles on the normal physics,
// steered toward the next checkpoint by a small brain.
import { game } from '../core/gameState.js';
import { clamp, angleDiff } from '../core/mathUtils.js';
import { spawnVehicle, removeVehicle } from '../vehicles/vehiclePhysics.js';
import { RACE_RIVALS } from './raceCatalog.js';

/** Line the rivals up ahead of the start marker, alternating lanes. */
export function spawnRivals(def) {
  const h = def.start.heading, fx = Math.sin(h), fz = Math.cos(h);
  return RACE_RIVALS.map((spec, i) => {
    const ahead = 8 + i * 7, side = i % 2 ? 1.75 : -1.75;
    const v = spawnVehicle(spec.type, def.start.x + fx * ahead + fz * side, def.start.z + fz * ahead - fx * side, h, { color: spec.color });
    v.ai = { mode: 'racer' }; v.missionTag = 'race';
    return { v, name: spec.name, pace: v.spec.maxSpeed * spec.pace, done: 0, offset: side, stuck: 0 };
  });
}

export function removeRivals(rivals) { for (const r of rivals) if (!r.v.removed) removeVehicle(r.v); }

export function holdRival(r) { const c = r.v.controls; c.throttle = 0; c.steer = 0; c.brake = 1; }

/** Drive toward a point; returns the distance left. `slowAhead` brakes for a corner at the checkpoint. */
export function driveRival(r, tx, tz, slowAhead, dt) {
  const v = r.v, c = v.controls;
  if (v.wrecked || v.removed) return Infinity;
  const dx = tx - v.pos.x, dz = tz - v.pos.z, d = Math.hypot(dx, dz), diff = angleDiff(v.heading, Math.atan2(dx, dz));
  c.steer = clamp(diff * 2.4, -1, 1); c.handbrake = false;
  let desired = r.pace;
  if (Math.abs(diff) > 0.3) desired = Math.min(desired, 13);
  if (slowAhead && d < 30) desired = Math.min(desired, 16);
  if (v.speed < desired - 0.6) { c.throttle = 1; c.brake = 0; }
  else if (v.speed > desired + 1.5) { c.throttle = 0; c.brake = clamp((v.speed - desired) / 6, 0.15, 1); }
  else { c.throttle = 0.2; c.brake = 0; }
  // wedged against something: back out for a moment
  r.stuck = Math.abs(v.speed) < 1.5 ? r.stuck + dt : 0;
  if (r.stuck > 2.5) { c.throttle = -1; c.brake = 0; c.steer = -c.steer; if (r.stuck > 4) r.stuck = 0; }
  return d;
}
