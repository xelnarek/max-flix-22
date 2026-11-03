import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEnemyObstacleAvoidanceVector } from '../src/enemyNavigation.ts';

test('campaign navigation returns no bias when the chase lane is clear', () => {
  const steer = calculateEnemyObstacleAvoidanceVector(
    { id: 'enemy-clear', x: 0, z: -8 },
    { x: 0, z: 8 },
    [{ x: 8, z: 0, halfWidth: 2, halfDepth: 2 }],
  );
  assert.deepEqual(steer, { x: 0, z: 0 });
});

test('campaign navigation steers around a shelf blocking the direct chase lane', () => {
  const actor = { id: 'enemy-blocked', x: 0, z: -8 };
  const target = { x: 0, z: 8 };
  const steer = calculateEnemyObstacleAvoidanceVector(
    actor,
    target,
    [{ x: 0, z: 0, halfWidth: 2, halfDepth: 2 }],
    8,
    0.8,
  );
  assert.ok(Math.hypot(steer.x, steer.z) > 0.8);
  assert.ok(Math.abs(steer.x) > 0.1, 'the selected route must leave the blocked straight line');
});

test('campaign navigation recovers an actor already inside obstacle clearance', () => {
  const actor = { id: 'enemy-trapped', x: 0, z: 0 };
  const steer = calculateEnemyObstacleAvoidanceVector(
    actor,
    { x: 0, z: 10 },
    [{ x: 0, z: 0, halfWidth: 2, halfDepth: 2 }],
  );
  assert.ok(Math.hypot(steer.x, steer.z) > 1.6);
  assert.ok(Math.abs(steer.x) + Math.abs(steer.z) > 1.6);
});

test('campaign navigation is deterministic for an actor approaching a symmetric obstacle', () => {
  const input = [
    { id: 'enemy-deterministic', x: 0, z: -8 },
    { x: 0, z: 8 },
    [{ x: 0, z: 0, halfWidth: 2, halfDepth: 2 }],
  ];
  const first = calculateEnemyObstacleAvoidanceVector(...input);
  const second = calculateEnemyObstacleAvoidanceVector(...input);
  assert.deepEqual(first, second);
});

test('invalid obstacle records are ignored without producing non-finite steering', () => {
  const steer = calculateEnemyObstacleAvoidanceVector(
    { id: 'enemy-safe', x: 0, z: -5 },
    { x: 0, z: 5 },
    [{ x: Number.NaN, z: 0, halfWidth: 4, halfDepth: 4 }],
  );
  assert.deepEqual(steer, { x: 0, z: 0 });
});
