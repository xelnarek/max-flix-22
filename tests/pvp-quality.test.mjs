import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('PvP client sends at the room tick rate and only shows match-end once', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /pvpInputSendAccumulator \+=/);
  assert.match(game, /const inputInterval = 1 \/ 30/);
  assert.match(game, /this\.pvpWantDash = false/);
  assert.match(game, /this\.pvpMatchEndHandled/);
  assert.match(game, /lastPvpHitEventId/);
  assert.match(game, /event\.id <= this\.lastPvpHitEventId/);
  assert.match(game, /this\.pendingPvpHitEvents\.push\(event\)/);
  assert.match(game, /if \(!this\.pvpMatchEndHandled\)/);
});

test('online session handles static hosting, bounded retries and does not restart the arena on every snapshot', async () => {
  const client = await readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8');
  assert.match(client, /VITE_PVP_WS_URL/);
  assert.match(client, /isGitHubPages/);
  assert.match(client, /MAX_CONNECT_ATTEMPTS = 3/);
  assert.match(client, /CONNECT_TIMEOUT_MS = 75_000/);
  assert.match(client, /RETRY_CONNECT_TIMEOUT_MS = 12_000/);
  assert.match(client, /this\.reconnectAttempts === 0/);
  assert.match(client, /wybudzenie po bezczynności może trwać około minuty/);
  assert.match(client, /hasStartedMatch/);
  assert.match(client, /pendingCreate = undefined/);
  assert.match(client, /pendingJoin = undefined/);
  assert.match(client, /rematch_waiting/);
});

test('manual touch aim, server-origin checks, six-character invite codes and mutual rematch are wired', async () => {
  const [game, app, html, server, arena] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/pvpServer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpArena.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /wantFire: this\.pvpWantFire/);
  assert.match(game, /public triggerPvpFire\(\): boolean/);
  assert.doesNotMatch(game, /shouldPvpAimFire\(x, z, this\.manualAimFiring\)/);
  assert.match(game, /PVP_AIM_DIRECTION_DEADZONE/);
  assert.match(game, /this\.pvpInputSendAccumulator %= inputInterval/);
  assert.match(app, /getElementById\('pvp-aim-zone'\)/);
  assert.match(app, /getPvpOperatorAttackCooldown\(operatorId\)/);
  assert.match(app, /startPvpFireCooldown\(/);
  assert.match(app, /fireButton\.dataset\.roundActive = String\(roundActive\)/);
  assert.match(app, /REWANŻ ZGŁOSZONY • CZEKAJ NA RYWALA/);
  assert.match(html, /maxlength="6"/);
  assert.match(server, /maxPayload: 4096/);
  assert.match(server, /MAX_MESSAGES_PER_SECOND = 120/);
  assert.match(server, /PVP_ALLOWED_ORIGINS/);
  assert.match(server, /wantFire: intent\.wantFire === true \|\| sanitized\.wantFire === true/);
  assert.match(server, /if \(room\.inputs\.p1\.wantFire\) room\.inputs\.p1\.wantFire = false/);
  assert.match(server, /rematchVotes\.size === 2/);
  assert.match(server, /\{6\}/);
  assert.match(arena, /sanitizePvpInputIntent/);
  assert.match(arena, /firstProjectileObstacleHit/);
  assert.match(arena, /getPvpAimAssistAngle/);
  assert.match(arena, /updatePvpPerkDrop/);
  assert.match(arena, /perkDrop: \{ active: false/);
  assert.match(game, /applyPvpCameraFraming/);
  assert.match(game, /calculatePvpCameraFrame/);
  assert.match(game, /pvpPerkLabelContext/);
  assert.match(game, /aimPositions\.needsUpdate/);
  assert.match(game, /pvpScreenAimToWorld/);
  assert.match(game, /pvpScreenMovementToWorld/);
  assert.match(game, /pvpAimGuide/);
  assert.match(app, /pvp-perk-status/);
  assert.match(html, /id="pvp-perk-status"/);
  assert.match(arena, /separatePvpPlayers/);
});

test('static Pages deployment receives only the public WebSocket endpoint setting', async () => {
  const [workflow, deploymentGuide] = await Promise.all([
    readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'),
    readFile(new URL('../docs/PVP_SERVER_DEPLOYMENT.md', import.meta.url), 'utf8'),
  ]);
  assert.match(workflow, /VITE_PVP_WS_URL: \$\{\{ vars\.VITE_PVP_WS_URL \}\}/);
  assert.match(deploymentGuide, /PVP_ALLOWED_ORIGINS/);
  assert.match(deploymentGuide, /pvp:server/);
  assert.match(deploymentGuide, /wss:\/\//);
});

test('PvP combat feedback keeps simultaneous hits and renders lightweight projectile trails and feedback overlays', async () => {
  const [arena, game, html, css] = await Promise.all([
    readFile(new URL('../src/pvpArena.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(arena, /hitEvents: PvpHitEvent\[\]/);
  assert.match(arena, /state\.hitEvents\.push\(hitEvent\)/);
  assert.match(game, /pendingPvpHitEvents/);
  assert.match(game, /new THREE\.CylinderGeometry\(0\.018, 0\.075/);
  assert.match(game, /mesh\.rotation\.y = Math\.atan2\(proj\.vx, proj\.vz\)/);
  assert.match(game, /pulsePvpFeedback\('pvp-hit-vignette'\)/);
  assert.match(game, /pulsePvpFeedback\('pvp-hit-confirm'\)/);
  assert.match(html, /id="pvp-hit-vignette"/);
  assert.match(html, /id="pvp-hit-confirm"/);
  assert.match(css, /@keyframes pvp-damage-flash/);
  assert.match(css, /@keyframes pvp-hit-confirmation/);
});

test('PvP result panel compares authoritative combat breakdown for both players', async () => {
  const [arena, app, html, css] = await Promise.all([
    readFile(new URL('../src/pvpArena.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  for (const field of [
    'damageTaken', 'primaryDamageDealt', 'abilityDamageDealt',
    'abilityUses', 'abilityHits', 'healingDone', 'dashesUsed', 'knockouts',
  ]) {
    assert.match(arena, new RegExp(field));
  }
  assert.match(arena, /proj\.kind === 'ability'/);
  assert.match(arena, /shooterPlayer\.shotsHit \+= 1/);
  assert.match(app, /const comparisonRows/);
  assert.match(app, /pvp-end-self-\$\{key\}/);
  assert.match(app, /pvp-end-opponent-\$\{key\}/);
  assert.match(html, /id="pvp-end-self-ability-damage"/);
  assert.match(html, /id="pvp-end-opponent-ability-damage"/);
  assert.match(html, /id="pvp-end-self-healing"/);
  assert.match(html, /id="pvp-end-opponent-knockouts"/);
  assert.match(css, /\.pvp-end-comparison-row/);
  assert.match(css, /max-height: min\(90dvh, 820px\)/);
});

test('both online and local PvP rematches reset all match-wide statistics through the shared helper', async () => {
  const [client, server, arena] = await Promise.all([
    readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/pvpServer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpArena.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /resetPvpMatchStats\(this\.state\)/);
  assert.match(server, /resetPvpMatchStats\(room\.state\)/);
  assert.match(arena, /export function resetPvpMatchStats/);
  assert.match(arena, /syncPvpMatchStats\(state\)/);
});

test('PvP WebSocket server expires stale movement and firing intents', async () => {
  const server = await readFile(new URL('../src/server/pvpServer.ts', import.meta.url), 'utf8');
  assert.match(server, /PVP_INPUT_STALE_TIMEOUT_MS = 220/);
  assert.match(server, /function expireStaleRoomInputs/);
  assert.match(server, /expireStaleRoomInputs\(room, now\)/);
  assert.match(server, /room\.lastInputAt\[playerSlot\] = Date\.now\(\)/);
  assert.match(server, /isFiring: false/);
});


test('PvP right-stick is revealed on the portaled touch-controls layer, not the WebGL shell', async () => {
  const [app, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /touchControls\?\.classList\.add\('pvp-mode', 'manual-aim-mode'\)/);
  assert.match(app, /touchControls\?\.classList\.remove\('pvp-mode', 'manual-aim-mode'\)/);
  assert.match(css, /#touch-controls\.manual-aim-mode \.pvp-aim-zone \{ display: block !important; \}/);
  assert.doesNotMatch(css, /#game-shell\.manual-aim-mode \.pvp-aim-zone \{ display: block !important; \}/);
  assert.match(css, /#touch-controls\.manual-aim-mode \.pvp-aim-base:not\(\.active\) \{ opacity: \.48 !important; \}/);
});

test('PvP online buttons are disabled with a clear WSS requirement when the static client has no server URL', async () => {
  const [app, html] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /const onlineReady = Boolean\(import\.meta\.env\.VITE_PVP_WS_URL\?\.trim\(\) \|\| 'wss:\/\/paleciaki-pvp\.onrender\.com\/pvp-ws'\)/);
  assert.match(app, /createRoomButton\.disabled = !onlineReady/);
  assert.match(app, /joinRoomButton\.disabled = !onlineReady/);
  assert.match(html, /id="pvp-online-hint"/);
  assert.match(app, /strona GitHub Pages nie hostuje serwera WSS/);
});

test('local PvP bot does not fire into blocking warehouse cover', async () => {
  const [client, tactics] = await Promise.all([
    readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpBotTactics.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /choosePvpBotDecision/);
  assert.match(tactics, /hasPvpLineOfSight\(bot, opponent, obstacles\)/);
  assert.match(tactics, /const isFiring = distance < 26 && lineOfSight && bot\.hp > 0/);
});


test('PvP host lobby exposes connection progress and server errors before a room is created', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const hostStart = app.indexOf("bindPvpTap(btnCreateRoom");
  const host = app.slice(hostStart, app.indexOf("// Online WebSocket Join", hostStart));
  assert.ok(host.includes("createdRoomInfo?.classList.remove('hidden')"));
  assert.ok(host.includes('Łączenie z serwerem PvP'));
  assert.ok(host.includes("hostStatus.setAttribute('role', 'alert')"));
  assert.ok(host.includes('hostStatus.textContent = ' + String.fromCharCode(96) + 'Błąd: ${err}' + String.fromCharCode(96)));
});


test('PvP deployment uses a minimal runtime Docker image and a Frankfurt Render Blueprint', async () => {
  const [docker, blueprint, server] = await Promise.all([
    readFile(new URL('../Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../render.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/standalone.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(docker, /FROM node:24-alpine AS runtime-deps/);
  assert.ok(docker.includes('npm install --omit=dev --no-package-lock --no-audit --no-fund ws@8.22.1'));
  assert.match(docker, /COPY --from=runtime-deps \/deps\/node_modules \.\/node_modules/);
  assert.ok(docker.includes('CMD ["npm", "run", "pvp:server"]'));
  assert.doesNotMatch(docker, /npm ci/);
  assert.match(blueprint, /runtime: docker/);
  assert.match(blueprint, /region: frankfurt/);
  assert.match(blueprint, /plan: free/);
  assert.match(blueprint, /healthCheckPath: \/healthz/);
  assert.match(blueprint, /autoDeployTrigger: checksPass/);
  assert.match(blueprint, /PVP_ALLOWED_ORIGINS/);
  assert.match(server, /request\.url === '\/healthz'/);
  assert.match(server, /process\.env\.PORT/);
});


test('PvP lobby shows accessible live connection, waiting-room and opponent status', async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="pvp-connection-status" class="pvp-connection-status is-idle" role="status" aria-live="polite"/);
  assert.match(html, /id="pvp-connection-title"/);
  assert.match(html, /id="pvp-connection-detail"/);
  assert.match(app, /setPvpConnectionStatus\('connecting', 'ŁĄCZENIE Z SERWEREM'/);
  assert.match(app, /setPvpConnectionStatus\('waiting', 'POKÓJ UTWORZONY • OCZEKIWANIE'/);
  assert.match(app, /setPvpConnectionStatus\('matched', 'PRZECIWNIK DOŁĄCZYŁ'/);
  assert.match(app, /setPvpConnectionStatus\('error', 'NIE UDAŁO SIĘ POŁĄCZYĆ'/);
  assert.match(app, /setPvpConnectionStatus\('error', 'NIE UDAŁO SIĘ DOŁĄCZYĆ'/);
  assert.match(css, /\.pvp-connection-status\.is-connecting/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});


test('public PvP matchmaking connects the lobby, server FIFO queue, auto-ready and cancel action', async () => {
  const [server, client, app, html, css] = await Promise.all([
    readFile(new URL('../src/server/pvpServer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(server, /const matchmakingQueue: MatchmakingQueueEntry\[\] = \[\]/);
  assert.match(server, /case 'find_match'/);
  assert.match(server, /case 'cancel_matchmaking'/);
  assert.match(server, /type: 'matchmaking_status'/);
  assert.match(server, /type: 'match_found'/);
  assert.match(server, /first\.assignRoom\(code, 'p1'\)/);
  assert.match(server, /second\.assignRoom\(code, 'p2'\)/);
  assert.match(client, /public findMatch\(operatorId: CharacterId, playerName: string\)/);
  assert.match(client, /public cancelMatchmaking\(\): boolean/);
  assert.match(client, /case 'matchmaking_status'/);
  assert.match(client, /case 'match_found'/);
  assert.match(client, /Keep the request until matched\/cancelled so reconnects can re-enter the FIFO queue/);
  assert.match(client, /this\.send\(\{ type: 'set_ready', ready: true \}\)/);
  assert.match(app, /btn-pvp-find-match/);
  assert.match(app, /btn-pvp-cancel-match/);
  assert.match(app, /session\.findMatch\(this\.selectedPvpOperator, playerNick\)/);
  assert.match(app, /session\.cancelMatchmaking\(\)/);
  assert.match(app, /RYWAL SIĘ ROZŁĄCZYŁ/);
  assert.match(app, /Twoja pozycja: \$\{position\}/);
  assert.match(html, /id="btn-pvp-find-match"/);
  assert.match(html, /id="btn-pvp-cancel-match"/);
  assert.match(css, /\.pvp-matchmaking-actions/);
  assert.match(css, /\.pvp-connection-status\.is-searching/);
});


test('Survival is harder to trivialize, combat HUD stops covering the arena, and pause exposes exit to menu', async () => {
  const [balance, difficulty, game, html, app, css] = await Promise.all([
    readFile(new URL('../src/characterBalance.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/survivalDifficulty.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(balance, /SURVIVAL_OUTGOING_DAMAGE_MULTIPLIER = 0\.62/);
  assert.match(balance, /SURVIVAL_INCOMING_DAMAGE_MULTIPLIER = 1\.30/);
  assert.match(balance, /SURVIVAL_HIT_INVULNERABILITY_SECONDS = 0\.78/);
  assert.match(game, /scaleSurvivalOutgoingDamage\(amount\)/);
  assert.match(game, /scaleSurvivalIncomingDamage\(amount\)/);
  assert.match(game, /SURVIVAL_HIT_INVULNERABILITY_SECONDS/);
  assert.match(game, /const groupSize = Math\.min\(groupLimit, 3 \+/);
  assert.match(difficulty, /spawnIntervalSeconds: Math\.max\(3\.0/);
  assert.match(difficulty, /enemySpeedMultiplier: 1 \+/);
  assert.match(html, /id="btn-menu-pause" class="btn-modal pause-exit-button"[^>]*>WYJDŹ DO MENU/);
  assert.match(html, /aria-modal="true"/);
  assert.match(app, /const exitPausedRunToMenu = \(\) =>/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-menu-pause'\), exitPausedRunToMenu\)/);
  assert.match(css, /#game-shell\.survival-mode #survival-hud #survival-contract/);
  assert.match(css, /#game-shell\.survival-mode #survival-hud #survival-event/);
  assert.match(css, /#game-shell\.survival-mode #survival-hud \.survival-chip:not\(\.time-chip\):not\(\.wave-chip\)/);
  assert.match(app, /document\.body\.appendChild\(dialog\)/);
  assert.match(css, /#pause-modal \.pause-exit-button/);
  assert.match(css, /#pause-modal \.modal-actions[\s\S]*?flex-direction: column/);
});


test('PvP lobby and match result dialogs render above the full-screen title menu and remain tappable', async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="btn-open-pvp"/);
  assert.match(html, /id="pvp-lobby-modal"[^>]*aria-hidden="true"/);
  assert.match(app, /bindPvpTap\(btnOpenPvp, openLobby\)/);
  assert.match(app, /document\.body\.appendChild\(dialog\)/);
  assert.match(app, /element\.addEventListener\('pointerup', activate\)/);
  assert.match(app, /pvpLobbyModal\.classList\.remove\('hidden'\)/);
  assert.match(app, /pvpLobbyModal\.setAttribute\('aria-hidden', 'false'\)/);
  assert.match(css, /#pvp-lobby-modal,[\s\n]*#pvp-match-end-modal,[\s\n]*#pause-modal\s*\{[\s\S]*?z-index:\s*2147483100\s*!important/);
  assert.match(css, /#pvp-lobby-modal button,[\s\n]*#pvp-lobby-modal input/);
});


test('manual PvP fire input cannot bypass the authoritative reload timer', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /localPvpPlayer\.attackCooldownTimer > 0\.08/);
});


test('PvP camera tracks both duelists, refreshes projection on aspect changes and previews first cover hit', async () => {
  const [game, camera, aim] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpCamera.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpAim.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /calculatePvpCameraTrackingBounds\(duel\.first, duel\.second/);
  assert.match(game, /const aspectChanged = Math\.abs\(this\.camera\.aspect - frame\.aspect\)/);
  assert.match(game, /this\.camera\.updateProjectionMatrix\(\)/);
  assert.match(game, /first: \{ x: local\.x, z: local\.z \}/);
  assert.match(game, /second: \{ x: remote\.x, z: remote\.z \}/);
  assert.match(game, /calculatePvpAimPreview\(/);
  assert.match(game, /preview\.onTarget \? 0x4ade80 : preview\.blocked \? 0xef4444/);
  assert.match(game, /createArenaObstacleFootprint\(obs\.width, obs\.depth, footprintColor\)/);
  assert.match(camera, /export function calculatePvpCameraTrackingBounds/);
  assert.match(aim, /export function calculatePvpAimPreview/);
});


test('Survival and PvP use exclusive control sets with no shared mode classes left behind', async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /type TouchControlsMode = 'survival' \| 'pvp' \| 'hidden'/);
  assert.match(app, /function setTouchControlsMode\(mode: TouchControlsMode\)/);
  assert.match(app, /root\.classList\.toggle\('pvp-mode', activePvp\)/);
  assert.match(app, /root\.classList\.toggle\('manual-aim-mode', activePvp\)/);
  assert.match(app, /root\.classList\.toggle\('survival-mode', activeSurvival\)/);
  assert.match(app, /setTouchControlsMode\('survival'\)/);
  assert.match(app, /setTouchControlsMode\('pvp'\)/);
  assert.match(app, /setTouchControlsMode\('hidden'\)/);
  assert.match(html, /class="pvp-aim-zone pvp-only-control"/);
  assert.match(html, /class="pvp-control-guide pvp-only-control"/);
  assert.match(html, /pvp-fire-btn pvp-only-control hidden/);
  assert.match(css, /#touch-controls:not\(\.pvp-mode\) \.pvp-only-control/);
  assert.match(css, /#touch-controls\.pvp-mode \.pvp-control-guide\.pvp-only-control/);
});
