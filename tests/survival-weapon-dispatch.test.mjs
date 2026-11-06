import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findNextReadyWeaponIndex,
  getNextWeaponDispatchCursor,
} from '../src/survivalWeaponDispatch.ts';

test('round-robin dispatch gives each simultaneously-ready weapon a turn', () => {
  const cooldowns = [0, 0, 0, 0];
  let cursor = 0;
  const order = [];
  for (let shot = 0; shot < cooldowns.length; shot++) {
    const index = findNextReadyWeaponIndex(cooldowns, cursor);
    assert.ok(index >= 0);
    order.push(index);
    cursor = getNextWeaponDispatchCursor(index, cooldowns.length);
  }
  assert.deepEqual(order, [0, 1, 2, 3]);
});

test('dispatch skips weapons that are still reloading and wraps safely', () => {
  assert.equal(findNextReadyWeaponIndex([3, 0, 4, 0], 2), 3);
  assert.equal(findNextReadyWeaponIndex([1, 2, 3], 1), -1);
  assert.equal(findNextReadyWeaponIndex([], 0), -1);
  assert.equal(getNextWeaponDispatchCursor(3, 4), 0);
  assert.equal(getNextWeaponDispatchCursor(1, 0), 0);
});
