import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHordeRingPoint,
  getHordeRingRadius,
  getSurvivalHordeSettings,
} from '../src/survivalHorde.ts';

test('mobile and desktop horde sizes stay bounded and have a controlled duration', () => {
  const mobile = getSurvivalHordeSettings(true);
  const desktop = getSurvivalHordeSettings(false);
  assert.equal(mobile.enemyCount, 12);
  assert.equal(desktop.enemyCount, 16);
  assert.ok(desktop.enemyCount > mobile.enemyCount);
  assert.equal(mobile.durationSeconds, 18);
  assert.equal(mobile.spawnIntervalSeconds, 0.48);
});

test('ring positions are evenly distributed without stacked spawn points', () => {
  const total = 16;
  const points = Array.from({ length: total }, (_, index) =>
    getHordeRingPoint(index, total, 3, -2, 13.4, 0.4)
  );
  const radii = points.map((point) => Math.hypot(point.x - 3, point.z + 2));
  assert.ok(radii.every((radius) => Math.abs(radius - 13.4) < 1e-9));
  const neighbourDistances = points.map((point, index) => {
    const next = points[(index + 1) % total];
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
  assert.ok(neighbourDistances.every((distance) => distance > 5));
});

test('the closing ring contracts smoothly and never expands past its starting radius', () => {
  assert.equal(getHordeRingRadius(0, 13.4, 6.8), 13.4);
  assert.equal(getHordeRingRadius(1, 13.4, 6.8), 6.8);
  const mid = getHordeRingRadius(0.5, 13.4, 6.8);
  assert.ok(mid < 13.4 && mid > 6.8);
  assert.equal(getHordeRingRadius(Number.NaN, 13.4, 6.8), 13.4);
});

test('invalid totals and radii cannot produce non-finite spawn coordinates', () => {
  const point = getHordeRingPoint(0, 0, 5, 6, Number.NaN);
  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.z));
  assert.equal(Math.hypot(point.x - 5, point.z - 6), 0);
});
