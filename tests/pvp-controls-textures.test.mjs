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

test('PvP timing arc and STRZAŁ are placed over the movement joystick', async () => {
  const [app, game, html, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(app.includes("bindPvpTap(pvpFireButton"));
  assert.ok(app.includes("activeAimPointerId = event.pointerId"));
  assert.ok(app.includes("this.engine.setPvpAimStickInput("));
  assert.ok(app.includes("touchActionsZone.prepend(pvpFireControl)"));
  assert.ok(game.includes("getPvpSweepAimAngle("));
  assert.ok(game.includes("pvpAimSweepPointer"));
  assert.ok(html.includes('id="pvp-fire-control"'));
  assert.ok(html.includes("PRAWY: CELOWANIE"));
  assert.ok(html.indexOf('id="touch-joystick-zone"') < html.indexOf('id="pvp-fire-control"'));
  assert.ok(html.indexOf('id="pvp-fire-control"') < html.indexOf('class="touch-actions-zone"'));
  assert.ok(html.includes('id="pvp-aim-zone"'));
  assert.ok(css.includes("pvp-fire-control"));
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


test('arena surfaces include industrial wear, drainage and distinct freight hardware marks', async () => {
  const textures = await readFile(new URL('../src/pvpTextures.ts', import.meta.url), 'utf8');
  assert.match(textures, /Recessed drainage plates/);
  assert.match(textures, /Forklift tyre polishing/);
  assert.match(textures, /B4/);
  assert.match(textures, /Reflective panels, end caps and fixing bolts/);
  assert.match(textures, /Concrete wall seams, anchor plates/);
});
