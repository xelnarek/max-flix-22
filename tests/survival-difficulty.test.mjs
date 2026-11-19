import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalDifficultyProfile } from '../src/survivalDifficulty.ts';
import { ENEMY_MOVEMENT_SPEED_MULTIPLIER } from '../src/combatBalance.ts';
import { scaleSurvivalOutgoingDamage, scaleSurvivalIncomingDamage, SURVIVAL_OUTGOING_DAMAGE_MULTIPLIER, SURVIVAL_HIT_INVULNERABILITY_SECONDS } from '../src/characterBalance.ts';

test('Survival difficulty escalates health, cadence and special pressure without accelerating enemies', () => {
  const early = getSurvivalDifficultyProfile(1);
  const middle = getSurvivalDifficultyProfile(10);
  const late = getSurvivalDifficultyProfile(30);
  assert.equal(early.enemyHealthMultiplier, 1.45);
  assert.equal(early.enemySpeedMultiplier, 1);
  assert.equal(early.spawnIntervalSeconds, 5.15);
  assert.equal(early.enemyAbilityRateMultiplier, 1.18);
  assert.ok(middle.enemyHealthMultiplier > early.enemyHealthMultiplier);
  assert.ok(late.enemyHealthMultiplier > middle.enemyHealthMultiplier);
  assert.equal(middle.enemySpeedMultiplier, 1);
  assert.equal(late.enemySpeedMultiplier, 1);
  assert.ok(middle.spawnIntervalSeconds < early.spawnIntervalSeconds);
  assert.ok(late.spawnIntervalSeconds < middle.spawnIntervalSeconds);
  assert.ok(late.enemyAbilityRateMultiplier > middle.enemyAbilityRateMultiplier);
  assert.deepEqual(getSurvivalDifficultyProfile(Number.NaN), early);
});

test('normal Survival movement stays at the 0.88x dodge-friendly baseline across late waves', () => {
  assert.equal(ENEMY_MOVEMENT_SPEED_MULTIPLIER, 0.88);
  for (const wave of [1, 10, 30, 1000]) {
    const profile = getSurvivalDifficultyProfile(wave);
    assert.equal(profile.enemySpeedMultiplier, 1);
    assert.equal(profile.enemySpeedMultiplier * ENEMY_MOVEMENT_SPEED_MULTIPLIER, 0.88);
  }
});

test('late-game health, spawn cadence, group size and enemy ability pressure remain bounded', () => {
  const late = getSurvivalDifficultyProfile(1000);
  assert.equal(late.enemyHealthMultiplier, 4.0);
  assert.equal(late.enemySpeedMultiplier, 1);
  assert.equal(late.spawnIntervalSeconds, 4.55);
  assert.equal(late.extraGroupSize, 6);
  assert.equal(late.enemyAbilityRateMultiplier, 1.96);
});

test('every Survival operator receives a stronger outgoing damage and increased incoming pressure', () => {
  assert.equal(SURVIVAL_OUTGOING_DAMAGE_MULTIPLIER, 0.88);
  assert.ok(Math.abs(scaleSurvivalOutgoingDamage(10) - 8.8) < 1e-9);
  assert.equal(scaleSurvivalIncomingDamage(1), 1.16);
  assert.equal(SURVIVAL_HIT_INVULNERABILITY_SECONDS, 0.72);
  assert.equal(scaleSurvivalOutgoingDamage(-5), 0);
  assert.equal(scaleSurvivalIncomingDamage(Number.NaN), 0);
});
