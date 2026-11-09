import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('B4 art pack is bundled, warmed and typed before any scene uses it', async () => {
  const [pack, assets, declarations] = await Promise.all([
    read('../src/b4AssetPack.ts'),
    read('../src/assets.ts'),
    read('../types.d.ts'),
  ]);
  for (const asset of [
    'b4-floor-concrete.svg',
    'b4-pallet-wood.svg',
    'b4-freight-carton.svg',
    'b4-corrugated-steel.svg',
    'b4-hazard-chevron.svg',
    'b4-sprite-atlas.svg',
    'b4-enemy-atlas.svg',
  ]) assert.ok(pack.includes(asset), 'missing bundled asset: ' + asset);
  for (const kind of ['floor', 'pallet', 'carton', 'steel', 'hazard', 'spriteAtlas', 'enemyAtlas']) {
    assert.ok(assets.includes(`preloadB4VisualTexture('${kind}')`), 'missing warm-up: ' + kind);
  }
  assert.match(assets, /await item\.execute\(\)/);
  assert.match(declarations, /declare module '\*\.svg\?url'/);
  assert.match(pack, /new Map<B4VisualTextureKind, B4TextureEntry>/);
});

test('Campaign warehouse props and enemy model use the shared B4 textures and sprite decal', async () => {
  const warehouse = await read('../src/warehouseAssets.ts');
  assert.match(warehouse, /map: getB4VisualTexture\('pallet'\)/);
  assert.match(warehouse, /map: getB4VisualTexture\('carton'\)/);
  assert.match(warehouse, /map: getB4VisualTexture\('steel'\)/);
  assert.match(warehouse, /map: getB4VisualTexture\('hazard'\)/);
  assert.match(warehouse, /createB4SpriteDecal\('zombie'/);
  assert.match(warehouse, /export function createWarehouseRack/);
  assert.match(warehouse, /export function createTilePallet/);
});

test('Survival and PvP use shared B4 surfaces; new Survival cargo has registered collision cover', async () => {
  const [game, textures] = await Promise.all([
    read('../src/game.ts'),
    read('../src/pvpTextures.ts'),
  ]);
  assert.match(textures, /return getB4VisualTexture\('floor'\)/);
  assert.match(textures, /getB4VisualTexture\('carton'\)/);
  assert.match(textures, /getB4VisualTexture\('hazard'\)/);
  assert.match(textures, /getB4VisualTexture\('steel'\)/);
  assert.match(game, /const pvpLeftSign = createB4WallSprite\('forklift'/);
  assert.match(game, /const pvpRightSign = createB4WallSprite\('zombie'/);
  assert.match(game, /const freightStack = createB4FreightStack\(\)/);
  assert.match(game, /this\.registerCameraOccludersInGroup\(freightStack, 0\.14\)/);
  assert.match(game, /this\.survivalObstacles\.push\(\{[\s\S]*?halfWidth: 1\.28,[\s\S]*?halfDepth: 1\.05/);
  assert.match(game, /const survivalForkliftSign = createB4WallSprite\('forklift'/);
  assert.match(game, /const survivalWorkerSign = createB4WallSprite\('worker'/);
});

test('second B4 atlas is bundled, preloaded and used by four distinct enemy archetypes', async () => {
  const [pack, assets, warehouse, atlas] = await Promise.all([
    read('../src/b4AssetPack.ts'),
    read('../src/assets.ts'),
    read('../src/warehouseAssets.ts'),
    read('../src/visuals/b4-enemy-atlas.svg'),
  ]);
  assert.match(pack, /enemyAtlasUrl from '\.\/visuals\/b4-enemy-atlas\.svg\?url'/);
  assert.match(pack, /enemyAtlas: enemyAtlasUrl/);
  assert.match(pack, /atlas: 'enemyAtlas'/);
  assert.match(assets, /preloadB4VisualTexture\('enemyAtlas'\)/);
  for (const kind of ['customer', 'inspector', 'handlowiec', 'monter']) {
    assert.match(pack, new RegExp(`\\b${kind}: \\{ atlas: 'enemyAtlas'`));
    assert.ok(warehouse.includes(`createB4SpriteDecal('${kind}'`), 'missing NPC patch: ' + kind);
  }
  assert.match(pack, /spriteTextureViews\.get\(kind\)/);
  assert.match(atlas, /linearGradient/);
  assert.match(atlas, /inspector|customer|handlowiec|monter/i);
});
