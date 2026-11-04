import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinBossImpactRadius } from '../src/combatTelegraphs.ts';

test('detects players inside a boss impact radius', () => {
  assert.equal(isWithinBossImpactRadius(3, 4, 0, 0, 5), true);
});

test('treats the radius boundary as a hit and a point beyond it as a dodge', () => {
  assert.equal(isWithinBossImpactRadius(0, 8.7, 0, 0, 8.7), true);
  assert.equal(isWithinBossImpactRadius(0, 8.71, 0, 0, 8.7), false);
});

test('negative radii are safely treated as zero', () => {
  assert.equal(isWithinBossImpactRadius(0, 0, 0, 0, -5), true);
  assert.equal(isWithinBossImpactRadius(0, 0.01, 0, 0, -5), false);
});

test('invalid coordinates cannot create false boss hits', () => {
  assert.equal(isWithinBossImpactRadius(Number.NaN, 0, 0, 0, 8), false);
  assert.equal(isWithinBossImpactRadius(0, Number.POSITIVE_INFINITY, 0, 0, 8), false);
});

import {
  isEffectiveBossLaneDodge,
  isInsideBossAttackLane,
} from '../src/combatTelegraphs.ts';

test('a warning lane uses the same forward axis as the rendered boss telegraph', () => {
  assert.equal(isInsideBossAttackLane(0, 6, 0, 0, 0, 12, 2), true);
  assert.equal(isInsideBossAttackLane(6, 0, 0, 0, Math.PI / 2, 12, 2), true);
  assert.equal(isInsideBossAttackLane(0, -1, 0, 0, 0, 12, 2), false);
});

test('lane checks respect the exact warning length and width', () => {
  assert.equal(isInsideBossAttackLane(0, 12.5, 0, 0, 0, 12, 2), false);
  assert.equal(isInsideBossAttackLane(1.5, 6, 0, 0, 0, 12, 2), false);
  assert.equal(isInsideBossAttackLane(0, 6, 0, 0, 0, 12, 2), true);
});

test('a lateral dash that exits the committed lane is a perfect dodge', () => {
  assert.equal(isEffectiveBossLaneDodge(0, 6, 1, 0, 3.96, 0, 0, 0, 12, 2), true);
  assert.equal(isEffectiveBossLaneDodge(6, 0, 0, 1, 3.96, 0, 0, Math.PI / 2, 12, 2), true);
});

test('running forward along the warning lane does not count as a perfect dodge', () => {
  assert.equal(isEffectiveBossLaneDodge(0, 6, 0, 1, 3.96, 0, 0, 0, 12, 2), false);
  assert.equal(isEffectiveBossLaneDodge(0, 6, 1, 0, 0.4, 0, 0, 0, 12, 2), false);
});

test('perfect dodge checks reject invalid coordinates and require a starting lane threat', () => {
  assert.equal(isEffectiveBossLaneDodge(Number.NaN, 6, 1, 0, 4, 0, 0, 0, 12, 2), false);
  assert.equal(isEffectiveBossLaneDodge(4, 6, 1, 0, 4, 0, 0, 0, 12, 2), false);
});
