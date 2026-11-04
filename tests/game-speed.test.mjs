import test from 'node:test';
import assert from 'node:assert/strict';
import { getScaledSimulationDelta, normalizeGameSpeed } from '../src/gameSpeed.ts';

test('simulation speed is restricted to supported 1x and 2x values', () => {
  assert.equal(normalizeGameSpeed(1), 1);
  assert.equal(normalizeGameSpeed(2), 2);
  assert.equal(normalizeGameSpeed('2'), 2);
  assert.equal(normalizeGameSpeed(3), 1);
  assert.equal(normalizeGameSpeed(Number.NaN), 1);
});

test('2x scales the complete simulation delta while 1x preserves normal time', () => {
  const frame = 1 / 60;
  assert.equal(getScaledSimulationDelta(frame, 1), frame);
  assert.equal(getScaledSimulationDelta(frame, 2), frame * 2);
});

test('simulation speed clamps long frames and rejects invalid deltas', () => {
  assert.equal(getScaledSimulationDelta(0.5, 1), 1 / 30);
  assert.equal(getScaledSimulationDelta(0.5, 2), 2 / 30);
  assert.equal(getScaledSimulationDelta(Number.NaN, 2), 0);
  assert.equal(getScaledSimulationDelta(-2, 2), 0);
});
