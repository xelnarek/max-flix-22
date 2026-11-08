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
  assert.match(client, /CONNECT_TIMEOUT_MS = 7000/);
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
  assert.match(game, /this\.manualAimFiring && this\.attackCooldownTimer <= 0/);
  assert.match(game, /shouldPvpAimFire\(x, z, this\.manualAimFiring\)/);
  assert.match(game, /PVP_AIM_DIRECTION_DEADZONE/);
  assert.match(game, /this\.pvpInputSendAccumulator %= inputInterval/);
  assert.match(app, /getElementById\('pvp-aim-zone'\)/);
  assert.match(app, /REWANŻ ZGŁOSZONY • CZEKAJ NA RYWALA/);
  assert.match(html, /maxlength="6"/);
  assert.match(server, /maxPayload: 4096/);
  assert.match(server, /MAX_MESSAGES_PER_SECOND = 120/);
  assert.match(server, /PVP_ALLOWED_ORIGINS/);
  assert.match(server, /rematchVotes\.size === 2/);
  assert.match(server, /\{6\}/);
  assert.match(arena, /sanitizePvpInputIntent/);
  assert.match(arena, /firstProjectileObstacleHit/);
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
  assert.match(app, /const onlineReady = Boolean\(import\.meta\.env\.VITE_PVP_WS_URL\?\.trim\(\)\)/);
  assert.match(app, /createRoomButton\.disabled = !onlineReady/);
  assert.match(app, /joinRoomButton\.disabled = !onlineReady/);
  assert.match(html, /id="pvp-online-hint"/);
  assert.match(app, /strona GitHub Pages nie hostuje serwera WSS/);
});

test('local PvP bot does not fire into blocking warehouse cover', async () => {
  const client = await readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8');
  assert.match(client, /const hasClearShot = hasPvpLineOfSight\(bot, player, this\.state\.obstacles\)/);
  assert.match(client, /this\.p2Input\.isFiring = distToPlayer < 22 && hasClearShot/);
});


test('PvP host lobby exposes connection progress and server errors before a room is created', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const host = app.slice(app.indexOf("btnCreateRoom?.addEventListener"), app.indexOf("// Online WebSocket Join"));
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
  assert.match(blueprint, /plan: 0\.5c-512mb/);
  assert.match(blueprint, /healthCheckPath: \/healthz/);
  assert.match(blueprint, /autoDeployTrigger: checksPass/);
  assert.match(blueprint, /PVP_ALLOWED_ORIGINS/);
  assert.match(server, /request\.url === '\/healthz'/);
  assert.match(server, /process\.env\.PORT/);
});
