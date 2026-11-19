// Money and respect: earning, spending, respect ranks and what each rank unlocks.
import { game } from '../core/gameState.js';
import { emitEvent } from '../core/eventBus.js';

export const RESPECT_RANKS = [
  { name: 'Street Rat', at: 0, unlock: 'Pistols at Iron Pelican Arms' },
  { name: 'Hustler', at: 100, unlock: 'Mako SMG, taxi fares pay double' },
  { name: 'Wheelman', at: 260, unlock: 'Tidebreaker shotgun, body armour' },
  { name: 'Shot Caller', at: 520, unlock: 'Boulevard Sprint high-stakes races' },
  { name: 'Kingpin of Palmera', at: 900, unlock: 'The whole bay answers to you' },
];

export function addMoney(amount, reason = '') {
  if (!amount) return;
  game.money = Math.max(0, game.money + amount);
  if (amount > 0) game.stats.moneyEarned += amount;
  emitEvent('moneyChanged', { amount, reason });
}

export function spendMoney(amount, reason = '') {
  if (game.money < amount) return false;
  game.money -= amount;
  emitEvent('moneyChanged', { amount: -amount, reason });
  return true;
}

export function addRespect(amount) {
  const before = getRespectRank().index;
  game.respect += amount;
  const after = getRespectRank();
  emitEvent('respectChanged', { amount });
  if (after.index > before) emitEvent('rankUp', after);
}

export function getRespectRank() {
  let index = 0;
  while (index < RESPECT_RANKS.length - 1 && game.respect >= RESPECT_RANKS[index + 1].at) index++;
  const rank = RESPECT_RANKS[index], next = RESPECT_RANKS[index + 1];
  const progress = next ? (game.respect - rank.at) / (next.at - rank.at) : 1;
  return { index, name: rank.name, unlock: rank.unlock, next: next ? next.name : null, progress };
}
