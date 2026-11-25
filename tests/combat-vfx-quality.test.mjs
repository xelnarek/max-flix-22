import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { CombatFlashLightPool, isSoftwareWebGLRenderer } from '../src/combatVfx.ts';
import { ParticleMeshPool } from '../src/particlePool.ts';
import { ProjectileTracerPool, getFirearmTracerStyle } from '../src/projectileTracerPool.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('CombatFlashLightPool preallocates bounded lights, decays smoothly, and respects adaptiveTier >= 2', () => {
  const pool = new CombatFlashLightPool(3);
  assert.equal(pool.group.children.length, 3);
  assert.equal(pool.activeCount, 0);

  // Tier 2 suppresses dynamic point lights to preserve framerate
  assert.equal(pool.flash(0, 1, 0, 0xfbbf24, 6, 8, 0.1, 2), false);
  assert.equal(pool.activeCount, 0);

  // Normal flashes fill the pool without growing group children
  assert.equal(pool.flash(1, 1, 2, 0x38bdf8, 8, 9, 0.2, 0), true);
  assert.equal(pool.flash(2, 1, 3, 0xf97316, 12, 10, 0.2, 0), true);
  assert.equal(pool.flash(3, 1, 4, 0xef4444, 15, 11, 0.2, 0), true);
  assert.equal(pool.activeCount, 3);
  assert.equal(pool.group.children.length, 3);

  // Exceeding pool capacity reuses the lowest-intensity slot without allocating
  assert.equal(pool.flash(4, 1, 5, 0x22d3ee, 18, 12, 0.2, 0), true);
  assert.equal(pool.group.children.length, 3);
  assert.equal(pool.activeCount, 3);

  // Decay over duration expires all active lights cleanly
  pool.update(0.1);
  assert.equal(pool.activeCount, 3);
  pool.update(0.15);
  assert.equal(pool.activeCount, 0);

  pool.flash(0, 1, 0, 0xffffff, 5, 6, 0.2, 0);
  assert.equal(pool.activeCount, 1);
  pool.clear();
  assert.equal(pool.activeCount, 0);

  pool.dispose();
  assert.equal(pool.flash(0, 1, 0, 0xffffff, 5, 6, 0.2, 0), false);
});

test('ParticleMeshPool toggles additive bloomEmitter mode and resets on release', () => {
  const pool = new ParticleMeshPool(4);
  const glow = pool.acquire('octahedron', 0x38bdf8, 0.2, 0.9, true);
  assert.ok(glow);
  const glowMat = glow.material;
  assert.equal(glowMat.blending, THREE.AdditiveBlending);
  assert.equal(glowMat.userData.bloomEmitter, true);

  pool.release(glow);
  assert.equal(glowMat.userData.bloomEmitter, false);

  const matte = pool.acquire('box', 0x94a3b8, 0.2, 0.9, false);
  assert.ok(matte);
  const matteMat = matte.material;
  assert.equal(matteMat.blending, THREE.NormalBlending);
  assert.equal(matteMat.userData.bloomEmitter, false);

  pool.dispose();
});

test('ProjectileTracerPool tags tracer outer and inner layers for selective bloom', () => {
  const parent = new THREE.Group();
  const pool = new ProjectileTracerPool(2);
  pool.emitSegment(parent, 0, 1, 0, 0, 1, 3, getFirearmTracerStyle('plasma', 0x38bdf8));
  assert.equal(parent.children.length, 1);
  const group = parent.children[0];
  const outer = group.children[0];
  const inner = group.children[1];
  assert.equal(outer.material.userData.bloomEmitter, true);
  assert.equal(inner.material.userData.bloomEmitter, true);
  assert.equal(outer.material.toneMapped, false);
  assert.equal(inner.material.toneMapped, false);
  pool.dispose();
});

test('isSoftwareWebGLRenderer flags SwiftShader/llvmpipe and ignores hardware GPUs', () => {
  const makeMockRenderer = (rendererName) => ({
    getContext: () => ({
      RENDERER: 0x1f01,
      getExtension: () => null,
      getParameter: () => rendererName,
    }),
  });
  assert.equal(isSoftwareWebGLRenderer(makeMockRenderer('Google SwiftShader')), true);
  assert.equal(isSoftwareWebGLRenderer(makeMockRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')), true);
  assert.equal(isSoftwareWebGLRenderer(makeMockRenderer('ANGLE (NVIDIA GeForce RTX 4080)')), false);
});

test('GameEngine, SelectiveBloomPipeline, warehouse lamps, and title screen wire graphics & VFX upgrades cleanly', async () => {
  const [game, index, bloom, warehouse] = await Promise.all([
    read('../src/game.ts'),
    read('../src/index.ts'),
    read('../src/selectiveBloom.ts'),
    read('../src/warehouseAssets.ts'),
  ]);

  assert.match(bloom, /bloomEmitter === true/);
  assert.match(game, /private readonly combatFlashLights = new CombatFlashLightPool\(3\)/);
  assert.match(game, /private spawnExplosionCompositeFx\(/);
  assert.match(game, /getMuzzleStarTexture\(\)/);
  assert.match(game, /getShockwaveRingTexture\(\)/);
  assert.match(game, /getScorchMarkTexture\(\)/);
  assert.match(game, /hitEmissiveOriginals/);
  assert.match(game, /survival-ceiling-floor-halo-/);
  assert.match(game, /this\.isHandheldViewport \? 1024 : 2048/);
  assert.match(index, /getSoftGlowTexture\(\)/);
  assert.match(index, /!isSoftwareGpu/);
  assert.match(warehouse, /bloomEmitter = true/);
});
