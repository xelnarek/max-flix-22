import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuTabIndexForKey } from '../src/menuTabNavigation.ts';

test('arrow keys move through all nine menu tabs and wrap at both ends', () => {
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 9), 1);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 9), 8);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 8, 9), 0);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 8, 9), 7);
});

test('Home and End jump to the first and last menu tab', () => {
  assert.equal(getMenuTabIndexForKey('Home', 4, 9), 0);
  assert.equal(getMenuTabIndexForKey('End', 1, 9), 6);
});

test('unrelated keys and invalid tab indexes do not change navigation', () => {
  assert.equal(getMenuTabIndexForKey('Enter', 0, 9), null);
  assert.equal(getMenuTabIndexForKey('ArrowRight', -1, 9), null);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 7, 7), null);
  assert.equal(getMenuTabIndexForKey('Home', 0, 0), null);
  assert.equal(getMenuTabIndexForKey('End', 0.5, 7), null);
});

test('nine-tab menu keeps Home and End aligned with the current destination count', () => {
  assert.equal(getMenuTabIndexForKey('Home', 8, 9), 0);
  assert.equal(getMenuTabIndexForKey('End', 0, 9), 8);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 8, 9), 0);
});
