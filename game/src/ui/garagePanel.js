// Job: render the garage panel. WORKSHOP / SHOWROOM tabs, the car's stat bars (gold = stock, green = bought
// upgrades), respray swatches, the priced workshop rows with stage pips and OWNED states, and the showroom
// collection with OWNED / LOCKED cars. Pure rendering; systems/garage.js owns the logic.
let el = null;
const root = () => el || (el = document.getElementById('garage-panel'));
const pct = (n) => (Math.max(0, Math.min(1, n)) * 100).toFixed(0);

function rowHtml(r) {
  const pips = r.max ? `<u class="pips">${'<i class="on"></i>'.repeat(r.level)}${'<i></i>'.repeat(r.max - r.level)}</u>` : '';
  const note = r.note ? `<small>${r.note}</small>` : '';
  const chip = r.state === 'owned' ? `<em class="owned">${r.stateText}</em>` : `<b>${r.price}</b>`;
  return `<div class="g-row ${r.state}"><kbd>${r.key}</kbd><span>${r.label}${note}</span>${pips}${chip}</div>`;
}

function swatchHtml(s) {
  return `<div class="g-sw${s.on ? ' on' : ''}"><i style="background:${s.swatch}"></i><kbd>${s.key}</kbd><small>${s.label}</small></div>`;
}

function carHtml(c) {
  return `<div class="g-row ${c.owned ? 'owned' : 'locked'}"><span>${c.name}<small>${c.klass} &middot; $${c.value.toLocaleString('en-US')}</small></span>${c.owned ? '<em class="owned">OWNED</em>' : '<em class="locked">LOCKED</em>'}</div>`;
}

export function showGaragePanel(menu) {
  const bars = menu.stats.map((s) => `<div class="gbar"><span>${s.label}</span><div><i style="width:${pct(s.value)}%"></i><u style="width:${pct(s.gain)}%"></u></div></div>`).join('');
  const tabs = `<div class="g-tabs"><span class="${menu.tab === 'workshop' ? 'on' : ''}">WORKSHOP</span><span class="${menu.tab === 'showroom' ? 'on' : ''}">SHOWROOM <small>${menu.owned}/${menu.collection.length}</small></span><kbd>Q</kbd></div>`;
  const head = `<h2>${menu.title.toUpperCase()}</h2><p>${menu.car}<b>${menu.cash}</b></p>`;
  const body = menu.tab === 'showroom'
    ? `<h3>COLLECTION &middot; drive a model to add it</h3><div class="g-cars">${menu.collection.map(carHtml).join('')}</div>`
    : `${bars}<h3>RESPRAY <small>${menu.paintPrice} &middot; clears an unseen wanted level</small></h3><div class="g-swatches">${menu.swatches.map(swatchHtml).join('')}</div>
      <h3>WORKSHOP</h3>${menu.rows.map(rowHtml).join('')}`;
  root().innerHTML = `${tabs}${head}${body}<div class="g-foot"><kbd>E</kbd> leave the garage</div>`;
  root().classList.remove('hidden');
}

export function hideGaragePanel() { root().classList.add('hidden'); }
