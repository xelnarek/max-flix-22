import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalKillScoreMultiplier,
  getSurvivalWaveClearBonus,
} from '../src/survivalScoring.ts';

test('Survival kill points grow gradually with harder waves and have a hard ceiling', () => {
  assert.equal(getSurvivalKillScoreMultiplier(1), 1);
  assert.equal(getSurvivalKillScoreMultiplier(5), 1.06);
  assert.equal(getSurvivalKillScoreMultiplier(18), 1.25);
  assert.equal(getSurvivalKillScoreMultiplier(1000), 1.25);
  assert.equal(getSurvivalKillScoreMultiplier(Number.NaN), 1);
});

test('wave clear bonus requires at least three eliminations in the previous wave', () => {
  assert.equal(getSurvivalWaveClearBonus(1, 0), 0);
  assert.equal(getSurvivalWaveClearBonus(1, 2), 0);
  assert.equal(getSurvivalWaveClearBonus(1, 3), 84);
  assert.equal(getSurvivalWaveClearBonus(5, 10), 148);
});

test('wave bonus remains capped during long Survival runs', () => {
  assert.equal(getSurvivalWaveClearBonus(1000, 1000), 420);
  assert.equal(getSurvivalWaveClearBonus(Number.NaN, Number.NaN), 0);
});
