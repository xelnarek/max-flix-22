import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUiViewport, shouldShowTouchControls } from '../src/uiViewport.ts';

test('modern phone portrait uses a near-native menu scale', () => {
  const profile = calculateUiViewport(390, 844, true);
  assert.ok(profile.scale >= 0.98 && profile.scale <= 1.02);
  assert.equal(profile.landscapeTouch, false);
});

test('short and narrow touch screens switch to compact density', () => {
  const profile = calculateUiViewport(360, 620, true);
  assert.equal(profile.density, 'compact');
  assert.ok(profile.scale >= 0.82 && profile.scale <= 1.10);
});

test('touch landscape uses a different reference profile to protect vertical space', () => {
  const profile = calculateUiViewport(844, 390, true);
  assert.equal(profile.landscapeTouch, true);
  assert.equal(profile.density, 'compact');
});

test('desktop panels have a bounded width and never exceed the design maximum', () => {
  const small = calculateUiViewport(1024, 600, false);
  const large = calculateUiViewport(2560, 1440, false);
  assert.ok(small.panelMaxWidth < 1024);
  assert.equal(large.panelMaxWidth, 1240);
  assert.equal(large.density, 'wide');
});

test('invalid dimensions are safely normalized', () => {
  const profile = calculateUiViewport(Number.NaN, 0, false);
  assert.ok(Number.isFinite(profile.scale));
  assert.ok(profile.panelMaxWidth >= 1);
});

test('very narrow touch screens never get a panel wider than the usable viewport', () => {
  const profile = calculateUiViewport(320, 568, true);
  assert.equal(profile.panelMaxWidth, 304);
  assert.ok(profile.panelMaxWidth <= 320);
});

test('touch controls stay hidden in a narrow desktop window with a fine mouse pointer', () => {
  assert.equal(shouldShowTouchControls(true, 760, false, true), false);
});

test('touch hardware and coarse pointers keep controls at wide viewport sizes', () => {
  assert.equal(shouldShowTouchControls(true, 1440, true, true), true);
  assert.equal(shouldShowTouchControls(true, 1440, true, false), true);
});

test('pointerless narrow devices retain the compact-layout fallback', () => {
  assert.equal(shouldShowTouchControls(true, 760, false, false), true);
  assert.equal(shouldShowTouchControls(true, 1200, false, false), false);
});

test('hidden gameplay states never expose touch controls', () => {
  assert.equal(shouldShowTouchControls(false, 390, true, false), false);
});
