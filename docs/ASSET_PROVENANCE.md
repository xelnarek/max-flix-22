# Asset provenance — realistic warehouse character pass

## MakeHuman / MPFB humanoids

This game downloads only generated binary GLB assets from the pinned public project
https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78 .
The source project's LICENSE-NOTES.md declares generated body, hair, clothing and procedural animation files
CC0-1.0 when they are built only from CC0 inputs. The GPL-3.0-or-later generator source is not copied into this game.

Pinned source commit: 852e48f316b90a0937234886630e4fb4cdfd1f78.

The imported base model contains a 53-bone humanoid rig and baked idle, walk, run, walk_back, strafe_left,
strafe_right, jump, fall and land clips. Clothing and hairstyles are separate GLB meshes sharing that rig.
Role-specific attack, hit, special and death poses are authored in this repository as small Three.js clips;
combat stats, hitboxes, AI and progression remain unchanged.

The build downloads assets via scripts/fetch-makehuman-assets.mjs and verifies pinned Git blob SHA-1, GLB 2.0
structure, embedded animation names and skeleton joint compatibility. During local development the existing
procedural/Gobkit actors remain available as a fail-soft fallback.

## Imported asset roles

| Asset | Role |
| --- | --- |
| base_body_anim.glb | Humanoid base, face and baked locomotion |
| clothing_shirt.glb, clothing_tshirt.glb | Business / warehouse tops |
| clothing_jacket.glb, clothing_hoodie.glb | Security / technical outer garments |
| clothing_jeans.glb | Work trousers |
| clothing_shoes.glb, clothing_boots.glb | Footwear |
| hair_short02.glb, hair_short04.glb, hair_bob02.glb | Short and bob hairstyles |

The generated GLB outputs are declared CC0-1.0 by the source project. Exact byte lengths, Git blob hashes,
SHA-256 values and source URLs are recorded in public/assets/makehuman/manifest.json at build time.
