import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalDifficultyProfile } from '../src/survivalDifficulty.ts';
import { scaleSurvivalOutgoingDamage, scaleSurvivalIncomingDamage } from '../src/characterBalance.ts';

test('difficulty pressure increases monotonically without losing finite bounds', () => {
  const early = getSurvivalDifficultyProfile(1);
  const middle = getSurvivalDifficultyProfile(10);
  const late = getSurvivalDifficultyProfile(30);
  assert.equal(early.enemyHealthMultiplier, 1.18);
  assert.equal(early.enemySpeedMultiplier, 0.9);
  assert.equal(early.spawnIntervalSeconds, 7.4);
  assert.ok(middle.enemyHealthMultiplier > early.enemyHealthMultiplier);
  assert.ok(late.enemyHealthMultiplier > middle.enemyHealthMultiplier);
  assert.ok(middle.enemySpeedMultiplier > early.enemySpeedMultiplier);
  assert.ok(late.enemySpeedMultiplier > middle.enemySpeedMultiplier);
  assert.ok(middle.spawnIntervalSeconds < early.spawnIntervalSeconds);
  assert.ok(late.spawnIntervalSeconds < middle.spawnIntervalSeconds);
  assert.ok(late.enemyAbilityRateMultiplier > middle.enemyAbilityRateMultiplier);
  assert.deepEqual(getSurvivalDifficultyProfile(Number.NaN), early);
});

test('late-game pressure stops at explicit spawn and stat limits', () => {
  const late = getSurvivalDifficultyProfile(1000);
  assert.equal(late.enemyHealthMultiplier, 3);
  assert.equal(late.enemySpeedMultiplier, 1.26);
  assert.equal(late.spawnIntervalSeconds, 4.2);
  assert.equal(late.extraGroupSize, 3);
  assert.equal(late.enemyAbilityRateMultiplier, 1.4);
});


test('all Survival operators share the same outgoing nerf and incoming pressure increase', () => {
  assert.equal(scaleSurvivalOutgoingDamage(10), 7.6);
  assert.equal(scaleSurvivalIncomingDamage(1), 1.15);
  assert.equal(scaleSurvivalOutgoingDamage(-5), 0);
  assert.equal(scaleSurvivalIncomingDamage(Number.NaN), 0);
});
