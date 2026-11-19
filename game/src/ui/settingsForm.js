// Settings controls (volume, radio, mouse, bloom, shadows) shared by the start screen and the pause menu.
import { getSettings, updateSetting } from '../systems/settings.js';
import { setMasterVolume } from '../audio/audioEngine.js';

export function settingsHtml() {
  const st = getSettings();
  return `<label>Master volume <input data-set="masterVolume" type="range" min="0" max="1" step="0.05" value="${st.masterVolume}"></label>
    <label>Radio volume <input data-set="musicVolume" type="range" min="0" max="1" step="0.05" value="${st.musicVolume}"></label>
    <label>Mouse sensitivity <input data-set="mouseSensitivity" type="range" min="0.3" max="2.5" step="0.05" value="${st.mouseSensitivity}"></label>
    <label>Bloom and glow <input data-set="bloom" type="checkbox" ${st.bloom ? 'checked' : ''}></label>
    <label>Sun shadows <input data-set="shadows" type="checkbox" ${st.shadows ? 'checked' : ''}></label>`;
}

/** Wires the inputs produced by settingsHtml() inside `host`; graphics toggles call `onGraphicsChanged`. */
export function bindSettings(host, onGraphicsChanged) {
  host.querySelectorAll('[data-set]').forEach((input) => {
    const name = input.dataset.set;
    input.oninput = input.onchange = () => {
      const value = input.type === 'checkbox' ? input.checked : Number(input.value);
      updateSetting(name, value);
      if (name === 'masterVolume') setMasterVolume(value);
      if (input.type === 'checkbox' && onGraphicsChanged) onGraphicsChanged();
    };
  });
}
