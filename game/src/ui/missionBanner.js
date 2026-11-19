// Mission banner (top left): MISSION n/8, title, STAGE x/y progress bar, the NEXT objective and a timer
// when the stage is timed. In free roam it points at the next job; side hustles reuse it with their own name.
import { getActiveMissionInfo, getNextMissionInfo } from '../missions/missionProgress.js';
import { formatTimer } from '../core/mathUtils.js';

const el = {};
let sideName = '', timerSeconds = null, lastKey = '';

export function initMissionBanner() {
  for (const id of ['mission-banner', 'mission-kicker', 'mission-name', 'mission-stage', 'mission-stage-bar', 'mission-next', 'mission-timer']) el[id] = document.getElementById(id);
}

/** Side activities (taxi fares, races) and screenshot scenes name the banner themselves. */
export function setMissionName(text) { sideName = text || ''; }
export function setMissionTimer(seconds) { timerSeconds = seconds === null || seconds === undefined ? null : seconds; }

function stageBar(stage, stages) {
  let html = '';
  for (let i = 1; i <= stages; i++) html += `<i class="${i < stage ? 'done' : i === stage ? 'now' : ''}"></i>`;
  return html;
}

export function updateMissionBanner() {
  const m = getActiveMissionInfo(), next = m ? null : getNextMissionInfo();
  let kicker, name, stage = '', bar = '', nextLine, mode;
  if (m) {
    mode = 'story'; kicker = `MISSION ${m.number}/${m.total} · ${m.act}`; name = m.title;
    stage = `STAGE ${m.stage}/${m.stages}`; bar = stageBar(m.stage, m.stages); nextLine = `<b>NEXT:</b> ${m.next}`;
  } else if (sideName) {
    mode = 'side'; kicker = 'SIDE HUSTLE'; name = sideName; nextLine = '';
  } else if (next) {
    mode = 'roam'; kicker = `FREE ROAM · STORY ${next.number - 1}/${next.total}`; name = next.title;
    nextLine = `<b>NEXT JOB:</b> see ${next.giver} at the gold <b>${next.giver[0]}</b> blip`;
  } else {
    mode = 'roam'; kicker = 'FREE ROAM · STORY COMPLETE'; name = 'Kingpin of Palmera'; nextLine = '<b>NEXT:</b> races, taxi fares, flamingos';
  }
  const key = [mode, kicker, name, stage, nextLine].join('|');
  if (key !== lastKey) {
    lastKey = key;
    el['mission-banner'].className = mode;
    el['mission-kicker'].textContent = kicker; el['mission-name'].textContent = name;
    el['mission-stage'].textContent = stage; el['mission-stage-bar'].innerHTML = bar;
    el['mission-stage'].parentElement.classList.toggle('hidden', !stage);
    el['mission-next'].innerHTML = nextLine; el['mission-next'].classList.toggle('hidden', !nextLine);
  }
  const t = el['mission-timer'];
  t.classList.toggle('hidden', timerSeconds === null);
  if (timerSeconds !== null) { const text = formatTimer(timerSeconds); if (t.textContent !== text) t.textContent = text; t.classList.toggle('low', timerSeconds < 15); }
}
