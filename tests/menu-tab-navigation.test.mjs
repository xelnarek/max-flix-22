import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuTabIndexForKey } from '../src/menuTabNavigation.ts';

test('arrow keys move through all twelve menu tabs and wrap at both ends', () => {
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 12), 1);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 12), 11);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 11, 12), 0);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 11, 12), 10);
});

test('Home and End jump to the first and last menu tab', () => {
  assert.equal(getMenuTabIndexForKey('Home', 4, 12), 0);
  assert.equal(getMenuTabIndexForKey('End', 1, 12), 11);
});

test('unrelated keys and invalid tab indexes do not change navigation', () => {
  assert.equal(getMenuTabIndexForKey('Enter', 0, 12), null);
  assert.equal(getMenuTabIndexForKey('ArrowRight', -1, 12), null);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 12, 12), null);
  assert.equal(getMenuTabIndexForKey('Home', 0, 0), null);
  assert.equal(getMenuTabIndexForKey('End', 0.5, 12), null);
});

test('twelve-tab menu keeps Home and End aligned with the current destination count', () => {
  assert.equal(getMenuTabIndexForKey('Home', 8, 12), 0);
  assert.equal(getMenuTabIndexForKey('End', 0, 12), 11);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 11, 12), 0);
});

test('vertical navigation keys also move through the desktop side rail', () => {
  assert.equal(getMenuTabIndexForKey('ArrowDown', 0, 12), 1);
  assert.equal(getMenuTabIndexForKey('ArrowUp', 0, 12), 11);
  assert.equal(getMenuTabIndexForKey('ArrowDown', 11, 12), 0);
  assert.equal(getMenuTabIndexForKey('ArrowUp', 11, 12), 10);
});

test('horizontal navigation ignores vertical arrows when the rail is horizontal', () => {
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 12, 'horizontal'), 1);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 12, 'horizontal'), 11);
  assert.equal(getMenuTabIndexForKey('ArrowDown', 0, 12, 'horizontal'), null);
  assert.equal(getMenuTabIndexForKey('ArrowUp', 0, 12, 'horizontal'), null);
});

test('vertical navigation ignores horizontal arrows when the rail is vertical', () => {
  assert.equal(getMenuTabIndexForKey('ArrowDown', 0, 12, 'vertical'), 1);
  assert.equal(getMenuTabIndexForKey('ArrowUp', 0, 12, 'vertical'), 11);
  assert.equal(getMenuTabIndexForKey('ArrowRight', 0, 12, 'vertical'), null);
  assert.equal(getMenuTabIndexForKey('ArrowLeft', 0, 12, 'vertical'), null);
});
