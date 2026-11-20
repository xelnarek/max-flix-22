import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateBallisticHeight,
  getBallisticGroundContactTime,
} from '../src/survivalFirearmBallistics.ts';

test('ballistic height follows the deterministic gravity equation', () => {
  const h0 = 0.6;
  const velocityY = 7.4;
  const gravity = 12.5;
  const apexTime = velocityY / gravity;

  assert.equal(evaluateBallisticHeight(h0, velocityY, gravity, 0), h0);
  assert.ok(evaluateBallisticHeight(h0, velocityY, gravity, apexTime) > 2.7);
  assert.ok(evaluateBallisticHeight(h0, velocityY, gravity, apexTime * 2) < h0);
});

test('ground contact solver returns the descending root and handles invalid or flat trajectories', () => {
  const time = getBallisticGroundContactTime(0.6, 7.4, 12.5, 0.14);
  assert.ok(time !== null && time > 1.1 && time < 1.4);
  assert.ok(Math.abs(evaluateBallisticHeight(0.6, 7.4, 12.5, time) - 0.14) < 1e-9);
  assert.equal(getBallisticGroundContactTime(0.14, 7.4, 12.5, 0.14), 0);
  assert.equal(getBallisticGroundContactTime(0.6, 7.4, 0), null);
  assert.ok(Number.isFinite(evaluateBallisticHeight(Number.NaN, Number.NaN, Number.NaN, Number.NaN)));
});
