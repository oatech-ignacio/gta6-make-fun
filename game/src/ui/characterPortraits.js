// 2D canvas portraits of characters (head and shoulders) for the dialogue box.
/** Paints a head-and-shoulders portrait of a look onto a 2D canvas (dialogue box, pause map). */
export function drawCharacterPortrait(canvas, look, background = ['#ff7a3d', '#7a2bff']) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, hex = (h) => '#' + h.toString(16).padStart(6, '0');
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, background[0]); g.addColorStop(1, background[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(W * 0.72, H * 0.3, W * 0.28, 0, 7); ctx.fill();
  ctx.fillStyle = hex(look.shirt); ctx.beginPath(); ctx.moveTo(W * 0.08, H); ctx.lineTo(W * 0.2, H * 0.74); ctx.lineTo(W * 0.8, H * 0.74); ctx.lineTo(W * 0.92, H); ctx.fill();
  if (look.undershirt || look.tie) { ctx.fillStyle = hex(look.undershirt || look.tie); ctx.fillRect(W * 0.44, H * 0.74, W * 0.12, H * 0.3); }
  ctx.fillStyle = hex(look.skin); ctx.fillRect(W * 0.42, H * 0.6, W * 0.16, H * 0.18);
  if (look.longHair) { ctx.fillStyle = hex(look.hair); ctx.fillRect(W * 0.24, H * 0.24, W * 0.52, H * 0.52); }
  ctx.fillStyle = hex(look.skin); ctx.beginPath(); ctx.roundRect(W * 0.3, H * 0.2, W * 0.4, H * 0.46, W * 0.12); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(W * 0.5, H * 0.2, W * 0.2, H * 0.46);
  ctx.fillStyle = hex(look.hair); ctx.beginPath(); ctx.roundRect(W * 0.28, H * 0.14, W * 0.44, H * 0.16, W * 0.08); ctx.fill();
  ctx.fillStyle = '#0c0c12'; ctx.beginPath(); ctx.roundRect(W * 0.32, H * 0.36, W * 0.36, H * 0.09, 4); ctx.fill();     // shades
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(W * 0.35, H * 0.375, W * 0.08, H * 0.02);
  ctx.strokeStyle = 'rgba(60,20,20,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(W * 0.43, H * 0.56); ctx.quadraticCurveTo(W * 0.5, H * 0.585, W * 0.58, H * 0.55); ctx.stroke();
  const top = look.hat || look.cap || look.helmet || look.bandana;
  if (top) { ctx.fillStyle = hex(top); ctx.beginPath(); ctx.roundRect(look.hat ? W * 0.14 : W * 0.27, H * 0.13, look.hat ? W * 0.72 : W * 0.46, H * 0.09, 6); ctx.fill(); if (look.hat || look.cap) { ctx.beginPath(); ctx.roundRect(W * 0.32, H * 0.04, W * 0.36, H * 0.13, 8); ctx.fill(); } }
}
