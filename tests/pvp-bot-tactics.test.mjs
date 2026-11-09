import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkObstacleCollision,
  createInitialPvpArenaState,
  PVP_PLAYER_RADIUS,
} from '../src/pvpArena.ts';
import { applyPvpBotAimSpread, choosePvpBotDecision, PVP_BOT_AIM_SPREAD_RADIANS } from '../src/pvpBotTactics.ts';

function contextWith(botId = 'dawid') {
  const state = createInitialPvpArenaState('marcin', 'PLAYER', botId, 'BOT');
  state.status = 'in_round';
  state.pickup.active = false;
  state.perkDrop.active = false;
  state.obstacles = [];
  const bot = state.p2;
  const opponent = state.p1;
  bot.x = 0;
  bot.z = 0;
  opponent.x = 10;
  opponent.z = 0;
  bot.abilityCooldownTimer = 20;
  return {
    state,
    bot,
    opponent,
    makeDecision: (opponentVelocity = { x: 0, z: 0 }, orbitSign = 1) =>
      choosePvpBotDecision({ bot, opponent, state, opponentVelocity, orbitSign }),
  };
}

test('practice bot aim includes bounded miss chance instead of perfect frame-by-frame tracking', () => {
  const targetAngle = 1.1;
  const samples = Array.from({ length: 12 }, (_, index) => applyPvpBotAimSpread(targetAngle, index));
  assert.ok(samples.every(Number.isFinite));
  assert.ok(samples.every((angle) => Math.abs(Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle))) <= PVP_BOT_AIM_SPREAD_RADIANS + 1e-9));
  assert.ok(new Set(samples.map((angle) => angle.toFixed(4))).size > 8, 'spread should vary between decisions');
});

test('bot aim spread is deterministic and safely wraps angles', () => {
  assert.equal(applyPvpBotAimSpread(0.4, 5), applyPvpBotAimSpread(0.4, 5));
  assert.ok(applyPvpBotAimSpread(Math.PI - 0.02, 4) >= -Math.PI);
  assert.equal(applyPvpBotAimSpread(Number.NaN, 1), 0);
});

test('local bot practice supports a real pause and throttles its AI decisions', async () => {
  const { readFile } = await import('node:fs/promises');
  const client = await readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8');
  assert.match(client, /public setPaused\(paused: boolean\)/);
  assert.match(client, /if \(this\.paused\) return/);
  assert.match(client, /if \(this\.botRepositionTimer > 0\) return/);
  assert.match(client, /this\.botRepositionTimer = 0\.46/);
  assert.match(client, /applyPvpBotAimSpread\(decision\.aimAngle, this\.botDecisionTick\)/);
});

test('bot leads shots toward a moving opponent instead of aiming only at its current position', () => {
  const { makeDecision } = contextWith('dawid');
  const direct = makeDecision({ x: 0, z: 0 });
  const led = makeDecision({ x: 0, z: 5 });

  assert.ok(Math.abs(led.aimAngle - direct.aimAngle) > 0.03);
  assert.equal(led.isFiring, true);
});

test('low-health bot prioritizes an available medkit over circling the opponent', () => {
  const { state, bot, makeDecision } = contextWith();
  bot.hp = 480;
  state.pickup.active = true;
  state.pickup.x = 0;
  state.pickup.z = 8;

  const decision = makeDecision();
  const towardMedkit = { x: state.pickup.x - bot.x, z: state.pickup.z - bot.z };
  const dot = decision.moveX * towardMedkit.x + decision.moveZ * towardMedkit.z;

  assert.ok(dot > 0.25, 'the bot should move toward the medkit');
});

test('bot anticipates an incoming shot and requests a dash when impact is imminent', () => {
  const { state, bot, makeDecision } = contextWith();
  bot.x = 0;
  bot.z = 0;
  bot.dashCooldownTimer = 0;
  state.projectiles.push({
    id: 'incoming', ownerSlot: 'p1', x: 5, y: 0.6, z: 0,
    vx: -18, vz: 0, radius: 0.28, damage: 100, life: 1, pierce: 1, color: 0xff0000,
  });

  const decision = makeDecision();

  assert.equal(decision.wantDash, true);
  assert.ok(Math.hypot(decision.moveX, decision.moveZ) > 0.9);
});

test('bot avoids an obstacle when navigating toward a target', () => {
  const { state, bot, opponent, makeDecision } = contextWith();
  opponent.x = 11;
  opponent.z = 0;
  state.obstacles = [{
    id: 'blocking_crate', x: 2, z: 0, width: 2.2, depth: 3.2, height: 2.2, type: 'pallet',
  }];

  const decision = makeDecision();
  const result = checkObstacleCollision(
    bot.x + decision.moveX * 1.2,
    bot.z + decision.moveZ * 1.2,
    PVP_PLAYER_RADIUS,
    state.obstacles,
  );

  assert.equal(result.hit, false);
  assert.ok(decision.moveZ > 0.15 || decision.moveZ < -0.15, 'bot should route around central cover');
});

test('bot never fires through warehouse cover', () => {
  const { state, makeDecision } = contextWith();
  state.obstacles = [{
    id: 'blocking_wall', x: 5, z: 0, width: 1.5, depth: 5, height: 2.5, type: 'barrier',
  }];

  const decision = makeDecision();

  assert.equal(decision.isFiring, false);
});

test('Marcin bot uses its defensive ability when health is critically low', () => {
  const { bot, makeDecision } = contextWith('marcin');
  bot.hp = 600;
  bot.abilityCooldownTimer = 0;

  const decision = makeDecision();

  assert.equal(decision.wantAbility, true);
});
