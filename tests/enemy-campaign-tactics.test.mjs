import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCampaignEnemyFlankProfile,
  getCampaignEnemyFlankVector,
  resolveCampaignEnemyFlankSide,
} from '../src/enemyCampaignTactics.ts';

test('Campaign flanking is limited to selected humanoid roles and keeps ranged/vehicle lanes direct', () => {
  assert.ok(getCampaignEnemyFlankProfile('kurier').lateralBias > 0.65);
  assert.ok(getCampaignEnemyFlankProfile('sebix_m').lateralBias > 0.6);
  assert.ok(getCampaignEnemyFlankProfile('zombie_pracownik').lateralBias > 0.5);
  assert.ok(getCampaignEnemyFlankProfile('walczak').lateralBias < 0.2);
  for (const type of ['handlowiec', 'przedstawiciel_włoski', 'pan_roman', 'serwisant', 'cyber_salesman', 'pomazaniec', 'forklift', 'agv_robot', 'piorun_dron']) {
    assert.equal(getCampaignEnemyFlankProfile(type), null, type + ' must keep its direct ranged/vehicle lane');
  }
});

test('left and right flankers use mirrored approach vectors with the same bounded strength', () => {
  const left = getCampaignEnemyFlankVector('kurier', 10, 0, 10, 1.2, -1);
  const right = getCampaignEnemyFlankVector('kurier', 10, 0, 10, 1.2, 1);
  assert.ok(left.bias > 0.65 && left.bias <= 0.76);
  assert.equal(left.bias, right.bias);
  assert.ok(Math.abs(left.x - right.x) < 1e-9);
  assert.ok(Math.abs(left.z + right.z) < 1e-9);
  assert.ok(Math.abs(Math.hypot(left.x, left.z) - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(right.x, right.z) - 1) < 1e-9);
});

test('the lateral bias smoothly fades out before the existing melee contact distance', () => {
  const attackDistance = 1.2;
  const profile = getCampaignEnemyFlankProfile('sebix_m');
  const atContact = getCampaignEnemyFlankVector(
    'sebix_m', 2, 0, attackDistance + 0.35, attackDistance, 1,
  );
  const halfway = getCampaignEnemyFlankVector(
    'sebix_m', 2, 0, attackDistance + 0.35 + profile.fadeDistance * 0.5, attackDistance, 1,
  );
  const full = getCampaignEnemyFlankVector(
    'sebix_m', 2, 0, attackDistance + 0.35 + profile.fadeDistance, attackDistance, 1,
  );
  assert.equal(atContact.bias, 0);
  assert.ok(halfway.bias > 0 && halfway.bias < full.bias);
  assert.ok(Math.abs(full.bias - profile.lateralBias) < 1e-9);
});

test('a direct-role enemy keeps its original pursuit vector unchanged', () => {
  const direct = getCampaignEnemyFlankVector('handlowiec', 6, -8, 10, 1.2, -1);
  assert.deepEqual(direct, { x: 6, z: -8, bias: 0 });
});

test('side assignment is stable per enemy and balanced across a generated campaign crowd', () => {
  assert.equal(resolveCampaignEnemyFlankSide('campaign-enemy-42'), resolveCampaignEnemyFlankSide('campaign-enemy-42'));
  const sides = new Set(
    Array.from({ length: 32 }, (_, index) => resolveCampaignEnemyFlankSide('campaign-enemy-' + index)),
  );
  assert.deepEqual([...sides].sort(), [-1, 1]);
});

test('invalid and degenerate pursuit vectors fail safely without NaN steering', () => {
  const zero = getCampaignEnemyFlankVector('kurier', 0, 0, 8, 1.2, -1);
  assert.deepEqual(zero, { x: 0, z: 0, bias: 0 });
  const invalid = getCampaignEnemyFlankVector('kurier', Number.NaN, 4, Number.NaN, Number.NaN, 1);
  assert.ok(Number.isFinite(invalid.x));
  assert.ok(Number.isFinite(invalid.z));
  assert.ok(Number.isFinite(invalid.bias));
  assert.ok(Math.abs(Math.hypot(invalid.x, invalid.z) - 1) < 1e-9);
});
