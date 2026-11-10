import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('new B4 atlases are bundled, cached and preloaded before play', async () => {
  const [pack, assets, operator, combat, lamp, rack, enemy] = await Promise.all([
    read('../src/b4AssetPack.ts'),
    read('../src/assets.ts'),
    read('../src/visuals/b4-operator-atlas.svg'),
    read('../src/visuals/b4-combat-atlas.svg'),
    read('../src/visuals/b4-highbay-lamp.svg'),
    read('../src/visuals/b4-rack-labels.svg'),
    read('../src/visuals/b4-enemy-atlas-3.svg'),
  ]);
  for (const [kind, filename] of [
    ['operatorAtlas', 'b4-operator-atlas.svg'],
    ['combatAtlas', 'b4-combat-atlas.svg'],
    ['lamp', 'b4-highbay-lamp.svg'],
    ['rackAtlas', 'b4-rack-labels.svg'],
    ['enemyAtlas3', 'b4-enemy-atlas-3.svg'],
  ]) {
    assert.ok(pack.includes(filename), 'missing bundled asset: ' + filename);
    assert.ok(assets.includes("preloadB4VisualTexture('" + kind + "')"), 'missing warm-up: ' + kind);
  }
  assert.match(pack, /spriteTextureViews = new Map<B4SpriteKind, THREE\.Texture>/);
  assert.match(pack, /combatTextureViews = new Map<B4CombatOperator, THREE\.Texture>/);
  assert.match(pack, /repeat\.set\(frame\.width, frame\.height\)/);
  assert.match(pack, /export function createB4CombatSprite/);
  assert.match(operator, /OP 01/);
  assert.match(operator, /OP 05/);
  assert.match(combat, /<svg/);
  assert.match(lamp, /radialGradient/);
  assert.match(rack, /WYSOKIE SKŁADOWANIE/);
  assert.match(enemy, /BOSMAN/);
});

test('operator patches, boss identities, rack labels and LED fixture finish reach the 3D models', async () => {
  const warehouse = await read('../src/warehouseAssets.ts');
  assert.match(warehouse, /operatorBadgeKind/);
  for (const kind of ['operator01', 'operator02', 'operator03', 'operator04', 'operator05']) {
    assert.ok(warehouse.includes("'" + kind + "'"), 'missing playable operator patch: ' + kind);
  }
  for (const kind of ['bosman', 'eliteGuard', 'walczak', 'krolLeto', 'rackA', 'rackB']) {
    assert.ok(warehouse.includes("createB4SpriteDecal('" + kind + "'"), 'missing 3D identity/label decal: ' + kind);
  }
  assert.match(warehouse, /map: getB4VisualTexture\('lamp'\)/);
  assert.match(warehouse, /housingRim/);
});

test('weapon signatures are integrated in Campaign, Survival and PvP with sprite cleanup', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /createB4CombatSprite\(charId, 0\.34\)/);
  assert.match(game, /createB4CombatSprite\(shooter\.operatorId, 0\.30\)/);
  assert.match(game, /createB4SpriteDecal\('rackC'/);
  assert.match(game, /object instanceof THREE\.Sprite/);
  assert.match(game, /this\.survivalObstacles\.push/);
  assert.match(game, /this\.registerCameraOccludersInGroup\(freightStack, 0\.14\)/);
});
