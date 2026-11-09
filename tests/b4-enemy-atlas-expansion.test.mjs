import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('third original enemy atlas is cached, clamped and preloaded', async () => {
  const [pack, assets, atlas] = await Promise.all([
    read('../src/b4AssetPack.ts'),
    read('../src/assets.ts'),
    read('../src/visuals/b4-enemy-atlas-2.svg'),
  ]);
  assert.ok(pack.includes("enemyAtlas2Url from './visuals/b4-enemy-atlas-2.svg?url'"));
  assert.ok(pack.includes("enemyAtlas2: enemyAtlas2Url"));
  assert.ok(pack.includes("kind === 'enemyAtlas2'"));
  assert.ok(pack.includes("preloadB4VisualTexture('enemyAtlas2')") === false);
  assert.ok(assets.includes("preloadB4VisualTexture('enemyAtlas2')"));
  for (const kind of ['agv', 'courier', 'roman', 'stacker']) {
    assert.ok(pack.includes(kind + ": { atlas: 'enemyAtlas2'"), 'missing sprite frame: ' + kind);
  }
  assert.match(atlas, /AGV|courier|Roman|stacker/i);
});

test('new enemy atlas frames are applied to live 3D Survival enemy models', async () => {
  const warehouse = await read('../src/warehouseAssets.ts');
  for (const kind of ['agv', 'courier', 'roman', 'stacker']) {
    assert.ok(warehouse.includes("createB4SpriteDecal('" + kind + "'"), 'missing live model decal: ' + kind);
  }
  assert.ok(warehouse.includes('agvIdentityPatch.position.set'));
  assert.ok(warehouse.includes('courierIdentityPatch.position.set'));
  assert.ok(warehouse.includes('romanIdentityPatch.position.set'));
  assert.ok(warehouse.includes('stackerIdentityPatch.position.set'));
});
