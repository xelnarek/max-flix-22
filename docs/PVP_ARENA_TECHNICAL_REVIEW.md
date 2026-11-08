# PvP Arena — current technical review

## Current implementation status

The repository now contains a playable 1v1 PvP arena, a local bot session, a room lobby, a WebSocket client/server implementation, a best-of-three match loop, and a separate manual-aim control path. The arena and manual aiming are separate from the existing Survival PvE auto-combat path.

The browser version is published on GitHub Pages. Online human-vs-human matches still require a separately hosted Node WebSocket service and the public `VITE_PVP_WS_URL` build variable. Without that service, local bot practice remains available but online rooms cannot be treated as operational.

## Combat and controls

- **Touch / phones:** the left virtual joystick moves the operator. A single large **STRZAŁ** button is placed immediately above that joystick. To the right, only the PvP actions remain: **MOC** and **UNIK**. The Survival-only basic attack and jump controls are hidden while PvP is active.
- **Archero-style timing:** a directional cursor sweeps along a curved arc beside the operator, from one end to the other and back. The player taps **STRZAŁ** when the cursor crosses the opponent's firing direction. The sweep is deterministic and independent of movement input; it does not snap to the opponent or silently choose a target.
- **Desktop:** movement uses WASD / arrow keys. The existing bottom-dock attack slot becomes **STRZAŁ**, with the same reload/readiness feedback as the mobile button. F, J, X and the arena click remain quick-fire inputs; Q performs the dash and E / Shift activates the operator ability. The redundant touch overlay is hidden on a non-touch desktop.
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
- closes the match when a player disconnects.

**Known limitation:** active-match reconnection/resume is not implemented. A player disconnect ends the current match rather than attempting a risky partial state restore. This behaviour is surfaced to the remaining player.

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
3. Add a controlled reconnect grace period only after session identity and state restoration are designed and tested.
4. Tune mobile touch-zone placement and visual feedback on-device, not solely through browser emulation.
