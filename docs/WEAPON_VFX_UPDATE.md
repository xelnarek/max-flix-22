# Weapon-specific projectile, balance and VFX update

Implemented in main on 2026-11-26.

## Rocket launcher
- Recognisable missile casing, nose cone, stabilising fins and rear nozzle.
- Pulsing two-layer orange/yellow rocket exhaust.
- Real blast on direct impact and projectile range expiry, including area damage in PvE.
- Authoritative PvP rocket detonation events, including range and bounds termination.

## Flamethrower
- Tapered flame projectile with a yellow-white hot core and orange side tongues.
- Short-lived muzzle flame jet with explicit GPU-resource cleanup.
- Warm ember wake and matching flame-shaped trail.

## Other firearm families
- Pooled tracer geometry now distinguishes kinetic rounds, rocket exhaust, flame jets, smoke grenades, plasma and Gauss shots.
- PvP attached projectile trails use the same per-archetype visual families.

## Crimsonland-style cadence and reload balance

All eleven primary firearms now use deliberately slower weapon-specific timing. The profile is shared by Survival and Campaign; PvP uses its own tuned cooldowns while taking the same longer magazine reload durations.

| Weapon | Time between shots | Reload | Tactical identity |
|---|---:|---:|---|
| Service pistol | 1.30 s | 2.20 s | Accurate, repeatable single shots |
| .45 SMG | 0.38 s | 2.80 s | Fastest conventional fire, short-range pressure |
| Assault rifle | 0.55 s | 2.65 s | Controlled medium-range bursts |
| 12G shotgun | 1.25 s | 2.90 s | Seven-pellet close-range stopping blast |
| 7.62 battle rifle | 1.15 s | 3.20 s | Heavy, high-recoil single slug |
| Minigun | 0.22 s | 4.40 s | Sustained six-barrel stream, long drum change |
| Rocket launcher | 2.15 s | 4.50 s | Rare explosive shot with ignition and wide splash |
| Flamethrower | 0.28 s | 3.40 s | Short-range flame fan and burning targets |
| Plasma rifle | 0.72 s | 3.50 s | Slow plasma orb and ion splash |
| Ballistic grenade launcher | 1.75 s | 4.60 s | Arcing grenade, fuse and area denial |
| Gauss rifle | 1.95 s | 4.00 s | Charged, long-range penetrating lance |

Individual shot damage has been raised to compensate for the longer cadence in PvE. PvP per-shot output remains normalized separately so slower firing does not unintentionally multiply duel damage. The held-weapon attack animation now has a distinct, slower cycle per firearm.

## Strengthened visual signatures
- Muzzle flashes, projectile silhouettes, trail widths/lifetimes, recoil and hit particle budgets are tuned per weapon, not shared as generic bullet effects.
- Heavy rifle, shotgun, rocket, grenade and Gauss use stronger impact feedback; SMG/minigun keep compact tracers while the flamethrower, plasma and explosive weapons retain their dedicated effect families.
- Per-firearm projectile geometry and tracer pools remain bounded and reused to protect mobile GPU performance.

## Scope and performance
- Shared projectile presentation is used by Survival, Campaign and PvP.
- Cadence, reload duration and PvE base damage now use the Crimsonland-style tactical balance table above.
- Tracer geometries are created once per pool and reused. The flame muzzle effect has a short capped lifetime.
- Regression tests cover rocket/flame silhouettes, tracer geometry families, and authoritative PvP rocket explosions.
