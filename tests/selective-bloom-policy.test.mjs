import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnableSelectiveBloom } from '../src/bloomPolicy.ts';

test('mobile bloom uses a conservative enable threshold and hysteresis', () => {
  assert.equal(shouldEnableSelectiveBloom(54, true, false), false);
  assert.equal(shouldEnableSelectiveBloom(55, true, false), true);
  assert.equal(shouldEnableSelectiveBloom(50, true, true), true);
  assert.equal(shouldEnableSelectiveBloom(46, true, true), false);
});

test('desktop bloom has a separate frame-rate budget', () => {
  assert.equal(shouldEnableSelectiveBloom(47, false, false), false);
  assert.equal(shouldEnableSelectiveBloom(48, false, false), true);
  assert.equal(shouldEnableSelectiveBloom(40, false, true), true);
  assert.equal(shouldEnableSelectiveBloom(38, false, true), false);
});

test('invalid or unavailable FPS data disables bloom safely', () => {
  assert.equal(shouldEnableSelectiveBloom(0, false, true), false);
  assert.equal(shouldEnableSelectiveBloom(Number.NaN, true, true), false);
  assert.equal(shouldEnableSelectiveBloom(Number.POSITIVE_INFINITY, true, false), false);
});

test('mobile Survival bypasses the secondary bloom pass while desktop keeps a frame-rate gate', () => {
  assert.equal(shouldEnableSelectiveBloom(58, true, false, true), false);
  assert.equal(shouldEnableSelectiveBloom(120, true, false, true), false);
  assert.equal(shouldEnableSelectiveBloom(60, true, true, true), false);
  assert.equal(shouldEnableSelectiveBloom(53, false, false, true), false);
  assert.equal(shouldEnableSelectiveBloom(54, false, false, true), true);
});
