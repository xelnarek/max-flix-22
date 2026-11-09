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
7. Press Play. The first slice creates a procedural B4 warehouse, an operator, a few training enemies, a camera and a small HUD.

The project deliberately does not import or overwrite the old game. New C# systems live beside the old code until their parity tests are approved.

## Current vertical slice

- Five operator IDs and baseline statistics are declared in Assets/Scripts/Runtime/OperatorCatalog.cs.
- Operator 01 is selected by default.
- Basic movement, camera follow, health, safe-area HUD and multi-touch joystick/buttons are available.
- Each of the five operators now has a distinct first-pass primary attack and special ability; legacy base stats and cooldowns remain in OperatorCatalog.
- Projectile hits support stun, slow, knockback, piercing and the returning WZ wrench; operator-specific hit thresholds, shield/sprint windows, double jump and summon support are implemented in the first combat pass.
- Special ability has a separate touch button, visible cooldown and keyboard E shortcut.
- The current B4 layout remains procedural; combat support models (WZ-404, three cats and MafiKapibary) are also procedural placeholders.
- Keyboard, mouse, gamepad and multi-touch UI use Unity's New Input System; this code still requires an actual Unity Editor compile and device balancing pass.

## Not migrated yet

Campaign progression, full Survival, all legacy enemy archetypes and bosses, the 12 Survival weapons/perk progression, exact legacy map geometry, PvP network client, account/cloud saves, Firebase, Google sign-in, ads/UMP, all legacy screens, achievements, easter eggs and release signing remain tracked in docs/UNITY_MIGRATION_PLAN.md. The new operator combat code is a first-pass port, not yet verified for exact gameplay parity or runtime performance.

## Build policy

Do not publish this project to GitHub Pages or Google Play yet. A Unity build is not a replacement for the live Three.js version until all migration gates and device tests pass.
