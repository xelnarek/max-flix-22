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

test('movement and PvP aim sticks capture separate pointers for simultaneous touch', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(app, /activePointerId !== null/);
  assert.match(app, /joystickZone\.setPointerCapture\(event\.pointerId\)/);
  assert.match(app, /window\.addEventListener\('pointercancel', handleEnd/);
  assert.match(app, /calculateVirtualJoystickInput\(dx, dy, maxRadius\)/);
  assert.match(app, /activeAimPointerId !== null/);
  assert.doesNotMatch(app, /event\.isPrimary === false/);
  assert.match(css, /touch-action: none !important/);
  assert.match(css, /\.joystick-base::before/);
});

test('cinematic intro stages its title reveal over a richer animated warehouse scene', async () => {
  const intro = await readFile(new URL('../src/cinematicIntro.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(intro, /drawPalletStacks\(ctx, w, h, seconds\)/);
  assert.match(intro, /drawForklift\(ctx, w, h, seconds, forkliftAmount\)/);
  assert.match(intro, /drawAtmosphere\(ctx, w, h, seconds\)/);
  assert.match(intro, /drawHorde\(ctx, w, h, horde, seconds\)/);
  assert.match(intro, /PALECIAKI!/);
  assert.match(intro, /UWAGA: ZMIANA WYMKNĘŁA SIĘ SPOD KONTROLI/);
  assert.match(intro, /private readonly duration = 11\.8/);
  assert.match(intro, /is-title-reveal/);
  assert.match(css, /\.cinematic-intro-overlay\.is-title-reveal \.cinematic-intro-copy/);
});


test('boot only warms runtime textures and lazily creates models and audio after interaction', async () => {
  const assets = await readFile(new URL('../src/assets.ts', import.meta.url), 'utf8');
  assert.match(assets, /const assetList: AssetItem\[\] = \[/);
  for (const texture of ['getFloorTexture()', 'getWallTexture()', 'getShowroomMarbleFloorTexture()', 'getShowroomWallTexture()', 'getTerminalGraniteFloorTexture()', 'getHazardStripeTexture()']) {
    assert.ok(assets.includes(texture), 'missing runtime texture warmup: ' + texture);
  }
  assert.doesNotMatch(assets, /createCharacterModel\(|createWalczakBossModel\(|createDisplayPodium\(|createShowroomPlant\(/);
  assert.doesNotMatch(assets, /sound\.initCtx\(/);
  assert.match(assets, /cat-count-models">NA ŻĄDANIE/);
  assert.match(assets, /cat-count-audio">PO DOTKNIĘCIU/);
});

test('mobile intro has a bounded canvas pixel ratio and auto-closes its reduced-motion poster', async () => {
  const intro = await readFile(new URL('../src/cinematicIntro.ts', import.meta.url), 'utf8');
  assert.match(intro, /const dpr = mobile \? 1 : Math\.min\(1\.5/);
  assert.match(intro, /this\.completionTimeout = window\.setTimeout\(\(\) => this\.stop\(\), 1800\)/);
  assert.match(intro, /if \(this\.completionTimeout !== null\) window\.clearTimeout\(this\.completionTimeout\)/);
});

test('boot timeouts prevent false-ready menus when the asset or WebGL engine initialization fails', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(app, /withBootTimeout\(\s*assetLoader\.preloadAll\(\),\s*12000/);
  assert.match(app, /withBootTimeout\(\s*xb\.init\(options\),\s*18000/);
  assert.match(app, /if \(!renderer\)/);
  assert.match(app, /Nie udało się uruchomić silnika 3D/);
  assert.match(app, /boot-recovery-notice/);
  assert.doesNotMatch(app, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => resolve\(\)\)\)/);
});
