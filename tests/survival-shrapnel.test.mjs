import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalShrapnelProfile } from '../src/survivalShrapnel.ts';

test('shrapnel is disabled at rank zero and malformed ranks fail safely', () => {
  assert.deepEqual(getSurvivalShrapnelProfile(0), {
    radius: 0,
    damageMultiplier: 0,
    maxTargets: 0,
  });
  assert.deepEqual(getSurvivalShrapnelProfile(Number.NaN), {
    radius: 0,
    damageMultiplier: 0,
    maxTargets: 0,
  });
  assert.deepEqual(getSurvivalShrapnelProfile(-4), {
    radius: 0,
    damageMultiplier: 0,
    maxTargets: 0,
  });
});

test('three shrapnel ranks increase reach and damage without unbounded target counts', () => {
  const first = getSurvivalShrapnelProfile(1);
  const second = getSurvivalShrapnelProfile(2);
  const third = getSurvivalShrapnelProfile(3);
  assert.ok(first.radius < second.radius && second.radius < third.radius);
  assert.ok(first.damageMultiplier < second.damageMultiplier);
  assert.ok(second.damageMultiplier < third.damageMultiplier);
  assert.deepEqual([first.maxTargets, second.maxTargets, third.maxTargets], [1, 1, 2]);
  assert.ok(third.damageMultiplier <= 0.46);
  assert.ok(third.maxTargets <= 3);
});

test('Crystal Cascade adds a bounded extra target and a stronger impact profile', () => {
  const base = getSurvivalShrapnelProfile(2);
  const evolved = getSurvivalShrapnelProfile(2, true);
  assert.ok(evolved.radius > base.radius);
  assert.ok(evolved.damageMultiplier > base.damageMultiplier);
  assert.equal(evolved.maxTargets, 2);
  assert.equal(getSurvivalShrapnelProfile(3, true).maxTargets, 3);
});

test('rarity strength is clamped and cannot create a runaway splash multiplier', () => {
  const base = getSurvivalShrapnelProfile(3, true, 1);
  const stronger = getSurvivalShrapnelProfile(3, true, 1.4);
  const capped = getSurvivalShrapnelProfile(3, true, 99);
  const invalid = getSurvivalShrapnelProfile(3, true, Number.NaN);
  assert.ok(stronger.damageMultiplier > base.damageMultiplier);
  assert.equal(capped.damageMultiplier, 0.46);
  assert.equal(invalid.damageMultiplier, base.damageMultiplier);
  assert.ok(capped.damageMultiplier <= 0.46);
});
