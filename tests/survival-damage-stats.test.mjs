import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSurvivalDamageReport,
  createSurvivalDamageStats,
  getSurvivalWeaponDamageSource,
  recordSurvivalDamage,
} from '../src/survivalDamageStats.ts';

test('damage report ranks real weapon damage and computes each source percentage', () => {
  const stats = createSurvivalDamageStats();
  recordSurvivalDamage(stats, 'basic_attack', 12);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('pallet_cannon'), 28);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('piorun_drone'), 20);
  recordSurvivalDamage(stats, 'ability', 40);

  const report = buildSurvivalDamageReport(stats);
  assert.equal(report.totalDamage, 100);
  assert.deepEqual(report.entries.map((entry) => entry.label), [
    'Umiejętności i asysty',
    'Działo paletowe',
    'Dron Piorun',
    'Atak podstawowy operatora',
  ]);
  assert.deepEqual(report.entries.map((entry) => entry.percentage), [40, 28, 20, 12]);
  assert.equal(report.entries[1].category, 'BROŃ');
});

test('damage recorder ignores blocked, zero, negative and invalid damage values', () => {
  const stats = createSurvivalDamageStats();
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('glue_mine'), 0);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('glue_mine'), -2);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('glue_mine'), Number.NaN);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('glue_mine'), Number.POSITIVE_INFINITY);
  assert.equal(buildSurvivalDamageReport(stats).totalDamage, 0);
  assert.deepEqual(buildSurvivalDamageReport(stats).entries, []);
});

test('weapon report includes only weapons that actually dealt damage', () => {
  const stats = createSurvivalDamageStats();
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('steam_bomb'), 3.25);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('steam_bomb'), 1.25);
  const report = buildSurvivalDamageReport(stats);
  assert.equal(report.totalDamage, 4.5);
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].percentage, 100);
  assert.equal(report.entries[0].damage, 4.5);
});
