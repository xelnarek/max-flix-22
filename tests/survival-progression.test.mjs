import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalXpRequirement } from '../src/survivalProgression.ts';
import {
  getSurvivalProgressionInfo,
  getSurvivalPromotionRarityFloor,
} from '../src/survivalProgression.ts';

test('Survival promotions give the operator a visible rank path every five levels', () => {
  assert.deepEqual(getSurvivalProgressionInfo(1), {
    rankName: 'NOWICJUSZ', nextRankName: 'OPERATOR', nextRankLevel: 5, isPromotion: false,
  });
  assert.deepEqual(getSurvivalProgressionInfo(5), {
    rankName: 'OPERATOR', nextRankName: 'SPECJALISTA', nextRankLevel: 10, isPromotion: true,
  });
  assert.equal(getSurvivalProgressionInfo(14).rankName, 'SPECJALISTA');
  assert.equal(getSurvivalProgressionInfo(15).rankName, 'BRYGADZISTA');
  assert.equal(getSurvivalProgressionInfo(24).rankName, 'KIEROWNIK');
  assert.equal(getSurvivalProgressionInfo(25).rankName, 'LEGENDA B4');
  assert.equal(getSurvivalProgressionInfo(30).nextRankLevel, 35);
});

test('promotion checkpoints progressively raise the guaranteed draft rarity', () => {
  assert.equal(getSurvivalPromotionRarityFloor(4), null);
  assert.equal(getSurvivalPromotionRarityFloor(5), 'rare');
  assert.equal(getSurvivalPromotionRarityFloor(10), 'epic');
  assert.equal(getSurvivalPromotionRarityFloor(15), 'epic');
  assert.equal(getSurvivalPromotionRarityFloor(20), 'legendary');
  assert.equal(getSurvivalPromotionRarityFloor(25), 'legendary');
  assert.equal(getSurvivalPromotionRarityFloor(30), 'legendary');
  assert.equal(getSurvivalPromotionRarityFloor(Number.NaN), null);
});


test('the opening level remains quick and unchanged', () => {
  assert.equal(getSurvivalXpRequirement(1), 9);
  assert.equal(getSurvivalXpRequirement(2), 15);
});

test('later Survival levels need less XP than the previous curve while remaining progressive', () => {
  for (let level = 2; level <= 60; level++) {
    const tuned = getSurvivalXpRequirement(level);
    const previous = Math.round(10 + level * 3);
    assert.ok(tuned < previous, `level ${level} should be faster than the previous curve`);
    assert.ok(tuned >= Math.round(previous * 0.90), `level ${level} must not be accelerated too aggressively`);
  }
});

test('XP requirements remain valid and monotonically increasing at high levels', () => {
  let previous = getSurvivalXpRequirement(1);
  for (let level = 2; level <= 200; level++) {
    const current = getSurvivalXpRequirement(level);
    assert.ok(current >= 12);
    assert.ok(current > previous);
    previous = current;
  }
});

test('invalid level inputs safely use the opening threshold', () => {
  assert.equal(getSurvivalXpRequirement(0), 9);
  assert.equal(getSurvivalXpRequirement(-5), 9);
  assert.equal(getSurvivalXpRequirement(Number.NaN), 9);
  assert.equal(getSurvivalXpRequirement(Number.POSITIVE_INFINITY), 9);
});
