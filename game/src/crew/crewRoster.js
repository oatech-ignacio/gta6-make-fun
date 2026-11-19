// Job: data table of the three allies Dez can recruit around Palmera Bay
// (name, role, ability, hotkey, cooldown, price and recruiting spot). No logic.
export const CREW = [
  { key: 'sable', name: 'Sable Okoro', role: 'Driver', ability: 'Decoy Run', code: 'KeyZ', label: 'Z', cooldown: 60, price: 1500, spot: { x: 347, z: 100 },
    blurb: 'Runs a lookalike car the other way. Bay Patrol drops one wanted star.' },
  { key: 'gus', name: 'Gus Tamarind', role: 'Mechanic', ability: 'Pit Stop', code: 'KeyX', label: 'X', cooldown: 45, price: 2500, spot: { x: -150, z: 347 },
    blurb: 'Patches your car to 100% on the move, or drops a vest (+50 armour) when you are on foot.' },
  { key: 'wren', name: 'Wren Castillo', role: 'Lookout', ability: 'Blind Spot', code: 'KeyC', label: 'C', cooldown: 75, price: 4000, spot: { x: 250, z: -30 },
    blurb: 'Jams the police scanner: nobody has eyes on you for 12 seconds.' },
];
