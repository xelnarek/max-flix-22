# PvP Arena — technical review and manual touch aim foundation

## Current state of main

The repository currently has no playable PvP mode, room lobby, matchmaking, remote-player replication, or PvP result type. The active engine modes are Campaign and Survival; the arena currently means the Survival PvE arena. The autonomous targeting/auto-fire path is `updateSurvivalAutoCombat()`, which selects an enemy, rotates the operator toward it, triggers the basic attack, then dispatches Survival weapons.

The current Firebase/Firestore integration stores leaderboard entries and player profiles. It is not a real-time combat transport and must not receive player position/HP writes every frame. Its leaderboard rules only accept Campaign and Survival results.

## Touch controls for a fair PvP arena

Use a twin-stick layout on phones:

- Left floating stick controls movement only.
- Right floating stick determines world-space attack direction. Holding it beyond a 0.16 radial deadzone fires on the operator's normal attack cadence.
- Release stops firing but retains the last aim direction. Movement, dash and camera changes must not retarget the opponent.
- No nearest-target selection, snap aim, homing correction or auto-turning is allowed in PvP.
- Ability, jump and dash remain explicit action buttons. The old attack button is hidden only while manual-aim mode is active.

The right stick must accept a second simultaneous pointer while the left stick is already held. That is why the left stick's old `isPrimary` rejection has been removed: each control locks only its own pointer ID and both pointers can be tracked independently. Pointer cancel, lost capture, blur, page hide and backgrounding all release firing/movement safely.

The new `src/pvpAim.ts` normalizes direction, handles malformed input and preserves the previous aim when the stick returns to neutral. The game engine exposes a manual-aim API, suppresses Survival auto-combat only when that mode is enabled, and keeps normal Survival behaviour unchanged when disabled.

## PvP MVP scope

Begin with unranked 1v1 duels on one compact symmetric warehouse arena, mirrored spawn points, low cover and best-of-three rounds. Use a short countdown and clear round-end/result states. Disable Survival's auto-weapons, XP gems, random events, boss mechanics and run-only perk drafts. Normalize HP, baseline damage, movement envelope and cooldowns; operator identity should come from a distinctive manual primary pattern and one deliberate ability, not stacked Survival bonuses.

## Online multiplayer architecture

For online PvP, add a dedicated real-time room service (WebSocket or another low-latency, authenticated transport). Clients send movement/aim/button intent, not hit claims or opponent HP. Server validates arena bounds, speed, cooldowns, projectiles, collisions, damage, round transitions, stale input sequence numbers, disconnect grace and final results. Use interpolation plus local prediction/reconciliation. Store only validated match results and persistent profiles in Firestore.

## Release gates

1. Add a real PvP menu entry, arena scene, mirrored spawns and remote-player entity.
2. Add room creation/join/ready/countdown/rematch/leave flows.
3. Add server-authoritative hit resolution and anti-cheat validation.
4. Test latency, disconnect/reconnect, simultaneous knockout, spawn protection, cooldown abuse and forged inputs.
5. Run two- or three-device playtests. CI/build alone does not establish fair PvP latency or touch usability.

This PR only contributes the isolated manual-aim input foundation. It does not claim online PvP is already playable.
