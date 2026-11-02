import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEnemySeparationVector,
  chooseSpacedSpawnPoint,
} from '../src/enemySpacing.ts';

test('coincident enemies receive finite, opposite deterministic separation vectors', () => {
  const first = { id: 'enemy-a', x: 0, z: 0 };
  const second = { id: 'enemy-b', x: 0, z: 0 };
  const fromFirst = calculateEnemySeparationVector(first, [first, second]);
  const fromSecond = calculateEnemySeparationVector(second, [first, second]);
  assert.ok(Number.isFinite(fromFirst.x) && Number.isFinite(fromFirst.z));
  assert.ok(Math.hypot(fromFirst.x, fromFirst.z) > 0);
  assert.ok(Math.abs(fromFirst.x + fromSecond.x) < 1e-9);
  assert.ok(Math.abs(fromFirst.z + fromSecond.z) < 1e-9);
});

test('separation is zero outside the requested spacing radius', () => {
  const self = { id: 'self', x: 0, z: 0 };
  const far = { id: 'far', x: 3.5, z: 0 };
  assert.deepEqual(calculateEnemySeparationVector(self, [self, far], 2.6), { x: 0, z: 0 });
});

test('defeated actors and invalid positions do not affect live enemy steering', () => {
  const self = { id: 'self', x: 0, z: 0 };
  const defeated = { id: 'dead', x: 0.4, z: 0, state: 'defeated' };
  const invalid = { id: 'invalid', x: Number.NaN, z: 0 };
  assert.deepEqual(calculateEnemySeparationVector(self, [self, defeated, invalid]), { x: 0, z: 0 });
});

test('separation magnitude is capped when several actors overlap', () => {
  const self = { id: 'self', x: 0, z: 0 };
  const neighbours = Array.from({ length: 30 }, (_, index) => ({
    id: 'enemy-' + index,
    x: 0.01 * (index + 1),
    z: 0.01 * ((index % 3) - 1),
  }));
  const vector = calculateEnemySeparationVector(self, [self, ...neighbours]);
  assert.ok(Math.hypot(vector.x, vector.z) <= 1.65 + 1e-9);
});

test('spawn selection prefers an unobstructed candidate with the required clearance', () => {
  const occupied = [{ id: 'existing', x: 0, z: 0 }];
  const candidates = [{ x: 1, z: 0 }, { x: 8, z: 0 }, { x: -9, z: 0 }];
  assert.deepEqual(chooseSpacedSpawnPoint(candidates, occupied, 3.2), { x: 8, z: 0 });
});

test('when every spawn point is crowded, choose the least crowded valid candidate', () => {
  const occupied = [
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 10, z: 0 },
  ];
  const candidates = [{ x: 1, z: 0 }, { x: 7, z: 0 }, { x: 9, z: 0 }];
  assert.deepEqual(chooseSpacedSpawnPoint(candidates, occupied, 3.2), { x: 7, z: 0 });
});

test('invalid candidate positions are ignored and an empty candidate list returns null', () => {
  assert.equal(chooseSpacedSpawnPoint([{ x: Number.NaN, z: 0 }], [], 3.2), null);
});
