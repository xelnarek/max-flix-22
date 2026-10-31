import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ParticleMeshPool } from '../src/particlePool.ts';

test('particle meshes are reused without exceeding the configured cap', () => {
  const pool = new ParticleMeshPool(2);

  try {
    const first = pool.acquire('tetrahedron', 0xff2200, 0.5, 0.9);
    const second = pool.acquire('sphere', 0x22cc88, 0.08, 0.8);

    assert.ok(first instanceof THREE.Mesh);
    assert.ok(second instanceof THREE.Mesh);
    assert.equal(pool.allocatedCount, 2);
    assert.equal(pool.availableCount, 0);
    assert.equal(pool.acquire('box', 0xffffff), null);

    first!.position.set(4, 5, 6);
    pool.release(first!);
    pool.release(first!);

    assert.equal(first!.parent, null);
    assert.equal(first!.visible, false);
    assert.equal(pool.availableCount, 1);

    const reused = pool.acquire('octahedron', 0x00ff44, 1.75, 0.72);
    assert.equal(reused, first);
    assert.equal(reused!.geometry.type, 'OctahedronGeometry');
    assert.equal((reused!.material as THREE.MeshBasicMaterial).color.getHex(), 0x00ff44);
    assert.equal((reused!.material as THREE.MeshBasicMaterial).opacity, 0.72);
    assert.equal(reused!.scale.x, 1.75);
    assert.equal(pool.allocatedCount, 2);

    pool.release(reused!);
    pool.release(second!);
    assert.equal(pool.availableCount, 2);
  } finally {
    pool.dispose();
  }
});

test('disposed particle pools stop handing out meshes', () => {
  const pool = new ParticleMeshPool(1);
  const mesh = pool.acquire('box', 0xffffff);
  assert.ok(mesh);
  pool.dispose();
  pool.dispose();

  assert.equal(pool.allocatedCount, 0);
  assert.equal(pool.availableCount, 0);
  assert.equal(pool.acquire('sphere', 0xffffff), null);
});
