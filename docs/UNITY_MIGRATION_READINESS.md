# Unity migration readiness — 16 November 2026 (source integration pass 2)

## Executive status

The Unity branch is a real migration foundation, not a converted production game. The existing Three.js build remains the only production build. The Unity project is pinned to Unity 6000.6.8f1 / Unity 6.6.8f1 with URP 17.5.0, Input System 1.20.1, uGUI 2.6.0 and glTFast 6.20.0.

This work prepares a safer, repeatable path: source-data contracts are audited in normal repository CI; Unity Player settings are checked before an Editor build; Android lifecycle settings avoid a known Unity 6.6.8f1 issue; and the connected four-biome Survival world is now composed in the Unity source runtime. The integration is in the feature branch `feat/unity-survival-mega-world-cutover`; it is not yet merged into production `main`, compiled by Unity Editor, or accepted on a device.

**It is not safe to switch production to Unity yet.** A Unity Editor compile/build and on-device runtime test have not been completed in this session.

## What is now prepared

- Unity Editor and all four core package versions are pinned.
- The Unity build workflow is manually dispatched and requires private Unity activation secrets. It produces artifacts only; it does not deploy to GitHub Pages or upload to Google Play.
- The Editor creates the Bootstrap scene, assigns URP, configures the New Input System and configures WebGPU with WebGL 2 fallback.
- Before a Player build, Unity checks its URP assignment, Bootstrap scene, Android identity, IL2CPP/ARM64, API 26/36, landscape orientation, Android frame pacing, the WebGPU/WebGL 2 API order, and stable content-catalog counts.
- The same five operator IDs, 23 enemy IDs, 15 perk IDs, four map IDs and twelve weapon IDs are checked against the TypeScript reference data by `npm run audit:unity`.
- Unity biome floor colours now match the live game instead of using the earlier pale/white values.
- The C# topology contract records the live 240 × 80 m Survival world: four biome centres, four open shared edges, four 22 m transition bands and bilinear blend weights.
- In the current feature branch, Survival now starts one persistent world root containing all four 120 × 40 m sectors. Each procedural environment layout is placed in its correct quadrant and scaled into the tile; only the outer world perimeter is closed.
- Four transition overlays are generated from 64 × 64 textures sampled from the same bilinear biome weights. Floor colour, fog, ambient lighting and directional-light tint can blend across the seams without scene changes.
- Enemy health/speed multipliers are weighted at the actual spawn position; XP bonuses are weighted at the enemy defeat position. Wave/horde spawn points are clamped to the 240 × 80 m bounds and checked against colliders.
- Fixed the Night Sorting scanner-gate placement formula so all three gates are evenly spaced inside the 40 m biome depth instead of placing one gate outside the sector.

## Blocking gaps before feature parity

### 1. Connected Survival mega-world — wired in source, not yet verified

The current feature branch changes the Survival bootstrap to `BuildUnifiedSurvivalWorld()`. It creates one root, four transformed sector roots at the canonical zone centres, four continuous floor tiles, a single outside perimeter, and four texture-driven transition overlays. The former per-arena walls are omitted from the combined world; the Cold Storage internal insulated end walls are also omitted. Biome lighting and gameplay modifiers use the same spatial blend field.

The next validation is not another design-only pass: Unity Editor must compile the C# code, then a Play-mode sweep must verify all four sectors, all four corridors, the four-way centre, outside wall collisions, obstacle blocking, spawn safety, camera tracking and no visible floor seams/z-fighting. Procedural layouts are scaled from their existing local coordinates into 120 × 40 m tiles; this is not yet a claim that the detailed geometry matches every legacy Three.js obstacle 1:1. The map, environment and modifier changes currently exist only on `feat/unity-survival-mega-world-cutover` until PR checks pass and it is merged.

### 2. Imported rig models are not yet used by gameplay

The strict pipeline stages and validates 17 CC0 GLB rigs. The runtime still uses procedural placeholders. Player/enemy prefab creation, skeleton attachment, retargeting for Idle/Walk/Run/Hit/Death, combat attachment points, role props and mobile shader-variant QA remain required.

### 3. Not ported or not validated 1:1

- PvP Unity client, lobby and reconnect against the existing authoritative Node/WebSocket server.
- Firebase/Google sign-in, cloud saves, account talents/ranks and leaderboard.
- AdMob rewarded/interstitial integration and UMP privacy flow.
- Full Survival contracts, mutators, wave events, all weapon/passive semantics, all enemy special behaviours, bosses and rewards.
- Necronomicon, Rabbit Hole, all secret triggers, bonus events and full achievement tracking.
- Complete UI/menu parity and device-specific touch layout checks.
- Actual Unity Editor compile, WebGL/WebGPU and WebGL2 fallback test, Android IL2CPP/AAB build, install, suspend/resume/back-button test, and sustained-performance test on Poco F6 plus a lower-tier Android device.
- Play-mode validation of the new mega-world in Unity: sector edges, transformed colliders, all transition routes, floor texture orientation, overlap/z-fighting, world bounds, horde spawn distribution, enemy separation and 60 FPS behaviour.

## One-time Unity build activation

Do not paste license or account credentials into chat or commit them to the repository. Add the following in GitHub repository **Settings → Secrets and variables → Actions**:

- `UNITY_LICENSE`: contents of the activated Unity Personal `.ulf` license file.
- `UNITY_EMAIL`: Unity account email.
- `UNITY_PASSWORD`: Unity account password or the credential format required by GameCI.

For a signed Google Play AAB, also configure the existing Android upload secrets:

- `ANDROID_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Then open **Actions → Unity 6.6 WebGL and Android build** and manually dispatch a WebGL build first. Resolve real Unity Editor compile/import errors before requesting Android APK/AAB builds. The workflow only publishes downloadable artifacts.

## Cutover order

1. Run `npm run audit:unity` and the full repository CI.
2. Activate the Unity build workflow and produce a real WebGL Player.
3. Fix every Unity Editor compiler/import error; run the project readiness menu command.
4. Compile the feature branch in Unity Editor and run the readiness audit; fix every compile/import/build-preflight error.
5. Play-test the connected mega-world in Editor: check floor transitions, collider gaps, wall bounds, enemy paths, spawn ring, secrets/pickups, camera and lighting through every seam.
6. Wire actual CC0 rigs and verify all required clips/material variants.
7. Finish feature parity for Campaign, Survival, secrets, account, leaderboard, PvP and ads/UMP.
8. Build and install Android ARM64 APK; test multitouch, landscape, pause, background/resume, Android Back and WebView/WebGL browser fallback.
9. Profile CPU/GPU/memory/thermal behaviour on Poco F6 and a lower-tier device; verify sustained 60 FPS target in normal combat and graceful quality reduction under dense waves.
10. Run two-client PvP/reconnect tests and confirm Firebase and server contracts.
11. Only then prepare a production candidate, Play internal testing and a controlled domain/Google Play cutover. Keep the Three.js version available as rollback until the Unity release has passed acceptance.

## Known Unity version issue

Unity 6000.6.8f1 has a known Android issue where the Back gesture/button can close the app after it returns from the background when **Run In Background** and **Predictive Back Support** are both enabled. This project now explicitly disables both settings and enables Android optimized frame pacing. The real device suspend/resume and Back path still must be tested before release.

References:
- [Unity 6000.6.8f1 release notes](https://unity.com/releases/editor/whats-new/6000.6.8f1)
- [Unity WebGPU enablement for 6000.6](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/graphics/web-gpu/enable)
- [Unity Android Predictive Back setting](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/PlayerSettings.Android-predictiveBackSupport.html)
