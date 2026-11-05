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

test('the sixth consecutive pickup triggers one perfect-chain reward only once', () => {
  let state = createSurvivalXpStreakState();
  let perfect = null;
  for (let index = 0; index < 8; index++) {
    const result = registerSurvivalXpPickup(state, 20 + index * 1.1);
    state = result.state;
    if (result.perfectChainNow) perfect = result;
  }
  assert.ok(perfect);
  assert.equal(perfect.tier, 6);
  assert.equal(perfect.perfectChainNow, true);
  assert.equal(state.perfectRewardClaimed, true);
  const continued = registerSurvivalXpPickup(state, 29.0);
  assert.equal(continued.perfectChainNow, false);
  assert.equal(continued.state.perfectRewardClaimed, true);
});

test('a broken XP chain can earn the perfect-chain reward again after rebuilding six pickups', () => {
  let state = createSurvivalXpStreakState();
  for (let index = 0; index < 6; index++) state = registerSurvivalXpPickup(state, 30 + index).state;
  assert.equal(state.perfectRewardClaimed, true);
  state = registerSurvivalXpPickup(state, 50).state;
  assert.equal(state.count, 1);
  assert.equal(state.perfectRewardClaimed, false);
  let result;
  for (let index = 1; index < 6; index++) {
    result = registerSurvivalXpPickup(state, 50 + index);
    state = result.state;
  }
  assert.equal(result.perfectChainNow, true);
});
