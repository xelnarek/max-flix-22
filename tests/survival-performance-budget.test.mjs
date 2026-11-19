import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalPerformanceBudget } from '../src/survivalPerformanceBudget.ts';

test('handheld effect and crowd budgets step down with the adaptive tier', () => {
  const strong = getSurvivalPerformanceBudget(true, 0);
  const balanced = getSurvivalPerformanceBudget(true, 1);
  const constrained = getSurvivalPerformanceBudget(true, 2);

  assert.deepEqual(
    [strong.enemyCap, strong.groupCap, strong.novaProjectileCount, strong.explosionParticleCount],
    [22, 8, 16, 18],
  );
  assert.deepEqual(
    [balanced.enemyCap, balanced.groupCap, balanced.novaProjectileCount, balanced.explosionParticleCount],
    [20, 7, 14, 14],
  );
  assert.deepEqual(
    [constrained.enemyCap, constrained.groupCap, constrained.novaProjectileCount, constrained.explosionParticleCount],
    [16, 5, 10, 10],
  );
});

test('desktop has a larger but explicitly bounded effects budget', () => {
  const budget = getSurvivalPerformanceBudget(false, 0);
  assert.deepEqual(
    [budget.enemyCap, budget.groupCap, budget.maxRouletteExtraEnemies, budget.novaProjectileCount],
    [42, 10, 4, 20],
  );
  assert.ok(budget.explosionParticleCount <= 26);
});

test('performance budget normalizes invalid and out-of-range adaptive tiers', () => {
  assert.deepEqual(
    getSurvivalPerformanceBudget(true, Number.NaN),
    getSurvivalPerformanceBudget(true, 1),
  );
  assert.deepEqual(
    getSurvivalPerformanceBudget(true, -5),
    getSurvivalPerformanceBudget(true, 0),
  );
  assert.deepEqual(
    getSurvivalPerformanceBudget(true, 50),
    getSurvivalPerformanceBudget(true, 2),
  );
});

test('all per-event limits remain positive and finite', () => {
  for (const mobile of [true, false]) {
    for (const tier of [0, 1, 2]) {
      const budget = getSurvivalPerformanceBudget(mobile, tier);
      for (const value of Object.values(budget)) {
        assert.ok(Number.isFinite(value) && value > 0);
      }
    }
  }
});

test('performance budgets reuse frozen profiles for each device/tier combination', () => {
  const desktopA = getSurvivalPerformanceBudget(false, 0);
  const desktopB = getSurvivalPerformanceBudget(false, 2);
  const mobile0A = getSurvivalPerformanceBudget(true, 0);
  const mobile0B = getSurvivalPerformanceBudget(true, 0);
  const mobile1 = getSurvivalPerformanceBudget(true, 1);
  const mobile2 = getSurvivalPerformanceBudget(true, 2);
  assert.equal(desktopA, desktopB);
  assert.equal(mobile0A, mobile0B);
  assert.notEqual(mobile0A, mobile1);
  assert.notEqual(mobile1, mobile2);
  assert.notEqual(mobile2, desktopA);
  for (const profile of [desktopA, mobile0A, mobile1, mobile2]) assert.ok(Object.isFrozen(profile));
});
