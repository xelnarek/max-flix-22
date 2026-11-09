import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemyHitReaction, getEnemyHitPulse, getEnemyImpactBurstProfile } from '../src/enemyCombatFeedback.ts';

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


test('impact bursts become more pronounced for heavier hits and bosses while staying bounded', () => {
  const light = getEnemyImpactBurstProfile(1, false, false, 0);
  const heavy = getEnemyImpactBurstProfile(5, false, false, 0);
  const boss = getEnemyImpactBurstProfile(5, true, false, 0);
  assert.ok(heavy.particleCount >= light.particleCount);
  assert.equal(boss.particleCount, 5);
  assert.ok(boss.particleScale > heavy.particleScale);
  assert.ok(boss.particleSpeed <= 4.2);
  assert.equal(boss.duration, 0.24);
});

test('handheld impact bursts respect adaptive effects quality tiers', () => {
  const normal = getEnemyImpactBurstProfile(3, false, true, 0);
  const reduced = getEnemyImpactBurstProfile(3, false, true, 1);
  const low = getEnemyImpactBurstProfile(3, true, true, 2);
  assert.equal(normal.particleCount, 2);
  assert.equal(reduced.particleCount, 2);
  assert.equal(low.particleCount, 1);
  assert.ok(low.particleScale > 0);
  assert.ok(low.duration > 0);
});

test('impact burst profile sanitizes invalid damage and performance inputs', () => {
  const profile = getEnemyImpactBurstProfile(Number.NaN, true, true, Number.NaN);
  assert.deepEqual(profile, {
    particleCount: 2,
    particleScale: (0.044 + 0.82 * 0.018) * 1.12,
    particleSpeed: 2.25 + 0.82 * 1.2,
    duration: 0.24,
  });
});
