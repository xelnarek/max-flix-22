import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('all four real boundary walls have matching full-height player and AI footprints', async () => {
  const game = await read('src/game.ts');
  assert.match(game, /private survivalObstacles: \{[^\n]+height\?: number/);
  assert.match(game, /halfWidth: 21, halfDepth: 0\.24, height: 9\.5/);
  assert.match(game, /halfWidth: 59\.5, halfDepth: 0\.24, height: 9\.5/);
  assert.match(game, /halfWidth: 0\.325, halfDepth: 3\.5, height: 9\.5/);
  assert.match(game, /halfWidth: 0\.325, halfDepth: 20, height: 9\.5/);
  assert.match(game, /if \(this\.playerPos\.y >= \(obstacle\.height \?\? 1\.0\)\) continue/);
  assert.match(game, /calculateEnemyObstacleAvoidanceVector\([\s\S]*?this\.survivalObstacles/);
});

test('enemy spawning stays inside the currently reachable biome instead of crossing sealed walls', async () => {
  const [game, layout] = await Promise.all([
    read('src/game.ts'), read('src/survivalWorldLayout.ts')
  ]);
  assert.match(game, /const biomeBounds = getSurvivalWorldBiomeBounds\(this\.survivalMapId\)/);
  assert.match(game, /const minX = Math\.max\(this\.levelBounds\.minX \+ 2\.5, biomeBounds\.minX \+ 2\.5\)/);
  assert.match(game, /const minZ = Math\.max\(this\.levelBounds\.minZ \+ 1\.5, biomeBounds\.minZ \+ 1\.5\)/);
  assert.match(layout, /export function getSurvivalWorldBiomeBounds/);
  assert.match(layout, /export function getSurvivalWorldBiomeIdAtPosition/);
});

test('pursuing enemies follow the shortest open portal route into the player biome', async () => {
  const [game, layout] = await Promise.all([
    read('src/game.ts'), read('src/survivalWorldLayout.ts')
  ]);
  assert.match(game, /const enemyBiomeId = getSurvivalWorldBiomeIdAtPosition\(enemy\.x, enemy\.z, this\.survivalMapId\)/);
  assert.match(game, /const portalWaypoint = !inHordeRing && enemyBiomeId !== this\.survivalMapId/);
  assert.match(game, /getSurvivalWorldWaypoint\(enemyBiomeId, this\.survivalMapId\)/);
  assert.match(game, /if \(!portalWaypoint && steerLength < 0\.72 && engaged\)/);
  assert.equal((game.match(/const bossPortalWaypoint = this\.gameMode === 'survival'/g) || []).length, 2);
  assert.match(game, /e, bossPortalWaypoint, this\.survivalObstacles/);
  assert.match(layout, /export function getSurvivalWorldRoute/);
  assert.match(layout, /export function getSurvivalWorldWaypoint/);
});

test('Survival map textures are per-world clones of the global B4 texture cache', async () => {
  const game = await read('src/game.ts');
  assert.match(game, /floor: createPvpFloorTexture\(\)\.clone\(\)/);
  assert.match(game, /crate: createPvpObstacleTexture\('crate'\)\.clone\(\)/);
  assert.match(game, /barrier: createPvpObstacleTexture\('barrier'\)\.clone\(\)/);
  assert.match(game, /wall: createPvpObstacleTexture\('wall'\)\.clone\(\)/);
  assert.match(game, /options\.surfaceTextures\?\.floor \?\? createPvpFloorTexture\(\)\.clone\(\)/);
});
