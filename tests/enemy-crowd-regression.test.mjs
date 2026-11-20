import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemySpatialIndex, resolveEnemyCrowdOverlaps, getEnemyCollisionRadius } from '../src/enemySpacing.ts';

const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

function assertCrowdClear(actors, clearance = 0.16) {
  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i], b = actors[j];
      const required = getEnemyCollisionRadius(a.type ?? '', a.collisionRadius) +
        getEnemyCollisionRadius(b.type ?? '', b.collisionRadius) + clearance;
      const actual = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(actual >= required - 0.035,
        a.id + ' and ' + b.id + ' still overlap: ' + actual.toFixed(3) + ' < ' + required.toFixed(3));
    }
  }
}

test('crowd resolver clears coincident regular enemies in one bounded update', () => {
  const actors = [
    { id: 'customer-a', type: 'customer', x: 0, z: 0 },
    { id: 'kurier-b', type: 'kurier', x: 0, z: 0 },
    { id: 'sebix-c', type: 'sebix_m', x: 0.12, z: 0.04 },
  ];
  const corrected = resolveEnemyCrowdOverlaps(actors, new EnemySpatialIndex(4), bounds, 0.16, 4, 0.8);
  assert.ok(corrected > 0);
  assertCrowdClear(actors);
});

test('crowd resolver respects large boss footprints and arena bounds', () => {
  const actors = [
    { id: 'boss', type: 'krol_leto', x: 0, z: 0 },
    { id: 'customer-a', type: 'customer', x: 0.2, z: 0 },
    { id: 'customer-b', type: 'customer', x: 0.2, z: 0.1 },
  ];
  resolveEnemyCrowdOverlaps(actors, new EnemySpatialIndex(4), bounds, 0.16, 4, 0.8);
  assertCrowdClear(actors);
  for (const actor of actors) {
    assert.ok(actor.x >= bounds.minX && actor.x <= bounds.maxX);
    assert.ok(actor.z >= bounds.minZ && actor.z <= bounds.maxZ);
  }
});

test('defeated actors do not push live enemy models', () => {
  const actors = [
    { id: 'live', type: 'customer', x: 0, z: 0 },
    { id: 'dead', type: 'customer', x: 0, z: 0, state: 'defeated' },
  ];
  const corrected = resolveEnemyCrowdOverlaps(actors, new EnemySpatialIndex(4), bounds, 0.16, 4, 0.8);
  assert.equal(corrected, 0);
  assert.deepEqual({ x: actors[0].x, z: actors[0].z }, { x: 0, z: 0 });
});
