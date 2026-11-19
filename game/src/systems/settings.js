// Player settings (volume, mouse sensitivity, graphics) persisted to localStorage.
const KEY = 'palmeraHeat.settings.v1';
const settings = { masterVolume: 0.7, musicVolume: 0.6, mouseSensitivity: 1, bloom: true, shadows: true };

export function loadSettings() {
  try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(settings, JSON.parse(raw)); } catch (err) { /* private mode */ }
  return settings;
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (err) { /* ignore */ } }
export function getSettings() { return settings; }
export function updateSetting(name, value) { settings[name] = value; saveSettings(); }
