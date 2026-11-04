import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateVirtualJoystickInput } from '../src/virtualJoystick.ts';

test('virtual joystick filters resting-finger jitter with a radial dead zone', () => {
  assert.deepEqual(calculateVirtualJoystickInput(1.5, 1.5, 40), { x: 0, y: 0 });
  assert.deepEqual(calculateVirtualJoystickInput(0, 0, 40), { x: 0, y: 0 });
});

test('virtual joystick preserves direction and reaches full input at the rim', () => {
  const right = calculateVirtualJoystickInput(40, 0, 40);
  assert.ok(Math.abs(right.x - 1) < 1e-9);
  assert.ok(Math.abs(right.y) < 1e-9);

  const down = calculateVirtualJoystickInput(0, 40, 40);
  assert.ok(Math.abs(down.x) < 1e-9);
  assert.ok(Math.abs(down.y - 1) < 1e-9);

  const diagonal = calculateVirtualJoystickInput(100, 100, 40);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-9);
});

test('virtual joystick handles invalid dimensions and clamps travel beyond the rim', () => {
  assert.deepEqual(calculateVirtualJoystickInput(20, 10, 0), { x: 0, y: 0 });
  assert.deepEqual(calculateVirtualJoystickInput(Number.NaN, 10, 40), { x: 0, y: 0 });
  const beyondRim = calculateVirtualJoystickInput(-100, 0, 40);
  assert.equal(beyondRim.x, -1);
  assert.equal(beyondRim.y, 0);
});

test('touch joystick captures a single pointer and resets on cancellation', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(app, /event\.isPrimary === false/);
  assert.match(app, /joystickZone\.setPointerCapture\(event\.pointerId\)/);
  assert.match(app, /window\.addEventListener\('pointercancel', handleEnd/);
  assert.match(app, /calculateVirtualJoystickInput\(dx, dy, maxRadius\)/);
  assert.match(css, /touch-action: none !important/);
  assert.match(css, /\.joystick-base::before/);
});

test('cinematic intro stages its title reveal over a richer animated warehouse scene', async () => {
  const intro = await readFile(new URL('../src/cinematicIntro.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(intro, /drawPalletStacks\(ctx, w, h, seconds\)/);
  assert.match(intro, /drawForklift\(ctx, w, h, seconds, forkliftAmount\)/);
  assert.match(intro, /drawAtmosphere\(ctx, w, h, seconds\)/);
  assert.match(intro, /is-title-reveal/);
  assert.match(css, /\.cinematic-intro-overlay\.is-title-reveal \.cinematic-intro-copy/);
});
