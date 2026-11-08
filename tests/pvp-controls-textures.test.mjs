import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('PvP arena uses generated floor and obstacle surface maps rather than flat placeholder colors', async () => {
  const [game, textures] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpTextures.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /createPvpFloorTexture\(\)/);
  assert.match(game, /createPvpObstacleTexture\('crate'\)/);
  assert.match(game, /createPvpObstacleTexture\('barrier'\)/);
  assert.match(textures, /THREE\.CanvasTexture/);
  assert.match(textures, /THREE\.RepeatWrapping/);
  assert.match(textures, /THREE\.SRGBColorSpace/);
});

test('PvP right-hand aim control is a floating drag pad with a separate one-shot fire button', async () => {
  const [app, html] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /aimStartX = event\.clientX/);
  assert.match(app, /aimStartY = event\.clientY/);
  assert.match(app, /aimBase\.style\.left = ''/);
  assert.match(app, /bindPvpTap\(pvpFireButton/);
  assert.match(html, /CELUJ • PRZYTRZYMAJ I PRZESUŃ/);
  assert.match(html, /id="btn-pvp-fire"/);
});


test('Survival reuses the PvP floor, crate, barrier, wall and footprint assets', async () => {
  const [game, textures] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpTextures.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /const floorTexture = createPvpFloorTexture\(\)/);
  assert.match(game, /const crateTexture = createPvpObstacleTexture\('crate'\)/);
  assert.match(game, /const barrierTexture = createPvpObstacleTexture\('barrier'\)/);
  assert.match(game, /const wallTexture = createPvpObstacleTexture\('wall'\)/);
  assert.match(game, /addSurvivalFootprint\(group, 2\.9, 1\.95\)/);
  assert.match(game, /addSurvivalFootprint\(barricade, 2\.45, 1\.25\)/);
  assert.match(game, /this\.survivalArenaInstanceTextures\.add\(texture\)/);
  assert.match(game, /this\.survivalArenaInstanceMaterials\.add\(material\)/);
  assert.match(textures, /export function createArenaObstacleFootprint/);
  assert.match(game, /createArenaObstacleFootprint\(obs\.width, obs\.depth, footprintColor\)/);
});
