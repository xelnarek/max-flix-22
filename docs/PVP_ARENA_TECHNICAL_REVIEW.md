# PvP Arena — current technical review

## Current implementation status

The repository now contains a playable 1v1 PvP arena, a local bot session, a room lobby, a WebSocket client/server implementation, a best-of-three match loop, and a separate manual-aim control path. The arena and manual aiming are separate from the existing Survival PvE auto-combat path.

The browser version is published on GitHub Pages. Online human-vs-human matches still require a separately hosted Node WebSocket service and the public `VITE_PVP_WS_URL` build variable. Without that service, local bot practice remains available but online rooms cannot be treated as operational.

## Combat and controls

- Phones use twin-stick controls: left stick moves, right stick aims and fires. Keyboard/mouse use the manual aim path as well.
- The aiming direction has its own low deadzone. Firing has separate start/stop thresholds, which reduces accidental shots and trigger flicker from thumb jitter.
- Releasing the right stick stops firing but preserves the last deliberate direction.
- No opponent snap-aim or nearest-target selection is used in PvP.
- Survival auto-targeting remains enabled when manual PvP aim mode is off.
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
