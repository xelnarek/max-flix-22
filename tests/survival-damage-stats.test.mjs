import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSurvivalDamageReport,
  createSurvivalDamageStats,
  getSurvivalWeaponDamageSource,
  recordSurvivalDamage,
  recordSurvivalKill,
} from '../src/survivalDamageStats.ts';

test('damage report ranks real HP damage and shows per-source hits and lethal blows', () => {
  const stats = createSurvivalDamageStats();
  recordSurvivalDamage(stats, 'basic_attack', 12);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('pallet_cannon'), 20);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('pallet_cannon'), 8);
  recordSurvivalDamage(stats, getSurvivalWeaponDamageSource('piorun_drone'), 20);
  recordSurvivalDamage(stats, 'ability', 40);
  recordSurvivalKill(stats, getSurvivalWeaponDamageSource('pallet_cannon'));
  recordSurvivalKill(stats, 'ability');
  recordSurvivalKill(stats, 'ability');

  const report = buildSurvivalDamageReport(stats);
  assert.equal(report.totalDamage, 100);
  assert.equal(report.totalEliminations, 3);
  assert.deepEqual(report.entries.map((entry) => entry.label), [
    'Umiejętności i asysty',
    'Działo paletowe',
    'Dron Piorun',
    'Atak podstawowy operatora',
  ]);
  assert.deepEqual(report.entries.map((entry) => entry.percentage), [40, 28, 20, 12]);
  assert.deepEqual(report.entries.map((entry) => entry.hits), [1, 2, 1, 1]);
  assert.deepEqual(report.entries.map((entry) => entry.eliminations), [2, 1, 0, 0]);
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
  assert.equal(report.entries[0].hits, 2);
  assert.equal(report.entries[0].eliminations, 0);
});

test('finishers are credited only to the source that delivered the final hit', () => {
  const stats = createSurvivalDamageStats();
  const saw = getSurvivalWeaponDamageSource('diamond_saw');
  const drone = getSurvivalWeaponDamageSource('piorun_drone');
  recordSurvivalDamage(stats, saw, 4);
  recordSurvivalDamage(stats, drone, 1);
  recordSurvivalKill(stats, drone);

  const report = buildSurvivalDamageReport(stats);
  assert.equal(report.totalEliminations, 1);
  assert.equal(report.entries.find((entry) => entry.source === saw)?.eliminations, 0);
  assert.equal(report.entries.find((entry) => entry.source === drone)?.eliminations, 1);
});

test('finishers can be reported even when malformed legacy counters are present', () => {
  const stats = createSurvivalDamageStats();
  recordSurvivalKill(stats, 'basic_attack');
  const report = buildSurvivalDamageReport(stats);
  assert.equal(report.totalDamage, 0);
  assert.equal(report.totalEliminations, 1);
  assert.equal(report.entries[0].percentage, 0);
});
