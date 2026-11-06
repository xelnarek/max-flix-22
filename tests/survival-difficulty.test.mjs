import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalDifficultyProfile } from '../src/survivalDifficulty.ts';

test('difficulty pressure increases monotonically without losing finite bounds', () => {
  const early = getSurvivalDifficultyProfile(1);
  const middle = getSurvivalDifficultyProfile(10);
  const late = getSurvivalDifficultyProfile(30);
  assert.equal(early.enemyHealthMultiplier, 1);
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
  assert.equal(late.enemyHealthMultiplier, 3.55);
  assert.equal(late.enemySpeedMultiplier, 1.036);
  assert.equal(late.spawnIntervalSeconds, 5.2);
  assert.equal(late.extraGroupSize, 2);
  assert.equal(late.enemyAbilityRateMultiplier, 1.28);
});
