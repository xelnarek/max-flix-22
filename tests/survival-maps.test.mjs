import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseRandomSurvivalMap,
  getSurvivalMapDefinition,
  getSurvivalSecretKeys,
  SURVIVAL_MAP_IDS,
} from '../src/survivalMaps.ts';

test('Survival has four distinct playable maps with five fixed secrets each', () => {
  assert.equal(SURVIVAL_MAP_IDS.length, 4);
  const names = new Set();
  const palettes = new Set();
  for (const mapId of SURVIVAL_MAP_IDS) {
    const map = getSurvivalMapDefinition(mapId);
    assert.equal(map.id, mapId);
    assert.ok(map.name.length > 3);
    assert.ok(map.subtitle.length > 3);
    assert.equal(map.secretLocations.length, 5);
    names.add(map.name);
    palettes.add([map.backgroundColor, map.floorColor, map.wallColor, map.accentColor].join(':'));
  }
  assert.equal(names.size, 4);
  assert.equal(palettes.size, 4, 'each arena must have its own visual color signature');
  assert.equal(getSurvivalSecretKeys().length, 20);
  assert.equal(new Set(getSurvivalSecretKeys()).size, 20);
});

test('random map selection excludes the immediately previous arena', () => {
  for (const previous of SURVIVAL_MAP_IDS) {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const next = chooseRandomSurvivalMap(previous, roll);
      assert.ok(SURVIVAL_MAP_IDS.includes(next));
      assert.notEqual(next, previous);
    }
  }
});

test('random map selection covers every arena and clamps invalid rolls safely', () => {
  const firstRun = SURVIVAL_MAP_IDS.map((_map, index) => chooseRandomSurvivalMap(null, index / 4));
  assert.deepEqual(new Set(firstRun), new Set(SURVIVAL_MAP_IDS));
  assert.equal(chooseRandomSurvivalMap('warehouse_b4', Number.NaN), 'cold_storage');
  assert.equal(chooseRandomSurvivalMap('cold_storage', -10), 'warehouse_b4');
  assert.equal(chooseRandomSurvivalMap(null, 10), 'night_sorting');
});

test('map definitions provide bounded and distinct hidden secret positions', () => {
  for (const mapId of SURVIVAL_MAP_IDS) {
    const map = getSurvivalMapDefinition(mapId);
    const positions = new Set();
    for (const secret of map.secretLocations) {
      assert.ok(secret.x >= -58 && secret.x <= 58);
      assert.ok(secret.z >= -18.2 && secret.z <= 18.2);
      positions.add(secret.x + ':' + secret.z);
    }
    assert.equal(positions.size, 5);
  }
});


test('every map includes the Alice-inspired Oniric Dream rabbit-hole invitation', () => {
  for (const mapId of SURVIVAL_MAP_IDS) {
    const dream = getSurvivalMapDefinition(mapId).secretLocations.find((secret) => secret.id === 'oniric_dream');
    assert.ok(dream, 'missing Oniric Dream on ' + mapId);
    assert.equal(dream.name, 'Oniryczny sen');
    assert.equal(dream.style, 'rabbit_hole');
  }
});


test('every Survival map includes a separate Necronomicon boss secret', () => {
  for (const mapId of SURVIVAL_MAP_IDS) {
    const secret = getSurvivalMapDefinition(mapId).secretLocations.find((entry) => entry.id === 'necronomicon');
    assert.ok(secret, 'missing Necronomicon on ' + mapId);
    assert.equal(secret.name, 'Necronomicon');
    assert.equal(secret.style, 'necronomicon');
  }
});

test('every arena contains the same five collectible secret families', () => {
  const expected = new Set(['wz', 'cassette', 'capybara', 'rabbit_hole', 'necronomicon']);
  for (const mapId of SURVIVAL_MAP_IDS) {
    const secrets = getSurvivalMapDefinition(mapId).secretLocations;
    assert.equal(secrets.length, 5);
    assert.deepEqual(new Set(secrets.map((secret) => secret.style)), expected);
  }
});
