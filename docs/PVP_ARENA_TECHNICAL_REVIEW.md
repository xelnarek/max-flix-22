# PvP Arena — current technical review

## Current implementation status

The repository now contains a playable 1v1 PvP arena, a local bot session, a room lobby, a WebSocket client/server implementation, a best-of-three match loop, and a separate manual-aim control path. The arena and manual aiming are separate from the existing Survival PvE auto-combat path.

The browser version is published on GitHub Pages. Online human-vs-human matches still require a separately hosted Node WebSocket service and the public `VITE_PVP_WS_URL` build variable. Without that service, local bot practice remains available but online rooms cannot be treated as operational.

## Combat and controls

- **Touch / phones:** the left virtual joystick moves the operator. A single large **STRZAŁ** button is placed immediately above that joystick. To the right, only the PvP actions remain: **MOC** and **UNIK**. The Survival-only basic attack and jump controls are hidden while PvP is active.
- **Archero-style timing:** a directional cursor sweeps along a curved arc beside the operator, from one end to the other and back. The sweep is centred on the operator's facing direction; moving with the left stick or WASD changes that facing direction, and releasing movement keeps it steady while the player times **STRZAŁ**. The cursor does not follow the opponent. The player must position and orient the operator, read the arc and fire when the cursor crosses the intended firing lane.
- **Desktop:** movement uses WASD / arrow keys. The existing bottom-dock attack slot becomes **STRZAŁ**, with the same reload/readiness feedback as the mobile button. F, J, X and the arena click remain quick-fire inputs; Q performs the dash and E / Shift activates the operator ability. The redundant touch overlay is hidden on a non-touch desktop.
- The server preserves the submitted aim angle exactly: there is no opponent magnetism, snap-to-target, target-following sweep or automatic correction. The moving cursor itself defines the projectile direction, and the player must time the tap accurately.
- The server remains authoritative for shot cooldowns, projectile collision, cover and damage. Client countdown feedback is only a visual aid; the server decides whether a shot is accepted.
- Survival retains its separate PvE auto-targeting, weapon dispatch, upgrade, wave and damage-report systems. Its attack, jump, ability and dash controls are not reused as PvP primary fire.
- Standard shots and operator abilities are tracked separately. Ability projectiles must not be counted as primary-weapon shots when calculating weapon accuracy.
- Projectile collisions are swept across their movement segment and respect arena cover. Player movement and dash use substeps to reduce tunnelling through pallets and barriers.
- Hit events have unique monotonic IDs. Every hit from the same authoritative simulation tick is retained and buffered by clients so simultaneous damage feedback is not dropped.

## Match results and combat statistics

The authoritative arena tracks, for each player across the full match:

- total damage dealt and damage received;
- damage dealt by the primary attack;
- damage dealt by the operator ability;
- primary shots fired, primary shots hit and primary-weapon accuracy;
- ability uses and damaging ability hits;
- actual HP restored by arena medkits;
- tactical dashes used;
- round knockouts.

The results panel compares both players side by side. Stats persist between rounds and are reset only when a new match is created. Accuracy uses primary projectiles only; Dawid's three-beam ability is deliberately counted as ability damage, not as three extra primary shots.

## Online room service

The dedicated WebSocket service:
- validates room codes, operator IDs, player names and input packets;
- performs the arena simulation on the server rather than accepting client-reported damage or HP;
- clamps movement and aim input and enforces cooldowns through the authoritative simulation;
- limits payload size and message rate, checks allowed origins, and uses ping/pong heartbeats;
- waits for both connected players to join and confirm readiness;
- requires both players to request a rematch;
- gives an unexpectedly disconnected player a bounded reconnect grace period. The authoritative match simulation is frozen while a slot is disconnected; a successful rejoin restores the same slot and room state;
- ends a live match only when the disconnect grace period expires or a player intentionally leaves.

**Reconnect contract:** each player receives a random, tab-scoped capability stored in `sessionStorage`. The client retries a lost room connection with bounded exponential backoff (up to 10 attempts inside an 18-second client window). The server stores only the SHA-256 hash of each capability, compares tokens in constant time, rotates the capability after a valid rejoin, and holds the live room for a default 20-second server grace period. An intentional leave does not receive the grace period. The remaining player receives an authoritative match-end result if the disconnected player does not return.

The active-match reconnect path is implemented and regression-tested in `tests/pvp-session-reconnect.test.mjs`; actual two-device recovery under real mobile-network changes remains a physical-device acceptance test.

## Latest PvP tuning and visual pass

The current PvP tuning uses a standard movement speed of 5.0 world units/s, a dash speed of 13.2, and a sprint perk multiplier of 1.10. These are deliberately lower than the previous 6.2 / 16.0 / 1.16 values so that spacing and shot timing are readable rather than twitch-driven.

Primary projectile collision/display radii are now operator-specific: Marcin 0.40, Grzesiek 0.54, Dawid 0.33, Mateusz 0.48 and Piotr 0.45. The Dawid special fires three ability beams with 70 damage each; these are still tracked separately from primary-shot accuracy. All five operator ability branches now have regression coverage across shield/push, frontal charge, tri-beam, shockwave/cover and electrical damage/stun behaviour. Piotr's electrical special applies 110 damage and a 1.1-second stun; Marcin's defensive special grants 250 shield.

The PvP floor uses a more matte industrial finish to reduce broad specular glare. Cover objects receive baked radial contact shadows so their silhouettes still read on phones where dynamic shadow maps are disabled for performance. Desktop dynamic shadows remain available through the existing renderer profile. Arena lighting has been rebalanced toward lower ambient fill and a slightly stronger cool rim light, preserving warm key-light highlights without flattening the floor texture.

The mobile fire control is anchored above the movement stick and shifted 14 px left of its centre line. The active pointer position is used to keep the control close to the movement origin; safe-area and viewport clamps prevent clipping.

## Desktop / mobile verification boundary

Automated tests verify the input routing, mode-specific HUD ownership, sweep timing, touch-zone placement logic and desktop fire action. They do not simulate a real thumb, multi-touch gesture or GPU compositor. A visual acceptance pass is still required on a phone and on a desktop browser before calling the controls fully verified.

## Release and test gates

Automated test coverage currently includes arena geometry, input sanitization, collision/cover, projectile tunnelling, simultaneous hit events, damage clipping, medkit fairness, rematch flow, disconnect handling, aim thresholds, match statistics and post-match UI wiring. CI also checks TypeScript and builds the production website.

Passing CI does not prove touch comfort, frame pacing on a physical phone, fairness under real internet latency, or a successful two-device online match. Those still require:
1. Deploying the standalone WebSocket service with TLS/WSS.
2. Setting `VITE_PVP_WS_URL` in GitHub Actions variables and rebuilding Pages.
3. Testing two physical devices, including the target Android phone, at different network conditions.
4. Checking room creation/join, simultaneous attacks, medkit claims, round transitions, rematches and disconnect behaviour.

## Follow-up priorities

1. Complete and verify external WSS hosting before claiming online PvP is live.
2. Playtest operator-specific damage, cooldowns and movement to tune matchup balance from measured results.
3. Exercise the implemented reconnect flow on two physical devices: background/foreground the app, toggle Wi-Fi/mobile data, and confirm that a successful rejoin resumes the same round while an expired grace period ends it deterministically.
4. Tune mobile touch-zone placement and visual feedback on-device, not solely through browser emulation.
