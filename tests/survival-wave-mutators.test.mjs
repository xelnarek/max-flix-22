import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySurvivalWaveMutator,
  getSurvivalWaveMutator,
  getSurvivalWaveSpawnTuning,
} from '../src/survivalWaveMutators.ts';

test('Survival shifts rotate five readable tactical mutators from wave three', () => {
  assert.equal(getSurvivalWaveMutator(1).id, 'standard');
  assert.equal(getSurvivalWaveMutator(2).id, 'standard');
  assert.equal(getSurvivalWaveMutator(3).id, 'rush');
  assert.equal(getSurvivalWaveMutator(4).id, 'armored');
  assert.equal(getSurvivalWaveMutator(5).id, 'supply');
  assert.equal(getSurvivalWaveMutator(6).id, 'swarm');
  assert.equal(getSurvivalWaveMutator(7).id, 'convoy');
  assert.equal(getSurvivalWaveMutator(8).id, 'rush');
  assert.equal(getSurvivalWaveMutator(9).id, 'armored');
  assert.equal(getSurvivalWaveMutator(10).id, 'supply');
});

test('Rush shift trades a little enemy health for faster pressure', () => {
  const stats = applySurvivalWaveMutator({ maxHp: 20, speed: 2 }, getSurvivalWaveMutator(3));
  assert.deepEqual(stats, { maxHp: 19, speed: 2.36, xpMultiplier: 1.05 });
});

test('Armored shift adds controlled health and slows the push', () => {
  const stats = applySurvivalWaveMutator({ maxHp: 20, speed: 2 }, getSurvivalWaveMutator(4));
  assert.deepEqual(stats, { maxHp: 26, speed: 1.8, xpMultiplier: 1.12 });
});

test('Supply shift rewards every kill with more XP but leaves enemy stats intact', () => {
  const stats = applySurvivalWaveMutator({ maxHp: 20, speed: 2 }, getSurvivalWaveMutator(5));
  assert.deepEqual(stats, { maxHp: 20, speed: 2, xpMultiplier: 1.5 });
});

test('Swarm shift delivers larger groups more often while reducing individual health', () => {
  const mutator = getSurvivalWaveMutator(6);
  assert.deepEqual(applySurvivalWaveMutator({ maxHp: 20, speed: 2 }, mutator), {
    maxHp: 18, speed: 2.12, xpMultiplier: 1.35,
  });
  assert.deepEqual(getSurvivalWaveSpawnTuning(4, 6, mutator, 8), {
    spawnIntervalSeconds: 3.44, groupSize: 8,
  });
});

test('Premium convoy trades group frequency for tougher, richer enemies', () => {
  const mutator = getSurvivalWaveMutator(7);
  assert.deepEqual(applySurvivalWaveMutator({ maxHp: 20, speed: 2 }, mutator), {
    maxHp: 24, speed: 1.84, xpMultiplier: 1.65,
  });
  assert.deepEqual(getSurvivalWaveSpawnTuning(4, 6, mutator, 8), {
    spawnIntervalSeconds: 4.56, groupSize: 5,
  });
});

test('spawn tuning respects handheld caps and fails safely on malformed inputs', () => {
  const swarm = getSurvivalWaveMutator(6);
  assert.deepEqual(getSurvivalWaveSpawnTuning(4, 12, swarm, 5), {
    spawnIntervalSeconds: 3.44, groupSize: 5,
  });
  assert.deepEqual(getSurvivalWaveSpawnTuning(Number.NaN, Number.NaN, swarm, 0), {
    spawnIntervalSeconds: 4.3, groupSize: 1,
  });
});

test('invalid waves fall back to standard and malformed stats stay finite', () => {
  assert.equal(getSurvivalWaveMutator(Number.NaN).id, 'standard');
  assert.deepEqual(
    applySurvivalWaveMutator(
      { maxHp: Number.NaN, speed: Number.POSITIVE_INFINITY },
      getSurvivalWaveMutator(3),
    ),
    { maxHp: 1, speed: 0.118, xpMultiplier: 1.05 },
  );
});
