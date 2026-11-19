# MAX FLIX 22 — Crimson Environment & Enemy Pack v1.1

A cohesive, additive asset pack for the existing Three.js 0.186 / Vite renderer and top-down 3D Survival arenas.

## Surface library
- Arena floors: worn B4 concrete, Port 17 asphalt, cold-storage sealed floor and night-sorter rubber.
- Industrial surfaces: corrugated container steel, rusted plate, pallet timber, hazard chevrons, frosted cold-room metal, blue rack uprights and blue plastic pallet.
- Decals: worn-floor overlay and warehouse aisle/safety marking pattern.

## Modular environment models
The runtime module `src/crimsonEnvironmentPack.ts` exports:
- `createCrimsonRack()` — three-bay selective racking with uprights, beams, decks, X-bracing, footplates and loaded bays.
- `createCrimsonPalletStack()` — timber runners, carton load, stretch film and straps.
- `createCrimsonBarrelCluster()` — three steel drums with rims and hazard bands.
- `createCrimsonConveyor()` — low-profile roller conveyor.
- `createCrimsonColdCompressor()` — refrigeration unit with fan grille, pipes and beacon.
- `createCrimsonContainer()` — corrugated ISO container with corner castings.

These props are placed by `createSurvivalWorldDressing()` in all four Survival arenas. Their obstacle footprints are registered alongside the visual meshes so enemies and the player do not treat solid cover as empty floor.

## Enemy model variants
`createCrimsonEnemyModel()` provides three compact, low-poly top-down silhouettes:
- Stalker — clawed melee creature with high-contrast eyes.
- Armored Foreman — heavy armored unit with a baton.
- Toxic Inspector — hazmat-style ranged unit with a visible tank and luminous visor.

These are standalone factory variants for enemy visual composition. Existing GLB rigs, role kits, animation controllers, damage values and hitboxes are not replaced by this pack.

## Runtime and quality notes
- Color maps use `THREE.SRGBColorSpace`; non-color maps must use `THREE.NoColorSpace`.
- Repeating materials use `THREE.RepeatWrapping`; material instances clone texture state.
- Geometry is modular and low-poly; shared primitive shapes keep draw cost controlled.
- New cover is kept near arena edges to preserve the central combat sightline.
- Existing procedural Survival biome floor atlas remains active. The new surface set is available for controlled material assignment and overlays; it is not a blanket replacement of the biome blend.
- Android device validation, seam review, draw-call profiling and 60 FPS confirmation are still required before release.

## Licensing
Original vector artwork and procedural geometry authored for MAX FLIX 22. No third-party texture files included.
