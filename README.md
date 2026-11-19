# gta6-make-fun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/oatech-ignacio/gta6-make-fun/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/oatech-ignacio/gta6-make-fun/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**PALMERA HEAT** is an original open-world crime game that runs in desktop Chrome from static files: no build step, no downloads, no network. Dez Marlowe and Luz Quintero, two small-time hustlers, arrive in the sun-soaked city of Palmera Bay with $350 and work their way from boosting cars for Tio Benny to the vault of Banco Aurora, one step ahead of Bay Patrol and the developer who owns the skyline.

Everything is generated in code: the city geometry, canvas-drawn facades and neon signs, vehicles, characters, the sky, and all sound and radio music (Web Audio). Rendering uses three.js r187 (vendored in `game/vendor/`).

### Controls

| Key | Action |
| --- | --- |
| `W A S D` | Walk / drive |
| Mouse | Look and aim (click the game to capture the mouse) |
| `Shift` / `Space` | Sprint / jump (on foot), handbrake drift (in vehicles) |
| `F` | Enter, exit or steal a vehicle (pulls the driver out) |
| Right mouse / left mouse | Aim / punch or fire (drive-by from cars) |
| `1 2 3 4 5`, `Q`, wheel | Fists, pistol, SMG, shotgun, rifle |
| `R` | Reload on foot, next radio station while driving |
| `E` | Interact: shops, garages, chop shop, safehouse save, race starts, recruit crew, police siren |
| `Z` / `X` / `C` | Crew abilities: Decoy Run (driver), Pit Stop (mechanic), Blind Spot (lookout) |
| `1`-`0` in a garage | Paint, repair, engine / armour / tyre upgrades, plate swap |
| `T` / `H` | Taxi fares in a Sunfare Cab / horn |
| `M` or `Esc` | City map, stats, save and settings |
| `Enter` | Skip dialogue |

### Features

- **Palmera Bay**: a street grid of 63 blocks across five districts (Neon Row downtown, the Coral Strand beach strip, Hibiscus Heights suburbs, Azucar Market, Rustwater Docks) plus Pelican Causeway out to Isla Dorada, a pier with a Ferris wheel, dock cranes and a 200 m landmark tower.
- **On foot and behind the wheel**: third-person movement, ten vehicle types (sports, muscle, sedan, compact, pickup, van, taxi, police interceptor, armoured van, motorbike) with arcade physics, drifting, damage, smoke, fire and explosions.
- **A living city**: lane-following traffic that obeys traffic lights and queues, pedestrians who walk the sidewalks, cross at corners and run from gunfire, parked cars, a day/night cycle with golden-hour light, street lamps and neon at night.
- **Wanted level**: five stars, witnesses, patrol cars that join the chase, cruisers that route through the road graph, ram and shoot, officers who arrest or open fire, roadblocks at three stars, a helicopter with a searchlight at four. Break line of sight or respray to lose them.
- **Combat**: fists, Coral 9 pistol, Mako SMG, Tidebreaker shotgun, Reefline rifle, hitscan with tracers and muzzle flashes, knock-downs, armour, WASTED and BUSTED with hospital and station respawns.
- **Story**: eight chained missions across three acts with dialogue and an original cast (drive-to, steal and deliver, chase and ram, timed delivery, shoot-out, getaway, bank heist hold-out, four-star escape and a final showdown).
- **Street races**: three races started at purple `R` markers (Boulevard Sprint, the two-lap Neon Row Circuit, the Causeway Drag) with a countdown, checkpoints, three rival drivers on the same car physics, a race HUD (position, lap, checkpoint, time), prize money and saved wins and best times.
- **Crew**: three recruitable allies waiting at teal `C` markers. Sable Okoro (driver, Decoy Run drops a wanted star), Gus Tamarind (mechanic, Pit Stop repairs the car) and Wren Castillo (lookout, Blind Spot jams police sight for 12 seconds), each on a cooldown shown in the HUD crew panel.
- **Garages**: Odette's Respray and Coral Strand Customs open a garage panel with five paint colours, repair, three levels each of engine, armour and tyre upgrades that tune every car Dez drives, and a plate swap that shakes an unseen wanted level.
- **Side hustles**: three street races on the Causeway and downtown, a crew of three recruitable allies (driver, mechanic, lookout) with hotkey abilities, and a garage with respray, plate swap and upgrades.
- **Side hustles and progression**: taxi fares, chop shop, gun shop unlocks by respect rank, 12 golden flamingos, money, respect ranks, and a completion percentage that counts races, crew and garage upgrades.
- **Interface**: HUD with rotating minimap, GPS route line, police and mission blips, wanted stars and IN SIGHT / SEARCHING status, a live police response panel with unit callsigns and status chips, respect rank, money, health and armour, a five-slot weapon bar with ammo, vehicle condition and speed, a compact radio chip, and portrait dialogue. Pause tabs cover MAP, STORY, STATS, CREW, SETTINGS, CONTROLS and SAVE. Three manual save slots plus mission autosaves live in localStorage; the start screen offers Continue and a real save list.

### Source layout

`game/src/` is split by job: `core/` (loop, state, input), `world/` (city generation, textures, sky, lighting), `vehicles/`, `characters/`, `combat/`, `police/`, `systems/` (wanted level, economy, garage, pickups, saves), `missions/`, `races/`, `crew/`, `ui/`, `audio/`, `render/` and `shots/` (deterministic screenshot scenes, `index.html?shot=chase&seed=1`).

The four captured live scenes are `chase`, `onfoot`, `race` and `map`: a four-star morning pursuit up Corsair Boulevard with rush-hour traffic, pedestrians, six police units and Air One; a midday mission gunfight on Neon Row; the Causeway Drag street race; and the city map with progression, races, crew, garages and saves (`start`, the title menu, is still available as a scene). Screenshots are 1280×720 JPEGs under 240 KiB, named `1-chase.jpg` through `4-map.jpg`.

`tools/take-screenshots.mjs` regenerates `screenshots/` from the real game in headless Chrome, and `tools/smoke-test.mjs` plays through the main systems and fails on any console error (both need `npm install --no-save playwright-core`).

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
