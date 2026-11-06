import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNearbySpawnPoint } from '../src/arenaSpawn.ts';
import { chooseCampaignNearbyRewardSpawnPoint } from '../src/campaignRewards.ts';

const bounds = { minX: -24, maxX: 24, minZ: -14, maxZ: 14 };

test('nearby reward spawn stays visible, bounded and outside obstacle footprints', () => {
  const point = chooseNearbySpawnPoint(
    { x: 0, z: 0 },
    bounds,
    [{ x: 0, z: 7, halfWidth: 3.2, halfDepth: 2.8 }],
    [{ id: 'enemy-1', x: -7, z: 0 }, { id: 'old-pickup', x: 7, z: 0 }],
    0,
    0.5,
    { minimumPlayerDistance: 5, maximumPlayerDistance: 10, minimumOccupiedDistance: 2.5 },
  );
  assert.ok(point);
  assert.ok(point.x >= bounds.minX && point.x <= bounds.maxX);
  assert.ok(point.z >= bounds.minZ && point.z <= bounds.maxZ);
  assert.ok(Math.hypot(point.x, point.z) >= 5);
  assert.ok(Math.hypot(point.x, point.z) <= 10);
  assert.ok(!(Math.abs(point.x) < 4.2 && Math.abs(point.z - 7) < 3.8));
  assert.ok(Math.hypot(point.x + 7, point.z) >= 2.5);
  assert.ok(Math.hypot(point.x - 7, point.z) >= 2.5);
});

test('spawn helper declines when the available arena area is too small to place a visible pickup', () => {
  const point = chooseNearbySpawnPoint(
    { x: 0, z: 0 },
    { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
    [],
    [],
    0.3,
    0.5,
  );
  assert.equal(point, null);
});

test('campaign roaming rewards use the operator location and the correct sector bounds', () => {
  const point = chooseCampaignNearbyRewardSpawnPoint(
    2,
    { x: 72, z: 0 },
    0.2,
    0.4,
    [],
    [],
    { minimumPlayerDistance: 5, maximumPlayerDistance: 11 },
  );
  assert.ok(point);
  assert.ok(point.x >= 43 && point.x <= 109);
  assert.ok(Math.hypot(point.x - 72, point.z) >= 5);
  assert.ok(Math.hypot(point.x - 72, point.z) <= 11);
});
