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
| `b4-enemy-atlas-2.svg` | AGV, courier, sanitary supplier and stacker identities |
| `b4-enemy-atlas-3.svg` | Boss and elite identities: Bosman, elite guard, Walczak and Krol Leto |
| `b4-operator-atlas.svg` | Five embroidered role patches for playable operators |
| `b4-combat-atlas.svg` | Character-specific weapon signatures for primary and PvP projectiles |
| `b4-highbay-lamp.svg` | Anodized metal finish for high-bay LED lamp housings |
| `b4-rack-labels.svg` | B4 rack-bay markers for A/B/C zones and safety areas |

## Runtime integration

- **Campaign:** pallet, carton and high-bay-rack models share the B4 timber, carton, steel and safety maps. Each playable operator carries a role-specific patch; rack uprights display bay labels; high-bay LED fixtures use the new anodized housing map. Principal bosses and the elite guard receive their own identity patches without replacing their animated 3D models.
- **Survival:** the arena floor, wall, freight and barriers use the same B4 maps as PvP. Collision-backed cargo and rack cover retain their movement and camera-occlusion registrations. Rack bay signage and operator-specific weapon signatures add readable visual identity without changing gameplay statistics.
- **PvP:** floor and obstacle maps use the same asset pack. Symmetrical end-wall signs remain decorative, while each projectile receives a small weapon signature selected from the firing operator. Hitboxes, velocity and damage remain unchanged.

## Loading and performance

`B4AssetPack` uses Vite-bundled SVG URLs and one shared Three.js texture cache. All seventeen pack assets are awaited by the existing asset warm-up process so scene setup does not race SVG decoding. Pallet stacks and world signage are constructed when the relevant scene is built; they are not recreated per frame.

The atlas uses alpha-tested decals rather than a permanently transparent full-screen overlay. Textures are shared between modes to avoid duplicated GPU copies.
