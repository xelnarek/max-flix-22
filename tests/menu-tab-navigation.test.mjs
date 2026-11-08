import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuTabIndexForKey } from '../src/menuTabNavigation.ts';

test('arrow keys move through all ten menu tabs and wrap at both ends', () => {
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 10), 1);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 10), 9);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 9, 10), 0);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 9, 10), 8);
});

test('Home and End jump to the first and last menu tab', () => {
  assert.equal(getMenuTabIndexForKey('Home', 4, 10), 0);
  assert.equal(getMenuTabIndexForKey('End', 1, 10), 9);
});

test('unrelated keys and invalid tab indexes do not change navigation', () => {
  assert.equal(getMenuTabIndexForKey('Enter', 0, 10), null);
  assert.equal(getMenuTabIndexForKey('ArrowRight', -1, 10), null);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 9, 10), null);
  assert.equal(getMenuTabIndexForKey('Home', 0, 0), null);
  assert.equal(getMenuTabIndexForKey('End', 0.5, 10), null);
});

test('ten-tab menu keeps Home and End aligned with the current destination count', () => {
  assert.equal(getMenuTabIndexForKey('Home', 8, 10), 0);
  assert.equal(getMenuTabIndexForKey('End', 0, 10), 9);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 9, 10), 0);
});
