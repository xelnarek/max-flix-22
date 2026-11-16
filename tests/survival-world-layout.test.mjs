import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalBiomeIdAtPosition, getSurvivalWorldBiome,
  SURVIVAL_WORLD_BIOMES, SURVIVAL_WORLD_BOUNDS, SURVIVAL_WORLD_DEPTH,
  SURVIVAL_WORLD_TRANSITIONS, SURVIVAL_WORLD_WIDTH,
} from '../src/survivalWorldLayout.ts';

test('four 120 x 40 m arenas tile one 240 x 80 m world', () => {
  assert.equal(SURVIVAL_WORLD_BIOMES.length, 4);
  assert.equal(SURVIVAL_WORLD_WIDTH, 240);
  assert.equal(SURVIVAL_WORLD_DEPTH, 80);
  assert.deepEqual(SURVIVAL_WORLD_BOUNDS, { minX: -120, maxX: 120, minZ: -40, maxZ: 40 });
  assert.deepEqual(SURVIVAL_WORLD_BIOMES.map((biome) => [biome.id, biome.centerX, biome.centerZ]), [
    ['warehouse_b4', -60, -20], ['container_terminal', 60, -20],
    ['cold_storage', 60, 20], ['night_sorting', -60, 20],
  ]);
  for (const biome of SURVIVAL_WORLD_BIOMES) assert.equal(getSurvivalWorldBiome(biome.id).id, biome.id);
});

test('all four portals connect reciprocal open edges and keep their intended widths', () => {
  const edges = (id) => getSurvivalWorldBiome(id).openEdges;
  assert.equal(SURVIVAL_WORLD_TRANSITIONS.length, 4);
  assert.equal(edges('warehouse_b4').east && edges('container_terminal').west, true);
  assert.equal(edges('container_terminal').south && edges('cold_storage').north, true);
  assert.equal(edges('cold_storage').west && edges('night_sorting').east, true);
  assert.equal(edges('night_sorting').north && edges('warehouse_b4').south, true);
  assert.deepEqual(SURVIVAL_WORLD_TRANSITIONS.map((portal) => portal.openingWidth), [26, 36, 26, 36]);
});

test('biome changes are based on global coordinates with stable doorway hysteresis', () => {
  assert.equal(getSurvivalBiomeIdAtPosition(-60, -20), 'warehouse_b4');
  assert.equal(getSurvivalBiomeIdAtPosition(60, -20), 'container_terminal');
  assert.equal(getSurvivalBiomeIdAtPosition(60, 20), 'cold_storage');
  assert.equal(getSurvivalBiomeIdAtPosition(-60, 20), 'night_sorting');
  assert.equal(getSurvivalBiomeIdAtPosition(1.5, -20, 'warehouse_b4'), 'warehouse_b4');
  assert.equal(getSurvivalBiomeIdAtPosition(5, -20, 'warehouse_b4'), 'container_terminal');
  assert.equal(getSurvivalBiomeIdAtPosition(-1.5, -20, 'container_terminal'), 'container_terminal');
  assert.equal(getSurvivalBiomeIdAtPosition(-5, -20, 'container_terminal'), 'warehouse_b4');
  assert.equal(getSurvivalBiomeIdAtPosition(-60, 1.5, 'warehouse_b4'), 'warehouse_b4');
  assert.equal(getSurvivalBiomeIdAtPosition(-60, 5, 'warehouse_b4'), 'night_sorting');
  assert.equal(getSurvivalBiomeIdAtPosition(60, -1.5, 'cold_storage'), 'cold_storage');
  assert.equal(getSurvivalBiomeIdAtPosition(60, -5, 'cold_storage'), 'container_terminal');
  assert.equal(getSurvivalBiomeIdAtPosition(Number.NaN, 0, 'cold_storage'), 'cold_storage');
});
