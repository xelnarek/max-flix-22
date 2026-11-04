import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPerfectDodgeCounterattack,
  getSurvivalDashCooldownSeconds,
  getSurvivalDashProgress,
  rollSurvivalCriticalDamage,
} from '../src/archeroMechanics.ts';

test('a critical roll multiplies a weapon hit and reports the critical state', () => {
  assert.deepEqual(rollSurvivalCriticalDamage(4, 0.25, 2, 0.24), {
    damage: 8,
    critical: true,
  });
});

test('the chance boundary is exclusive and a normal hit keeps its base damage', () => {
  assert.deepEqual(rollSurvivalCriticalDamage(3, 0.25, 2, 0.25), {
    damage: 3,
    critical: false,
  });
});

test('critical probability and multiplier are bounded against accidental runaway values', () => {
  assert.deepEqual(rollSurvivalCriticalDamage(10, 5, 20, -1), {
    damage: 30,
    critical: true,
  });
  assert.deepEqual(rollSurvivalCriticalDamage(10, -2, 0.1, 0), {
    damage: 10,
    critical: false,
  });
});

test('invalid numeric inputs cannot produce NaN damage or accidental critical hits', () => {
  assert.deepEqual(rollSurvivalCriticalDamage(Number.NaN, Number.NaN, Number.NaN, Number.NaN), {
    damage: 1,
    critical: false,
  });
});

test('dash cooldown upgrades remain bounded and never remove the cooldown', () => {
  assert.equal(getSurvivalDashCooldownSeconds(1), 5.2);
  assert.equal(getSurvivalDashCooldownSeconds(0.5), 3);
  assert.equal(getSurvivalDashCooldownSeconds(2), 5.2);
  assert.equal(getSurvivalDashCooldownSeconds(Number.NaN), 5.2);
});

test('dash cooldown progress is clamped to the HUD range', () => {
  assert.equal(getSurvivalDashProgress(5.2, 5.2), 0);
  assert.equal(getSurvivalDashProgress(2.6, 5.2), 0.5);
  assert.equal(getSurvivalDashProgress(-1, 5.2), 1);
  assert.equal(getSurvivalDashProgress(10, 5.2), 0);
  assert.equal(getSurvivalDashProgress(0, 0), 1);
});


test('a perfect dodge grants one flat damage point to the next volley only', () => {
  assert.equal(applyPerfectDodgeCounterattack(1, true), 2);
  assert.equal(applyPerfectDodgeCounterattack(3, true), 4);
  assert.equal(applyPerfectDodgeCounterattack(3, false), 3);
});

test('counterattack damage remains safe for invalid base values', () => {
  assert.equal(applyPerfectDodgeCounterattack(Number.NaN, true), 2);
  assert.equal(applyPerfectDodgeCounterattack(Number.POSITIVE_INFINITY, false), 1);
});
