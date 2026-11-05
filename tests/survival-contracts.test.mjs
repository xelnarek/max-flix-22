import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSurvivalContract,
  createSurvivalContract,
  registerSurvivalContractAction,
} from '../src/survivalContracts.ts';

test('contract types rotate between combat, collection and combo play', () => {
  assert.equal(createSurvivalContract(1).kind, 'eliminations');
  assert.equal(createSurvivalContract(2).kind, 'xp');
  assert.equal(createSurvivalContract(3).kind, 'combo');
  assert.equal(createSurvivalContract(4).kind, 'eliminations');
  assert.equal(createSurvivalContract(5).kind, 'xp');
  assert.equal(createSurvivalContract(6).target, 4);
});

test('elimination and XP goals accumulate only their matching action', () => {
  const killContract = createSurvivalContract(1);
  const ignored = registerSurvivalContractAction(killContract, 'xp', 20);
  assert.equal(ignored.state.progress, 0);
  const partial = registerSurvivalContractAction(killContract, 'eliminations', 4);
  assert.equal(partial.state.progress, 4);
  const complete = registerSurvivalContractAction(partial.state, 'eliminations', 99);
  assert.equal(complete.state.progress, killContract.target);
  assert.equal(complete.completedNow, true);
  assert.equal(registerSurvivalContractAction(complete.state, 'eliminations').completedNow, false);
});

test('combo contract tracks the best streak instead of adding unrelated kills', () => {
  const state = createSurvivalContract(3);
  const first = registerSurvivalContractAction(state, 'combo', 2);
  const lower = registerSurvivalContractAction(first.state, 'combo', 1);
  assert.equal(lower.state.progress, 2);
  const complete = registerSurvivalContractAction(lower.state, 'combo', 3);
  assert.equal(complete.completedNow, true);
  assert.equal(complete.state.progress, 3);
});

test('contract expires once and completed contracts cannot expire afterwards', () => {
  const state = createSurvivalContract(2);
  const almost = advanceSurvivalContract(state, 59.5);
  assert.equal(almost.state.remainingSeconds, 0.5);
  const expired = advanceSurvivalContract(almost.state, 1);
  assert.equal(expired.expiredNow, true);
  assert.equal(advanceSurvivalContract(expired.state, 3).expiredNow, false);
  const completed = registerSurvivalContractAction(state, 'xp', 999);
  assert.equal(advanceSurvivalContract(completed.state, 100).state.completed, true);
});

test('invalid time and action values cannot create non-finite progress', () => {
  const state = createSurvivalContract(Number.NaN);
  assert.equal(state.wave, 1);
  assert.equal(advanceSurvivalContract(state, Number.NaN).state.remainingSeconds, 60);
  assert.equal(registerSurvivalContractAction(state, 'eliminations', Number.NaN).state.progress, 0);
  assert.equal(advanceSurvivalContract(state, -2).state.remainingSeconds, 60);
});
