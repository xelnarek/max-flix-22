# B4 Visual Asset Pack

The B4 asset pack is original project artwork authored as SVG and Three.js helpers.
No third-party sprite or texture files are copied into this pack.

## Source assets

| Asset | Intended use |
| --- | --- |
| `b4-floor-concrete.svg` | Industrial concrete/epoxy floor, shared by Survival and PvP |
| `b4-pallet-wood.svg` | EURO pallet timber grain used on freight props and pallet models |
| `b4-freight-carton.svg` | Printed transport cartons and cargo stacks |
| `b4-corrugated-steel.svg` | Warehouse cladding and high-bay rack steel |
| `b4-hazard-chevron.svg` | Safety edges, rack beams and barrier markings |
| `b4-sprite-atlas.svg` | Four decals: worker, zombie worker, forklift and pallet |
| `b4-enemy-atlas.svg` | Four NPC identity patches: BHP inspector, angry customer, sales rep and tile installer |

## Runtime integration

- **Campaign:** existing pallet, carton and high-bay-rack models use the new shared timber, carton, steel and safety maps. Zombie-worker, BHP inspector, angry customer, sales rep and tile-installer models receive distinct atlas patches without replacing their animated 3D models.
- **Survival:** the arena floor, wall, freight and barriers use the same B4 maps as PvP. Two new cargo stacks are physical cover: their footprints are registered for movement and enemy obstacle avoidance, and their meshes are registered as camera occluders. B4 sprite signs label the route.
- **PvP:** floor and obstacle maps use the same asset pack. Symmetrical end-wall sprite signs add warehouse identity without changing player collision or match balance.

## Loading and performance

`B4AssetPack` uses Vite-bundled SVG URLs and one shared Three.js texture cache. The seven pack assets are awaited by the existing asset warm-up process so scene setup does not race SVG decoding. Pallet stacks and world signage are constructed when the relevant scene is built; they are not recreated per frame.

The atlas uses alpha-tested decals rather than a permanently transparent full-screen overlay. Textures are shared between modes to avoid duplicated GPU copies.
