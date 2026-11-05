import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalConvoyHazardCount } from '../src/survivalConvoy.ts';

test('forklift convoy never exceeds the global three-active-hazard ceiling', () => {
  assert.equal(getSurvivalConvoyHazardCount(0, 0, 10), 2);
  assert.equal(getSurvivalConvoyHazardCount(1, 0, 10), 2);
  assert.equal(getSurvivalConvoyHazardCount(2, 0, 10), 1);
  assert.equal(getSurvivalConvoyHazardCount(3, 0, 10), 0);
  assert.equal(getSurvivalConvoyHazardCount(9, 0, 10), 0);

  for (let active = 0; active <= 8; active++) {
    const count = getSurvivalConvoyHazardCount(active, 0, 10);
    assert.ok(active + count <= 3, 'active hazard ceiling exceeded at ' + active);
  }
});

test('mobile load and narrow lanes reduce convoy size without exceeding available slots', () => {
  assert.equal(getSurvivalConvoyHazardCount(0, 2, 10), 1);
  assert.equal(getSurvivalConvoyHazardCount(1, 2, 10), 1);
  assert.equal(getSurvivalConvoyHazardCount(0, 0, 2), 1);
  assert.equal(getSurvivalConvoyHazardCount(1, 0, 2), 1);
  assert.equal(getSurvivalConvoyHazardCount(2, 2, 2), 1);
});

test('invalid convoy inputs safely resolve to a bounded hazard count', () => {
  assert.equal(getSurvivalConvoyHazardCount(Number.NaN, Number.NaN, Number.NaN), 1);
  assert.equal(getSurvivalConvoyHazardCount(Number.POSITIVE_INFINITY, 0, 9), 0);
  assert.equal(getSurvivalConvoyHazardCount(-5, -2, 9), 2);
});
