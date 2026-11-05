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
