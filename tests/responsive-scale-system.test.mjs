import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the responsive scaling stylesheet loads after every legacy UI layer', async () => {
  const html = await read('../index.html');
  const focus = html.indexOf('menu-focus-overhaul.css');
  const scale = html.indexOf('responsive-scale-system.css');
  assert.ok(focus >= 0 && scale > focus, 'global scaling must be the final CSS owner');
});

test('one viewport scale reaches the menu, loading card, modals and gameplay HUD', async () => {
  const css = await read('../src/responsive-scale-system.css');
  for (const selector of [
    '#title-screen .title-sheet',
    '.game-modal > .modal-card',
    '.loader-modal-card.loader-maddnes-card',
    '#game-shell #hud-top:not(.hidden)',
    '#game-shell #survival-hud:not(.hidden)',
    'body > #pvp-hud:not(.hidden)',
    '#game-shell .dialogue-side-container',
  ]) assert.ok(css.includes(selector), 'missing global scale owner for ' + selector);
  assert.match(css, /zoom:\s*var\(--ui-scale\)/);
  assert.match(css, /var\(--ui-panel-max\)/);
});

test('touch controls scale without zooming their pointer-coordinate root', async () => {
  const [css, app, touch] = await Promise.all([
    read('../src/responsive-scale-system.css'),
    read('../src/index.ts'),
    read('../src/touchControlLayout.ts'),
  ]);
  assert.match(css, /\.joystick-base\s*\{[\s\S]*?var\(--ui-joystick-size\)/);
  assert.match(css, /\.touch-actions-zone \.touch-action-btn\s*\{[\s\S]*?min-width:\s*54px/);
  assert.match(css, /\.pvp-aim-base\s*\{[\s\S]*?var\(--ui-scale\)/);
  assert.match(app, /fireControlWrapper\?\.getBoundingClientRect\(\)\.width/);
  assert.match(app, /fireButtonSize:\s*fireControlSize/);
  assert.match(touch, /resolveJoystickSize/);
  assert.match(touch, /resolveFireButtonSize/);
});

test('touch joystick and PvP aim controls stay viewport-aware at narrow and landscape sizes', async () => {
  const { calculateTouchControlGeometry } = await import('../src/touchControlLayout.ts');
  for (const viewport of [
    { width: 280, height: 568 },
    { width: 320, height: 568 },
    { width: 393, height: 852 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
    { width: 915, height: 412 },
  ]) {
    for (const mode of ['survival', 'pvp']) {
      const geometry = calculateTouchControlGeometry({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        mode,
      });
      assert.ok(Number.isFinite(geometry.horizontalGapToActions));
      assert.ok(geometry.actionDock.left >= viewport.width * 0.5);
      assert.ok(geometry.actionDock.right <= viewport.width);
      assert.ok(geometry.actionDock.bottom <= viewport.height);
      assert.ok(geometry.joystickZone.width > 0);
      if (mode === 'pvp') assert.ok(geometry.fireControl);
    }
  }
});
