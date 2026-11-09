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


test('original B4 art pack supplies the shared industrial floors, freight props and sprite atlas', async () => {
  const [textures, pack, assets, floor, pallet, carton, steel, hazard, sprites] = await Promise.all([
    readFile(new URL('../src/pvpTextures.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/b4AssetPack.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/assets.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/visuals/b4-floor-concrete.svg', import.meta.url), 'utf8'),
    readFile(new URL('../src/visuals/b4-pallet-wood.svg', import.meta.url), 'utf8'),
    readFile(new URL('../src/visuals/b4-freight-carton.svg', import.meta.url), 'utf8'),
    readFile(new URL('../src/visuals/b4-corrugated-steel.svg', import.meta.url), 'utf8'),
    readFile(new URL('../src/visuals/b4-hazard-chevron.svg', import.meta.url), 'utf8'),
    readFile(new URL('../src/visuals/b4-sprite-atlas.svg', import.meta.url), 'utf8'),
  ]);
  assert.match(textures, /return getB4VisualTexture\('floor'\)/);
  assert.match(textures, /getB4VisualTexture\('carton'\)/);
  assert.match(textures, /getB4VisualTexture\('hazard'\)/);
  assert.match(textures, /getB4VisualTexture\('steel'\)/);
  for (const kind of ['floor', 'pallet', 'carton', 'steel', 'hazard', 'spriteAtlas']) {
    assert.match(pack, new RegExp(`'\\./visuals/b4-[^']+\\.svg\\?url'`));
    assert.match(assets, new RegExp(`preloadB4VisualTexture\\('${kind}'\\)`));
  }
  assert.match(pack, /createB4FreightStack/);
  assert.match(pack, /createB4SpriteDecal/);
  assert.match(floor, /Gradient/i);
  assert.match(pallet, /fibres/);
  assert.match(carton, /MAX FLIX/);
  assert.match(steel, /linearGradient/);
  assert.match(hazard, /chev/);
  assert.match(sprites, /enemy|worker|zombie|forklift|pallet/i);
});
