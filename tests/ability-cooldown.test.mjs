import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceAbilityCooldown,
  applyAbilityKillRecharge,
  createAbilityCooldown,
  getAbilityCooldownProgress,
  scaleAbilityCooldown,
} from '../src/abilityCooldown.ts';

test('special ability cooldown advances to ready and reports the correct fill percentage', () => {
  const started = createAbilityCooldown(20);
  assert.deepEqual(started, {
    remainingSeconds: 20,
    durationSeconds: 20,
    killRechargeUsedSeconds: 0,
  });
  assert.equal(getAbilityCooldownProgress(started), 0);

  const halfway = advanceAbilityCooldown(started, 10);
  assert.equal(halfway.remainingSeconds, 10);
  assert.equal(getAbilityCooldownProgress(halfway), 0.5);

  const ready = advanceAbilityCooldown(halfway, 15);
  assert.equal(ready.remainingSeconds, 0);
  assert.equal(getAbilityCooldownProgress(ready), 1);
});

test('cooldown ignores invalid or negative deltas and never becomes negative', () => {
  const initial = createAbilityCooldown(8);
  assert.deepEqual(advanceAbilityCooldown(initial, Number.NaN), initial);
  assert.deepEqual(advanceAbilityCooldown(initial, Number.POSITIVE_INFINITY), initial);
  assert.deepEqual(advanceAbilityCooldown(initial, -4), initial);
  assert.equal(advanceAbilityCooldown(initial, 100).remainingSeconds, 0);
  assert.deepEqual(createAbilityCooldown(Number.NaN), {
    remainingSeconds: 0,
    durationSeconds: 0,
    killRechargeUsedSeconds: 0,
  });
});

test('cooldown efficiency shortens an active recharge without changing its fill percentage', () => {
  const active = {
    remainingSeconds: 15,
    durationSeconds: 20,
    killRechargeUsedSeconds: 2,
  };
  const improved = scaleAbilityCooldown(active, 0.92);
  assert.equal(improved.remainingSeconds, 13.8);
  assert.equal(improved.durationSeconds, 18.4);
  assert.equal(improved.killRechargeUsedSeconds, 1.84);
  assert.ok(Math.abs(getAbilityCooldownProgress(improved) - 0.25) < 1e-9);
});

test('Survival kills recharge a bounded fraction of one special cooldown', () => {
  let state = createAbilityCooldown(30);
  const cap = state.durationSeconds * 0.22;
  let totalRecharged = 0;

  for (let index = 0; index < 100; index++) {
    const result = applyAbilityKillRecharge(state, 0.2, cap);
    state = result.state;
    totalRecharged += result.rechargedSeconds;
  }

  assert.ok(Math.abs(totalRecharged - 6.6) < 1e-9);
  assert.ok(Math.abs(state.killRechargeUsedSeconds - 6.6) < 1e-9);
  assert.ok(Math.abs(state.remainingSeconds - 23.4) < 1e-9);
});

test('elite kill recharge cannot exceed remaining cooldown or the per-use cap', () => {
  const almostReady = {
    remainingSeconds: 0.2,
    durationSeconds: 20,
    killRechargeUsedSeconds: 0,
  };
  const capped = applyAbilityKillRecharge(almostReady, 1.0, 4.4);
  assert.equal(capped.rechargedSeconds, 0.2);
  assert.equal(capped.state.remainingSeconds, 0);
  assert.equal(getAbilityCooldownProgress(capped.state), 1);

  const exhaustedBudget = applyAbilityKillRecharge({
    remainingSeconds: 10,
    durationSeconds: 20,
    killRechargeUsedSeconds: 4.4,
  }, 2, 4.4);
  assert.equal(exhaustedBudget.rechargedSeconds, 0);
  assert.equal(exhaustedBudget.state.remainingSeconds, 10);
});
