# Weapon-specific projectile and VFX update

Implemented in main on 2026-11-25.

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

## Scope and performance
- Shared projectile presentation is used by Survival, Campaign and PvP.
- Existing cadence, reload timing, and base damage values are unchanged.
- Tracer geometries are created once per pool and reused. The flame muzzle effect has a short capped lifetime.
- Regression tests cover rocket/flame silhouettes, tracer geometry families, and authoritative PvP rocket explosions.
