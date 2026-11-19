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
| `1 2 3 4`, `Q`, wheel | Fists, pistol, SMG, shotgun |
| `R` | Reload on foot, next radio station while driving |
| `E` | Interact: shops, respray, chop shop, safehouse save, race start, police siren |
| `T` / `H` | Taxi fares in a Sunfare Cab / horn |
| `M` or `Esc` | City map, stats, save and settings |
| `Enter` | Skip dialogue |

### Features

- **Palmera Bay**: a street grid of 63 blocks across five districts (Neon Row downtown, the Coral Strand beach strip, Hibiscus Heights suburbs, Azucar Market, Rustwater Docks) plus Pelican Causeway out to Isla Dorada, a pier with a Ferris wheel, dock cranes and a 200 m landmark tower.
- **On foot and behind the wheel**: third-person movement, ten vehicle types (sports, muscle, sedan, compact, pickup, van, taxi, police interceptor, armoured van, motorbike) with arcade physics, drifting, damage, smoke, fire and explosions.
- **A living city**: lane-following traffic that obeys traffic lights and queues, pedestrians who walk the sidewalks, cross at corners and run from gunfire, parked cars, a day/night cycle with golden-hour light, street lamps and neon at night.
- **Wanted level**: five stars, witnesses, patrol cars that join the chase, cruisers that route through the road graph, ram and shoot, officers who arrest or open fire, roadblocks at three stars, a helicopter with a searchlight at four. Break line of sight or respray to lose them.
- **Combat**: fists, Coral 9 pistol, Mako SMG, Tidebreaker shotgun, hitscan with tracers and muzzle flashes, knock-downs, armour, WASTED and BUSTED with hospital and station respawns.
- **Story**: six chained missions with dialogue and an original cast (drive-to, steal and deliver, chase and ram, timed delivery, shoot-out, getaway, bank heist hold-out).
- **Side hustles and progression**: taxi fares, the Boulevard Sprint race, chop shop, gun shop unlocks by respect rank, 12 golden flamingos, money, respect ranks.
- **Interface**: HUD with rotating minimap, GPS route line, police and mission blips, wanted stars, money, health and armour, weapon and ammo, speedometer, radio banner, objective text, full-screen city map with stats and legend, start screen, settings, save/load to localStorage with autosave after missions.

### Source layout

`game/src/` is split by job: `core/` (loop, state, input), `world/` (city generation, textures, sky, lighting), `vehicles/`, `characters/`, `combat/`, `police/`, `systems/` (wanted level, economy, pickups, saves), `missions/`, `ui/`, `audio/`, `render/` and `shots/` (deterministic screenshot scenes, `index.html?shot=chase&seed=1`).

`tools/take-screenshots.mjs` regenerates `screenshots/` from the real game in headless Chrome, and `tools/smoke-test.mjs` plays through the main systems and fails on any console error (both need `npm install --no-save playwright-core`).

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
