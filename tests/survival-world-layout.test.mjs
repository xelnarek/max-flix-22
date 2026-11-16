import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalBiomeIdAtPosition, getSurvivalWorldBiome, getSurvivalWorldBiomeBounds,
  getSurvivalWorldBiomeIdAtPosition, getSurvivalWorldRoute, getSurvivalWorldWaypoint,
  getSurvivalWorldTransitionFootprint, isSurvivalWorldTransitionFromNegativeSide,
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
  assert.deepEqual(SURVIVAL_WORLD_TRANSITIONS.map((portal) => portal.markerSpan), [26, 36, 26, 36]);
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


test('each biome has exact global bounds and strict actor-quadrant classification', () => {
  assert.deepEqual(getSurvivalWorldBiomeBounds('warehouse_b4'), {
    minX: -120, maxX: 0, minZ: -40, maxZ: 0,
  });
  assert.deepEqual(getSurvivalWorldBiomeBounds('container_terminal'), {
    minX: 0, maxX: 120, minZ: -40, maxZ: 0,
  });
  assert.deepEqual(getSurvivalWorldBiomeBounds('cold_storage'), {
    minX: 0, maxX: 120, minZ: 0, maxZ: 40,
  });
  assert.deepEqual(getSurvivalWorldBiomeBounds('night_sorting'), {
    minX: -120, maxX: 0, minZ: 0, maxZ: 40,
  });
  assert.equal(getSurvivalWorldBiomeIdAtPosition(-5, -5), 'warehouse_b4');
  assert.equal(getSurvivalWorldBiomeIdAtPosition(5, -5), 'container_terminal');
  assert.equal(getSurvivalWorldBiomeIdAtPosition(5, 5), 'cold_storage');
  assert.equal(getSurvivalWorldBiomeIdAtPosition(-5, 5), 'night_sorting');
  assert.equal(getSurvivalWorldBiomeIdAtPosition(Number.NaN, 0, 'cold_storage'), 'cold_storage');
});

test('shortest routes use open portal pairs and every leg has an interior waypoint', () => {
  const route = getSurvivalWorldRoute('warehouse_b4', 'cold_storage');
  assert.equal(route.length, 2);
  assert.deepEqual(route.map((step) => [step.from, step.to]), [
    ['warehouse_b4', 'container_terminal'],
    ['container_terminal', 'cold_storage'],
  ]);
  assert.deepEqual(getSurvivalWorldRoute('cold_storage', 'warehouse_b4').map((step) => [step.from, step.to]), [
    ['cold_storage', 'container_terminal'],
    ['container_terminal', 'warehouse_b4'],
  ]);
  assert.deepEqual(getSurvivalWorldWaypoint('warehouse_b4', 'container_terminal'), { x: 7, z: -20 });
  assert.deepEqual(getSurvivalWorldWaypoint('container_terminal', 'warehouse_b4'), { x: -7, z: -20 });
  assert.deepEqual(getSurvivalWorldWaypoint('container_terminal', 'cold_storage'), { x: 60, z: 7 });
  assert.deepEqual(getSurvivalWorldWaypoint('cold_storage', 'container_terminal'), { x: 60, z: -7 });
  assert.deepEqual(getSurvivalWorldWaypoint('cold_storage', 'night_sorting'), { x: -7, z: 20 });
  assert.deepEqual(getSurvivalWorldWaypoint('night_sorting', 'cold_storage'), { x: 7, z: 20 });
  assert.deepEqual(getSurvivalWorldWaypoint('night_sorting', 'warehouse_b4'), { x: -60, z: -7 });
  assert.deepEqual(getSurvivalWorldWaypoint('warehouse_b4', 'night_sorting'), { x: -60, z: 7 });
  assert.equal(getSurvivalWorldWaypoint('warehouse_b4', 'warehouse_b4'), null);
  assert.equal(getSurvivalWorldRoute('warehouse_b4', 'warehouse_b4').length, 0);
});

test('route cache returns connected legs for every pair of distinct sectors', () => {
  for (const from of SURVIVAL_WORLD_BIOMES) {
    for (const to of SURVIVAL_WORLD_BIOMES) {
      if (from.id === to.id) continue;
      const route = getSurvivalWorldRoute(from.id, to.id);
      assert.ok(route.length >= 1 && route.length <= 2);
      assert.equal(route[0].from, from.id);
      assert.equal(route.at(-1).to, to.id);
      for (let index = 1; index < route.length; index++) {
        assert.equal(route[index - 1].to, route[index].from);
      }
      assert.ok(getSurvivalWorldWaypoint(from.id, to.id));
    }
  }
});


test('biome blends cover the full shared edge and use the correct source-side orientation', () => {
  const footprints = SURVIVAL_WORLD_TRANSITIONS.map(getSurvivalWorldTransitionFootprint);
  assert.deepEqual(footprints, [
    { bandWidth: 22, bandDepth: 40, seamWidth: 1.25, seamDepth: 40 },
    { bandWidth: 120, bandDepth: 22, seamWidth: 120, seamDepth: 1.25 },
    { bandWidth: 22, bandDepth: 40, seamWidth: 1.25, seamDepth: 40 },
    { bandWidth: 120, bandDepth: 22, seamWidth: 120, seamDepth: 1.25 },
  ]);
  assert.deepEqual(SURVIVAL_WORLD_TRANSITIONS.map(isSurvivalWorldTransitionFromNegativeSide), [true, true, false, false]);
});

test('enemy portal waypoints preserve the current lane across a fully open shared edge', () => {
  assert.deepEqual(getSurvivalWorldWaypoint('warehouse_b4', 'container_terminal', undefined, { x: -24, z: -34 }), { x: 7, z: -34 });
  assert.deepEqual(getSurvivalWorldWaypoint('container_terminal', 'cold_storage', undefined, { x: 111, z: -8 }), { x: 111, z: 7 });
  assert.deepEqual(getSurvivalWorldWaypoint('cold_storage', 'night_sorting', undefined, { x: 12, z: 34 }), { x: -7, z: 34 });
  assert.deepEqual(getSurvivalWorldWaypoint('night_sorting', 'warehouse_b4', undefined, { x: -111, z: 8 }), { x: -111, z: -7 });
  assert.deepEqual(getSurvivalWorldWaypoint('warehouse_b4', 'container_terminal', undefined, { x: -24, z: -99 }), { x: 7, z: -38 });
});
