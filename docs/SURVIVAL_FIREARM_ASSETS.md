# Survival firearm 3D assets

The live weapon model is upgraded asynchronously from the built-in procedural mesh to a local GLB model. The procedural builder remains the immediate fallback and is retained for the two archetypes without a faithful matching CC0 asset (minigun and flamethrower).

## Curated mapping

| In-game archetype | External model | Source pack | Runtime animation |
|---|---|---|---|
| Pistol | Compact pistol | FPS Guns and Shooting Range | Magazine + slide |
| SMG | Compact submachine gun | FPS Guns and Shooting Range | Magazine + stock |
| Rifle | Assault carbine | FPS Guns and Shooting Range | Magazine + stock |
| Shotgun | Pump shotgun | FPS Guns and Shooting Range | Open / close |
| Heavy rifle | Battle rifle | FPS Guns and Shooting Range | Magazine + stock |
| Rocket | Rocket Launcher Pickup | Arena Shooter Map Kit | Procedural recoil |
| Plasma | Plasma Gun Pickup | Arena Shooter Map Kit | Procedural recoil |
| Gauss | Rail Gun Pickup | Arena Shooter Map Kit | Procedural recoil |
| Grenade | Grenade Launcher Pickup | Arena Shooter Map Kit | Procedural recoil |

Minigun and flamethrower deliberately keep their bespoke procedural models: the chosen third-party catalogues did not offer an equally suitable rotary multi-barrel or fuel-tank flamethrower model. The existing model is preferable to a misleading substitution.

## Rights and provenance

All nine selected models are published by 3DAssets.dev under CC0 1.0 Universal; the source pages permit commercial use and do not require attribution. The provider identifies the selected assets as AI-generated (Claude Fable 5.1). The source pages list the FPS pack as metre-scale, +Y up / +Z forward, with 105 GLBs totalling 16.3 MB. The game fetches only the nine selected models, validates GLB 2.0 headers/mesh content, and records file SHA-256 values in `public/assets/survival-firearms/manifest.json`.

Source packs:
- https://3dassets.dev/packs/fps-weapon-set-and-firing-range
- https://3dassets.dev/assets?category=weapons-tools&tag=realistic&theme=sci-fi
- https://creativecommons.org/publicdomain/zero/1.0/

## Runtime and build

`scripts/fetch-survival-firearm-assets.mjs` downloads the selected models to `public/assets/survival-firearms` during `predev` and strict production `prebuild`. No weapon model is fetched from a third-party CDN during gameplay. Missing files in non-strict development leave the procedural models visible. GLTF source resources are cached once; each rendered instance owns cloned geometries/materials, while embedded textures and source clips remain shared.
