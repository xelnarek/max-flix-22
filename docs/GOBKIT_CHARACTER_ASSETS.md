# Gobkit character asset integration

## Source and licence

Max Flix 22 uses selected character models from Gobkit's free GLB catalogue. The build reads the current public catalogue at `https://gobkit.com/api/free`, resolves each exact model ID, verifies the model's own CC0 1.0 licence and animation metadata, then downloads the GLB into `public/assets/gobkit/`. The original source URLs and licence strings are written to the generated `manifest.json`.

Only source assets explicitly marked CC0 1.0 and rigged with the named `Idle`, `Walk`, `Run`, `Death` and `Hit` clips are accepted. The downloader rejects missing IDs, a changed licence, an unexpected host, invalid GLB headers or broken animation metadata.

## Player roster

| Existing operator | 3D model |
| --- | --- |
| Operator 01 / Marcin | Store Manager |
| Operator 02 / Grzesiek | Fire Chief |
| Operator 03 / Dawid | Stock Clerk |
| Operator 04 / Mateusz | Baggage Handler |
| Operator 05 / Piotr | Security Guard |

The operator IDs, character stats, attack definitions, passives, abilities, progression and unlock rules remain unchanged. The new GLBs are visual replacements only. The old procedural models remain as a fail-soft visual fallback if a model request fails.

## Survival enemy roster

All 19 humanoid and creature archetypes use locally bundled, rigged GLB assets. Each imported rig receives a role-specific size, animation track and accessory kit; the previous warehouse-prop model is hidden after the new rig is attached.

| Enemy family | 3D model |
| --- | --- |
| Customer / shoplifter | Shoplifter |
| Architect | Office Manager |
| Courier | Food Courier |
| Sales representative | Sales Rep |
| BHP inspector | Hazmat Tech |
| Service technician / installer | Forcible Entry Firefighter |
| Italian sales representative | Store Manager |
| Pallet-truck operator | Baggage Handler |
| Pan Roman / sanitaryware supplier | Stock Clerk |
| Serwisant | Fire Chief |
| Bosman Kraków | Security Guard |
| Sebix | Bloodiron Grunt |
| Zombie warehouse worker | Stitched Brute |
| Elite guard | Bloodiron Grunt |
| Walczak boss | Werewolf Captain |
| Król Leto boss | Bloodiron Juggernaut |
| Gamma mutant | Bloodiron Juggernaut |
| Radioactive Pip | Night Witch |
| Cyber salesperson | Android Commander |

The forklift, AGV robot, Piorun drone and Pomazaniec bicycle rider remain purpose-built non-humanoid models, rather than being replaced with mismatched human rigs. Their collision, movement and attack systems are unchanged. Reused rig IDs are only used where the role-specific accessory kit makes the silhouette distinct.

## Runtime and performance

- The source catalogue is fetched at build time; the game does not call Gobkit at runtime.
- GLBs are loaded lazily on first use and cached in one shared `GLTFLoader` promise map.
- Each actor gets a skeleton-aware clone via Three.js `SkeletonUtils.clone`.
- Geometry and materials are cloned per actor so normal character/despawn cleanup cannot destroy another actor's rig. Texture maps remain shared.
- The model is fitted to a consistent world height and grounded against the existing actor origin.
- Existing UI markers, health bars, shadows, nameplates, PvP markers and enemy telegraphs are preserved.
- Named clips are cross-faded according to actor state. PvP's local and remote operator slots use the same selected model mapping.
- If a model fails to load in a non-strict development session, the existing procedural actor stays visible.

## Build behaviour

`npm run dev` runs a non-strict asset preparation step. `npm run build` runs the same step in strict mode: production and Android builds stop rather than silently shipping missing model files. This keeps GitHub Pages and Capacitor packages self-contained and avoids runtime dependence on a third-party CDN.
