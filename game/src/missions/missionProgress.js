// Read-only view of story progress for the HUD and menus: which mission and act the player is on,
// the stage inside the active mission and the objective that comes after the current one.
import { game } from '../core/gameState.js';
import { STORY_MISSIONS, STORY_ACTS, getActForMission } from './storyMissions.js';
import { STORY_CAST } from './storyCharacters.js';

const plain = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');

/** Stages are the steps that give the player an objective (dialogue and instant set-up steps do not count). */
export function getMissionStages(def) { return def.steps.filter((s) => s.text); }

/** Banner data for the active story mission, or null in free roam. */
export function getActiveMissionInfo() {
  const m = game.activeMission;
  if (!m) return null;
  const stages = getMissionStages(m.def);
  let done = 0, nextStage = null;
  m.def.steps.forEach((s, i) => { if (!s.text) return; if (i <= m.stepIndex) done++; else if (!nextStage) nextStage = s; });
  const current = m.step && m.step.text ? m.step : null;
  return {
    number: m.index + 1, total: STORY_MISSIONS.length, title: m.def.title, giver: STORY_CAST[m.def.giver].name, act: getActForMission(m.index).name,
    stage: Math.max(1, done), stages: stages.length,
    current: current ? plain(current.text) : '',
    next: nextStage ? plain(nextStage.text) : 'Finish the job and collect your cut',
    timed: !!(current && current.timeLimit),
  };
}

/** The job waiting at the letter blip, or null once the story is finished. */
export function getNextMissionInfo() {
  const def = STORY_MISSIONS[game.missionIndex];
  if (!def) return null;
  return { number: game.missionIndex + 1, total: STORY_MISSIONS.length, title: def.title, giver: STORY_CAST[def.giver].name, giverKey: def.giver, act: getActForMission(game.missionIndex).name, blurb: def.blurb };
}

/** Short label such as "ACT II · 5/8 Smoke on the Causeway" used by save slots. */
export function describeStoryPosition(missionIndex) {
  const total = STORY_MISSIONS.length;
  if (missionIndex >= total) return { act: STORY_ACTS[STORY_ACTS.length - 1].name, label: 'Story complete', number: total, total };
  return { act: getActForMission(missionIndex).name, label: STORY_MISSIONS[missionIndex].title, number: missionIndex + 1, total };
}
