// Character appearance data: the story cast's outfits, police and gang uniforms, and random civilians.
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
  vega: { skin: 0xb9794f, shirt: 0x101014, undershirt: 0x19d3c5, pants: 0x1b1b1f, hair: 0x111111, shoes: 0xffffff, bandana: 0x19d3c5, openShirt: true },
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
