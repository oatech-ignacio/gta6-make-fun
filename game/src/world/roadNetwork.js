// Road graph over the street grid: intersections (nodes), road segments (edges), lanes and pathfinding.
import { GRID_X, GRID_Z, ROAD_HALF, CAUSEWAY_Z } from './cityLayout.js';

export function buildRoadNetwork() {
  const nodes = [], edges = [];
  const cols = GRID_X.length, rows = GRID_Z.length;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    nodes.push({ id: j * cols + i, i, j, x: GRID_X[i], z: GRID_Z[j], links: [], signal: true });
  }
  const link = (a, b, noTraffic = false) => {
    const horizontal = Math.abs(a.z - b.z) < 1;
    const edge = { id: edges.length, a: a.id, b: b.id, horizontal, length: Math.hypot(a.x - b.x, a.z - b.z), noTraffic };
    edges.push(edge);
    a.links.push({ to: b.id, edge }); b.links.push({ to: a.id, edge });
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const n = nodes[j * cols + i];
    if (i + 1 < cols) link(n, nodes[j * cols + i + 1]);
    if (j + 1 < rows) link(n, nodes[(j + 1) * cols + i]);
  }
  // Pelican Causeway out to Isla Dorada (player and mission traffic only).
  const bridgeEnd = { id: nodes.length, i: 10, j: 2, x: 704, z: CAUSEWAY_Z, links: [], signal: false };
  nodes.push(bridgeEnd);
  const islandHub = { id: nodes.length, i: 11, j: 2, x: 790, z: CAUSEWAY_Z, links: [], signal: false };
  nodes.push(islandHub);
  link(nodes[2 * cols + 9], bridgeEnd, true);
  link(bridgeEnd, islandHub, true);
  return { nodes, edges, cols, rows };
}

export function nearestNode(network, x, z) {
  let best = null, bd = Infinity;
  for (const n of network.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}

/** Breadth-first route between two intersections; returns node ids including both ends. */
export function findNodePath(network, fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, -1]]);
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift();
    if (id === toId) break;
    for (const l of network.nodes[id].links) if (!prev.has(l.to)) { prev.set(l.to, id); queue.push(l.to); }
  }
  if (!prev.has(toId)) return [fromId];
  const path = [];
  for (let id = toId; id !== -1; id = prev.get(id)) path.push(id);
  return path.reverse();
}

/** The driving line of one lane from node a to node b (right-hand traffic). */
export function getLaneLine(network, fromId, toId, laneOffset) {
  const a = network.nodes[fromId], b = network.nodes[toId];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
  const rx = -dz, rz = dx;   // right-hand side of travel
  return { sx: a.x + rx * laneOffset, sz: a.z + rz * laneOffset, dx, dz, len, heading: Math.atan2(dx, dz) };
}

export function pickNextNode(network, fromId, atId, rng, allowNoTraffic = false) {
  const options = network.nodes[atId].links.filter((l) => l.to !== fromId && (allowNoTraffic || !l.edge.noTraffic));
  if (!options.length) return fromId;
  return rng.pick(options).to;
}

/** Closest point on any road centre line: used for spawning, roadblocks and "is the player on a road". */
export function nearestRoadPoint(network, x, z) {
  let best = null, bd = Infinity;
  for (const e of network.edges) {
    const a = network.nodes[e.a], b = network.nodes[e.b];
    const ex = b.x - a.x, ez = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / (e.length * e.length)));
    const px = a.x + ex * t, pz = a.z + ez * t;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bd) { bd = d; best = { edge: e, t, x: px, z: pz, dist: 0, dx: ex / e.length, dz: ez / e.length }; }
  }
  best.dist = Math.sqrt(bd);
  return best;
}

export function randomTrafficEdge(network, rng) {
  for (let k = 0; k < 20; k++) { const e = rng.pick(network.edges); if (!e.noTraffic) return e; }
  return network.edges[0];
}

export function intersectionHalfSize() { return ROAD_HALF; }
