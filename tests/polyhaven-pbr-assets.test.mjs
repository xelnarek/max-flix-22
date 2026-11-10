import assert from 'node:assert/strict';
import test from 'node:test';
import { isPng, makePolyHavenMapUrl, POLYHAVEN_TEXTURE_ASSETS } from '../scripts/polyHavenPack.mjs';

test('curated CC0 warehouse surfaces point to pinned 2K Poly Haven texture URLs', () => {
  const floor = makePolyHavenMapUrl('concrete_floor_worn_001', 'diff', '2k');
  assert.equal(floor, 'https://dl.polyhaven.org/file/ph-assets/Textures/png/2k/concrete_floor_worn_001/concrete_floor_worn_001_diff_2k.png');
  assert.ok(POLYHAVEN_TEXTURE_ASSETS.some((asset) => asset.id === 'factory_wall'));
  assert.ok(POLYHAVEN_TEXTURE_ASSETS.some((asset) => asset.id === 'metal_plate_02'));
});

test('PNG signature validation rejects HTML error pages and truncated responses', () => {
  assert.equal(isPng(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00])), true);
  assert.equal(isPng(Buffer.from('<html>404</html>')), false);
  assert.equal(isPng(Buffer.alloc(8)), false);
});


test('Survival and Campaign high-bay structures use the shared CC0 steel PBR set', async () => {
  const game = await (await import('node:fs/promises')).readFile(
    new URL('../src/game.ts', import.meta.url), 'utf8',
  );
  assert.match(game, /applyPolyHavenPbrMaps\(steel, 'metal_plate_02'/);
  assert.match(game, /applyPolyHavenPbrMaps\(pipeMaterial, 'metal_plate_02'/);
  assert.match(game, /applyPolyHavenPbrMaps\(deck, 'metal_plate_02'/);
  assert.match(game, /applyPolyHavenPbrMaps\(floorMaterial, 'concrete_floor_worn_001'/);
  assert.match(game, /applyPolyHavenPbrMaps\(wallMaterial, 'factory_wall'/);
  assert.match(game, /applyPolyHavenPbrMaps\(barrierMaterial, 'metal_plate_02'/);
});
