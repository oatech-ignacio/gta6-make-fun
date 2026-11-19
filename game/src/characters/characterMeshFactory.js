// Low-poly humanoids built from tapered boxes: a merged torso/head mesh plus pivoted arms and legs
// so they can be animated. Looks (skin, clothes, hair, hats, uniforms) are data, geometry is cached per look.
import * as THREE from 'three';
import { GeometryBatch } from '../world/geometryBatcher.js';

const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68a5e, 0x9b6a45, 0x6f4a31, 0x54361f];
const SHIRTS = [0xff5d7a, 0x25c9c0, 0xffd23f, 0xff8a3d, 0xffffff, 0x4d7cff, 0xb46bff, 0x38c172, 0xf2f2f2, 0x222831, 0xff9ecb, 0x7bdff2];
const PANTS = [0x2d3a55, 0x1f2430, 0xd9c7a3, 0x5c7a9c, 0xf2efe6, 0x3b3b3b, 0x7a4f35, 0x356b6b];
const HAIR = [0x1a1410, 0x3a2516, 0x6b4423, 0xb8863b, 0xe8d28a, 0x8c8c8c, 0xb03a2e, 0x111111];

export const CHARACTER_LOOKS = {
  dez: { skin: 0xc68a5e, shirt: 0xd9263a, undershirt: 0xf5f5f5, pants: 0x27344d, hair: 0x15100c, shoes: 0xf2f2f2, openShirt: true },
  luz: { skin: 0xb9794f, shirt: 0xffc21a, pants: 0x1c1c24, hair: 0x1b0f0a, shoes: 0xff3d8b, longHair: true, shorts: false },
  benny: { skin: 0xd9a37a, shirt: 0x1aa7a0, pants: 0xe6dcc2, hair: 0xcfcfcf, shoes: 0x6b4423, hat: 0xf0e2b8, belly: true, floral: 0xffe14d },
  odette: { skin: 0x6f4a31, shirt: 0x3d5a80, pants: 0x30343c, hair: 0x2a1a12, shoes: 0x1a1a1a, longHair: true, bandana: 0xff5d5d },
  crane: { skin: 0xf1c9a5, shirt: 0xf7f3ea, pants: 0xf7f3ea, hair: 0xd8d2c4, shoes: 0x6b4423, tie: 0xff3d8b },
  pike: { skin: 0xe0ac86, shirt: 0x39404f, pants: 0x232733, hair: 0x4a3a2a, shoes: 0x111111, tie: 0x9b1c1c },
  cop: { skin: 0xe0ac86, shirt: 0x1d2f5e, pants: 0x151c33, hair: 0x1a1410, shoes: 0x0c0c0c, cap: 0x101a3a, badge: true },
  swat: { skin: 0xc68a5e, shirt: 0x1c1f26, pants: 0x1c1f26, hair: 0x111111, shoes: 0x0c0c0c, helmet: 0x15171c, vest: 0x2b303b },
  gang: { skin: 0xc68a5e, shirt: 0x0f7f86, pants: 0x1b1b1f, hair: 0x111111, shoes: 0xffffff, bandana: 0x19d3c5 },
  guard: { skin: 0x9b6a45, shirt: 0x8a8f99, pants: 0x2b2f3a, hair: 0x111111, shoes: 0x0c0c0c, cap: 0x2b2f3a, badge: true },
};

export function randomCivilianLook(rng) {
  const look = { skin: rng.pick(SKIN), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), hair: rng.pick(HAIR), shoes: rng.pick([0xffffff, 0x222222, 0x8a5a2b, 0xff5d7a]) };
  const r = rng();
  if (r < 0.32) { look.longHair = true; if (rng.chance(0.5)) look.skirt = true; }
  if (rng.chance(0.4)) look.shorts = true;
  if (rng.chance(0.16)) look.hat = rng.pick([0xf0e2b8, 0xffffff, 0xff5d7a, 0x222222]);
  else if (rng.chance(0.12)) look.cap = rng.pick(SHIRTS);
  if (rng.chance(0.2)) look.floral = rng.pick(SHIRTS);
  if (rng.chance(0.12)) look.belly = true;
  return look;
}

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.6 });
const cache = new Map();
function rgb(hex, m = 1) { const c = new THREE.Color(hex); return [c.r * m, c.g * m, c.b * m]; }

function buildGeometries(look) {
  const key = JSON.stringify(look);
  if (cache.has(key)) return cache.get(key);
  const skin = rgb(look.skin), shirt = rgb(look.shirt), pants = rgb(look.pants), hair = rgb(look.hair), shoes = rgb(look.shoes || 0x222222);
  const torso = new GeometryBatch();
  const tw = look.belly ? 0.56 : 0.48;
  torso.addBox(0, 1.2, 0, tw, 0.64, look.belly ? 0.36 : 0.27, { color: look.vest ? rgb(look.vest) : shirt, topScale: 0.92, bottom: true });
  torso.addBox(0, 0.92, 0, tw * 0.94, 0.14, 0.26, { color: look.skirt ? shirt : pants });                    // hips
  if (look.skirt) torso.addBox(0, 0.72, 0, 0.5, 0.36, 0.34, { color: shirt, topScale: 0.8 });
  if (look.openShirt) torso.addBox(0, 1.22, 0.14, 0.18, 0.56, 0.02, { color: rgb(look.undershirt) });
  if (look.floral) for (let k = 0; k < 7; k++) torso.addBox(((k * 37) % 9 - 4) * 0.05, 1.0 + ((k * 53) % 10) * 0.045, 0.142, 0.06, 0.06, 0.01, { color: rgb(look.floral) });
  if (look.tie) torso.addBox(0, 1.26, 0.14, 0.06, 0.42, 0.02, { color: rgb(look.tie) });
  if (look.badge) torso.addBox(0.13, 1.36, 0.14, 0.07, 0.08, 0.02, { color: [0.95, 0.8, 0.25] });
  torso.addBox(0, 1.56, 0, 0.14, 0.1, 0.14, { color: skin });                                                   // neck
  torso.addBox(0, 1.74, 0.005, 0.25, 0.28, 0.26, { color: skin, topScale: 0.92, bottom: true });                // head
  torso.addBox(0, 1.72, 0.14, 0.2, 0.05, 0.02, { color: [0.08, 0.08, 0.1] });                                   // sunglasses / eyes
  if (look.helmet) torso.addBox(0, 1.82, 0, 0.3, 0.22, 0.31, { color: rgb(look.helmet), topScale: 0.85 });
  else {
    torso.addBox(0, 1.86, -0.02, 0.27, 0.11, 0.27, { color: hair, topScale: 0.85 });
    torso.addBox(0, 1.76, -0.125, 0.27, 0.22, 0.05, { color: hair });
    if (look.longHair) torso.addBox(0, 1.6, -0.13, 0.3, 0.42, 0.09, { color: hair });
  }
  if (look.hat) { torso.addBox(0, 1.93, 0, 0.62, 0.03, 0.62, { color: rgb(look.hat) }); torso.addBox(0, 1.98, 0, 0.28, 0.1, 0.28, { color: rgb(look.hat) }); }
  if (look.cap) { torso.addBox(0, 1.93, 0, 0.28, 0.09, 0.28, { color: rgb(look.cap) }); torso.addBox(0, 1.9, 0.19, 0.24, 0.03, 0.14, { color: rgb(look.cap, 0.8) }); }
  if (look.bandana) torso.addBox(0, 1.84, 0, 0.275, 0.07, 0.275, { color: rgb(look.bandana) });
  // limbs are modelled hanging from their pivot at y = 0
  const arm = (sleeve) => { const b = new GeometryBatch(); b.addBox(0, -0.15, 0, 0.14, 0.32, 0.16, { color: sleeve, bottom: true }); b.addBox(0, -0.45, 0, 0.115, 0.3, 0.13, { color: skin, bottom: true }); b.addBox(0, -0.64, 0.01, 0.12, 0.1, 0.14, { color: skin, bottom: true }); return b.build(); };
  const leg = () => { const b = new GeometryBatch(); const upper = look.skirt ? skin : pants, lower = look.shorts || look.skirt ? skin : pants; b.addBox(0, -0.22, 0, 0.2, 0.44, 0.22, { color: upper }); b.addBox(0, -0.62, 0, 0.17, 0.38, 0.19, { color: lower }); b.addBox(0, -0.85, 0.045, 0.19, 0.1, 0.3, { color: shoes, bottom: true }); return b.build(); };
  const set = { torso: torso.build(), arm: arm(look.vest ? rgb(look.shirt) : shirt), leg: leg() };
  cache.set(key, set);
  return set;
}

/** Returns a Group; userData.parts = { body, armL, armR, legL, legR, gun } for the animator. */
export function createCharacterMesh(look) {
  const geo = buildGeometries(look);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(geo.torso, material); torso.castShadow = true;
  const mk = (g, x, y) => { const m = new THREE.Mesh(g, material); m.position.set(x, y, 0); m.castShadow = true; body.add(m); return m; };
  body.add(torso);
  const armL = mk(geo.arm, 0.31, 1.47), armR = mk(geo.arm, -0.31, 1.47);
  const legL = mk(geo.leg, 0.12, 0.9), legR = mk(geo.leg, -0.12, 0.9);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), gunMaterial);
  gun.position.set(0, -0.72, 0.1); gun.visible = false; armR.add(gun);
  root.userData.parts = { body, torso, armL, armR, legL, legR, gun };
  return root;
}

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
