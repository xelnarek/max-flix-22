import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnemyMeleeTelegraphProfile } from '../src/enemyMeleeTelegraphs.ts';

const EXPECTED = [
  'customer', 'architect', 'inspector', 'kurier', 'monter',
  'sztaplar_szalony', 'elite_walczak_guard', 'zombie_pracownik',
  'mutant_gamma_forklift', 'radioactive_pip',
];

test('all ordinary melee archetypes have distinct readable strike profiles', () => {
  const profiles = EXPECTED.map((type) => getEnemyMeleeTelegraphProfile(type));
  assert.ok(profiles.every(Boolean));
  assert.equal(new Set(profiles.map((profile) => profile.warningText)).size, EXPECTED.length);
  assert.equal(new Set(profiles.map((profile) => profile.color)).size, EXPECTED.length);
  assert.equal(new Set(profiles.map((profile) => profile.windupSeconds)).size, EXPECTED.length);
  assert.equal(new Set(profiles.map((profile) => profile.recoverySeconds)).size, EXPECTED.length);
  for (const profile of profiles) {
    assert.ok(profile.windupSeconds >= 0.3 && profile.windupSeconds <= 0.7);
    assert.ok(profile.reachMeters >= 0.45 && profile.reachMeters <= 1.15);
    assert.ok(profile.laneWidth >= 0.85 && profile.laneWidth <= 1.9);
    assert.ok(profile.cooldownSeconds >= 1.1 && profile.cooldownSeconds <= 1.9);
    assert.ok(profile.recoverySeconds >= 0.10 && profile.recoverySeconds <= 0.42);
    assert.ok(profile.missText.length >= 8);
  }
});

test('bosses, ranged specialists and vehicles keep their dedicated attack logic', () => {
  for (const type of [
    'walczak', 'forklift', 'agv_robot', 'handlowiec', 'piorun_dron',
    'przedstawiciel_włoski', 'krol_leto', 'pan_roman', 'serwisant',
    'bosman_krakow', 'pomazaniec', 'sebix_m', 'cyber_salesman',
  ]) {
    assert.equal(getEnemyMeleeTelegraphProfile(type), null, type + ' must not use generic melee telegraphs');
  }
  assert.equal(getEnemyMeleeTelegraphProfile('not-an-enemy'), null);
});
