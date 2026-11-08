import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePvpCameraFrame } from '../src/pvpCamera.ts';

const bounds = { minX: -22, maxX: 22, minZ: -12, maxZ: 12 };

test('portrait camera puts the long arena axis on screen height and fits map depth', () => {
  const frame = calculatePvpCameraFrame(393, 852, { x: 8, z: -4 }, bounds);
  assert.equal(frame.portrait, true);
  assert.equal(frame.fov, 72);
  assert.ok(frame.position.x > frame.target.x);
  assert.ok(Math.abs(frame.position.z - frame.target.z) < 1e-9);
  assert.ok(frame.visibleWidth >= frame.requiredWidth * 1.1);
});

test('landscape camera tracks the duel centre and contains the full arena width', () => {
  const frame = calculatePvpCameraFrame(1280, 720, { x: -6, z: 3 }, bounds);
  assert.equal(frame.portrait, false);
  assert.equal(frame.fov, 58);
  assert.ok(frame.position.z > frame.target.z);
  assert.ok(Math.abs(frame.position.x - frame.target.x) < 1e-9);
  assert.ok(frame.visibleWidth >= frame.requiredWidth * 1.1);
});

test('invalid viewport values are normalized rather than producing invalid camera coordinates', () => {
  const frame = calculatePvpCameraFrame(Number.NaN, 0, { x: Number.NaN, z: Infinity }, bounds);
  for (const value of [frame.aspect, frame.fov, frame.position.x, frame.position.y, frame.position.z, frame.target.x, frame.target.y, frame.target.z]) {
    assert.ok(Number.isFinite(value));
  }
});
