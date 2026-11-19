// Garage panel: the car's stat bars (gold = stock, green = bought upgrades), paint swatches, repair, the three
// upgrade tracks with level pips and prices, and the plate swap. Pure rendering; systems/garage.js owns the logic.
let el = null;
const root = () => el || (el = document.getElementById('garage-panel'));
const pct = (n) => (Math.max(0, Math.min(1, n)) * 100).toFixed(0);

function rowHtml(r) {
  const swatch = r.swatch ? `<i class="sw" style="background:${r.swatch}"></i>` : '';
  const pips = r.max ? `<u class="pips">${'●'.repeat(r.level)}${'○'.repeat(r.max - r.level)}</u>` : '';
  return `<div class="shop-row"><kbd>${r.key}</kbd>${swatch}<span>${r.label}${pips}</span><b>${r.price}</b></div>`;
}

export function showGaragePanel(menu) {
  const bars = menu.stats.map((s) => `<div class="gbar"><span>${s.label}</span><div><i style="width:${pct(s.value)}%"></i><u style="width:${pct(s.gain)}%"></u></div></div>`).join('');
  root().innerHTML = `<h2>${menu.title.toUpperCase()}</h2><p>${menu.car} &middot; Cash ${menu.cash}</p>${bars}
    <h3>PAINT AND REPAIR</h3><div class="gpaints">${menu.paints.map(rowHtml).join('')}</div>
    <h3>UPGRADES AND PLATES</h3>${menu.upgrades.map(rowHtml).join('')}`;
  root().classList.remove('hidden');
}

export function hideGaragePanel() { root().classList.add('hidden'); }
