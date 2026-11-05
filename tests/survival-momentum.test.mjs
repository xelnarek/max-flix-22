import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSurvivalMomentum,
  createSurvivalMomentumState,
  getSurvivalMomentumDamageMultiplier,
  getSurvivalMomentumMoveMultiplier,
  getSurvivalMomentumRateMultiplier,
  registerSurvivalKill,
  SURVIVAL_KILL_STREAK_TARGET,
  SURVIVAL_KILL_STREAK_WINDOW_SECONDS,
  SURVIVAL_OVERDRIVE_COOLDOWN_SECONDS,
  SURVIVAL_OVERDRIVE_DURATION_SECONDS,
} from '../src/survivalMomentum.ts';

test('six fast eliminations activate a timed Overdrive and clear the chain', () => {
  let state = createSurvivalMomentumState();
  for (let index = 0; index < SURVIVAL_KILL_STREAK_TARGET - 1; index++) {
    const result = registerSurvivalKill(state);
    assert.equal(result.overdriveStarted, false);
    state = result.state;
  }
  const activated = registerSurvivalKill(state);
  assert.equal(activated.overdriveStarted, true);
  assert.equal(activated.state.killStreak, 0);
  assert.equal(activated.state.overdriveRemainingSeconds, SURVIVAL_OVERDRIVE_DURATION_SECONDS);
  assert.equal(activated.state.overdriveCooldownRemainingSeconds, SURVIVAL_OVERDRIVE_COOLDOWN_SECONDS);
});

test('the kill chain expires when eliminations are too far apart', () => {
  const first = registerSurvivalKill(createSurvivalMomentumState()).state;
  const expired = advanceSurvivalMomentum(first, SURVIVAL_KILL_STREAK_WINDOW_SECONDS + 0.01);
  assert.equal(expired.killStreak, 0);
  assert.equal(expired.killStreakRemainingSeconds, 0);
  assert.equal(registerSurvivalKill(expired).state.killStreak, 1);
});

test('Overdrive timers tick independently and cannot be banked during cooldown', () => {
  let state = createSurvivalMomentumState();
  for (let index = 0; index < SURVIVAL_KILL_STREAK_TARGET; index++) state = registerSurvivalKill(state).state;
  state = advanceSurvivalMomentum(state, 2);
  assert.equal(state.overdriveRemainingSeconds, SURVIVAL_OVERDRIVE_DURATION_SECONDS - 2);
  assert.equal(state.overdriveCooldownRemainingSeconds, SURVIVAL_OVERDRIVE_COOLDOWN_SECONDS - 2);

  let lockoutState = createSurvivalMomentumState();
  lockoutState = { ...lockoutState, overdriveCooldownRemainingSeconds: 10 };
  for (let index = 0; index < 12; index++) {
    const result = registerSurvivalKill(lockoutState);
    assert.equal(result.overdriveStarted, false);
    lockoutState = result.state;
  }
  assert.equal(lockoutState.killStreak, SURVIVAL_KILL_STREAK_TARGET - 1);
  assert.equal(lockoutState.overdriveRemainingSeconds, 0);
});

test('Overdrive boosts remain modest, deterministic and bounded', () => {
  assert.equal(getSurvivalMomentumRateMultiplier(6), 1.18);
  assert.equal(getSurvivalMomentumDamageMultiplier(6), 1.12);
  assert.equal(getSurvivalMomentumMoveMultiplier(6), 1.07);
  assert.equal(getSurvivalMomentumRateMultiplier(0), 1);
  assert.equal(getSurvivalMomentumDamageMultiplier(Number.NaN), 1);
  assert.equal(getSurvivalMomentumMoveMultiplier(-5), 1);
});
