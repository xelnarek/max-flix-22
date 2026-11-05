import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemyHitReaction, getEnemyHitPulse } from '../src/enemyCombatFeedback.ts';

test('normal hit recoil pushes an enemy away from the damage source', () => {
  const reaction = createEnemyHitReaction(4, 3, 1, 3, 2, false);
  assert.ok(reaction.impulseX > 0);
  assert.equal(reaction.impulseZ, 0);
  assert.ok(reaction.impulseX <= 1.2);
  assert.ok(reaction.duration > 0);
});

test('boss hit response is deliberately smaller than a normal enemy response', () => {
  const normal = createEnemyHitReaction(5, 0, 0, 0, 4, false);
  const boss = createEnemyHitReaction(5, 0, 0, 0, 4, true);
  assert.ok(boss.duration < normal.duration);
  assert.ok(Math.hypot(boss.impulseX, boss.impulseZ) < Math.hypot(normal.impulseX, normal.impulseZ));
  assert.ok(boss.strength < normal.strength);
});

test('hit response remains finite when the source and enemy share coordinates', () => {
  const reaction = createEnemyHitReaction(0, 0, 0, 0, 1, false);
  for (const value of Object.values(reaction)) assert.ok(Number.isFinite(value));
  assert.ok(reaction.impulseX > 0);
});

test('damage magnitude cannot create unbounded hit reactions', () => {
  const small = createEnemyHitReaction(2, 0, 0, 0, 1, false);
  const huge = createEnemyHitReaction(2, 0, 0, 0, 999999, false);
  assert.ok(huge.strength <= 0.18);
  assert.ok(Math.hypot(huge.impulseX, huge.impulseZ) <= 1.2);
  assert.ok(huge.strength >= small.strength);
});

test('hit pulse is zero at both ends and peaks halfway through the reaction', () => {
  assert.equal(getEnemyHitPulse(0.24, 0.24), 0);
  assert.ok(Math.abs(getEnemyHitPulse(0.12, 0.24) - 1) < 1e-9);
  assert.ok(Math.abs(getEnemyHitPulse(0, 0.24)) < 1e-9);
  assert.equal(getEnemyHitPulse(-1, 0.24), 0);
  assert.equal(getEnemyHitPulse(0.2, 0), 0);
});
