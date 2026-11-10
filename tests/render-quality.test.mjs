import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdaptiveEffectsTier, getAdaptiveRenderScale } from '../src/renderQuality.ts';

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


test('mobile effects tiers step down immediately under CPU pressure', () => {
  assert.equal(getAdaptiveEffectsTier(42, true, 0, 0), 1);
  assert.equal(getAdaptiveEffectsTier(31, true, 0, 0), 2);
  assert.equal(getAdaptiveEffectsTier(29, true, 1, 0), 2);
  assert.equal(getAdaptiveEffectsTier(42, true, 2, 0), 2);
  assert.equal(getAdaptiveEffectsTier(31, false, 0, 0), 0);
});

test('mobile effects tier recovery is hysteretic and advances one tier at a time', () => {
  assert.equal(getAdaptiveEffectsTier(47, true, 2, 9999), 2);
  assert.equal(getAdaptiveEffectsTier(47, true, 2, 10000), 1);
  assert.equal(getAdaptiveEffectsTier(53, true, 1, 8000), 1);
  assert.equal(getAdaptiveEffectsTier(54, true, 1, 7999), 1);
  assert.equal(getAdaptiveEffectsTier(54, true, 1, 8000), 0);
  assert.equal(getAdaptiveEffectsTier(Number.NaN, true, 2, 20000), 2);
  assert.equal(getAdaptiveEffectsTier(60, false, 2, 0), 0);
});


test('device render profiles cap mobile GPU work and preserve desktop quality', async () => {
  const { getDeviceRenderProfile } = await import('../src/renderQuality.ts');
  const low = getDeviceRenderProfile(true, 4, 4);
  assert.equal(low.tier, 'mobile-low');
  assert.equal(low.shadowsEnabled, false);
  assert.equal(low.bloomEnabled, false);
  assert.equal(low.pixelRatioCap, 1.08);
  assert.equal(low.survivalPixelRatioCap, 0.94);

  const balanced = getDeviceRenderProfile(true, 6, 6);
  assert.equal(balanced.tier, 'mobile-balanced');
  assert.equal(balanced.shadowsEnabled, false);
  assert.equal(balanced.softShadows, false);
  assert.equal(balanced.bloomEnabled, false);
  assert.equal(balanced.pixelRatioCap, 1.36);
  assert.equal(balanced.survivalPixelRatioCap, 1.16);

  const high = getDeviceRenderProfile(true, 8, 8);
  assert.equal(high.tier, 'mobile-high');
  assert.equal(high.pixelRatioCap, 1.78);
  assert.equal(high.survivalPixelRatioCap, 1.44);
  assert.equal(high.shadowsEnabled, false);
  assert.equal(high.bloomEnabled, true);

  const desktop = getDeviceRenderProfile(false, 4, 4);
  assert.equal(desktop.tier, 'desktop');
  assert.equal(desktop.softShadows, true);
  assert.equal(desktop.pixelRatioCap, 2);
});

test('unknown device metrics remain balanced rather than forcing the low graphics tier', async () => {
  const { getDeviceRenderProfile } = await import('../src/renderQuality.ts');
  assert.equal(getDeviceRenderProfile(true, undefined, undefined).tier, 'mobile-balanced');
  assert.equal(getDeviceRenderProfile(true, 8, undefined).tier, 'mobile-balanced');
});

test('pixel ratio transitions apply the 0.9 and 0.8 tiers without reacting to tiny noise', async () => {
  const { shouldApplyPixelRatioChange } = await import('../src/renderQuality.ts');
  assert.equal(shouldApplyPixelRatioChange(1, 0.9), true);
  assert.equal(shouldApplyPixelRatioChange(0.9, 0.8), true);
  assert.equal(shouldApplyPixelRatioChange(1, 0.98), false);
  assert.equal(shouldApplyPixelRatioChange(Number.NaN, 0.9), false);
});
