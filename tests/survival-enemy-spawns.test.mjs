import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseSurvivalEnemySpawnType,
  getSurvivalEnemySpawnWeights,
} from '../src/survivalEnemySpawns.ts';

const allRegularTypes = [
  'zombie_pracownik', 'kurier', 'sztaplar_szalony', 'monter', 'inspector',
  'handlowiec', 'customer', 'architect', 'przedstawiciel_włoski', 'serwisant',
  'piorun_dron', 'agv_robot', 'pan_roman', 'elite_walczak_guard',
];

test('early waves have a six-type baseline and gated archetypes unlock progressively', () => {
  const early = getSurvivalEnemySpawnWeights(1, 20).map((entry) => entry.type);
  assert.deepEqual(early, [
    'zombie_pracownik', 'kurier', 'sztaplar_szalony', 'monter', 'inspector', 'handlowiec'
  ]);
  assert.equal(getSurvivalEnemySpawnWeights(2, 90).some((entry) => entry.type === 'customer'), false);
  assert.equal(getSurvivalEnemySpawnWeights(3, 90).some((entry) => entry.type === 'customer'), true);
  assert.equal(getSurvivalEnemySpawnWeights(5, 69).some((entry) => entry.type === 'przedstawiciel_włoski'), false);
  assert.equal(getSurvivalEnemySpawnWeights(5, 70).some((entry) => entry.type === 'przedstawiciel_włoski'), true);
  assert.equal(getSurvivalEnemySpawnWeights(5, 200).some((entry) => entry.type === 'piorun_dron'), false);
  assert.equal(getSurvivalEnemySpawnWeights(6, 200).some((entry) => entry.type === 'piorun_dron'), true);
});

test('every regular archetype has a non-trivial weighted share in late Survival', () => {
  const eligible = getSurvivalEnemySpawnWeights(12, 600);
  assert.deepEqual(eligible.map((entry) => entry.type), allRegularTypes);
  assert.ok(eligible.every((entry) => entry.weight > 0));

  const counts = new Map(allRegularTypes.map((type) => [type, 0]));
  const samples = 12800;
  for (let index = 0; index < samples; index++) {
    const selected = chooseSurvivalEnemySpawnType(12, 600, index / samples);
    counts.set(selected, (counts.get(selected) ?? 0) + 1);
  }
  for (const [type, count] of counts) {
    assert.ok(count >= 400, type + ' was underrepresented: ' + count);
  }
});

test('bosses and one-time event enemies are kept out of the standard random pool', () => {
  const eligible = getSurvivalEnemySpawnWeights(20, 1200).map((entry) => entry.type);
  for (const type of ['walczak', 'krol_leto', 'bosman_krakow', 'sebix_m', 'pomazaniec', 'forklift']) {
    assert.equal(eligible.includes(type), false, type);
  }
  assert.equal(chooseSurvivalEnemySpawnType(1, 0, Number.NaN), 'zombie_pracownik');
});
