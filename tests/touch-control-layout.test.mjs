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

test('compact landscape uses a horizontal action dock below the top HUD', () => {
  for (const mode of ['survival', 'pvp']) {
    const geometry = calculateTouchControlGeometry({
      viewportWidth: 844,
      viewportHeight: 390,
      mode,
    });
    const expectedButtons = mode === 'pvp' ? 2 : 3;
    assert.ok(geometry.actionDock.width >= expectedButtons * 54);
    assert.ok(geometry.actionDock.height >= 54);
    assert.ok(geometry.actionDock.bottom <= 390);
    assert.ok(geometry.actionDock.top >= 250, 'action row must stay in the bottom HUD-free band');
    assert.ok(geometry.actionDock.left >= 390);
    if (mode === 'pvp') assert.ok(geometry.fireGapToActions >= 8);
  }
});

test('portrait keeps a vertical action stack while short landscape changes orientation', () => {
  const portrait = calculateTouchControlGeometry({
    viewportWidth: 393,
    viewportHeight: 852,
    mode: 'survival',
  });
  const landscape = calculateTouchControlGeometry({
    viewportWidth: 844,
    viewportHeight: 390,
    mode: 'survival',
  });
  assert.ok(portrait.actionDock.height > portrait.actionDock.width);
  assert.ok(landscape.actionDock.width > landscape.actionDock.height);
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

test('clamped live stick footprint never reaches the Survival or PvP action dock', async () => {
  const { clampTouchJoystickOrigin } = await import('../src/touchControlLayout.ts');
  for (const mode of ['survival', 'pvp']) {
    for (const viewport of touchViewports) {
      const geometry = calculateTouchControlGeometry({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        mode,
      });
      const point = clampTouchJoystickOrigin({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        mode,
        touchX: viewport.width,
        touchY: viewport.height,
      });
      const radius = Math.max(126, Math.min(148, viewport.width * 0.36)) * 0.5;
      assert.ok(point.x + radius <= geometry.actionDock.left - 8,
        mode + ' active stick touches the action dock at ' + viewport.width + 'x' + viewport.height);
      assert.ok(point.y + radius <= viewport.height - 12);
    }
  }
});

test('PvP stick origin reserves a dedicated timed-fire lane below the top HUD', async () => {
  const { clampTouchJoystickOrigin } = await import('../src/touchControlLayout.ts');
  const point = clampTouchJoystickOrigin({
    viewportWidth: 844,
    viewportHeight: 390,
    mode: 'pvp',
    touchX: 80,
    touchY: 70,
    fireButtonSize: 68,
    topHudClearance: 88,
  });
  const fireTop = point.y - 74 - 10 - 68;
  assert.ok(fireTop >= 88);
});


test('compact-landscape PvP fire circle stays at least 10px above the idle joystick', () => {
  for (const viewport of [
    { width: 568, height: 320 },
    { width: 844, height: 390 },
    { width: 915, height: 412 },
  ]) {
    const geometry = calculateTouchControlGeometry({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      mode: 'pvp',
    });
    const idleJoystickTop = viewport.height - Math.max(82, 12 + 76)
      - Math.max(126, Math.min(148, viewport.width * 0.36)) * 0.5;
    assert.ok(geometry.fireControl);
    assert.ok(geometry.fireControl.bottom <= idleJoystickTop - 10,
      'fire control overlaps idle joystick at ' + viewport.width + 'x' + viewport.height);
  }
});
