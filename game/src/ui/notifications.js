// Toast notifications stacked under the mission name (tips, rewards, police scanner chatter).
const MAX_NOTES = 4;

export function showNotification(html, kind = '', seconds = 4) {
  const host = document.getElementById('notifications');
  if (!host) return null;
  const note = document.createElement('div');
  note.className = 'note ' + kind;
  note.innerHTML = html;       // trusted, game-authored strings only
  host.appendChild(note);
  while (host.children.length > MAX_NOTES) host.removeChild(host.firstChild);
  if (seconds > 0) setTimeout(() => { if (note.parentNode) note.parentNode.removeChild(note); }, seconds * 1000);
  return note;
}

export function clearNotifications() { const host = document.getElementById('notifications'); if (host) host.textContent = ''; }
