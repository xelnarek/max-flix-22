import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalDifficultyProfile } from '../src/survivalDifficulty.ts';
import { scaleSurvivalOutgoingDamage, scaleSurvivalIncomingDamage, SURVIVAL_HIT_INVULNERABILITY_SECONDS } from '../src/characterBalance.ts';

test('Survival applies stronger pressure from the opening wave and scales monotonically', () => {
  const early = getSurvivalDifficultyProfile(1);
  const middle = getSurvivalDifficultyProfile(10);
  const late = getSurvivalDifficultyProfile(30);
  assert.equal(early.enemyHealthMultiplier, 1.28);
  assert.equal(early.enemySpeedMultiplier, 1);
  assert.equal(early.spawnIntervalSeconds, 5.5);
  assert.equal(early.enemyAbilityRateMultiplier, 1.1);
  assert.ok(middle.enemyHealthMultiplier > early.enemyHealthMultiplier);
  assert.ok(late.enemyHealthMultiplier > middle.enemyHealthMultiplier);
  assert.ok(middle.enemySpeedMultiplier > early.enemySpeedMultiplier);
  assert.ok(late.enemySpeedMultiplier > middle.enemySpeedMultiplier);
  assert.ok(middle.spawnIntervalSeconds < early.spawnIntervalSeconds);
  assert.ok(late.spawnIntervalSeconds < middle.spawnIntervalSeconds);
  assert.ok(late.enemyAbilityRateMultiplier > middle.enemyAbilityRateMultiplier);
  assert.deepEqual(getSurvivalDifficultyProfile(Number.NaN), early);
});

test('late-game difficulty is capped while enemy groups and attack cadence stay bounded', () => {
  const late = getSurvivalDifficultyProfile(1000);
  assert.equal(late.enemyHealthMultiplier, 3.38);
  assert.equal(late.enemySpeedMultiplier, 1.55);
  assert.equal(late.spawnIntervalSeconds, 3);
  assert.equal(late.extraGroupSize, 6);
  assert.equal(late.enemyAbilityRateMultiplier, 1.7);
});

test('every Survival operator shares the outgoing damage nerf and increased incoming pressure', () => {
  assert.equal(scaleSurvivalOutgoingDamage(10), 6.2);
  assert.equal(scaleSurvivalIncomingDamage(1), 1.3);
  assert.equal(SURVIVAL_HIT_INVULNERABILITY_SECONDS, 0.78);
  assert.equal(scaleSurvivalOutgoingDamage(-5), 0);
  assert.equal(scaleSurvivalIncomingDamage(Number.NaN), 0);
});
