import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalXpDropProfile, rollSurvivalXpDrop } from '../src/survivalXpDrops.ts';

test('regular enemies no longer leave an XP crystal on every kill', () => {
  const regular = getSurvivalXpDropProfile('zombie_pracownik');
  assert.equal(regular.chance, 0.32);
  assert.equal(rollSurvivalXpDrop('zombie_pracownik', 0.33, 0.5), null);
  assert.deepEqual(rollSurvivalXpDrop('zombie_pracownik', 0.1, 0), {
    dropClass: 'regular', value: 1, isMilestone: false,
  });
});

test('heavy enemies have a better chance and a higher XP value', () => {
  const heavy = getSurvivalXpDropProfile('sztaplar_szalony');
  assert.equal(heavy.chance, 0.56);
  assert.deepEqual(rollSurvivalXpDrop('sztaplar_szalony', 0.1, 0.99), {
    dropClass: 'heavy', value: 3, isMilestone: false,
  });
});

test('elites and bosses are reliable XP sources', () => {
  assert.equal(getSurvivalXpDropProfile('sebix_m').chance, 0.88);
  assert.equal(getSurvivalXpDropProfile('walczak').chance, 1);
  assert.deepEqual(rollSurvivalXpDrop('walczak', 0.99, 0.99), {
    dropClass: 'boss', value: 7, isMilestone: false,
  });
});

test('every eighth elimination remains a guaranteed milestone crystal', () => {
  assert.deepEqual(rollSurvivalXpDrop('zombie_pracownik', 0.99, 0, 1, 1, 1, 2), {
    dropClass: 'regular', value: 3, isMilestone: true,
  });
});

test('wave and anomaly bonuses stack but remain bounded', () => {
  const result = rollSurvivalXpDrop('kurier', 0.1, 0.99, 1.5, 1.6, 1.18);
  assert.equal(result?.value, 5);
  assert.equal(rollSurvivalXpDrop('kurier', 0.1, 0.5, 1, 0, 1)?.value, 1);
  assert.equal(rollSurvivalXpDrop('kurier', Number.NaN, Number.NaN, Number.NaN)?.value, 1);
});
