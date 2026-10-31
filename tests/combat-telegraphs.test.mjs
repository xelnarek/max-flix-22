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
