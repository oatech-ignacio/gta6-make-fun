// Tiny publish/subscribe bus that decouples gameplay systems (crimes, money, missions, UI).
const listeners = new Map();
export function onEvent(name, handler) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(handler);
  return () => offEvent(name, handler);
}
export function offEvent(name, handler) {
  const list = listeners.get(name);
  if (list) { const i = list.indexOf(handler); if (i >= 0) list.splice(i, 1); }
}
export function emitEvent(name, payload) {
  const list = listeners.get(name);
  if (list) for (const handler of list.slice()) handler(payload);
}
