// The cast of PALMERA HEAT: names, roles, looks and portrait colours used by dialogue and the map.
export const STORY_CAST = {
  dez: { name: 'Dez Marlowe', role: 'Wheelman', look: 'dez', portrait: ['#ff7a3d', '#b3123f'], bio: 'Ex-valet from Hibiscus Heights who can drive anything with a steering wheel and most things without.' },
  luz: { name: 'Luz Quintero', role: 'The Planner', look: 'luz', portrait: ['#ffd166', '#ff3d8b'], bio: 'Runs the Luna Lounge sound booth by night and reads bank blueprints by day.' },
  benny: { name: 'Tio Benny Salazar', role: 'Bait shop fixer', look: 'benny', portrait: ['#2be0d0', '#1d4b7a'], bio: "Sells worms, favours and information out of Benny's Bait & Tackle on Corsair Boulevard." },
  odette: { name: 'Mama Odette', role: 'Chop shop queen', look: 'odette', portrait: ['#ff9f43', '#5c2a82'], bio: "Owns Odette's Auto in Rustwater Docks. A car goes in, a rumour comes out." },
  crane: { name: 'Silas Crane', role: 'Developer', look: 'crane', portrait: ['#f7f3ea', '#8a6f4d'], bio: 'His name is on the tallest tower downtown, and on most of the eviction notices.' },
  pike: { name: 'Lt. Harlan Pike', role: 'Bay Patrol', look: 'pike', portrait: ['#5b8cff', '#1a1f3d'], bio: 'A lieutenant with a boat he cannot afford and friends he should not have.' },
  vega: { name: 'Nico Vega', role: 'Brine Kings boss', look: 'vega', portrait: ['#19d3c5', '#3a0d4a'], bio: 'Runs the Brine Kings out of Pier 9 and rents them to whoever pays in cash.' },
  rudy: { name: 'Rudy "Two-Tone" Vance', role: 'Deadbeat', look: 'gang', portrait: ['#19d3c5', '#1b1b1f'], bio: 'Owes Odette for a Kestrel V8 and has been avoiding the docks ever since.' },
};

export const STORY_SYNOPSIS = [
  'Palmera Bay sells sunsets to tourists and everything else to Silas Crane.',
  'Dez Marlowe and Luz Quintero are two small-time hustlers with one borrowed pistol and a plan:',
  'work their way up from boosting cars for Tio Benny to the vault of Banco Aurora, before Crane buys the ground out from under them.',
];

export function getCastMember(key) { return STORY_CAST[key] || { name: key, role: '', look: 'gang', portrait: ['#888', '#333'] }; }
