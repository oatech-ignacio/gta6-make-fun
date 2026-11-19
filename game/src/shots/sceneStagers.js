// Live entity staging helpers; traffic, pedestrians and pursuit use the normal game brains.
import { game } from '../core/gameState.js';
import { GRID_X, GRID_Z } from '../world/cityLayout.js';
import { spawnVehicle } from '../vehicles/vehiclePhysics.js';
import { assignTrafficRoute } from '../vehicles/trafficAI.js';
import { spawnCharacter, randomCivilianLook } from '../characters/characterEntity.js';
import { createPursuitBrain } from '../police/policeCruiserAI.js';
import { nearestNode } from '../world/roadNetwork.js';

export function setProgressState(money, respect, missionIndex) {
  game.money = money; game.respect = respect; game.missionIndex = missionIndex;
  Object.assign(game.stats, { carsStolen: 23, taxiFares: 7, racesWon: 2, flamingos: 4, bustedCount: 1, wastedCount: 3, distance: 61000, kills: 12, crewCalls: 9 });
  // side progress that goes with those numbers: the crew is hired, two races are won, the car is part tuned
  game.allies = { sable: true, gus: true, wren: true };
  game.races = { wins: { boulevard: true, neon: true }, best: { boulevard: 84.2, neon: 71.6 } };
  Object.assign(game.garage, { engine: 2, armor: 1, tyres: 1, resprays: 5, plateSwaps: 2, visited: { respray: true, customs: true } });
}

export function pursuitCruiser(x, z, heading, speed, type = 'police') {
  const v = spawnVehicle(type, x, z, heading);
  v.ai = createPursuitBrain(); v.siren = true; v.sirenPhase = Math.round(x) % 2 ? 0 : 1 / 7;
  v.vx = Math.sin(heading) * speed; v.vz = Math.cos(heading) * speed;
  return v;
}

export function trafficCar(type, x, z, heading, color) {
  const net = game.city.network, v = spawnVehicle(type, x, z, heading, color !== undefined ? { color } : {});
  const from = nearestNode(net, x - Math.sin(heading) * 50, z - Math.cos(heading) * 50), to = nearestNode(net, x + Math.sin(heading) * 50, z + Math.cos(heading) * 50);
  if (from !== to) assignTrafficRoute(v, from.id, to.id, { lane: Math.abs(heading) < 0.1 || Math.abs(Math.abs(heading) - Math.PI) < 0.1 ? Math.abs(x - GRID_X.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a)) : Math.abs(z - GRID_Z.reduce((a, b) => Math.abs(b - z) < Math.abs(a - z) ? b : a)) });
  v.vx = Math.sin(heading) * 10; v.vz = Math.cos(heading) * 10;
  return v;
}

export function fleeingPed(x, z, fromX, fromZ) {
  const ped = spawnCharacter({ x, z, kind: 'ped', look: randomCivilianLook(game.rng), heading: Math.atan2(x - fromX, z - fromZ) });
  ped.panic = 30; ped.fleeFrom = { x: fromX, z: fromZ }; ped.state = 'flee';
  return ped;
}

export function advanceScene(api, seconds = 3) {
  for (let i = 0; i < seconds * 30; i++) api.simulateWorld(1 / 30, 1 / 30);
}
