// Story dialogue box: speaker portrait, name and role, line-by-line playback (Enter skips ahead).
import { wasKeyPressed } from '../core/input.js';
import { getCastMember } from '../missions/storyCharacters.js';
import { CHARACTER_LOOKS, drawCharacterPortrait } from '../characters/characterMeshFactory.js';
import { playSound } from '../audio/soundEffects.js';
import { game } from '../core/gameState.js';

const state = { lines: null, index: 0, timer: 0, onDone: null };

function showLine() {
  const line = state.lines[state.index], cast = getCastMember(line.who);
  document.getElementById('dialogue-who').innerHTML = `${cast.name.toUpperCase()}<small>${cast.role}</small>`;
  document.getElementById('dialogue-text').textContent = line.text;
  drawCharacterPortrait(document.getElementById('dialogue-portrait'), CHARACTER_LOOKS[cast.look] || CHARACTER_LOOKS.gang, cast.portrait);
  document.getElementById('dialogue').classList.remove('hidden');
  state.timer = 2.4 + line.text.length * 0.052;
  if (game.player) playSound('talk', game.player.pos);
}

export function playDialogue(lines, onDone) {
  state.lines = lines; state.index = 0; state.onDone = onDone || null;
  showLine();
}

export function stopDialogue() {
  state.lines = null; state.onDone = null;
  document.getElementById('dialogue').classList.add('hidden');
}

export function isDialogueActive() { return !!state.lines; }

export function updateDialogue(realDt) {
  if (!state.lines) return;
  state.timer -= realDt;
  if (state.timer <= 0 || wasKeyPressed('Enter') || wasKeyPressed('NumpadEnter')) {
    state.index++;
    if (state.index >= state.lines.length) { const done = state.onDone; stopDialogue(); if (done) done(); }
    else showLine();
  }
}
