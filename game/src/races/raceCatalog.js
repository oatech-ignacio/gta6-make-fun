// Job: data for the street races of Palmera Bay. Where each one starts, its checkpoints (street intersections),
// laps, buy-in, prize and par time, plus the three rival drivers who line up against the player. No race logic.
import { GRID_X, GRID_Z, CAUSEWAY_Z, PLACES } from '../world/cityLayout.js';

const EAST = Math.PI / 2, SOUTH = 0, CZ = CAUSEWAY_Z;

export const RACES = [
  { id: 'boulevard', name: 'Boulevard Sprint', laps: 1, buyIn: 200, prize: 1200, par: 92,
    start: { x: PLACES.raceStart.x, z: PLACES.raceStart.z, heading: SOUTH },
    checkpoints: [[GRID_X[9], -144], [GRID_X[9], 48], [GRID_X[9], 240], [GRID_X[7], 240], [GRID_X[7], 48], [GRID_X[5], 48], [GRID_X[5], -144], [GRID_X[7], -144], [GRID_X[7], -336], [GRID_X[9], -336], [GRID_X[9], -290]] },
  { id: 'neon', name: 'Neon Row Circuit', laps: 2, buyIn: 300, prize: 2000, par: 80,
    start: { x: 70, z: GRID_Z[3] + 3.75, heading: EAST },
    checkpoints: [[GRID_X[7], GRID_Z[3]], [GRID_X[7], GRID_Z[4]], [GRID_X[5], GRID_Z[4]], [GRID_X[5], GRID_Z[3]]] },
  { id: 'causeway', name: 'Causeway Drag', laps: 1, buyIn: 500, prize: 3500, par: 60,
    start: { x: -390, z: CZ + 3.75, heading: EAST },
    checkpoints: [[-240, CZ], [-48, CZ], [144, CZ], [336, CZ], [470, CZ], [600, CZ], [745, CZ]] },
];

// pace is a fraction of the car's top speed
export const RACE_RIVALS = [
  { name: 'Vega', type: 'sports', color: 0x12d6c9, pace: 0.7 },
  { name: 'Tomas', type: 'muscle', color: 0xffc21a, pace: 0.74 },
  { name: 'Kiko', type: 'sports', color: 0x7a2bff, pace: 0.64 },
];
