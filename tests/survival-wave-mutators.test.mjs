import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySurvivalWaveMutator,
  getSurvivalWaveMutator,
} from '../src/survivalWaveMutators.ts';

test('Survival shifts rotate readable tactical mutators from wave three', () => {
  assert.equal(getSurvivalWaveMutator(1).id, 'standard');
  assert.equal(getSurvivalWaveMutator(2).id, 'standard');
  assert.equal(getSurvivalWaveMutator(3).id, 'rush');
  assert.equal(getSurvivalWaveMutator(4).id, 'armored');
  assert.equal(getSurvivalWaveMutator(5).id, 'supply');
  assert.equal(getSurvivalWaveMutator(6).id, 'rush');
  assert.equal(getSurvivalWaveMutator(7).id, 'armored');
  assert.equal(getSurvivalWaveMutator(8).id, 'supply');
});

test('Rush shift trades a little enemy health for faster pressure', () => {
  const stats = applySurvivalWaveMutator(
    { maxHp: 20, speed: 2 },
    getSurvivalWaveMutator(3),
  );
  assert.deepEqual(stats, { maxHp: 19, speed: 2.36, xpMultiplier: 1 });
});

test('Armored shift adds controlled health and slows the push', () => {
  const stats = applySurvivalWaveMutator(
    { maxHp: 20, speed: 2 },
    getSurvivalWaveMutator(4),
  );
  assert.deepEqual(stats, { maxHp: 26, speed: 1.8, xpMultiplier: 1 });
});

test('Supply shift rewards every kill with more XP but leaves enemy stats intact', () => {
  const stats = applySurvivalWaveMutator(
    { maxHp: 20, speed: 2 },
    getSurvivalWaveMutator(5),
  );
  assert.deepEqual(stats, { maxHp: 20, speed: 2, xpMultiplier: 1.5 });
});

test('invalid waves fall back to standard and malformed stats stay finite', () => {
  assert.equal(getSurvivalWaveMutator(Number.NaN).id, 'standard');
  assert.deepEqual(
    applySurvivalWaveMutator(
      { maxHp: Number.NaN, speed: Number.POSITIVE_INFINITY },
      getSurvivalWaveMutator(3),
    ),
    { maxHp: 1, speed: 0.118, xpMultiplier: 1 },
  );
});
