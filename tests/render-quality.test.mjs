import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdaptiveRenderScale } from '../src/renderQuality.ts';

test('invalid FPS samples never corrupt the current render scale', () => {
  assert.equal(getAdaptiveRenderScale(Number.NaN, true, 0.8, 10000), 0.8);
  assert.equal(getAdaptiveRenderScale(0, false, 0.9, 10000), 0.9);
});

test('render resolution degrades immediately in increasingly heavy combat', () => {
  assert.equal(getAdaptiveRenderScale(33, true, 1), 0.72);
  assert.equal(getAdaptiveRenderScale(40, true, 1), 0.8);
  assert.equal(getAdaptiveRenderScale(47, false, 1), 0.9);
  assert.equal(getAdaptiveRenderScale(60, true, 0.9), 0.9);
});

test('render quality recovery waits for six seconds of stable FPS', () => {
  assert.equal(getAdaptiveRenderScale(60, true, 0.72, 5999), 0.72);
  assert.equal(getAdaptiveRenderScale(60, true, 0.72, 6000), 0.8);
  assert.equal(getAdaptiveRenderScale(60, true, 0.8, 6000), 0.9);
});

test('mobile recovery uses a higher FPS floor than desktop', () => {
  assert.equal(getAdaptiveRenderScale(55, true, 0.9, 10000), 0.9);
  assert.equal(getAdaptiveRenderScale(54, false, 0.9, 10000), 1);
  assert.equal(getAdaptiveRenderScale(57, true, 0.9, 10000), 1);
});

test('recovery advances one tier at a time rather than jumping to full resolution', () => {
  assert.equal(getAdaptiveRenderScale(60, true, 0.72, 6000), 0.8);
  assert.equal(getAdaptiveRenderScale(60, true, 0.8, 6000), 0.9);
  assert.equal(getAdaptiveRenderScale(60, true, 0.9, 6000), 1);
});


test('mobile Survival lowers resolution earlier during dense waves', () => {
  assert.equal(getAdaptiveRenderScale(55, true, 1, 0, true), 0.9);
  assert.equal(getAdaptiveRenderScale(47, true, 1, 0, true), 0.8);
  assert.equal(getAdaptiveRenderScale(39, true, 1, 0, true), 0.72);
});

test('mobile Survival resolution recovers only after eight stable seconds', () => {
  assert.equal(getAdaptiveRenderScale(60, true, 0.72, 7999, true), 0.72);
  assert.equal(getAdaptiveRenderScale(60, true, 0.72, 8000, true), 0.8);
  assert.equal(getAdaptiveRenderScale(60, true, 0.8, 8000, true), 0.9);
});


test('device render profiles protect low-memory phones without lowering high-end mobile quality', async () => {
  const { getDeviceRenderProfile } = await import('../src/renderQuality.ts');
  const low = getDeviceRenderProfile(true, 4, 4);
  assert.equal(low.tier, 'mobile-low');
  assert.equal(low.shadowsEnabled, false);
  assert.equal(low.bloomEnabled, false);
  assert.equal(low.pixelRatioCap, 1.22);
  assert.equal(low.survivalPixelRatioCap, 1.08);

  const balanced = getDeviceRenderProfile(true, 6, 6);
  assert.equal(balanced.tier, 'mobile-balanced');
  assert.equal(balanced.shadowsEnabled, true);
  assert.equal(balanced.softShadows, false);
  assert.equal(balanced.survivalPixelRatioCap, 1.24);

  const high = getDeviceRenderProfile(true, 8, 8);
  assert.equal(high.tier, 'mobile-high');
  assert.equal(high.pixelRatioCap, 1.65);
  assert.equal(high.bloomEnabled, true);

  const desktop = getDeviceRenderProfile(false, 4, 4);
  assert.equal(desktop.tier, 'desktop');
  assert.equal(desktop.softShadows, true);
  assert.equal(desktop.pixelRatioCap, 2);
});

test('unknown device metrics use a balanced mobile profile instead of a false low-end classification', async () => {
  const { getDeviceRenderProfile } = await import('../src/renderQuality.ts');
  assert.equal(getDeviceRenderProfile(true, undefined, undefined).tier, 'mobile-balanced');
  assert.equal(getDeviceRenderProfile(true, 8, undefined).tier, 'mobile-balanced');
});
