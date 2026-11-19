// Keyboard + mouse state with pointer lock; "pressed" edges are valid for one frame.
const down = new Set();
const pressed = new Set();
const mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, wheel: 0, locked: false };
let canvasRef = null;
let lockEnabled = false;

export function initInput(canvas) {
  canvasRef = canvas;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => { down.clear(); mouse.left = mouse.right = false; });
  window.addEventListener('mousemove', (e) => {
    if (mouse.locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
    if (lockEnabled && !mouse.locked && e.target === canvasRef) requestPointerLock();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
  window.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { mouse.locked = document.pointerLockElement === canvasRef; });
}
export function requestPointerLock() {
  try { const p = canvasRef && canvasRef.requestPointerLock && canvasRef.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* headless */ }
}
export function releasePointerLock() { if (document.pointerLockElement) document.exitPointerLock(); }
export function setPointerLockEnabled(on) { lockEnabled = on; if (!on) releasePointerLock(); }
export function isKeyDown(code) { return down.has(code); }
export function wasKeyPressed(code) { return pressed.has(code); }
export function getMouse() { return mouse; }
export function consumeMouseDelta() { const d = { x: mouse.dx, y: mouse.dy }; mouse.dx = 0; mouse.dy = 0; return d; }
export function endInputFrame() { pressed.clear(); mouse.leftPressed = false; mouse.wheel = 0; }
/** Test / screenshot helper: inject a key state without a real keyboard. */
export function simulateKey(code, isDown) { if (isDown) { down.add(code); pressed.add(code); } else down.delete(code); }
export function moveAxis() {
  return {
    x: (isKeyDown('KeyD') || isKeyDown('ArrowRight') ? 1 : 0) - (isKeyDown('KeyA') || isKeyDown('ArrowLeft') ? 1 : 0),
    y: (isKeyDown('KeyW') || isKeyDown('ArrowUp') ? 1 : 0) - (isKeyDown('KeyS') || isKeyDown('ArrowDown') ? 1 : 0),
  };
}
