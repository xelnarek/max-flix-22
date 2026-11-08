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
