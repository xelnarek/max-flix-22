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
    assert.ok(pack.includes("./visuals/" + filename + "?url"), 'missing import: ' + filename);
    assert.ok(pack.includes(kind + ':'), 'missing texture mapping: ' + kind);
    assert.ok(assets.includes("preloadB4VisualTexture('" + kind + "')"), 'missing preload: ' + kind);
  }

  assert.match(container, /corrug|CONTAINER|B4/i);
  assert.match(conveyor, /roller|conveyor|TAŚMA/i);
  assert.match(coldStorage, /FROST|COLD|ICE/i);
  assert.match(drum, /HAZARD|BHP|BARREL/i);
  assert.ok(pack.includes('export function createB4HazardDrumCluster'));
  assert.ok(pack.includes("getB4VisualTexture('drum')"));
});

test('Survival uses container, cold-room and conveyor materials as map-specific 3D skins', async () => {
  const game = await read('../src/game.ts');
  assert.ok(game.includes("map: getB4VisualTexture('container')"));
  assert.ok(game.includes("coldStorageSkin = new THREE.MeshStandardMaterial"));
  assert.ok(game.includes("conveyorSkin = new THREE.MeshStandardMaterial"));
  assert.ok(game.includes("feature.kind === 'container_stack' ? containerSkin"));
  assert.ok(game.includes("feature.kind === 'cold_compressor' ? coldStorageSkin"));
  assert.ok(game.includes('createB4HazardDrumCluster()'));
  assert.ok(game.includes('halfWidth: 0.98, halfDepth: 0.96'));
  assert.ok(game.includes('this.registerCameraOccludersInGroup(drums, 0.16)'));
});

test('PvP adds mirrored collision-backed hazard drum cover with the original drum model', async () => {
  const [arena, game] = await Promise.all([
    read('../src/pvpArena.ts'),
    read('../src/game.ts'),
  ]);
  assert.ok(arena.includes("type: 'pallet' | 'barrier' | 'pillar' | 'barrel'"));
  assert.ok(arena.includes("id: 'drum_cache_w', x: -5.4"));
  assert.ok(arena.includes("id: 'drum_cache_e', x: 5.4"));
  assert.ok(game.includes("if (obs.type === 'barrel')"));
  assert.ok(game.includes('drumCluster.scale.set(obs.width'));
});
