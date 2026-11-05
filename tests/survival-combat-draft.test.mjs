import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseSurvivalRicochetTarget,
  getSurvivalRadiationProfile,
  getSurvivalRicochetProfile,
} from '../src/survivalCombatDraft.ts';

test('ricochet ranks add controlled hops and preserve a bounded damage share', () => {
  const none = getSurvivalRicochetProfile(0);
  const first = getSurvivalRicochetProfile(1);
  const third = getSurvivalRicochetProfile(3);
  assert.equal(none.bounceCount, 0);
  assert.equal(first.bounceCount, 1);
  assert.equal(third.bounceCount, 3);
  assert.ok(third.maxDistance > first.maxDistance);
  assert.ok(third.damageRetention > first.damageRetention);
  assert.ok(third.damageRetention <= 0.9);
});

test('Chain Reactor improves both range and ricochet damage retention without exceeding caps', () => {
  const base = getSurvivalRicochetProfile(2);
  const evolved = getSurvivalRicochetProfile(2, true);
  assert.equal(evolved.bounceCount, base.bounceCount);
  assert.ok(evolved.maxDistance > base.maxDistance);
  assert.ok(evolved.damageRetention > base.damageRetention);
  assert.ok(evolved.damageRetention <= 0.9);
});

test('radiation ranks grow the pulse area, target budget and damage', () => {
  const none = getSurvivalRadiationProfile(0);
  const first = getSurvivalRadiationProfile(1);
  const second = getSurvivalRadiationProfile(2);
  const third = getSurvivalRadiationProfile(3);
  assert.deepEqual(none, { radius: 0, intervalSeconds: 0, damage: 0, maxTargets: 0 });
  assert.ok(first.radius < second.radius && second.radius < third.radius);
  assert.equal(first.damage, 1);
  assert.equal(second.damage, 2);
  assert.equal(third.maxTargets, 10);
  assert.ok(third.intervalSeconds < first.intervalSeconds);
});

test('Chain Reactor makes radiation pulse faster, wider and stronger', () => {
  const base = getSurvivalRadiationProfile(2);
  const evolved = getSurvivalRadiationProfile(2, true);
  assert.ok(evolved.radius > base.radius);
  assert.ok(evolved.intervalSeconds < base.intervalSeconds);
  assert.ok(evolved.damage > base.damage);
  assert.equal(evolved.maxTargets, base.maxTargets);
});

test('ricochet chooses the nearest living unhit enemy inside range', () => {
  const target = chooseSurvivalRicochetTarget(
    { x: 0, z: 0 },
    [
      { id: 'far', x: 5, z: 0 },
      { id: 'already-hit', x: 1, z: 0 },
      { id: 'defeated', x: 0.5, z: 0, state: 'defeated' },
      { id: 'nearest-valid', x: 2, z: 0 },
      { id: 'outside', x: 12, z: 0 },
    ],
    new Set(['already-hit']),
    7,
  );
  assert.equal(target?.id, 'nearest-valid');
});

test('ricochet tie-breaking is stable and malformed ranges fail safely', () => {
  const candidates = [
    { id: 'zeta', x: 2, z: 0 },
    { id: 'alpha', x: -2, z: 0 },
  ];
  assert.equal(chooseSurvivalRicochetTarget({ x: 0, z: 0 }, candidates, new Set(), 3)?.id, 'alpha');
  assert.equal(chooseSurvivalRicochetTarget({ x: 0, z: 0 }, candidates, new Set(), 0), null);
  assert.equal(chooseSurvivalRicochetTarget({ x: Number.NaN, z: 0 }, candidates, new Set(), 3), null);
  assert.equal(chooseSurvivalRicochetTarget({ x: 0, z: 0 }, candidates, new Set(['alpha', 'zeta']), 3), null);
});
