import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_DEATH_MOTION_PROFILES,
  getEnemyDeathMotionPose,
  getEnemyDeathMotionProfile,
} from '../src/enemyDeathMotion.ts';

const enemyTypes = [
  'customer', 'walczak', 'forklift', 'architect', 'inspector', 'agv_robot',
  'handlowiec', 'monter', 'piorun_dron', 'elite_walczak_guard', 'kurier',
  'przedstawiciel_włoski', 'sztaplar_szalony', 'krol_leto', 'pan_roman',
  'serwisant', 'bosman_krakow', 'zombie_pracownik', 'pomazaniec', 'sebix_m',
  'mutant_gamma_forklift', 'radioactive_pip', 'cyber_salesman',
  'wkurzona_zona', 'kluska_piekielna',
];

test('every enemy archetype has a bounded and explicit defeat motion profile', () => {
  assert.deepEqual(Object.keys(ENEMY_DEATH_MOTION_PROFILES).sort(), [...enemyTypes].sort());
  for (const type of enemyTypes) {
    const p = getEnemyDeathMotionProfile(type);
    assert.ok(p.duration >= 0.6 && p.duration <= 1.5, type + ' duration');
    assert.ok(Math.abs(p.fallX) <= 0.9, type + ' fall angle');
    assert.ok(Math.abs(p.rollZ) <= 0.9, type + ' roll angle');
    assert.ok(p.drop >= 0 && p.drop <= 0.3, type + ' drop');
    assert.ok(p.squash >= 0 && p.squash <= 0.32, type + ' squash');
  }
});

test('defeat poses start neutral, progress smoothly and end in a distinct fall pose', () => {
  for (const type of enemyTypes) {
    const start = getEnemyDeathMotionPose(type, 0, 1);
    const end = getEnemyDeathMotionPose(type, 1, 1);
    assert.ok(Math.abs(start.rotationX) < 1e-9);
    assert.ok(Math.abs(start.rotationZ) < 1e-9);
    assert.equal(start.drop, 0);
    assert.equal(start.scaleY, 1);
    for (const value of Object.values(end)) assert.ok(Number.isFinite(value), type);
    assert.ok(end.scaleY >= 0.68 && end.scaleY <= 1, type + ' scale');
    assert.ok(end.drop <= 0 && end.drop >= -0.3, type + ' vertical settle');
  }
  const profiles = enemyTypes.map((type) => JSON.stringify(getEnemyDeathMotionPose(type, 1, 1)));
  assert.ok(new Set(profiles).size >= 20, 'death poses should be visually distinct by role');
});

test('death roll direction follows the stable side seed and remains bounded', () => {
  for (const type of enemyTypes) {
    const left = getEnemyDeathMotionPose(type, 0.8, -1);
    const right = getEnemyDeathMotionPose(type, 0.8, 1);
    assert.ok(Math.abs(left.rotationZ + right.rotationZ) < 1e-8);
    for (const pose of [left, right]) {
      for (const value of Object.values(pose)) assert.ok(Number.isFinite(value));
    }
  }
});

test('invalid animation progress is safely clamped without leaking NaN transforms', () => {
  for (const progress of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2]) {
    const pose = getEnemyDeathMotionPose('zombie_pracownik', progress, 1);
    for (const value of Object.values(pose)) assert.ok(Number.isFinite(value));
  }
});
