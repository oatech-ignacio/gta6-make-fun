// Traffic signals at every grid intersection: timing, queries for the traffic AI, and instanced poles + lamps.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { GeometryBatch } from '../world/geometryBatcher.js';
import { ROAD_HALF } from '../world/cityLayout.js';

const CYCLE = 26, GREEN = 10.5, YELLOW = 2.5;
let lampMesh = null, lampRefs = [], lastTick = -1;
const color = new THREE.Color();

function nodeOffset(node) { return (node.i * 7 + node.j * 11) % CYCLE; }

/** Signal state for traffic travelling along the horizontal (east-west) or vertical axis through a node. */
export function getSignalState(node, horizontal, time = game.time) {
  if (!node.signal) return 'green';
  const t = (time + nodeOffset(node)) % CYCLE;
  const own = horizontal ? (t + CYCLE / 2) % CYCLE : t;
  if (own < GREEN) return 'green';
  if (own < GREEN + YELLOW) return 'yellow';
  return 'red';
}

export function buildTrafficLights(network) {
  const poleBatch = new GeometryBatch();
  poleBatch.addBox(0, 2.6, 0, 0.2, 5.2, 0.2, { color: [0.16, 0.17, 0.2] });
  poleBatch.addBox(0, 5.0, 1.6, 0.14, 0.14, 3.2, { color: [0.16, 0.17, 0.2] });
  poleBatch.addBox(0, 4.75, 3.1, 0.42, 1.3, 0.36, { color: [0.08, 0.08, 0.09] });
  const signalNodes = network.nodes.filter((n) => n.signal);
  const count = signalNodes.length * 4;
  const poles = new THREE.InstancedMesh(poleBatch.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), count);
  lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), count * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  lampRefs = [];
  let k = 0;
  const approaches = [[1, 0], [-1, 0], [0, 1], [0, -1]];   // direction of travel into the node
  for (const node of signalNodes) for (const [dx, dz] of approaches) {
    const rx = -dz, rz = dx, e = ROAD_HALF + 0.9;
    const px = node.x - dx * e + rx * e, pz = node.z - dz * e + rz * e;
    // the arm (local +z) reaches left over the lanes; lamps face the oncoming driver
    const armHeading = Math.atan2(-rx, -rz);
    q.setFromAxisAngle(up, armHeading); p.set(px, 0, pz); m.compose(p, q, one); poles.setMatrixAt(k, m);
    const hx = px - rx * 3.1 - dx * 0.24, hz = pz - rz * 3.1 - dz * 0.24;
    ['red', 'yellow', 'green'].forEach((name, li) => {
      p.set(hx, 5.15 - li * 0.4, hz); m.compose(p, q, one); lampMesh.setMatrixAt(k * 3 + li, m);
      lampMesh.setColorAt(k * 3 + li, color.setRGB(0.1, 0.1, 0.1));
    });
    lampRefs.push({ node, horizontal: dz === 0 });
    k++;
  }
  poles.instanceMatrix.needsUpdate = true; lampMesh.instanceMatrix.needsUpdate = true;
  poles.computeBoundingSphere(); lampMesh.computeBoundingSphere();
  const group = new THREE.Group(); group.name = 'trafficLights'; group.add(poles, lampMesh);
  lastTick = -1; updateTrafficLights(0);
  return group;
}

const LAMP_ON = { red: [4.5, 0.25, 0.2], yellow: [4, 2.6, 0.2], green: [0.2, 4.2, 1.1] };
const LAMP_OFF = { red: [0.22, 0.03, 0.03], yellow: [0.2, 0.14, 0.02], green: [0.02, 0.18, 0.06] };

export function updateTrafficLights(time) {
  const tick = Math.floor(time * 2);
  if (!lampMesh || tick === lastTick) return;
  lastTick = tick;
  lampRefs.forEach((ref, k) => {
    const state = getSignalState(ref.node, ref.horizontal, time);
    ['red', 'yellow', 'green'].forEach((name, li) => {
      const c = name === state ? LAMP_ON[name] : LAMP_OFF[name];
      lampMesh.setColorAt(k * 3 + li, color.setRGB(c[0], c[1], c[2]));
    });
  });
  lampMesh.instanceColor.needsUpdate = true;
}
