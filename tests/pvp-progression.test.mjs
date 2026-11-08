import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialPvpArenaState,
  NEUTRAL_PVP_PROGRESSION_BONUSES,
  PVP_BASE_SPEED,
  PVP_OPERATOR_PROFILES,
  sanitizePvpProgressionBonuses,
  stepPvpArena,
} from '../src/pvpArena.ts';

const neutralInput = (angle = 0) => ({
  moveX: 0,
  moveZ: 0,
  aimAngle: angle,
  isFiring: false,
  wantFire: false,
  wantDash: false,
  wantAbility: false,
});

function prepareCloseShot(p1Bonuses, p2Bonuses) {
  const state = createInitialPvpArenaState(
    'marcin',
    'P1',
    'grzesiek',
    'P2',
    p1Bonuses,
    p2Bonuses,
  );
  state.status = 'in_round';
  state.obstacles = [];
  state.pickup.active = false;
  state.p1.x = -8;
  state.p1.z = 0;
  state.p2.x = -5.2;
  state.p2.z = 0;
  return state;
}

test('PvP progression bonus payloads are clamped and malformed values fall back safely', () => {
  assert.deepEqual(sanitizePvpProgressionBonuses(undefined), NEUTRAL_PVP_PROGRESSION_BONUSES);
  assert.deepEqual(sanitizePvpProgressionBonuses({
    damageMultiplier: 99,
    damageTakenMultiplier: -3,
    speedMultiplier: 0,
    cooldownMultiplier: 0.1,
  }), {
    damageMultiplier: 1.08,
    damageTakenMultiplier: 0.90,
    speedMultiplier: 1,
    cooldownMultiplier: 0.90,
  });
  assert.deepEqual(sanitizePvpProgressionBonuses({
    damageMultiplier: Number.NaN,
    damageTakenMultiplier: Number.POSITIVE_INFINITY,
    speedMultiplier: 1.04,
    cooldownMultiplier: 0.96,
  }), {
    damageMultiplier: 1,
    damageTakenMultiplier: 1,
    speedMultiplier: 1.04,
    cooldownMultiplier: 0.96,
  });
});

test('each player receives only their own progression bonus payload at arena creation', () => {
  const p1 = { damageMultiplier: 1.08, damageTakenMultiplier: 0.95, speedMultiplier: 1.03, cooldownMultiplier: 0.94 };
  const p2 = { damageMultiplier: 1.02, damageTakenMultiplier: 0.90, speedMultiplier: 1.06, cooldownMultiplier: 1 };
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2', p1, p2);

  assert.deepEqual(state.p1.progressionBonuses, p1);
  assert.deepEqual(state.p2.progressionBonuses, p2);
});

test('account damage and cooldown bonuses are applied by the authoritative PvP simulation', () => {
  const bonuses = {
    damageMultiplier: 1.08,
    damageTakenMultiplier: 1,
    speedMultiplier: 1,
    cooldownMultiplier: 0.90,
  };
  const state = prepareCloseShot(bonuses, NEUTRAL_PVP_PROGRESSION_BONUSES);
  const shot = { ...neutralInput(Math.PI / 2), wantFire: true };
  stepPvpArena(state, 0.1, shot, neutralInput());

  assert.equal(state.p1.damageDealt, 108);
  assert.equal(state.p1.primaryDamageDealt, 108);
  assert.equal(state.p2.damageTaken, 108);
  assert.equal(state.p2.hp, 1000 - 108);
  assert.ok(Math.abs(state.p1.attackCooldownTimer - PVP_OPERATOR_PROFILES.marcin.attackCooldown * 0.90) < 1e-9);
});

test('defender progression mitigation is applied to real projectile HP loss', () => {
  const state = prepareCloseShot(
    NEUTRAL_PVP_PROGRESSION_BONUSES,
    { damageMultiplier: 1, damageTakenMultiplier: 0.90, speedMultiplier: 1, cooldownMultiplier: 1 },
  );
  const shot = { ...neutralInput(Math.PI / 2), wantFire: true };
  stepPvpArena(state, 0.1, shot, neutralInput());

  assert.equal(state.p1.damageDealt, 90);
  assert.equal(state.p2.damageTaken, 90);
  assert.equal(state.p2.hp, 910);
});

test('mobility progression changes authoritative PvP movement speed', () => {
  const state = createInitialPvpArenaState(
    'marcin',
    'P1',
    'grzesiek',
    'P2',
    { damageMultiplier: 1, damageTakenMultiplier: 1, speedMultiplier: 1.06, cooldownMultiplier: 1 },
    NEUTRAL_PVP_PROGRESSION_BONUSES,
  );
  state.status = 'in_round';
  state.obstacles = [];
  state.pickup.active = false;
  const initialX = state.p1.x;
  stepPvpArena(state, 0.1, { ...neutralInput(), moveX: 1 }, neutralInput());

  const travelled = state.p1.x - initialX;
  assert.ok(Math.abs(travelled - PVP_BASE_SPEED * 1.06 * 0.1) < 1e-8);
});
