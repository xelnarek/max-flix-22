import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseCampaignRewardSpawnPoint } from '../src/campaignRewards.ts';

test('campaign roaming rewards stay inside the active mega-map sector', () => {
  const cases = [
    { sector: 1, minX: -29, maxX: 29 },
    { sector: 2, minX: 43, maxX: 109 },
    { sector: 3, minX: 123, maxX: 198 },
  ];
  for (const item of cases) {
    const left = chooseCampaignRewardSpawnPoint(item.sector, 0, 0);
    const right = chooseCampaignRewardSpawnPoint(item.sector, 1, 1);
    const middle = chooseCampaignRewardSpawnPoint(item.sector, 0.5, 0.5);
    assert.equal(left.x, item.minX);
    assert.equal(right.x, item.maxX);
    assert.ok(middle.x >= item.minX && middle.x <= item.maxX);
    assert.ok(left.z >= -10 && right.z <= 10);
  }
});

test('invalid sector and random samples are normalised to safe values', () => {
  assert.deepEqual(chooseCampaignRewardSpawnPoint(99, Number.NaN, Number.POSITIVE_INFINITY), { x: 0, z: 0 });
  assert.deepEqual(chooseCampaignRewardSpawnPoint(2, -2, 2), { x: 43, z: 10 });
});

test('campaign rewards are rerouted to a clear floor point when the sampled point intersects an obstacle', () => {
  const obstacles = [{ x: 76, z: 0, halfWidth: 7, halfDepth: 4 }];
  const point = chooseCampaignRewardSpawnPoint(2, 0.5, 0.5, obstacles);

  assert.notDeepEqual(point, { x: 76, z: 0 });
  assert.ok(Math.abs(point.x - 76) > 8.15 || Math.abs(point.z) > 5.15);
  assert.ok(point.x >= 43 && point.x <= 109);
  assert.ok(point.z >= -10 && point.z <= 10);
});

test('obstacle-aware reward placement is deterministic for the same rolls and map geometry', () => {
  const obstacles = [
    { x: 76, z: 0, halfWidth: 7, halfDepth: 4 },
    { x: 62, z: -6, halfWidth: 3, halfDepth: 2 },
  ];
  assert.deepEqual(
    chooseCampaignRewardSpawnPoint(2, 0.5, 0.5, obstacles),
    chooseCampaignRewardSpawnPoint(2, 0.5, 0.5, obstacles),
  );
});
