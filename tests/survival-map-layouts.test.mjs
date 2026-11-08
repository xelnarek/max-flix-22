import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalMapRouteFeatures, SURVIVAL_MAP_LAYOUTS } from '../src/survivalMapLayouts.ts';

test('each Survival arena has a distinct, non-empty physical route layout', () => {
  const signatures = new Set();
  for (const [mapId, features] of Object.entries(SURVIVAL_MAP_LAYOUTS)) {
    assert.equal(features.length, 4, mapId + ' should have four route features');
    signatures.add(features.map((feature) => feature.kind + ':' + feature.x + ':' + feature.z).join('|'));
    const ids = new Set();
    for (const feature of features) {
      assert.ok(feature.id.length > 2);
      assert.ok(!ids.has(feature.id), 'duplicate feature id in ' + mapId);
      ids.add(feature.id);
      assert.ok(feature.x - feature.width / 2 >= -58);
      assert.ok(feature.x + feature.width / 2 <= 58);
      assert.ok(feature.z - feature.depth / 2 >= -18.2);
      assert.ok(feature.z + feature.depth / 2 <= 18.2);
      assert.ok(feature.height > 0 && feature.height <= 3);
      assert.ok(feature.accent > 0);
    }
  }
  assert.equal(signatures.size, 4, 'maps must not reuse the same route pattern');
});

test('unknown map ids fall back safely to the B4 layout', () => {
  assert.deepEqual(getSurvivalMapRouteFeatures('unknown'), getSurvivalMapRouteFeatures('warehouse_b4'));
});


test('all Survival map feature families render physical, map-specific industrial detail', async () => {
  const game = await (await import('node:fs/promises')).readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  for (const feature of [
    "feature.kind === 'pallet_stack'",
    'cargoStraps',
    'deckBoards',
    "feature.kind === 'container_stack'",
    'const ribs = new THREE.InstancedMesh',
    "feature.kind === 'cold_compressor'",
    'fanRing',
    'ventSlats',
    "feature.kind === 'sorter_belt'",
    'statusLamp',
  ]) {
    assert.ok(game.includes(feature), 'missing map detail: ' + feature);
  }
  // Visual upgrades must not silently change collision sizing.
  assert.match(game, /halfWidth: feature\.width \* 0\.56/);
  assert.match(game, /halfDepth: feature\.depth \* 0\.56/);
});
