import test from 'node:test';
import assert from 'node:assert/strict';
import { removeAtSwap } from '../src/swapRemove.ts';

test('removes the requested item by swapping in the tail without shifting other entries', () => {
  const values = ['a', 'b', 'c', 'd'];
  assert.equal(removeAtSwap(values, 1), 'b');
  assert.deepEqual(values, ['a', 'd', 'c']);
});

test('removing the tail preserves the remaining order', () => {
  const values = [1, 2, 3];
  assert.equal(removeAtSwap(values, 2), 3);
  assert.deepEqual(values, [1, 2]);
});

test('invalid indexes leave the array untouched', () => {
  for (const index of [-1, 2, 0.5, Number.NaN]) {
    const values = ['x'];
    assert.equal(removeAtSwap(values, index), undefined);
    assert.deepEqual(values, ['x']);
  }
});

test('reverse update iteration visits every original item exactly once when removals occur', () => {
  const values = [0, 1, 2, 3, 4, 5];
  const visited = [];
  for (let index = values.length - 1; index >= 0; index--) {
    const value = values[index];
    visited.push(value);
    if (value % 2 === 0) removeAtSwap(values, index);
  }
  assert.deepEqual(visited.sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(values.sort((a, b) => a - b), [1, 3, 5]);
});
