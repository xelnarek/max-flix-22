import test from 'node:test';
import assert from 'node:assert/strict';
import { clampHorizontalPosition } from '../src/arenaBounds.ts';

const arena = { minX: -10, maxX: 10, minZ: -5, maxZ: 5 };

test('leaves positions inside the arena unchanged when no inset is requested', () => {
  assert.deepEqual(clampHorizontalPosition(3.25, -2.5, arena), {
    x: 3.25,
    z: -2.5,
    constrainedX: false,
    constrainedZ: false,
  });
});

test('keeps an entity radius inside all four arena edges', () => {
  assert.deepEqual(clampHorizontalPosition(12, -7, arena, 1), {
    x: 9,
    z: -4,
    constrainedX: true,
    constrainedZ: true,
  });
});

test('caps an oversized inset instead of inverting a narrow arena', () => {
  assert.deepEqual(clampHorizontalPosition(100, 100, {
    minX: 0, maxX: 2, minZ: 0, maxZ: 1,
  }, 50), {
    x: 1,
    z: 0.5,
    constrainedX: true,
    constrainedZ: true,
  });
});

test('recovers non-finite coordinates to the arena centre', () => {
  const result = clampHorizontalPosition(Number.NaN, Number.POSITIVE_INFINITY, arena);
  assert.equal(result.x, 0);
  assert.equal(result.z, 0);
  assert.equal(result.constrainedX, true);
  assert.equal(result.constrainedZ, true);
});
