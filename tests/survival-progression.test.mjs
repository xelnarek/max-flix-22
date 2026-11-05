import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalXpRequirement } from '../src/survivalProgression.ts';

test('the opening level remains quick and unchanged', () => {
  assert.equal(getSurvivalXpRequirement(1), 9);
  assert.equal(getSurvivalXpRequirement(2), 15);
});

test('later Survival levels need modestly less XP than the previous curve', () => {
  for (let level = 2; level <= 60; level++) {
    const tuned = getSurvivalXpRequirement(level);
    const previous = Math.round(10 + level * 3);
    assert.ok(tuned < previous, `level ${level} should be faster than the previous curve`);
    assert.ok(tuned >= Math.round(previous * 0.90), `level ${level} must not be accelerated too aggressively`);
  }
});

test('XP requirements remain valid and monotonically increasing at high levels', () => {
  let previous = getSurvivalXpRequirement(1);
  for (let level = 2; level <= 200; level++) {
    const current = getSurvivalXpRequirement(level);
    assert.ok(current >= 12);
    assert.ok(current > previous);
    previous = current;
  }
});

test('invalid level inputs safely use the opening threshold', () => {
  assert.equal(getSurvivalXpRequirement(0), 9);
  assert.equal(getSurvivalXpRequirement(-5), 9);
  assert.equal(getSurvivalXpRequirement(Number.NaN), 9);
  assert.equal(getSurvivalXpRequirement(Number.POSITIVE_INFINITY), 9);
});
