import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSurvivalXpStreakState,
  getSurvivalXpStreakTier,
  registerSurvivalXpPickup,
} from '../src/survivalXpStreak.ts';

test('a single pickup starts a streak without an XP bonus', () => {
  const result = registerSurvivalXpPickup(createSurvivalXpStreakState(), 10);
  assert.equal(result.tier, 1);
  assert.equal(result.multiplier, 1);
  assert.equal(result.continued, false);
});

test('rapid pickups increase the XP multiplier in bounded steps', () => {
  let state = createSurvivalXpStreakState();
  const multipliers = [];
  for (let index = 0; index < 8; index++) {
    const result = registerSurvivalXpPickup(state, 10 + index * 1.1);
    state = result.state;
    multipliers.push(result.multiplier);
  }
  assert.deepEqual(multipliers, [1, 1.08, 1.16, 1.25, 1.35, 1.45, 1.45, 1.45]);
  assert.equal(getSurvivalXpStreakTier(state, 18), 6);
});

test('a late pickup resets the chain and does not preserve a stale bonus', () => {
  const first = registerSurvivalXpPickup(createSurvivalXpStreakState(), 2);
  const second = registerSurvivalXpPickup(first.state, 8);
  assert.equal(second.tier, 1);
  assert.equal(second.multiplier, 1);
  assert.equal(second.continued, false);
});

test('invalid and backwards timestamps cannot create a free chain', () => {
  const first = registerSurvivalXpPickup(createSurvivalXpStreakState(), 10);
  const backwards = registerSurvivalXpPickup(first.state, 9);
  assert.equal(backwards.tier, 1);
  assert.equal(backwards.multiplier, 1);
  const invalid = registerSurvivalXpPickup(backwards.state, Number.NaN);
  assert.equal(invalid.state.lastPickupAt, 0);
});

test('streak display expires after the pickup window', () => {
  const first = registerSurvivalXpPickup(createSurvivalXpStreakState(), 10);
  const second = registerSurvivalXpPickup(first.state, 11);
  assert.equal(getSurvivalXpStreakTier(second.state, 16.25), 2);
  assert.equal(getSurvivalXpStreakTier(second.state, 16.26), 0);
});
