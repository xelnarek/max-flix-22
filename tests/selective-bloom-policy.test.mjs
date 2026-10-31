import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnableSelectiveBloom } from '../src/bloomPolicy.ts';

test('mobile bloom uses a conservative enable threshold and hysteresis', () => {
  assert.equal(shouldEnableSelectiveBloom(54, true, false), false);
  assert.equal(shouldEnableSelectiveBloom(55, true, false), true);
  assert.equal(shouldEnableSelectiveBloom(50, true, true), true);
  assert.equal(shouldEnableSelectiveBloom(46, true, true), false);
  assert.equal(shouldEnableSelectiveBloom(54, true, false), false);
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
