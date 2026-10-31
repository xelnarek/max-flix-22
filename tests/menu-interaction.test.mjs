import test from 'node:test';
import assert from 'node:assert/strict';
import { ThreeClickTrigger } from '../src/menuInteraction.ts';

test('three rapid clicks reveal exactly once and reset for the next reveal', () => {
  const trigger = new ThreeClickTrigger(2400, 3);
  assert.equal(trigger.register(100), false);
  assert.equal(trigger.register(700), false);
  assert.equal(trigger.register(1500), true);
  assert.equal(trigger.register(1600), false);
  assert.equal(trigger.register(1700), false);
  assert.equal(trigger.register(1800), true);
});

test('a pause longer than the allowed window restarts the sequence', () => {
  const trigger = new ThreeClickTrigger(2400, 3);
  assert.equal(trigger.register(100), false);
  assert.equal(trigger.register(200), false);
  assert.equal(trigger.register(2700), false);
  assert.equal(trigger.register(2800), false);
  assert.equal(trigger.register(2900), true);
});

test('backwards timestamps reset rather than triggering from stale input', () => {
  const trigger = new ThreeClickTrigger(2400, 3);
  assert.equal(trigger.register(1000), false);
  assert.equal(trigger.register(1100), false);
  assert.equal(trigger.register(500), false);
  assert.equal(trigger.register(600), false);
  assert.equal(trigger.register(700), true);
});

test('invalid timestamps do not advance the sequence', () => {
  const trigger = new ThreeClickTrigger(2400, 3);
  assert.equal(trigger.register(Number.NaN), false);
  assert.equal(trigger.register(10), false);
  assert.equal(trigger.register(Number.POSITIVE_INFINITY), false);
  assert.equal(trigger.register(20), false);
  assert.equal(trigger.register(30), true);
});
