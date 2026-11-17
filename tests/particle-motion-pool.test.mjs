import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ParticleMotionStatePool } from '../src/particleMotionPool.ts';

test('particle motion states preallocate vectors and reuse the same state without allocations', () => {
  const pool = new ParticleMotionStatePool(2);
  const first = pool.acquire();
  const second = pool.acquire();
  assert.ok(first);
  assert.ok(second);
  assert.equal(pool.availableCount, 0);
  assert.equal(pool.acquire(), null);

  const velocity = first.vel;
  const rotation = first.rotVel;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  first.mesh = mesh;
  first.vel.set(1, 2, 3);
  first.rotVel.set(4, 5, 6);
  first.life = 0.2;
  first.maxLife = 0.2;
  first.gravity = 2;
  first.hasGravity = true;
  first.baseScale = 0.08;
  first.hasRotation = true;

  assert.equal(pool.release(first), true);
  assert.equal(pool.release(first), false);
  assert.equal(pool.availableCount, 1);

  const reused = pool.acquire();
  assert.equal(reused, first);
  assert.equal(reused.vel, velocity);
  assert.equal(reused.rotVel, rotation);
  assert.equal(reused.mesh, null);
  assert.deepEqual(reused.vel.toArray(), [0, 0, 0]);
  assert.deepEqual(reused.rotVel.toArray(), [0, 0, 0]);
  assert.equal(reused.life, 0);
  assert.equal(reused.maxLife, 1);
  assert.equal(reused.gravity, 0);
  assert.equal(reused.hasGravity, false);
  assert.equal(reused.baseScale, 1);
  assert.equal(reused.hasRotation, false);

  mesh.geometry.dispose();
  mesh.material.dispose();
  pool.release(reused);
  pool.release(second);
  assert.equal(pool.availableCount, 2);
});

test('particle motion state pool validates capacity and rejects foreign entries', () => {
  assert.throws(() => new ParticleMotionStatePool(0), RangeError);
  assert.throws(() => new ParticleMotionStatePool(1.5), RangeError);

  const pool = new ParticleMotionStatePool(1);
  const foreign = {
    mesh: null,
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    gravity: 0,
    hasGravity: false,
    baseScale: 1,
    rotVel: new THREE.Vector3(),
    hasRotation: false,
  };
  assert.equal(pool.release(foreign), false);
  assert.equal(pool.availableCount, 1);
  assert.ok(pool.acquire());
  assert.equal(pool.availableCount, 0);
});
