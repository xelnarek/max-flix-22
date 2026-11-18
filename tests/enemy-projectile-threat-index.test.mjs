import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyProjectileThreatIndex } from '../src/enemyProjectileThreatIndex.ts';
import { calculateEnemyProjectileDodge } from '../src/enemyTactics.ts';

const shot = (x, z, vx, vz, y = 1.12) => ({
  mesh: { position: { x, y, z } },
  vel: { x: vx, y: 0, z: vz },
});

test('projectile threat index retains every shot that can enter the dodge horizon', () => {
  const incoming = shot(-5, 0, 8, 0);
  const crossing = shot(0, -6, 0, 9);
  const outside = shot(80, 80, -8, -8);
  const index = new EnemyProjectileThreatIndex(5);
  index.rebuild([incoming, crossing, outside]);

  const candidates = index.query(0, 0, 0.72, 1.02, 0.04);
  assert.ok(candidates.includes(incoming));
  assert.ok(candidates.includes(crossing));
  assert.ok(!candidates.includes(outside));
});

test('staleness margin keeps a fast projectile discoverable between grid refreshes', () => {
  const fastShot = shot(-12, 0, 22, 0);
  const index = new EnemyProjectileThreatIndex(4);
  index.rebuild([fastShot]);

  // The projectile has moved 0.7m since its cell was recorded. The conservative
  // query horizon covers this stale position plus the full dodge prediction.
  fastShot.mesh.position.x = -11.3;
  const candidates = index.query(0, 0, 0.72, 1.02, 0.04);
  assert.ok(candidates.includes(fastShot));
});

test('indexed dodge result matches the full projectile scan for real threats', () => {
  const actor = { id: 'guard-indexed', x: 0, y: 0.5, z: 0 };
  const incoming = shot(-4, 0, 8, 0);
  const nearbyMiss = shot(-4, 1.8, 8, 0);
  const distant = Array.from({ length: 800 }, (_, index) =>
    shot(100 + index * 4, 60 + (index % 7) * 5, -9, 0));
  const allProjectiles = [incoming, nearbyMiss, ...distant];
  const index = new EnemyProjectileThreatIndex(5);
  index.rebuild(allProjectiles);
  const nearby = index.query(actor.x, actor.z, 0.72, 1.02, 0.04);
  const fullResult = calculateEnemyProjectileDodge(actor, allProjectiles);
  const indexedResult = calculateEnemyProjectileDodge(actor, nearby);

  assert.deepEqual(indexedResult, fullResult);
  assert.ok(nearby.length < allProjectiles.length / 20, 'broadphase should discard most distant projectiles');
});

test('rebuild drops removed, orbiting, slow and malformed projectiles while reusing query storage', () => {
  const index = new EnemyProjectileThreatIndex(5);
  const active = shot(-4, 0, 8, 0);
  const orbiting = { ...shot(-3, 0, 9, 0), orbiting: true };
  const slow = shot(-2, 0, 1, 0);
  const invalid = shot(Number.NaN, 0, 9, 0);
  index.rebuild([active, orbiting, slow, invalid]);
  assert.equal(index.size, 1);
  const first = index.query(0, 0);
  assert.deepEqual(first, [active]);

  const replacement = shot(20, 20, -8, 0);
  index.rebuild([replacement]);
  const second = index.query(20, 20);
  assert.strictEqual(first, second, 'queries reuse one scratch array');
  assert.deepEqual(second, [replacement]);
  assert.deepEqual(index.query(0, 0), []);
});

test('invalid projectile coordinates and velocities are excluded from the index', () => {
  const index = new EnemyProjectileThreatIndex(5);
  const invalidHeight = shot(0, 0, 8, 0, Number.NaN);
  const invalidHorizontalVelocity = shot(2, 2, Number.POSITIVE_INFINITY, 0);
  const invalidVerticalVelocity = shot(4, 4, 8, 0);
  invalidVerticalVelocity.vel.y = Number.NEGATIVE_INFINITY;

  index.rebuild([invalidHeight, invalidHorizontalVelocity, invalidVerticalVelocity]);
  assert.equal(index.size, 0);
  assert.deepEqual(index.query(0, 0), []);
});

test('invalid query inputs and empty indexes return an empty reusable result', () => {
  const index = new EnemyProjectileThreatIndex(5);
  assert.deepEqual(index.query(Number.NaN, 0), []);
  index.rebuild([shot(0, 0, 8, 0)]);
  assert.deepEqual(index.query(0, 0, Number.NaN), []);
  assert.deepEqual(index.query(Number.POSITIVE_INFINITY, 0), []);
  index.rebuild([]);
  assert.deepEqual(index.query(0, 0), []);
});

test('numeric cell keys separate negative and positive world quadrants', () => {
  const projectiles = [
    shot(-80, -80, 8, 0),
    shot(-80, 80, 0, 8),
    shot(80, -80, 0, -8),
    shot(80, 80, -8, 0),
  ];
  const index = new EnemyProjectileThreatIndex(5);
  index.rebuild(projectiles);
  for (let i = 0; i < projectiles.length; i++) {
    const candidate = index.query(
      projectiles[i].mesh.position.x,
      projectiles[i].mesh.position.z,
      0.1,
      0.5,
      0.02,
    );
    assert.ok(candidate.includes(projectiles[i]), 'projectile in quadrant ' + i + ' remains indexed');
    assert.equal(candidate.length, 1, 'distant quadrants must not collide into one numeric key');
  }
});
