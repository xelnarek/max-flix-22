import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSurvivalRetreatState,
  getSurvivalFlankInterceptOffset,
  getSurvivalRetreatTarget,
} from '../src/survivalTactics.ts';

const baseRetreat = {
  hp: 2,
  maxHp: 10,
  distanceToPlayer: 6,
  retreatTimer: 0,
  retreatCooldown: 0,
  dt: 1 / 60,
};

test('flankers lead the operator path but other roles keep their assigned combat lane', () => {
  const velocity = { x: 0, z: 4 };
  const offset = getSurvivalFlankInterceptOffset('flanker', velocity);
  assert.equal(offset.x, 0);
  assert.ok(offset.z > 0 && offset.z <= 1.65);
  assert.deepEqual(getSurvivalFlankInterceptOffset('bruiser', velocity), { x: 0, z: 0 });
  assert.deepEqual(getSurvivalFlankInterceptOffset('ranged', velocity), { x: 0, z: 0 });
  assert.deepEqual(getSurvivalFlankInterceptOffset('support', velocity), { x: 0, z: 0 });
});

test('flank interception is bounded and safely ignores stationary or malformed velocity', () => {
  assert.deepEqual(getSurvivalFlankInterceptOffset('flanker', { x: 0, z: 0 }), { x: 0, z: 0 });
  assert.deepEqual(getSurvivalFlankInterceptOffset('flanker', { x: Number.NaN, z: 2 }), { x: 0, z: 0 });
  const offset = getSurvivalFlankInterceptOffset('flanker', { x: 40, z: 0 });
  assert.ok(Math.abs(offset.x) <= 1.650001);
  assert.equal(offset.z, 0);
});

test('ranged enemies retreat at a higher health threshold than frontline bruisers', () => {
  const ranged = advanceSurvivalRetreatState({
    ...baseRetreat,
    role: 'ranged',
    hp: 3.5,
    distanceToPlayer: 7,
  });
  const bruiser = advanceSurvivalRetreatState({
    ...baseRetreat,
    role: 'bruiser',
    hp: 3.5,
    distanceToPlayer: 2.5,
  });
  assert.equal(ranged.started, true);
  assert.equal(ranged.active, true);
  assert.equal(bruiser.started, false);
});

test('frontline flankers only retreat when badly wounded and the player is close', () => {
  const healthyFlanker = advanceSurvivalRetreatState({
    ...baseRetreat, role: 'flanker', hp: 3, distanceToPlayer: 3,
  });
  const woundedFlanker = advanceSurvivalRetreatState({
    ...baseRetreat, role: 'flanker', hp: 1, distanceToPlayer: 3,
  });
  const distantFlanker = advanceSurvivalRetreatState({
    ...baseRetreat, role: 'flanker', hp: 1, distanceToPlayer: 12,
  });
  assert.equal(healthyFlanker.started, false);
  assert.equal(woundedFlanker.started, true);
  assert.equal(distantFlanker.started, false);
});

test('retreat stays committed until safe distance, then respects its cooldown', () => {
  const first = advanceSurvivalRetreatState({
    ...baseRetreat, role: 'support', hp: 2, distanceToPlayer: 5,
  });
  const continuing = advanceSurvivalRetreatState({
    ...baseRetreat,
    role: 'support',
    hp: 2,
    distanceToPlayer: 7.5,
    retreatTimer: first.remainingSeconds,
    retreatCooldown: first.cooldownRemaining,
  });
  assert.equal(first.started, true);
  assert.equal(continuing.active, true);
  assert.equal(continuing.started, false);

  const safe = advanceSurvivalRetreatState({
    ...baseRetreat,
    role: 'support',
    hp: 2,
    distanceToPlayer: 10.2,
    retreatTimer: continuing.remainingSeconds,
    retreatCooldown: continuing.cooldownRemaining,
  });
  assert.equal(safe.active, false);
  assert.equal(safe.started, false);
  assert.ok(safe.cooldownRemaining > 0);
});

test('retreat cannot immediately restart while its cooldown is active', () => {
  const result = advanceSurvivalRetreatState({
    ...baseRetreat,
    role: 'ranged',
    hp: 1,
    distanceToPlayer: 4,
    retreatTimer: 0,
    retreatCooldown: 3.0,
  });
  assert.equal(result.started, false);
  assert.equal(result.active, false);
  assert.ok(result.cooldownRemaining > 2.9);
});

test('retreat target maintains a role-specific buffer and stable side assignment', () => {
  const input = {
    role: 'support',
    playerX: 0,
    playerZ: 0,
    enemyX: 3,
    enemyZ: 0,
    slot: 0,
  };
  const first = getSurvivalRetreatTarget(input);
  const second = getSurvivalRetreatTarget(input);
  assert.deepEqual(first, second);
  assert.ok(Math.hypot(first.x, first.z) >= 8.49);
  assert.ok(Math.hypot(first.x, first.z) <= 9.81);

  const opposite = getSurvivalRetreatTarget({ ...input, slot: 1 });
  assert.notDeepEqual(first, opposite);
});

test('invalid retreat inputs do not emit non-finite flank or retreat steering', () => {
  const state = advanceSurvivalRetreatState({
    role: 'ranged',
    hp: Number.NaN,
    maxHp: 0,
    distanceToPlayer: Number.NaN,
    retreatTimer: Number.NaN,
    retreatCooldown: Number.NaN,
    dt: Number.NaN,
  });
  assert.equal(state.active, false);
  assert.equal(state.started, false);
  assert.deepEqual(getSurvivalFlankInterceptOffset('flanker', { x: Infinity, z: 0 }), { x: 0, z: 0 });
});
