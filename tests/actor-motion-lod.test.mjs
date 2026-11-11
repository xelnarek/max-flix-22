import test from 'node:test';
import assert from 'node:assert/strict';
import { dampActorAngle, getActorAnimationInterval, getEnemyRigPlaybackRate } from '../src/actorMotion.ts';

test('actor facing takes the shortest route across the angular wrap boundary', () => {
  const current = Math.PI - 0.05;
  const target = -Math.PI + 0.05;
  const next = dampActorAngle(current, target, 12, 1 / 60);
  assert.ok(next > current, 'the actor should turn through the short positive arc');
  assert.ok(next < Math.PI + 0.05, 'the actor should not spin around the long side');
  assert.equal(dampActorAngle(0.2, 1.1, 0, 1 / 60), 0.2);
  assert.equal(dampActorAngle(0.2, 1.1, 12, 0), 0.2);
});

test('visible actor animation cadence scales with distance and device class', () => {
  assert.equal(getActorAnimationInterval(7, false), 0);
  assert.equal(getActorAnimationInterval(12, false), 1 / 45);
  assert.equal(getActorAnimationInterval(20, false), 1 / 30);
  assert.equal(getActorAnimationInterval(12, true), 1 / 30);
  assert.equal(getActorAnimationInterval(20, true), 1 / 24);
  assert.equal(getActorAnimationInterval(Number.NaN, true), 0);
});

test('imported enemy locomotion clips receive bounded cadence correction', () => {
  assert.equal(getEnemyRigPlaybackRate('Walk', 2.45), 1);
  assert.equal(getEnemyRigPlaybackRate('Run', 5.25), 1);
  assert.ok(getEnemyRigPlaybackRate('Walk', 6) <= 1.45);
  assert.ok(getEnemyRigPlaybackRate('Walk', 0.1) >= 0.78);
  assert.equal(getEnemyRigPlaybackRate('Hit', 4), 1);
});
