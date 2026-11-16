import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURVIVAL_BIOME_ZONES,
  SURVIVAL_WORLD_BOUNDS,
  SURVIVAL_WORLD_TRANSITIONS,
  getSurvivalBiomeAtPosition,
  getSurvivalBiomeWeights,
} from '../src/survivalWorldLayout.ts';

test('four original biome chunks tile one bounded 240 by 80 metre Survival world', () => {
  assert.deepEqual(
    SURVIVAL_BIOME_ZONES.map((zone) => zone.mapId).sort(),
    ['container_terminal', 'cold_storage', 'night_sorting', 'warehouse_b4'],
  );
  assert.deepEqual(SURVIVAL_WORLD_BOUNDS, {
    minX: -119.5, maxX: 119.5, minZ: -39.5, maxZ: 39.5,
  });

  for (const zone of SURVIVAL_BIOME_ZONES) {
    assert.ok(zone.offsetX === -60 || zone.offsetX === 60);
    assert.ok(zone.offsetZ === -20 || zone.offsetZ === 20);
    assert.ok(zone.offsetX - 59.5 >= SURVIVAL_WORLD_BOUNDS.minX);
    assert.ok(zone.offsetX + 59.5 <= SURVIVAL_WORLD_BOUNDS.maxX);
    assert.ok(zone.offsetZ - 20 >= SURVIVAL_WORLD_BOUNDS.minZ);
    assert.ok(zone.offsetZ + 20 <= SURVIVAL_WORLD_BOUNDS.maxZ);
  }

  assert.equal(getSurvivalBiomeAtPosition(-60, -20), 'warehouse_b4');
  assert.equal(getSurvivalBiomeAtPosition(60, -20), 'container_terminal');
  assert.equal(getSurvivalBiomeAtPosition(-60, 20), 'cold_storage');
  assert.equal(getSurvivalBiomeAtPosition(60, 20), 'night_sorting');
});

test('each adjacent region edge has one defined transition and matched opening', () => {
  assert.deepEqual(
    SURVIVAL_WORLD_TRANSITIONS.map((transition) => transition.id).sort(),
    ['b4-to-cold', 'b4-to-port', 'cold-to-night', 'port-to-night'],
  );
  for (const transition of SURVIVAL_WORLD_TRANSITIONS) {
    assert.equal(transition.width, 18);
    assert.ok(transition.length >= 40);
  }

  const edges = (mapId) => SURVIVAL_BIOME_ZONES.find((zone) => zone.mapId === mapId)?.openEdges;
  for (const [mapId, edge] of [
    ['warehouse_b4', 'east'], ['warehouse_b4', 'south'],
    ['container_terminal', 'west'], ['container_terminal', 'south'],
    ['cold_storage', 'east'], ['cold_storage', 'north'],
    ['night_sorting', 'west'], ['night_sorting', 'north'],
  ]) {
    assert.ok(edges(mapId)?.includes(edge), mapId + ' is missing its ' + edge + ' passage');
  }
});

test('lighting weights remain normalized and smoothly blend to 25 percent per region at the hub', () => {
  for (const [x, z, expected] of [
    [-60, -20, 'warehouse_b4'],
    [60, -20, 'container_terminal'],
    [-60, 20, 'cold_storage'],
    [60, 20, 'night_sorting'],
  ]) {
    const weights = getSurvivalBiomeWeights(x, z);
    assert.equal(getSurvivalBiomeAtPosition(x, z), expected);
    assert.ok(Math.abs(Object.values(weights).reduce((sum, weight) => sum + weight, 0) - 1) < 1e-9);
    assert.ok(weights[expected] > 0.999);
  }
  const junction = getSurvivalBiomeWeights(0, 0);
  for (const weight of Object.values(junction)) assert.ok(Math.abs(weight - 0.25) < 1e-9);
});
