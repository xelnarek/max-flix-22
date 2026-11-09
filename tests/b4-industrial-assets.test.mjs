import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('industrial extension textures are bundled and warmed before gameplay', async () => {
  const [pack, assets, container, conveyor, coldStorage, drum] = await Promise.all([
    read('../src/b4AssetPack.ts'),
    read('../src/assets.ts'),
    read('../src/visuals/b4-container-corrugate.svg'),
    read('../src/visuals/b4-conveyor-rollers.svg'),
    read('../src/visuals/b4-cold-storage.svg'),
    read('../src/visuals/b4-hazard-drum.svg'),
  ]);
  for (const [kind, filename] of [
    ['container', 'b4-container-corrugate.svg'],
    ['conveyor', 'b4-conveyor-rollers.svg'],
    ['coldStorage', 'b4-cold-storage.svg'],
    ['drum', 'b4-hazard-drum.svg'],
  ]) {
    assert.match(pack, new RegExp(filename.replaceAll('.', '\\\\.') + '\\\\?url'));
    assert.match(pack, new RegExp(kind + ':'));
    assert.match(assets, new RegExp("preloadB4VisualTexture\\\\('" + kind + "'\\\\)"));
  }
  assert.match(container, /corrug|CONTAINER|B4/i);
  assert.match(conveyor, /roller|conveyor|TAŚMA/i);
  assert.match(coldStorage, /FROST|COLD|ICE/i);
  assert.match(drum, /HAZARD|BHP|BARREL/i);
  assert.match(pack, /export function createB4HazardDrumCluster/);
  assert.match(pack, /getB4VisualTexture\\('drum'\\)/);
});

test('Survival uses container, cold-room and conveyor materials as map-specific 3D skins', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /map: getB4VisualTexture\\('container'\\)/);
  assert.match(game, /coldStorageSkin = new THREE\\.MeshStandardMaterial/);
  assert.match(game, /conveyorSkin = new THREE\\.MeshStandardMaterial/);
  assert.match(game, /feature\\.kind === 'container_stack' \\? containerSkin/);
  assert.match(game, /feature\\.kind === 'cold_compressor' \\? coldStorageSkin/);
  assert.match(game, /createB4HazardDrumCluster\\(\\)/);
  assert.match(game, /this\\.survivalObstacles\\.push\\(\\{ x: point\\.x, z: point\\.z, halfWidth: 0\\.98, halfDepth: 0\\.96 \\}\\)/);
});

test('PvP adds mirrored collision-backed hazard drum cover with the original drum model', async () => {
  const [arena, game] = await Promise.all([
    read('../src/pvpArena.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(arena, /type: 'pallet' \\| 'barrier' \\| 'pillar' \\| 'barrel'/);
  assert.match(arena, /id: 'drum_cache_w', x: -5\\.4/);
  assert.match(arena, /id: 'drum_cache_e', x: 5\\.4/);
  assert.match(game, /if \\(obs\\.type === 'barrel'\\)[\\s\\S]*?createB4HazardDrumCluster\\(\\)/);
  assert.match(game, /drumCluster\\.scale\\.set\\(obs\\.width/);
});
