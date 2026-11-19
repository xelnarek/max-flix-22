import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceEnemyAttackTelegraph,
  getEnemyRangedAttackTelegraphProfile,
  getEnemyAttackTelegraphConcurrencyLimit,
  hasEnemyAttackTelegraphCapacity,
} from '../src/enemyAttackTelegraphs.ts';

const EXPECTED_TYPES = [
  'pomazaniec',
  'handlowiec',
  'przedstawiciel_włoski',
  'pan_roman',
  'serwisant',
  'cyber_salesman',
];

test('each regular ranged attacker has a distinct visual warning profile', () => {
  const profiles = EXPECTED_TYPES.map((type) => getEnemyRangedAttackTelegraphProfile(type));
  assert.ok(profiles.every(Boolean));
  assert.equal(new Set(profiles.map((profile) => profile.warningText)).size, EXPECTED_TYPES.length);
  for (const profile of profiles) {
    assert.ok(profile.windupSeconds >= 0.4 && profile.windupSeconds <= 0.6);
    assert.ok(profile.laneWidth >= 0.9 && profile.laneWidth <= 1.7);
    assert.ok(Number.isInteger(profile.color));
    assert.ok(profile.warningText.length >= 12);
  }
});

test('melee, boss and unsupported types do not receive the regular ranged warning', () => {
  for (const type of ['customer', 'walczak', 'inspector', 'agv_robot', 'mutant_gamma_forklift']) {
    assert.equal(getEnemyRangedAttackTelegraphProfile(type), null);
  }
});

test('wind-up progress advances monotonically and releases only at completion', () => {
  let timer = 0.5;
  const first = advanceEnemyAttackTelegraph(timer, 0.5, 0.1);
  assert.equal(first.remainingSeconds, 0.4);
  assert.ok(first.progress > 0 && first.progress < 1);
  assert.equal(first.completed, false);

  const second = advanceEnemyAttackTelegraph(first.remainingSeconds, 0.5, 0.2);
  assert.ok(second.remainingSeconds < first.remainingSeconds);
  assert.ok(second.progress > first.progress);
  assert.equal(second.completed, false);

  const third = advanceEnemyAttackTelegraph(second.remainingSeconds, 0.5, 0.2);
  assert.equal(third.remainingSeconds, 0);
  assert.equal(third.progress, 1);
  assert.equal(third.completed, true);
});

test('large frame deltas are capped so one hitch cannot erase the warning window', () => {
  const tick = advanceEnemyAttackTelegraph(0.52, 0.52, 10);
  assert.equal(tick.remainingSeconds, 0.27);
  assert.ok(tick.progress < 0.5);
  assert.equal(tick.completed, false);
});

test('negative and invalid deltas cannot reverse or skip telegraph time', () => {
  const negative = advanceEnemyAttackTelegraph(0.5, 0.5, -2);
  assert.equal(negative.remainingSeconds, 0.5);
  assert.equal(negative.progress, 0);
  assert.equal(negative.completed, false);

  const invalid = advanceEnemyAttackTelegraph(0.5, 0.5, Number.NaN);
  assert.equal(invalid.remainingSeconds, 0.5);
  assert.equal(invalid.completed, false);
});

test('invalid durations fail closed and expired warnings complete deterministically', () => {
  const invalid = advanceEnemyAttackTelegraph(0.4, Number.NaN, 0.1);
  assert.equal(invalid.completed, false);
  assert.equal(invalid.progress, 1);

  const expired = advanceEnemyAttackTelegraph(0, 0.5, 0.1);
  assert.equal(expired.completed, true);
  assert.equal(expired.progress, 1);
});

test('shared warning budget caps simultaneous melee and ranged cues on handheld and desktop', () => {
  assert.equal(getEnemyAttackTelegraphConcurrencyLimit(true), 2);
  assert.equal(getEnemyAttackTelegraphConcurrencyLimit(false), 4);
  assert.equal(hasEnemyAttackTelegraphCapacity(0, true), true);
  assert.equal(hasEnemyAttackTelegraphCapacity(1, true), true);
  assert.equal(hasEnemyAttackTelegraphCapacity(2, true), false);
  assert.equal(hasEnemyAttackTelegraphCapacity(3, false), true);
  assert.equal(hasEnemyAttackTelegraphCapacity(4, false), false);
  assert.equal(hasEnemyAttackTelegraphCapacity(Number.NaN, false), false);
  assert.equal(hasEnemyAttackTelegraphCapacity(Number.POSITIVE_INFINITY, true), false);
});
