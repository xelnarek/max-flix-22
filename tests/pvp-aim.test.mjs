import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PVP_AIM_DIRECTION,
  PVP_AIM_DEADZONE,
  getPvpAimAngle,
  isPvpAimInputActive,
  normalizePvpAimDirection,
  pvpAimDirectionFromAngle,
} from '../src/pvpAim.ts';

test('manual aim normalizes diagonal touch input and does not amplify stick length', () => {
  const direction = normalizePvpAimDirection(0.8, 0.8);
  assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - 1) < 1e-10);
  assert.ok(Math.abs(direction.x - Math.SQRT1_2) < 1e-10);
  assert.ok(Math.abs(direction.z - Math.SQRT1_2) < 1e-10);
});

test('neutral right stick preserves the last deliberate aim direction', () => {
  const previous = { x: 1, z: 0 };
  assert.deepEqual(normalizePvpAimDirection(0.02, -0.03, previous), previous);
  assert.deepEqual(normalizePvpAimDirection(0, 0, previous), previous);
});

test('invalid samples never inject NaN into combat direction', () => {
  const previous = { x: 0, z: -1 };
  assert.deepEqual(normalizePvpAimDirection(Number.NaN, 1, previous), previous);
  assert.deepEqual(normalizePvpAimDirection(1, Number.POSITIVE_INFINITY, previous), previous);
  assert.deepEqual(normalizePvpAimDirection(0, 0, { x: Number.NaN, z: 0 }), DEFAULT_PVP_AIM_DIRECTION);
});

test('aim activation respects deadzone and rejects non-finite values', () => {
  assert.equal(isPvpAimInputActive(PVP_AIM_DEADZONE, 0), true);
  assert.equal(isPvpAimInputActive(PVP_AIM_DEADZONE / 2, 0), false);
  assert.equal(isPvpAimInputActive(Number.NaN, 1), false);
});

test('angle and direction conversions use the game forward-axis convention', () => {
  const direction = pvpAimDirectionFromAngle(Math.PI / 2);
  assert.ok(Math.abs(direction.x - 1) < 1e-10);
  assert.ok(Math.abs(direction.z) < 1e-10);
  assert.ok(Math.abs(getPvpAimAngle(direction) - Math.PI / 2) < 1e-10);
  assert.ok(Math.abs(getPvpAimAngle({ x: 0, z: -1 }) - Math.PI) < 1e-10);
});
