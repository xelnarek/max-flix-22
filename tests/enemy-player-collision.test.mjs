import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEnemyPlayerContactDistance,
  projectVelocityOutOfEnemyContacts,
  resolvePlayerMovementAgainstEnemies,
} from '../src/enemyPlayerCollision.ts';

test('player movement stops at an enemy body instead of passing through it', () => {
  const enemy = { id: 'guard', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const result = resolvePlayerMovementAgainstEnemies(
    { x: -3, z: 0 }, { x: 2, z: 0 }, 0.5, [enemy],
  );
  assert.equal(result.collided, true);
  assert.ok(Math.hypot(result.x - enemy.x, result.z - enemy.z) >= getEnemyPlayerContactDistance(enemy.type));
  assert.ok(result.x < 0, 'the player must remain on the approach side of the enemy');
});

test('player can slide around an enemy when moving diagonally into its body', () => {
  const enemy = { id: 'guard', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const result = resolvePlayerMovementAgainstEnemies(
    { x: -2, z: -1 }, { x: 2, z: 1.3 }, 0.5, [enemy],
  );
  assert.equal(result.collided, true);
  assert.ok(Math.hypot(result.x - enemy.x, result.z - enemy.z) >= getEnemyPlayerContactDistance(enemy.type));
  assert.ok(result.z > 0, 'the tangential movement component should be preserved');
});

test('jumping over an enemy leaves horizontal movement unobstructed', () => {
  const enemy = { id: 'guard', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const result = resolvePlayerMovementAgainstEnemies(
    { x: -3, z: 0 }, { x: 2, z: 0 }, 2.0, [enemy],
  );
  assert.equal(result.collided, false);
  assert.equal(result.x, 2);
});

test('defeated actors do not block and coincident spawns receive a deterministic recovery normal', () => {
  const dead = { id: 'dead', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'defeated' };
  const a = resolvePlayerMovementAgainstEnemies({ x: 0, z: 0 }, { x: 0.1, z: 0 }, 0.5, [dead]);
  assert.equal(a.collided, false);
  const b = { ...dead, id: 'live', state: 'chase' };
  const first = resolvePlayerMovementAgainstEnemies({ x: 0, z: 0 }, { x: 0.1, z: 0 }, 0.5, [b]);
  const second = resolvePlayerMovementAgainstEnemies({ x: 0, z: 0 }, { x: 0.1, z: 0 }, 0.5, [b]);
  assert.deepEqual(first, second);
});

test('large enemies have a larger physical collision distance than regular enemies', () => {
  assert.ok(getEnemyPlayerContactDistance('walczak') > getEnemyPlayerContactDistance('inspector'));
  assert.ok(getEnemyPlayerContactDistance('agv_robot') > getEnemyPlayerContactDistance('kurier'));
});

test('shallow contact overlap still permits the player to slide along the enemy body', () => {
  const enemy = { id: 'guard', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const result = resolvePlayerMovementAgainstEnemies(
    { x: -0.97, z: 0 }, { x: -0.97, z: 1.0 }, 0.5, [enemy],
  );
  assert.equal(result.collided, true);
  assert.ok(result.z > 0.8, 'tangential movement should not be erased by contact correction');
  assert.ok(Math.hypot(result.x, result.z) >= getEnemyPlayerContactDistance(enemy.type));
});


test('multi-enemy contact keeps every distinct blocking plane, not only the last collision', () => {
  const enemies = [
    { id: 'left-front', type: 'inspector', x: 0.5, y: 0.5, z: -0.7, state: 'chase' },
    { id: 'right-rear', type: 'inspector', x: -0.65, y: 0.5, z: 0.75, state: 'chase' },
  ];
  const result = resolvePlayerMovementAgainstEnemies(
    { x: -2, z: -2 }, { x: 2, z: 2 }, 0.5, enemies,
  );
  assert.equal(result.collided, true);
  assert.ok((result.contactNormals?.length ?? 0) >= 2, 'both enemy contact planes must be retained');
});

test('player momentum is projected out of all active contact planes in a crowded corner', () => {
  const normals = [{ x: 1, z: 0 }, { x: 0, z: 1 }];
  const projected = projectVelocityOutOfEnemyContacts({ x: -2, z: -1 }, normals);
  assert.ok(projected.x >= -1e-7, 'horizontal momentum must not continue into the first body');
  assert.ok(projected.z >= -1e-7, 'horizontal momentum must not continue into the second body');
  assert.ok(Math.hypot(projected.x, projected.z) < 1e-6, 'a closed corner must stop inward momentum');
});

test('contact velocity projection preserves tangent and outward momentum', () => {
  const tangent = projectVelocityOutOfEnemyContacts({ x: 0, z: 2 }, [{ x: 1, z: 0 }]);
  assert.deepEqual(tangent, { x: 0, z: 2 });
  const outward = projectVelocityOutOfEnemyContacts({ x: 2, z: 0 }, [{ x: 1, z: 0 }]);
  assert.deepEqual(outward, { x: 2, z: 0 });
});
