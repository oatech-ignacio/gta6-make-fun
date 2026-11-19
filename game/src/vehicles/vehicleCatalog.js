// Every drivable vehicle type in Palmera Bay: original names, handling numbers, dimensions and paint options.
export const VEHICLE_TYPES = {
  sports: { key: 'sports', name: 'Marlin RS', klass: 'Sports', maxSpeed: 58, accel: 26, brake: 44, turn: 2.5, grip: 7.0, mass: 1300, length: 4.5, width: 1.95, height: 1.18, value: 9500, weight: 0.08,
    colors: [0xff2d55, 0xffc21a, 0x12d6c9, 0xf5f5f5, 0xff6a00, 0x7a2bff] },
  muscle: { key: 'muscle', name: 'Kestrel V8', klass: 'Muscle', maxSpeed: 52, accel: 24, brake: 36, turn: 2.2, grip: 5.2, mass: 1600, length: 4.9, width: 1.95, height: 1.32, value: 6200, weight: 0.1,
    colors: [0x1b1b22, 0xb5121b, 0x1f4fb5, 0xe8a01a, 0x2f7d4f] },
  sedan: { key: 'sedan', name: 'Calder Brisa', klass: 'Sedan', maxSpeed: 42, accel: 16, brake: 34, turn: 2.3, grip: 6.4, mass: 1500, length: 4.7, width: 1.85, height: 1.45, value: 2800, weight: 0.3,
    colors: [0xc9ced6, 0x26303f, 0x7c1f2a, 0x1d4b7a, 0xe6e1d3, 0x4a5d4f, 0x8a6f4d] },
  compact: { key: 'compact', name: 'Pico 3', klass: 'Compact', maxSpeed: 38, accel: 15, brake: 34, turn: 2.7, grip: 6.8, mass: 1050, length: 3.7, width: 1.7, height: 1.5, value: 1500, weight: 0.2,
    colors: [0xffd23f, 0x3fc1ff, 0xff7fb0, 0x9be36b, 0xffffff, 0xff8a3d] },
  pickup: { key: 'pickup', name: 'Toro Mesa', klass: 'Pickup', maxSpeed: 40, accel: 15, brake: 30, turn: 2.0, grip: 5.6, mass: 2100, length: 5.4, width: 2.0, height: 1.8, value: 3200, weight: 0.14,
    colors: [0x8c2f1b, 0x2b3a4a, 0xd9d4c7, 0x35543b, 0x1e1e1e] },
  van: { key: 'van', name: 'Burro Hauler', klass: 'Van', maxSpeed: 35, accel: 12, brake: 28, turn: 1.9, grip: 5.4, mass: 2400, length: 5.5, width: 2.05, height: 2.3, value: 2600, weight: 0.1,
    colors: [0xf2f2f2, 0x2f6fb0, 0xd9a520, 0x596673] },
  taxi: { key: 'taxi', name: 'Sunfare Cab', klass: 'Taxi', maxSpeed: 43, accel: 17, brake: 34, turn: 2.3, grip: 6.4, mass: 1550, length: 4.7, width: 1.85, height: 1.45, value: 2000, weight: 0.08,
    colors: [0xffc400] },
  police: { key: 'police', name: 'Bay Patrol Interceptor', klass: 'Police', maxSpeed: 55, accel: 25, brake: 42, turn: 2.4, grip: 6.8, mass: 1750, length: 4.9, width: 1.92, height: 1.45, value: 0, weight: 0,
    colors: [0xf4f6fa] },
  swat: { key: 'swat', name: 'Bay Patrol Bulwark', klass: 'Police', maxSpeed: 46, accel: 19, brake: 34, turn: 2.0, grip: 6.0, mass: 3200, length: 5.6, width: 2.15, height: 2.2, value: 0, weight: 0,
    colors: [0x20242c] },
  bike: { key: 'bike', name: 'Avispa 600', klass: 'Motorbike', maxSpeed: 56, accel: 30, brake: 40, turn: 2.9, grip: 7.4, mass: 260, length: 2.2, width: 0.8, height: 1.15, value: 3800, weight: 0,
    colors: [0xff2d55, 0x11c5d9, 0xf5f5f5, 0xffb300] },
};

export const TRAFFIC_TYPES = Object.values(VEHICLE_TYPES).filter((t) => t.weight > 0);

export function pickTrafficType(rng) {
  const total = TRAFFIC_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of TRAFFIC_TYPES) { r -= t.weight; if (r <= 0) return t; }
  return TRAFFIC_TYPES[0];
}

export function getVehicleSpec(key) { return VEHICLE_TYPES[key] || VEHICLE_TYPES.sedan; }
export const UNITS_TO_MPH = 2.6;
