import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTouchControlGeometry } from '../src/touchControlLayout.ts';

const touchViewports = [
  { width: 280, height: 568 },
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
];

for (const mode of ['survival', 'pvp']) {
  test(mode + ' touch controls keep the movement stick and action dock horizontally separated', () => {
    for (const viewport of touchViewports) {
      const geometry = calculateTouchControlGeometry({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        mode,
      });
      assert.ok(
        geometry.horizontalGapToActions >= 8,
        mode + ' overlap at ' + viewport.width + 'x' + viewport.height +
          ': ' + geometry.horizontalGapToActions + 'px',
      );
      assert.ok(geometry.actionDock.left >= viewport.width * 0.5);
      assert.ok(geometry.actionDock.right <= viewport.width - 8);
      assert.ok(geometry.actionDock.top >= 0);
      assert.ok(geometry.actionDock.bottom <= viewport.height);
    }
  });
}

test('PvP timed fire button remains left of the right-side ability and dash controls', () => {
  for (const viewport of touchViewports) {
    const geometry = calculateTouchControlGeometry({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      mode: 'pvp',
    });
    assert.ok(geometry.fireControl);
    assert.ok((geometry.fireGapToActions ?? -Infinity) >= 8,
      'PvP fire/action overlap at ' + viewport.width + 'x' + viewport.height);
  }
});

test('compact landscape layouts shrink neither touch target below 54px nor clip the dock', () => {
  const geometry = calculateTouchControlGeometry({
    viewportWidth: 844,
    viewportHeight: 390,
    mode: 'pvp',
  });
  assert.ok(geometry.actionDock.width >= 54);
  assert.ok(geometry.actionDock.height >= 116);
  assert.ok(geometry.actionDock.bottom <= 390);
  assert.ok(geometry.fireGapToActions >= 8);
});

test('malformed viewport values still produce finite, non-negative geometry', () => {
  const geometry = calculateTouchControlGeometry({
    viewportWidth: Number.NaN,
    viewportHeight: Number.POSITIVE_INFINITY,
    mode: 'survival',
    actionButtonSize: Number.NaN,
    actionGap: Number.NaN,
  });
  for (const value of [
    geometry.joystickZone.left,
    geometry.joystickZone.top,
    geometry.joystickZone.right,
    geometry.joystickZone.bottom,
    geometry.actionDock.left,
    geometry.actionDock.top,
    geometry.actionDock.right,
    geometry.actionDock.bottom,
    geometry.horizontalGapToActions,
  ]) assert.ok(Number.isFinite(value));
  assert.ok(geometry.actionDock.left >= 0);
  assert.ok(geometry.actionDock.top >= 0);
});
