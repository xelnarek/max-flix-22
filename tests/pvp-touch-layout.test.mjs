import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePvpFireControlPosition } from '../src/pvpTouchLayout.ts';

test('PvP fire button follows the movement stick in a normal phone portrait', () => {
  const position = calculatePvpFireControlPosition({
    viewportWidth: 393,
    viewportHeight: 852,
    touchX: 120,
    touchY: 700,
    joystickRadius: 74,
  });

  assert.equal(position.left, 120);
  assert.equal(position.top, 538);
  assert.equal(position.bottom, 236);
  assert.ok(position.left - 39 >= 12);
  assert.ok(position.top >= 12);
});

test('PvP fire button is clamped inside both horizontal screen edges', () => {
  const left = calculatePvpFireControlPosition({
    viewportWidth: 393,
    viewportHeight: 852,
    touchX: -20,
    touchY: 700,
    joystickRadius: 74,
  });
  const right = calculatePvpFireControlPosition({
    viewportWidth: 393,
    viewportHeight: 852,
    touchX: 420,
    touchY: 700,
    joystickRadius: 74,
  });

  assert.equal(left.left, 51);
  assert.equal(right.left, 342);
  assert.ok(left.left - 39 >= 12);
  assert.ok(right.left + 39 <= 393 - 12);
});

test('PvP fire button stays visible on a short landscape phone viewport', () => {
  const position = calculatePvpFireControlPosition({
    viewportWidth: 844,
    viewportHeight: 390,
    touchX: 24,
    touchY: 220,
    joystickRadius: 74,
    fireControlSize: 68,
  });

  assert.equal(position.left, 46);
  assert.equal(position.top, 68);
  assert.equal(position.bottom, 254);
  assert.ok(position.top + 68 <= 390 - 12);
});

test('PvP fire button handles touches near the top and bottom safe edges', () => {
  const nearTop = calculatePvpFireControlPosition({
    viewportWidth: 320,
    viewportHeight: 568,
    touchX: 90,
    touchY: 30,
    joystickRadius: 74,
  });
  const nearBottom = calculatePvpFireControlPosition({
    viewportWidth: 320,
    viewportHeight: 568,
    touchX: 90,
    touchY: 568,
    joystickRadius: 74,
  });

  assert.equal(nearTop.top, 12);
  assert.equal(nearTop.bottom, 478);
  assert.equal(nearBottom.top, 406);
  assert.equal(nearBottom.bottom, 84);
});

test('PvP fire layout remains finite for malformed geometry', () => {
  const position = calculatePvpFireControlPosition({
    viewportWidth: Number.NaN,
    viewportHeight: Number.POSITIVE_INFINITY,
    touchX: Number.NaN,
    touchY: Number.NEGATIVE_INFINITY,
    joystickRadius: Number.NaN,
    fireControlSize: Number.NaN,
    gap: Number.NaN,
    safeMargin: Number.NaN,
  });

  assert.ok(Number.isFinite(position.left));
  assert.ok(Number.isFinite(position.top));
  assert.ok(Number.isFinite(position.bottom));
  assert.ok(position.left >= 0);
  assert.ok(position.top >= 0);
  assert.ok(position.bottom >= 0);
});
