import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuTabIndexForKey } from '../src/menuTabNavigation.ts';

test('arrow keys move through all eleven menu tabs and wrap at both ends', () => {
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 11), 1);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 11), 10);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 10, 11), 0);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 10, 11), 9);
});

test('Home and End jump to the first and last menu tab', () => {
  assert.equal(getMenuTabIndexForKey('Home', 4, 11), 0);
  assert.equal(getMenuTabIndexForKey('End', 1, 11), 10);
});

test('unrelated keys and invalid tab indexes do not change navigation', () => {
  assert.equal(getMenuTabIndexForKey('Enter', 0, 10), null);
  assert.equal(getMenuTabIndexForKey('ArrowRight', -1, 11), null);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 11, 11), null);
  assert.equal(getMenuTabIndexForKey('Home', 0, 0), null);
  assert.equal(getMenuTabIndexForKey('End', 0.5, 10), null);
});

test('eleven-tab menu keeps Home and End aligned with the current destination count', () => {
  assert.equal(getMenuTabIndexForKey('Home', 8, 11), 0);
  assert.equal(getMenuTabIndexForKey('End', 0, 11), 10);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 10, 11), 0);
});
