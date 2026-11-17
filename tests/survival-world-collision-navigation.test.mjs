import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('only the outer perimeter is walled; every internal biome edge is physically open', async () => {
  const game = await read('src/game.ts');
  assert.match(game, /private survivalObstacles: \{[^\n]+height\?: number/);
  assert.match(game, /if \(edgeIsOpen\) continue/);
  assert.match(game, /if \(edgeIsOpen\) continue;[\s\S]*?new THREE\.BoxGeometry\(119, 9\.5, 0\.48\)/);
  assert.match(game, /if \(!edgeIsOpen\) \{[\s\S]*?new THREE\.BoxGeometry\(0\.65, 9\.5, 40\)/);
  assert.doesNotMatch(game, /new THREE\.BoxGeometry\(42, 9\.5, 0\.48\)/);
  assert.doesNotMatch(game, /new THREE\.BoxGeometry\(0\.65, 9\.5, 7\)/);
  assert.match(game, /halfWidth: 59\.5, halfDepth: 0\.24, height: 9\.5/);
  assert.match(game, /halfWidth: 0\.325, halfDepth: 20, height: 9\.5/);
  assert.match(game, /if \(this\.playerPos\.y >= \(obstacle\.height \?\? 1\.0\)\) continue/);
  assert.match(game, /calculateEnemyObstacleAvoidanceVector\([\s\S]*?this\.survivalObstacles/);
});

test('enemy spawning uses the shared world bounds after internal partitions are removed', async () => {
  const [game, layout] = await Promise.all([
    read('src/game.ts'), read('src/survivalWorldLayout.ts')
  ]);
  assert.match(game, /const minX = this\.levelBounds\.minX \+ 2\.5/);
  assert.match(game, /const maxX = this\.levelBounds\.maxX - 2\.5/);
  assert.match(game, /const minZ = this\.levelBounds\.minZ \+ 1\.5/);
  assert.match(game, /const maxZ = this\.levelBounds\.maxZ - 1\.5/);
  assert.doesNotMatch(game, /getSurvivalWorldBiomeBounds\(this\.survivalMapId\)/);
  assert.match(layout, /export function getSurvivalWorldBiomeBounds/);
  assert.match(layout, /export function getSurvivalWorldBiomeIdAtPosition/);
});

test('enemies and Survival bosses steer directly through the continuous world', async () => {
  const game = await read('src/game.ts');
  assert.match(game, /const targetX = anchorX \+ Math\.sin\(angle\) \* preferredRadius/);
  assert.match(game, /const targetZ = anchorZ \+ Math\.cos\(angle\) \* preferredRadius/);
  assert.doesNotMatch(game, /portalWaypoint|bossPortalWaypoint|getSurvivalWorldWaypoint/);
  assert.match(game, /this\.gameMode === 'survival' \|\| distToPlayer < 14\.0/);
  assert.match(game, /this\.gameMode === 'survival' \|\| distToPlayer < 15\.0/);
  assert.match(game, /this\.survivalObstacles, 5\.4, 1\.25/);
  assert.match(game, /this\.survivalObstacles, 5\.8, 1\.35/);
});

test('Survival map textures are per-world clones of the global B4 texture cache', async () => {
  const game = await read('src/game.ts');
  assert.match(game, /floor: createPvpFloorTexture\(\)\.clone\(\)/);
  assert.match(game, /crate: createPvpObstacleTexture\('crate'\)\.clone\(\)/);
  assert.match(game, /barrier: createPvpObstacleTexture\('barrier'\)\.clone\(\)/);
  assert.match(game, /wall: createPvpObstacleTexture\('wall'\)\.clone\(\)/);
  assert.match(game, /options\.surfaceTextures\?\.floor \?\? createPvpFloorTexture\(\)\.clone\(\)/);
});


test('one world-space floor atlas spans all four biomes and the central four-way junction', async () => {
  const [game, atlas, layout] = await Promise.all([
    read('src/game.ts'), read('src/survivalFloorAtlas.ts'), read('src/survivalWorldLayout.ts')
  ]);
  assert.match(game, /createSurvivalFloorAtlasTexture\(/);
  assert.match(game, /surface\.name = 'survival-biome-floor-atlas'/);
  assert.match(game, /new THREE\.PlaneGeometry\(width, depth\)/);
  assert.match(game, /SURVIVAL_WORLD_BOUNDS\.maxX - SURVIVAL_WORLD_BOUNDS\.minX/);
  assert.match(atlas, /getSurvivalWorldBiomeBlendAtPosition\(safeX, safeZ\)/);
  assert.match(atlas, /blend\.weights\[mapId\]/);
  assert.match(atlas, /junction|four-way|four biome/i);
  assert.match(layout, /minX: -120, maxX: 120, minZ: -40, maxZ: 40/);
  assert.match(game, /floorGeometry = new THREE\.PlaneGeometry\(24, 40\)/);
  assert.match(game, /bayFloor\.position\.set\(side \* 48/);
  assert.match(game, /width: 24, height: 0\.2, depth: 40/);
  assert.doesNotMatch(game, /survival-biome-seam-/);
});

