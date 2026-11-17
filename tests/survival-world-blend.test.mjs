import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalWorldBiomeBlendAtPosition } from '../src/survivalWorldBlend.ts';
import { applySurvivalWorldCombatModifier } from '../src/survivalMaps.ts';
import { getSurvivalWorldBackgroundColor, getSurvivalWorldFloorColor, getSurvivalWorldLightingProfile, getSurvivalSurfaceProfile } from '../src/worldVisualQuality.ts';
import { SURVIVAL_WORLD_TRANSITIONS, getSurvivalWorldTransitionFootprint } from '../src/survivalWorldLayout.ts';

const closeTo = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);

test('outside transition bands each biome has a pure weight', () => {
  const cases = [[-80, -30, 'warehouse_b4'], [80, -30, 'container_terminal'], [80, 30, 'cold_storage'], [-80, 30, 'night_sorting']];
  for (const [x, z, expected] of cases) {
    const blend = getSurvivalWorldBiomeBlendAtPosition(x, z);
    assert.equal(blend.dominantBiomeId, expected);
    assert.equal(blend.weights[expected], 1);
    assert.equal(blend.blendAmount, 0);
    assert.equal(blend.boundaryKind, 'interior');
  }
});

test('a vertical seam blends west/east profiles smoothly and symmetrically', () => {
  const west = getSurvivalWorldBiomeBlendAtPosition(-5.5, -30);
  const middle = getSurvivalWorldBiomeBlendAtPosition(0, -30);
  const east = getSurvivalWorldBiomeBlendAtPosition(5.5, -30);
  closeTo(west.weights.warehouse_b4, east.weights.container_terminal);
  closeTo(west.weights.container_terminal, east.weights.warehouse_b4);
  closeTo(middle.weights.warehouse_b4, 0.5);
  closeTo(middle.weights.container_terminal, 0.5);
  closeTo(middle.blendAmount, 0.5);
  assert.equal(middle.boundaryKind, 'x-seam');
  closeTo(middle.xBoundaryInfluence, 1);
});

test('a horizontal seam blends north/south profiles and the central junction blends all four', () => {
  const horizontal = getSurvivalWorldBiomeBlendAtPosition(-30, 0);
  closeTo(horizontal.weights.warehouse_b4, 0.5);
  closeTo(horizontal.weights.night_sorting, 0.5);
  assert.equal(horizontal.boundaryKind, 'z-seam');
  const junction = getSurvivalWorldBiomeBlendAtPosition(0, 0);
  for (const id of ['warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting']) closeTo(junction.weights[id], 0.25);
  closeTo(junction.blendAmount, 0.75);
  closeTo(junction.junctionInfluence, 1);
  assert.equal(junction.boundaryKind, 'four-way');
});

test('the blend remains normalized and finite for invalid coordinates', () => {
  for (const [x, z] of [[Infinity, 0], [0, Number.NaN], [Number.NaN, Number.NaN]]) {
    const blend = getSurvivalWorldBiomeBlendAtPosition(x, z);
    const values = Object.values(blend.weights);
    assert.ok(values.every((value) => Number.isFinite(value) && value >= 0));
    closeTo(values.reduce((sum, value) => sum + value, 0), 1);
  }
});

test('world combat modifiers are weighted at two-way and four-way biome overlaps', () => {
  const twoWay = applySurvivalWorldCombatModifier({ maxHp: 100, speed: 10 }, 0, -30);
  assert.equal(twoWay.maxHp, 97);
  closeTo(twoWay.speed, 10.4);
  closeTo(twoWay.xpMultiplier, 1.06);
  const fourWay = applySurvivalWorldCombatModifier({ maxHp: 100, speed: 10 }, 0, 0);
  assert.equal(fourWay.maxHp, 101);
  closeTo(fourWay.speed, 10.05);
  closeTo(fourWay.xpMultiplier, 1.0975);
});

test('lighting, fog and background use the same spatial blend as biome geometry', () => {
  const junction = getSurvivalWorldBiomeBlendAtPosition(0, 0);
  const profile = getSurvivalWorldLightingProfile(junction.weights);
  const background = getSurvivalWorldBackgroundColor(junction.weights);
  assert.ok(profile.fogNear > 0 && profile.fogFar > profile.fogNear);
  assert.ok(profile.ambientIntensity > 0);
  assert.ok(Number.isInteger(profile.fogColor));
  assert.ok(Number.isInteger(background));
  const b4 = getSurvivalWorldBiomeBlendAtPosition(-40, -30);
  const pureB4 = getSurvivalWorldLightingProfile(b4.weights);
  const referenceB4 = getSurvivalWorldLightingProfile({ warehouse_b4: 1, container_terminal: 0, cold_storage: 0, night_sorting: 0 });
  assert.equal(pureB4.fogColor, referenceB4.fogColor);
});

test('shared biome seam metadata retains the same 22 m overlap width as the spatial blend field', () => {
  assert.deepEqual(SURVIVAL_WORLD_TRANSITIONS.map(getSurvivalWorldTransitionFootprint), [
    { bandWidth: 22, bandDepth: 40 },
    { bandWidth: 120, bandDepth: 22 },
    { bandWidth: 22, bandDepth: 40 },
    { bandWidth: 120, bandDepth: 22 },
  ]);
});


test('floor albedo remains muted and each biome keeps a restrained material response', () => {
  const pureB4 = getSurvivalWorldFloorColor({ warehouse_b4: 1, container_terminal: 0, cold_storage: 0, night_sorting: 0 });
  const pureCold = getSurvivalWorldFloorColor({ warehouse_b4: 0, container_terminal: 0, cold_storage: 1, night_sorting: 0 });
  const junction = getSurvivalWorldFloorColor(getSurvivalWorldBiomeBlendAtPosition(0, 0).weights);
  assert.notEqual(pureB4, 0xffffff);
  assert.notEqual(pureCold, 0xc5f0ff);
  assert.notEqual(pureB4, pureCold);
  assert.ok(((pureB4 >> 16) & 255) < 150);
  assert.ok(((junction >> 16) & 255) < 150);
  for (const id of ['warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting']) {
    const surface = getSurvivalSurfaceProfile(id);
    assert.ok(surface.floorRoughness >= 0.84);
    assert.ok(surface.floorMetalness <= 0.06);
  }
});

test('the connected floor atlas uses weighted alpha and low-contrast surface detail', async () => {
  const atlas = await (await import('node:fs/promises')).readFile(new URL('../src/survivalFloorAtlas.ts', import.meta.url), 'utf8');
  const game = await (await import('node:fs/promises')).readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(atlas, /context\.createImageData\(safeWidth, safeHeight\)/);
  assert.match(atlas, /image\.data\[offset \+ 3\] = Math\.round\(sample\.alpha \* 255\)/);
  assert.match(atlas, /getSurvivalWorldBiomeBlendAtPosition\(safeX, safeZ\)/);
  assert.match(atlas, /const jointShade =/);
  assert.match(atlas, /const aggregate =/);
  assert.match(atlas, /const frostLine =/);
  assert.match(atlas, /const grooveShade =/);
  assert.match(game, /roughness: 0\.97/);
  assert.match(game, /depthWrite: false/);
  assert.doesNotMatch(game, /survival-biome-gateway-posts|survival-biome-gateway-beams/);
});
