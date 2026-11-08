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

test('pallet cargo body is raised to expose its physical pallet deck detail', async () => {
  const game = await (await import('node:fs/promises')).readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /const bodyBaseY = feature\.kind === 'pallet_stack' \? 0\.26 : 0/);
  assert.match(game, /new THREE\.BoxGeometry\(feature\.width, bodyHeight, feature\.depth\)/);
  assert.match(game, /palletBase\.position\.y = 0\.075/);
  assert.match(game, /deckBoards\.instanceMatrix\.needsUpdate = true/);
});


test('map cover footprints do not overlap one another or block the central start lane', () => {
  for (const [mapId, features] of Object.entries(SURVIVAL_MAP_LAYOUTS)) {
    for (const feature of features) {
      const left = feature.x - feature.width * 0.56;
      const right = feature.x + feature.width * 0.56;
      const near = feature.z - feature.depth * 0.56;
      const far = feature.z + feature.depth * 0.56;
      assert.ok(right <= -5 || left >= 5 || far <= -5 || near >= 5,
        mapId + ' blocks the central start lane: ' + feature.id);
    }
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const a = features[i], b = features[j];
        const overlapX = Math.min(a.x + a.width * 0.56, b.x + b.width * 0.56)
          - Math.max(a.x - a.width * 0.56, b.x - b.width * 0.56);
        const overlapZ = Math.min(a.z + a.depth * 0.56, b.z + b.depth * 0.56)
          - Math.max(a.z - a.depth * 0.56, b.z - b.depth * 0.56);
        assert.ok(overlapX <= 0 || overlapZ <= 0,
          mapId + ' has overlapping collision footprints: ' + a.id + ' / ' + b.id);
      }
    }
  }
});
