import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuTabIndexForKey } from '../src/menuTabNavigation.ts';

test('arrow keys move through the seven menu tabs and wrap at both ends', () => {
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 7), 1);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 7), 6);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 6, 7), 0);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 6, 7), 5);
});

test('Home and End jump to the first and last menu tab', () => {
  assert.equal(getMenuTabIndexForKey('Home', 4, 7), 0);
  assert.equal(getMenuTabIndexForKey('End', 1, 7), 6);
});

test('unrelated keys and invalid tab indexes do not change navigation', () => {
  assert.equal(getMenuTabIndexForKey('Enter', 0, 7), null);
  assert.equal(getMenuTabIndexForKey('ArrowRight', -1, 7), null);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 7, 7), null);
  assert.equal(getMenuTabIndexForKey('Home', 0, 0), null);
  assert.equal(getMenuTabIndexForKey('End', 0.5, 7), null);
});
