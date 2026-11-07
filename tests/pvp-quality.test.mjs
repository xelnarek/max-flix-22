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
  assert.match(app, /pvp-end-self-primary-damage/);
  assert.match(app, /pvp-end-opponent-primary-damage/);
  assert.match(html, /id="pvp-end-self-ability-damage"/);
  assert.match(html, /id="pvp-end-opponent-ability-damage"/);
  assert.match(html, /id="pvp-end-self-healing"/);
  assert.match(html, /id="pvp-end-opponent-knockouts"/);
  assert.match(css, /\.pvp-end-comparison-row/);
  assert.match(css, /max-height: min\(90dvh, 820px\)/);
});
