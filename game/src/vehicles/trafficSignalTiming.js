// Traffic signal phases: which axis has green at each intersection, queried by the traffic AI and the lamp models.
import { game } from '../core/gameState.js';

const CYCLE = 26, GREEN = 10.5, YELLOW = 2.5;

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
