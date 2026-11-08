import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePvpCameraFrame, calculatePvpCameraTrackingBounds, isPvpPortraitViewport } from '../src/pvpCamera.ts';

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


test('camera zooms toward nearby duelists while retaining padding around both players', () => {
  const closeBounds = calculatePvpCameraTrackingBounds({ x: -2, z: -1 }, { x: 2, z: 1 }, bounds, false);
  const farBounds = calculatePvpCameraTrackingBounds({ x: -18, z: -4 }, { x: 18, z: 4 }, bounds, false);
  assert.ok(closeBounds.maxX - closeBounds.minX < farBounds.maxX - farBounds.minX);
  assert.ok(closeBounds.maxZ - closeBounds.minZ < farBounds.maxZ - farBounds.minZ);
  for (const [point, frame] of [
    [{ x: -2, z: -1 }, closeBounds],
    [{ x: 2, z: 1 }, closeBounds],
    [{ x: -18, z: -4 }, farBounds],
    [{ x: 18, z: 4 }, farBounds],
  ]) {
    assert.ok(point.x >= frame.minX && point.x <= frame.maxX);
    assert.ok(point.z >= frame.minZ && point.z <= frame.maxZ);
  }
});

test('portrait and landscape mode use the same visual viewport orientation rule', () => {
  assert.equal(isPvpPortraitViewport(393, 852), true);
  assert.equal(isPvpPortraitViewport(852, 393), false);
  assert.equal(isPvpPortraitViewport(Number.NaN, 0), false);
});

test('camera framing responds to aspect-only viewport changes without changing duel focus', () => {
  const portrait = calculatePvpCameraFrame(393, 852, { x: 3, z: -2 }, bounds);
  const landscape = calculatePvpCameraFrame(852, 393, { x: 3, z: -2 }, bounds);
  assert.notEqual(portrait.aspect, landscape.aspect);
  assert.notEqual(portrait.fov, landscape.fov);
  assert.deepEqual(portrait.target, { x: 3, y: 0.5, z: -2 });
  assert.deepEqual(landscape.target, { x: 3, y: 0.5, z: -2 });
});
