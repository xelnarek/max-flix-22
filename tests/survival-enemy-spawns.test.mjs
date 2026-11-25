import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  chooseSurvivalEnemySpawnType,
  getSurvivalEnemySpawnWeights,
} from '../src/survivalEnemySpawns.ts';

const allRegularTypes = [
  'zombie_pracownik', 'kurier', 'sztaplar_szalony', 'monter', 'inspector',
  'handlowiec', 'customer', 'architect', 'przedstawiciel_włoski', 'serwisant',
  'piorun_dron', 'agv_robot', 'pan_roman', 'elite_walczak_guard',
  'mutant_gamma_forklift', 'radioactive_pip', 'cyber_salesman',
  'wkurzona_zona', 'kluska_piekielna',
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
  assert.equal(getSurvivalEnemySpawnWeights(3, 180).some((entry) => entry.type === 'wkurzona_zona'), false);
  assert.equal(getSurvivalEnemySpawnWeights(4, 120).some((entry) => entry.type === 'wkurzona_zona'), true);
  assert.equal(getSurvivalEnemySpawnWeights(5, 240).some((entry) => entry.type === 'kluska_piekielna'), false);
  assert.equal(getSurvivalEnemySpawnWeights(6, 210).some((entry) => entry.type === 'kluska_piekielna'), true);
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
    assert.ok(count >= 200, type + ' was underrepresented: ' + count);
  }
});

test('bosses and one-time event enemies are kept out of the standard random pool', () => {
  const eligible = getSurvivalEnemySpawnWeights(20, 1200).map((entry) => entry.type);
  for (const type of ['walczak', 'krol_leto', 'bosman_krakow', 'sebix_m', 'pomazaniec', 'forklift']) {
    assert.equal(eligible.includes(type), false, type);
  }
  assert.equal(chooseSurvivalEnemySpawnType(1, 0, Number.NaN), 'sztaplar_szalony');
});


test('regular deliveries avoid repeating either of the last two unlocked archetypes', () => {
  const recent = ['zombie_pracownik', 'kurier'];
  assert.equal(chooseSurvivalEnemySpawnType(1, 0, 0, recent), 'sztaplar_szalony');
  assert.notEqual(chooseSurvivalEnemySpawnType(1, 0, 0, recent), recent[0]);
  assert.notEqual(chooseSurvivalEnemySpawnType(1, 0, 0, recent), recent[1]);
});

test('spawn variety falls back to the full roster when every unlocked archetype is recent', () => {
  const allEarly = getSurvivalEnemySpawnWeights(1, 0).map((entry) => entry.type);
  assert.equal(chooseSurvivalEnemySpawnType(1, 0, 0, allEarly), chooseSurvivalEnemySpawnType(1, 0, 0));
});

test('invalid recent history is harmless and special encounters remain outside the regular pool', () => {
  assert.equal(chooseSurvivalEnemySpawnType(1, 0, 0, ['walczak', 'pomazaniec']), 'zombie_pracownik');
});

test('Survival spawn history is reset, bounded and used only by regular deliveries', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /private survivalRecentSpawnTypes: SurvivalEnemySpawnType\[\] = \[\]/);
  assert.match(game, /this\.survivalRecentSpawnTypes = \[\]/);
  assert.match(game, /chooseSurvivalEnemySpawnType\(wave, this\.survivalElapsed, Math\.random\(\), this\.survivalRecentSpawnTypes\)/);
  assert.match(game, /this\.survivalRecentSpawnTypes\.push\(spawnType\);[\s\S]*?if \(this\.survivalRecentSpawnTypes\.length > SURVIVAL_SPAWN_VARIETY_MEMORY\) this\.survivalRecentSpawnTypes\.shift\(\)/);
});
