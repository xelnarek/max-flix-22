import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalXpDropProfile, rollSurvivalXpDrop } from '../src/survivalXpDrops.ts';

test('regular enemies no longer leave an XP crystal on every kill', () => {
  const regular = getSurvivalXpDropProfile('zombie_pracownik');
  assert.equal(regular.chance, 0.32);
  assert.equal(rollSurvivalXpDrop('zombie_pracownik', 0.33, 0.5), null);
  assert.deepEqual(rollSurvivalXpDrop('zombie_pracownik', 0.1, 0), {
    dropClass: 'regular', value: 1, isMilestone: false,
    isPityDrop: false,
  });
});

test('heavy enemies have a better chance and a higher XP value', () => {
  const heavy = getSurvivalXpDropProfile('sztaplar_szalony');
  assert.equal(heavy.chance, 0.56);
  assert.deepEqual(rollSurvivalXpDrop('sztaplar_szalony', 0.1, 0.99), {
    dropClass: 'heavy', value: 3, isMilestone: false,
    isPityDrop: false,
  });
});

test('elites and bosses are reliable XP sources', () => {
  assert.equal(getSurvivalXpDropProfile('sebix_m').chance, 0.88);
  assert.equal(getSurvivalXpDropProfile('walczak').chance, 1);
  assert.deepEqual(rollSurvivalXpDrop('walczak', 0.99, 0.99), {
    dropClass: 'boss', value: 4, isMilestone: false,
    isPityDrop: false,
  });
});

test('every eighth elimination remains a guaranteed milestone crystal', () => {
  assert.deepEqual(rollSurvivalXpDrop('zombie_pracownik', 0.99, 0, 1, 1, 1, 2), {
    dropClass: 'regular', value: 3, isMilestone: true,
    isPityDrop: false,
  });
});

test('wave and anomaly bonuses stack but remain bounded', () => {
  const result = rollSurvivalXpDrop('sztaplar_szalony', 0.1, 0.99, 1.5, 1.6, 1.18);
  assert.equal(result?.value, 5);
  assert.equal(rollSurvivalXpDrop('kurier', 0.05, 0.5, 1, 0, 1), null);
  assert.equal(rollSurvivalXpDrop('kurier', Number.NaN, Number.NaN, Number.NaN), null);
});


test('regular XP drops receive bounded bad-luck protection and are guaranteed after four misses', () => {
  assert.equal(rollSurvivalXpDrop('zombie_pracownik', 0.9, 0, 1, 1, 1, 0, 3), null);
  const protectedDrop = rollSurvivalXpDrop('zombie_pracownik', 0.9, 0, 1, 1, 1, 0, 4);
  assert.deepEqual(protectedDrop, {
    dropClass: 'regular', value: 1, isMilestone: false, isPityDrop: true,
  });
});

test('higher-value enemies receive proportionally faster pity protection', () => {
  const heavy = rollSurvivalXpDrop('sztaplar_szalony', 0.999, 0.5, 1, 1, 1, 0, 2);
  const elite = rollSurvivalXpDrop('sebix_m', 0.999, 0.5, 1, 1, 1, 0, 1);
  assert.equal(heavy?.isPityDrop, true);
  assert.equal(elite?.isPityDrop, true);
});

test('a normal successful roll is not mislabeled as a pity reward', () => {
  const result = rollSurvivalXpDrop('zombie_pracownik', 0.1, 0.5, 1, 1, 1, 0, 4);
  assert.equal(result?.isPityDrop, false);
});

test('an anomaly that explicitly disables XP drops is not bypassed by pity protection', () => {
  assert.equal(rollSurvivalXpDrop('zombie_pracownik', 0.1, 0.5, 1, 0, 1, 0, 8), null);
});
