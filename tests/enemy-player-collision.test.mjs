import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEnemyPlayerContactDistance,
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
