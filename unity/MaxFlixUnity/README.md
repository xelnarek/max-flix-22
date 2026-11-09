# Max Flix — Unity project

**Editor:** Unity 6000.6.8f1 (Unity 6.6.8f1)  
**Packages:** URP 17.5.0, uGUI 2.6.0, Input System 1.20.1  
**Initial scope:** B4 warehouse vertical slice / migration foundation  
**Production status:** prototype only — the current Three.js game remains the production build.

## Open

1. Install Unity Hub.
2. Install editor **6000.6.8f1** with Android Build Support (SDK/NDK + OpenJDK) and Web Build Support.
3. Open this folder (unity/MaxFlixUnity) as a Unity project.
4. Allow Package Manager to resolve the pinned packages.
5. The editor installer creates Assets/Scenes/Bootstrap.unity and registers it in Build Settings.
6. Run **Max Flix > Configure URP and New Input System** from the Unity menu. This creates/assigns the URP asset, selects the new Input System backend and enables WebGPU with WebGL 2 fallback for Web builds. Restart the Editor if Unity asks.
7. Press Play. The main menu appears; choose Survival or the B4 training arena, operator and Survival map. Survival starts with its wave director, XP progression and auto-weapon services.

The project deliberately does not import or overwrite the old game. New C# systems live beside the old code until their parity tests are approved.

## Current vertical slice

- Five operator IDs and baseline statistics are declared in Assets/Scripts/Runtime/OperatorCatalog.cs.
- Operator 01 is selected by default.
- Basic movement, camera follow, health, safe-area HUD and multi-touch joystick/buttons are available.
- Each of the five operators now has a distinct first-pass primary attack and special ability; Dawid's third primary attack fans into three stretch strands, his five-plate special can ricochet, and Mateusz's ninth-hit Speedrun only counts confirmed enemy impacts. Legacy base stats and cooldowns remain in OperatorCatalog.
- Projectile hits support stun, slow, knockback, piercing and the returning WZ wrench; operator-specific hit thresholds, shield/sprint windows, double jump and summon support are implemented in the first combat pass.
- CombatBalanceCatalog now preserves the source Campaign/Survival primary-attack cadence, special cooldown scaling, Survival outgoing/incoming damage modifiers and 0.78 s Survival hit-invulnerability window.
- Special ability has a separate touch button, visible cooldown and keyboard E shortcut.
- EnemyArchetypeCatalog contains all 23 legacy enemy IDs (forklift is classified as a world hazard) and the 17-entry Survival spawn unlock/weight roster. The first AI pass separates melee chasers, ranged attackers, support units, chargers and boss phase changes. The B4 slice currently instantiates only the Customer, AGV and Inspector examples.
- MainMenuController now opens on startup and provides actual selection of Survival/Campaign, one of five operators and one of four maps. Survival is the default. PvP is deliberately disabled in this menu until the Unity client is connected to the existing authoritative server.
- The selected Survival map changes the lighting, floor palette and map set dressing (containers/crane, cold-room machinery, night-sort conveyors/scanners or B4 docks), plus its HP/speed/XP modifiers.
- SurvivalWaveDirector includes the 60-second wave clock, weighted spawns, difficulty curve, mobile/desktop enemy caps, the 90-second contracting horde ring and 5-minute rotating boss warnings. It also ports the rare Bosman (wave 6+, 4%) and Sebix (wave 8+, 6.5%) spawn rules with one active copy of each. Horde entrants are distributed evenly around the contracting perimeter.
- EnemyAgent uses a short shared spatial cache and separation force to reduce enemy stacking and preserve clearance around the operator.
- SurvivalWeaponController contains a first executable pass of all 12 auto-fired weapons, separate reload timers, a serial dispatch gate and pooled projectiles. It has distinct homing, orbiting, AOE/slow, piercing, ricochet and returning-shot behavior.
- SurvivalProgressionController adds pooled XP crystals, map-scaled XP, levels/ranks, three-card rarity drafts, promotion rerolls, boss reward drafts, weapon unlocks/upgrades/evolutions and first-pass passive effects.
- A per-run SurvivalDamageTracker records effective HP damage by named weapon/operator and shows a percentage breakdown in the game-over report.
- Pause/resume, retry and return-to-menu are wired; pause and draft states freeze player/enemy updates.
- The current B4 layout remains procedural; enemy/operator/support models are readable low-poly placeholders, not the final imported rigs.
- Keyboard, mouse, gamepad and multi-touch UI use Unity's New Input System; this code still requires an actual Unity Editor compile and device balancing pass.

## Not migrated yet

Still missing or only partially ported: full Campaign objectives and sector progression; all original Survival contracts, mutators, events, secrets, complete passive catalogue and exact weapon/rarity behavior; several enemy special attacks and final boss patterns; exact legacy map geometry and final imported character/enemy rigs; PvP network client; account/cloud saves, Firebase/Google sign-in, leaderboard, ads/UMP, achievements and easter eggs; Android/Web/PC release signing. The current Survival systems are a playable implementation pass, not validated 1:1 parity.

## Build policy

Do not publish this project to GitHub Pages or Google Play yet. A Unity build is not a replacement for the live Three.js version until all migration gates and device tests pass.
