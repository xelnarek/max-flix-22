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
- The animation-only layer does not alter player physics, jump force, movement speed, damage, cooldowns, hitboxes or progression. The explicitly documented ranged-counterplay and Campaign-flank sections below describe the limited enemy-AI changes in this follow-up series.

## Regular ranged enemy counterplay
- Pomazaniec, Handlowiec, Przedstawiciel Włoski, Pan Roman, Serwisant and Cyber Salesman show role-coloured floor lanes before releasing ranged attacks.
- The aim direction is locked when the warning begins and drives the projectile at release, so the shot does not bend after the tell.
- Confirmed HP damage or stun interrupts the wind-up, removes its warning and applies a short recovery delay.
- The bounded warning timer tolerates frame hitches. Damage, projectile speed, cooldown values and enemy HP remain unchanged.


## Campaign side-entry AI
- Selected melee archetypes receive a deterministic left/right approach lane. Fast roles such as Kurier, Sebix and Zombie use a stronger lateral approach; heavy roles retain only a restrained offset.
- The lateral bias is distance-weighted and fades to zero before the existing melee contact band. Crowd separation, obstacle avoidance, arrival slowdown and attack range remain authoritative.
- Survival keeps its separate wave-director coalition and pincer system. Ranged specialists and vehicles keep their existing direct firing/charge lanes.
- No movement speed, HP, damage, attack cooldown or collision values are changed.
