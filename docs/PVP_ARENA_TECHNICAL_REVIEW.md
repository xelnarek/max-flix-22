# PvP Arena — technical review and input foundation

## Current repository finding (main at 2026-11-07)

The repository does **not** currently contain a playable PvP mode, match lobby, room matchmaking, remote player replication, or PvP score type. The public menu currently describes Survival as the only game mode. The game engine's active mode state is `campaign` / `survival`, and `startSurvival()` builds the current arena as a PvE survival map.

The current automatic targeting is specifically part of `updateSurvivalAutoCombat()`: it selects a nearby enemy, turns the operator toward that enemy, launches the primary attack automatically, and dispatches the autonomous Survival weapons at the selected target. The Firebase integration currently stores leaderboard entries and user profiles in Firestore; `firestore.rules` only permits `campaign` and `survival` leaderboard modes. It is not a realtime multiplayer transport.

This branch therefore adds a **reusable manual-aim input foundation**, not a falsely labelled or incomplete online PvP mode.

## Touch control model

The intended phone layout is twin-stick:

- Left floating stick: movement only.
- Right floating stick: the player chooses a world direction; holding it beyond a radial deadzone fires on the character's normal attack cooldown.
- Releasing the right stick stops firing but retains the last aim direction. Movement never overwrites aim while manual-aim mode is enabled.
- No nearest-opponent selection, target snapping, homing correction, or automatic turn-to-target is permitted in PvP.
- Ability, jump, and dash remain explicit buttons. The attack button is hidden while manual twin-stick mode is active because the right stick itself is the deliberate fire input.

The new `src/pvpAim.ts` helper sanitizes input, applies a 0.16 radial deadzone, normalizes diagonal input, preserves the last valid direction, and uses the same forward/yaw convention as the Three.js character rig. The engine exposes `setManualAimMode()`, `setManualAimInput()`, and `stopManualAimFiring()`. `startSurvival()` explicitly disables this mode, preserving current Survival auto-combat.

## PvP MVP recommendation

Start with **1v1 unranked arena duels**, not 4-player free-for-all. The first version should have one compact, symmetric warehouse arena with mirrored spawns and low cover, best-of-three rounds, a short pre-round countdown, fixed character stats, and no Survival perks, weapon drafts, auto-weapons, XP gems, random events, or boss effects. Keep operator signature attacks, but make their travel vectors deterministic and manual.

For fairness, normalise HP, baseline damage, attack cadence and movement envelope in PvP. Character differences should come from readable signature attack patterns and one active ability, not stacked Survival mastery multipliers. Either disable mastery bonuses in ranked PvP or cap them to cosmetic/non-combat progression. Hitboxes and projectile sizes must be consistent across device pixel ratios.

## Multiplayer architecture requirement

Do not implement realtime combat by writing player positions/HP into Firestore every frame. Firestore remains appropriate for completed match results and persistent profiles, not a high-frequency authoritative action loop. PvP needs a dedicated realtime room transport (WebSocket service or a properly configured realtime backend) with server-authoritative movement validation, cooldowns, projectile/hit resolution, damage, round state and final results. Clients should send input intent; they should not be allowed to announce their own hits or opponent HP.

Minimum room flow: create/join room → ready check → server countdown → match snapshots and input sequence numbers → round result → rematch/exit. Add disconnect grace, stale-input rejection, rate limits, server-side arena bounds and an immutable match result. Firestore should receive only the final validated result.

## Before public release

1. Add the actual PvP arena and player/remote-player entity model.
2. Add a server room service and deployment credentials; do not expose privileged secrets in the static GitHub Pages bundle.
3. Add remote state interpolation and local movement prediction with server reconciliation.
4. Add tests for lag, disconnect/reconnect, double-hit suppression, simultaneous KO, spawn protection, cooldown validation and forged input.
5. Run real multi-device tests on at least two phones. A green TypeScript/build pipeline alone does not prove PvP fairness or latency quality.

## Scope of this change

This PR provides the input/math layer and right-hand touch aim control hooks for the future PvP entry point. It deliberately does **not** advertise matchmaking or online PvP as implemented.
