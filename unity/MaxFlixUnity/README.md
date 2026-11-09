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
- Basic movement, jumping, camera follow, projectile attack and training enemy reactions are available.
- The B4 layout is procedural so the first slice does not depend on unavailable source art files.
- Touch controls are rendered by the HUD; keyboard, mouse and gamepad use Unity's New Input System.
- The EventSystem uses InputSystemUIInputModule; the touch joystick and buttons remain compatible with simultaneous touch pointers.

## Not migrated yet

Campaign progression, full Survival, all enemies and bosses, every weapon/passive/ability, PvP network client, account/cloud saves, Firebase, Google sign-in, ads/UMP, all legacy screens, achievements, easter eggs and release signing are tracked in docs/UNITY_MIGRATION_PLAN.md.

## Build policy

Do not publish this project to GitHub Pages or Google Play yet. A Unity build is not a replacement for the live Three.js version until all migration gates and device tests pass.
