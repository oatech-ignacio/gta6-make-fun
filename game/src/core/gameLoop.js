// requestAnimationFrame loop with a clamped timestep, plus manual stepping for tests/screenshots.
let updateFn = null, renderFn = null, running = false, last = 0;

function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  updateFn(dt);
  renderFn();
  requestAnimationFrame(frame);
}
export function startGameLoop(update, render) {
  updateFn = update; renderFn = render; running = true; last = performance.now();
  requestAnimationFrame(frame);
}
export function stopGameLoop() { running = false; }
/** Advance the simulation by fixed steps without waiting for real time (fast-forward). */
export function stepSimulation(seconds, step = 1 / 30) {
  const n = Math.max(1, Math.round(seconds / step));
  for (let i = 0; i < n; i++) updateFn(step);
}
export function renderOnce() { renderFn(); }
