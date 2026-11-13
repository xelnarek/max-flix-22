# Combat animation polish

This pass uses the existing role-matched Gobkit GLB rigs and the original procedural playable-operator models.

## Imported humanoid rigs
- The game generates project-authored Attack, Special, Hit, Jump, Fall and Land clips against each rig's detected rest pose.
- Enemy attack clips are selected by the existing visual profile (tool melee, heavy melee or ranged).
- Generated clips are cached by skeleton/rest-pose signature and shared between instances of the same rig.
- Existing imported locomotion and death clips remain in place. The authored clips only fill or replace the corresponding combat/airborne visual actions.

## Original playable operators
- The existing five stylized operator models remain unchanged.
- Attack uses a short anticipation, strong contact beat and damped follow-through.
- Jump and landing receive a small visual stretch, tuck and compression response.
- Player damage reaction has a faster impact and a smooth recovery.

## Scope and invariants
- No MakeHuman assets, downloader, rig, manifests or models are used or changed by this pass.
- No menu, roster, HUD, settings or navigation files are changed.
- No physics, jump force, movement speed, damage, cooldowns, hitboxes, enemy AI or progression values are changed.
