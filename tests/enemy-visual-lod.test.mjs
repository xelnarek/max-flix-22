import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEnemyVisualLodProxy,
  getEnemyVisualLodPalette,
  getEnemyVisualLodThresholds,
  shouldUseEnemyVisualLodProxy,
  updateEnemyVisualLodProxy,
} from '../src/enemyVisualLod.ts';

test('mobile visual LOD uses a close restore threshold to prevent proxy flicker', () => {
  const thresholds = getEnemyVisualLodThresholds(true);
  assert.deepEqual(thresholds, { enterProxyDistance: 25, exitProxyDistance: 19 });
  assert.equal(shouldUseEnemyVisualLodProxy(24.9 ** 2, true, false, false), false);
  assert.equal(shouldUseEnemyVisualLodProxy(25 ** 2, true, false, false), true);
  assert.equal(shouldUseEnemyVisualLodProxy(20 ** 2, true, true, false), true);
  assert.equal(shouldUseEnemyVisualLodProxy(19 ** 2, true, true, false), true);
  assert.equal(shouldUseEnemyVisualLodProxy(18.9 ** 2, true, true, false), false);
});

test('desktop retains full rigs farther away than mobile', () => {
  const thresholds = getEnemyVisualLodThresholds(false);
  assert.deepEqual(thresholds, { enterProxyDistance: 34, exitProxyDistance: 26 });
  assert.equal(shouldUseEnemyVisualLodProxy(30 ** 2, false, false, false), false);
  assert.equal(shouldUseEnemyVisualLodProxy(34 ** 2, false, false, false), true);
});

test('combat-critical states always retain the full animated rig', () => {
  for (const distance of [0, 19 ** 2, 25 ** 2, 100 ** 2]) {
    assert.equal(shouldUseEnemyVisualLodProxy(distance, true, true, true), false);
  }
});

test('invalid distances fail closed to the full rig', () => {
  assert.equal(shouldUseEnemyVisualLodProxy(Number.NaN, true, false, false), false);
  assert.equal(shouldUseEnemyVisualLodProxy(-1, true, false, false), false);
});

test('all visual archetypes have an individual palette and the proxy is one shared-material mesh', () => {
  const types = [
    'customer', 'walczak', 'architect', 'inspector', 'handlowiec', 'monter',
    'elite_walczak_guard', 'kurier', 'przedstawiciel_włoski', 'sztaplar_szalony',
    'krol_leto', 'pan_roman', 'serwisant', 'bosman_krakow', 'zombie_pracownik',
    'sebix_m', 'mutant_gamma_forklift', 'radioactive_pip', 'cyber_salesman',
  ];
  for (const type of types) {
    const palette = getEnemyVisualLodPalette(type);
    assert.ok(palette.body !== palette.trim, type + ' should have contrast between body and trim');
    const root = createEnemyVisualLodProxy(type);
    assert.equal(root.visible, false);
    assert.equal(root.children.length, 1);
    const mesh = root.children[0];
    assert.equal(mesh.isMesh, true);
    assert.equal(mesh.userData.actorLodSharedGeometry, true);
    assert.equal(mesh.material.userData.actorLodSharedMaterial, true);
    assert.ok(mesh.geometry.getAttribute('color').count > 0);
    root.removeFromParent();
  }
});

test('distant silhouettes keep a small gait cue without changing entity physics', () => {
  const root = createEnemyVisualLodProxy('kurier');
  updateEnemyVisualLodProxy(root, 0.8, true);
  assert.ok(Number.isFinite(root.position.y));
  assert.ok(Number.isFinite(root.rotation.z));
  assert.notEqual(root.position.y, 0);
  updateEnemyVisualLodProxy(root, 0, false);
  assert.equal(root.position.y, 0);
  assert.equal(root.rotation.z, 0);
});
