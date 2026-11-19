// The story of PALMERA HEAT as data: six chained missions, each a list of scripted steps with dialogue.
// Step types are executed by missionRunner.js.
import { PLACES, CAUSEWAY_Z } from '../world/cityLayout.js';

export const STORY_MISSIONS = [
  {
    id: 'fresh-off-the-bus', title: 'Fresh Off the Bus', giver: 'benny', place: 'bait', reward: { money: 1500, respect: 60 },
    blurb: 'Boost a Marlin RS off the promenade and get it to Odette in one piece.',
    steps: [
      { type: 'dialogue', lines: [
        { who: 'benny', text: 'Dez! Luz! My two favourite unemployed people. You want in? Prove you can deliver.' },
        { who: 'luz', text: "We deliver, Tio. What's the job?" },
        { who: 'benny', text: "A cherry-red Marlin RS on the promenade. Its owner is asleep on the beach. Mama Odette wants it at the docks, unscratched." },
        { who: 'dez', text: 'Unscratched. Sure. Define "scratch".' },
      ] },
      { type: 'stealVehicle', vehicle: 'sports', color: 0xff2d55, at: { x: 446, z: 118, heading: Math.PI }, text: 'Steal the <b>Marlin RS</b> parked on the promenade.' },
      { type: 'deliverVehicle', to: 'chopShop', minHealth: 35, text: "Drive the Marlin to <b>Odette's Auto</b> in Rustwater Docks. Keep it in one piece." },
      { type: 'dialogue', lines: [
        { who: 'odette', text: "Well, look at that. Four wheels and most of the paint. Benny's strays might be worth feeding." },
        { who: 'odette', text: 'Come back when you want real work, sugar. Bring your own gloves.' },
      ] },
      { type: 'giveWeapon', weapon: 'pistol', ammo: 36 },
    ],
  },
  {
    id: 'repo-rodeo', title: 'Repo Rodeo', giver: 'odette', place: 'chopShop', reward: { money: 2400, respect: 70 },
    blurb: "Run down Rudy Vance's Kestrel V8 and bring back what he owes.",
    steps: [
      { type: 'dialogue', lines: [
        { who: 'odette', text: 'Rudy "Two-Tone" Vance drove off my lot in a Kestrel V8 he never paid for.' },
        { who: 'odette', text: "He's circling the docks right now like he owns them. Ram him off the road and bring me his briefcase." },
        { who: 'dez', text: 'Finally. A job with bumpers.' },
      ] },
      { type: 'needVehicle', text: 'Get behind the wheel of <b>any vehicle</b>.' },
      { type: 'chase', vehicle: 'muscle', color: 0xe8a01a, from: { i: 3, j: 6 }, cruise: 23, damageTo: 30, text: "Ram <u>Rudy's Kestrel</u> until it gives out." },
      { type: 'collect', item: 'briefcase', atTarget: true, text: "Grab <b>Rudy's briefcase</b>." },
      { type: 'goto', place: 'chopShop', text: 'Bring the briefcase back to <b>Odette</b>.' },
      { type: 'dialogue', lines: [
        { who: 'odette', text: "Every dollar, plus interest. You drive like you're mad at the road, Dez. I like it." },
        { who: 'odette', text: 'Luz says she has something bigger cooking at the Luna Lounge. Go listen to her.' },
      ] },
    ],
  },
  {
    id: 'tide-tables', title: 'Tide Tables', giver: 'luz', place: 'club', reward: { money: 3200, respect: 80 },
    blurb: 'Run a van of "catering" across Pelican Causeway to Casa Marfil before the clock runs out.',
    steps: [
      { type: 'dialogue', lines: [
        { who: 'luz', text: 'Silas Crane throws a party on Isla Dorada tonight. His caterer just had an accident. We are the caterer now.' },
        { who: 'dez', text: "What's actually in the van?" },
        { who: 'luz', text: "Shrimp. And a transmitter the size of a shrimp. Get it through his gate before the guest list locks." },
      ] },
      { type: 'stealVehicle', vehicle: 'van', color: 0xf2f2f2, at: { x: 216, z: -36.5, heading: Math.PI / 2 }, text: 'Get in the <b>Burro Hauler</b> catering van.', owned: true },
      { type: 'deliverVehicle', to: { x: 760, z: CAUSEWAY_Z }, radius: 5, timeLimit: 125, minHealth: 30, text: 'Deliver the van to <b>Casa Marfil</b> on Isla Dorada before the gate closes.' },
      { type: 'dialogue', lines: [
        { who: 'crane', text: "You're late, and you're not Marcel. No matter. Park it and get off my island." },
        { who: 'pike', text: "Mr. Crane, I know that driver. Valet kid from the Heights. I'll see him off personally." },
      ] },
      { type: 'wanted', stars: 2 },
      { type: 'loseWanted', text: 'Lt. Pike made you. <b>Lose the cops</b> on the way back to the mainland.' },
      { type: 'dialogue', lines: [{ who: 'luz', text: "Transmitter's live. I can hear Crane's vault codes being read out like bingo numbers. Nice driving." }] },
    ],
  },
  {
    id: 'dockside-dispute', title: 'Dockside Dispute', giver: 'benny', place: 'bait', reward: { money: 4000, respect: 100 },
    blurb: "The Brine Kings jumped Benny's shipment at Pier 9. Take it back.",
    steps: [
      { type: 'dialogue', lines: [
        { who: 'benny', text: 'The Brine Kings hit my truck at Pier 9. Thirty crates of very expensive bait.' },
        { who: 'luz', text: 'Tio, nobody pays that much for worms.' },
        { who: 'benny', text: "That's why I need it back before anybody opens a crate. Take this, and take care of it." },
      ] },
      { type: 'giveWeapon', weapon: 'pistol', ammo: 72 },
      { type: 'goto', place: 'warehouse', radius: 26, text: 'Head to <b>Pier 9 Warehouse</b> at Rustwater Docks.' },
      { type: 'eliminate', look: 'gang', kind: 'gang', weapon: 'pistol', text: 'Take out the <u>Brine Kings</u> guarding the shipment.',
        enemies: [{ x: 92, z: 366 }, { x: 108, z: 370 }, { x: 100, z: 380 }, { x: 84, z: 386 }, { x: 116, z: 384 }, { x: 100, z: 392 }] },
      { type: 'collect', item: 'briefcase', at: { x: 100, z: 378 }, text: "Pick up <b>Benny's manifest</b>." },
      { type: 'goto', place: 'bait', text: 'Return to <b>Benny\'s Bait & Tackle</b>.' },
      { type: 'dialogue', lines: [{ who: 'benny', text: "You two are wasted on small fish. Luz, tell him about the bank. He's ready." }] },
    ],
  },
  {
    id: 'smoke-on-the-causeway', title: 'Smoke on the Causeway', giver: 'luz', place: 'club', reward: { money: 6000, respect: 130 },
    blurb: 'Luz is lifting the vault schematics. Be outside with the engine running.',
    steps: [
      { type: 'dialogue', lines: [
        { who: 'luz', text: "Crane's architect keeps the Banco Aurora schematics in an office on Marquee Avenue. I walk in, I walk out." },
        { who: 'luz', text: 'You sit outside in something fast. If I come out running, you drive like the bay is on fire.' },
        { who: 'dez', text: "That's the only way I know how." },
      ] },
      { type: 'needVehicle', text: 'Find a <b>fast car</b> for the getaway.' },
      { type: 'pickupPassenger', who: 'luz', at: { x: 58.5, z: 110 }, text: 'Pick up <b>Luz</b> outside the architect\'s office on Marquee Avenue.' },
      { type: 'dialogue', lines: [{ who: 'luz', text: 'GO GO GO! Pike had a man on the door. Every cruiser in Neon Row is coming!' }] },
      { type: 'wanted', stars: 3 },
      { type: 'loseWanted', text: 'Three stars. <b>Lose the cops</b>: break line of sight, or respray at Odette\'s.' },
      { type: 'goto', place: 'safehouse', radius: 5, text: 'Take Luz to the <b>Sol y Sombra Motel</b>.' },
      { type: 'dialogue', lines: [{ who: 'luz', text: 'Schematics, codes and a getaway driver who can count to three stars. We hit the vault tomorrow.' }] },
    ],
  },
  {
    id: 'the-aurora-job', title: 'The Aurora Job', giver: 'luz', place: 'safehouse', reward: { money: 25000, respect: 300 },
    blurb: 'Banco Aurora. Four guards, one vault, and the whole of Bay Patrol on the way.',
    steps: [
      { type: 'dialogue', lines: [
        { who: 'luz', text: 'Banco Aurora. Four guards on the floor. I crack the vault, you keep them off me for sixty seconds.' },
        { who: 'dez', text: "And then every cop in Palmera Bay shows up." },
        { who: 'luz', text: "That's the part you're good at. Take the Mako. Tonight we stop being small-time." },
      ] },
      { type: 'giveWeapon', weapon: 'smg', ammo: 192 },
      { type: 'giveArmor' },
      { type: 'goto', place: 'bank', radius: 20, text: 'Go to <b>Banco Aurora</b> on Aurora Avenue.' },
      { type: 'eliminate', look: 'guard', kind: 'guard', weapon: 'pistol', text: 'Deal with the <u>bank guards</u>.',
        enemies: [{ x: 38, z: -108 }, { x: 37, z: -92 }, { x: 39, z: -120 }, { x: 36.5, z: -80 }] },
      { type: 'wanted', stars: 4 },
      { type: 'hold', at: { x: 37, z: -100 }, radius: 9, seconds: 30, label: 'CRACKING THE VAULT', text: 'Stay close to the <b>bank doors</b> while Luz cracks the vault. Hold off Bay Patrol.' },
      { type: 'collect', item: 'briefcase', at: { x: 37.5, z: -103 }, text: 'Grab the <b>vault bags</b>.' },
      { type: 'loseWanted', text: 'You have the money. <b>Lose the cops</b> any way you can.' },
      { type: 'goto', place: 'safehouse', radius: 4, text: 'Get back to the <b>Sol y Sombra Motel</b>.' },
      { type: 'dialogue', lines: [
        { who: 'luz', text: 'Twenty-five thousand each, and a ledger with Silas Crane\'s name on every page.' },
        { who: 'crane', text: '(on the phone) You have something of mine. Enjoy the sunset, Mr. Marlowe. I own it too.' },
        { who: 'dez', text: 'Not for long.' },
      ] },
    ],
  },
];

export function getMissionStartPlace(mission) { return PLACES[mission.place]; }
export function getMissionByIndex(index) { return STORY_MISSIONS[index] || null; }
