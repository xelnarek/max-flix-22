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
  assert.match(assets, /this\.updateProgress\(this\.progress, `Wczytywanie:/);
  assert.doesNotMatch(assets, /itemsLoaded \/ itemsTotal/);
  const managerLoad = assets.match(/this\.loadingManager\.onLoad = \(\) => \{([\\s\\S]*?)\};/)?.[1] ?? '';
  assert.doesNotMatch(managerLoad, /this\.isLoaded\s*=/);
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


test('Survival starts without waiting for the ad provider and the menu is not covered by auto intro', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const start = app.slice(app.indexOf('const doStartSurvival'), app.indexOf('const bindTap ='));
  assert.match(start, /await assetLoader\.waitUntilReady\('Gra 3D'\)/);
  assert.match(start, /void initializeGameAds\(\)/);
  assert.doesNotMatch(start, /await initializeGameAds\(\)/);
  const boot = app.slice(app.indexOf('async function startApp()'));
  assert.doesNotMatch(boot, /dispatchEvent\(new Event\('paleciaki:launch-intro'\)\)/);
  assert.match(app, /btn-open-intro/);
});

test('touch controls are portaled outside the WebGL shell for Android hit testing', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const boot = app.slice(app.indexOf('async function startApp()'));
  assert.match(boot, /touchLayer && touchLayer\.parentElement !== document\.body[\s\S]*?document\.body\.appendChild\(touchLayer\)/);
  assert.match(boot, /touchLayer\.style\.setProperty\('z-index', '2000000', 'important'\)/);
  assert.match(boot, /touchLayer\.style\.setProperty\('pointer-events', 'none', 'important'\)/);
  assert.match(app, /touchControls\?\.classList\.add\('survival-mode'\)/);
});

test('the title menu is portaled above the WebGL shell for mobile compositor safety', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const boot = app.slice(app.indexOf('async function startApp()'));
  assert.match(boot, /titleScreen\.parentElement !== document\.body[\s\S]*?document\.body\.appendChild\(titleScreen\)/);
  assert.match(boot, /titleScreen\.style\.setProperty\('z-index', '1000000', 'important'\)/);
  assert.match(boot, /titleScreen\.style\.setProperty\('pointer-events', 'auto', 'important'\)/);
});

test('touch controls are explicitly hit-testable above the WebGL canvas during gameplay', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /#touch-controls:not\(\.hidden\)[\s\S]*?pointer-events: none !important/);
  assert.match(css, /#touch-controls \.joystick-zone,[\s\S]*?pointer-events: auto !important/);
  assert.match(css, /isolation: isolate !important/);
});


test('mobile touch controls stay visible and viewport-anchored after being portaled to body', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(css.includes('body #touch-controls:not(.hidden) {'));
  assert.ok(css.includes('z-index: 2147483000 !important;'));
  assert.ok(css.includes('body #touch-controls:not(.hidden) .joystick-base:not(.active) {'));
  assert.ok(css.includes('opacity: .72 !important;'));
  assert.ok(css.includes('body #touch-controls:not(.hidden) .touch-actions-zone {'));
  assert.ok(css.includes('body #touch-controls:not(.hidden) .touch-actions-zone .touch-action-btn {'));
});


test('gameplay explicitly forces the mobile touch layer visible when a run starts and hides it on return to menu', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(app, /function setTouchControlsVisibility\(visible: boolean\)/);
  assert.ok(app.includes("layer.classList.remove('hidden')"));
  assert.ok(app.includes("layer.style.setProperty('display', 'block', 'important')"));
  assert.ok(app.includes('setTouchControlsVisibility(true)'));
  assert.ok(app.includes('setTouchControlsVisibility(false)'));
});

test('joystick resting anchor does not override live pointer position while active', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.joystick-base:not(.active) {'));
  assert.ok(css.includes('.joystick-base.active {'));
  assert.ok(css.includes('transform: translate(-50%, -50%) !important;'));
});
