import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { BASE44_ENEMY_ASSETS } from '../src/base44EnemyAssets.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('all six Base44 GLBs are registered and mapped onto existing live enemy archetypes', async () => {
  const [profiles, registry, game, packageJson] = await Promise.all([
    import('../src/enemyVisualProfiles.ts'),
    import('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
    read('../package.json'),
  ]);

  const expected = {
    krol_leto: 'pierogowy_kolos',
    handlowiec: 'ksiegowy_otchlani',
    piorun_dron: 'turbo_golab',
    pan_roman: 'janusz_rakietnik',
    walczak: 'kapibara_mafioso',
    sebix_m: 'parowkowy_berserker',
  };

  assert.equal(Object.keys(BASE44_ENEMY_ASSETS).length, 6);
  for (const [enemyType, modelId] of Object.entries(expected)) {
    assert.equal(profiles.ENEMY_VISUAL_PROFILES[enemyType].base44Model, modelId);
    const profile = profiles.ENEMY_VISUAL_PROFILES[enemyType];
    assert.ok(profile.gobkitModel || profile.fallbackFactory,
      enemyType + ' must retain its original fallback model');
    if (enemyType === 'piorun_dron') {
      assert.equal(profile.fallbackFactory, 'createPiorunDronModel');
      assert.equal(profile.gobkitModel, undefined);
    }
    assert.equal(registry.GOBKIT_MODEL_FILES[modelId], BASE44_ENEMY_ASSETS[modelId].file);
    assert.match(BASE44_ENEMY_ASSETS[modelId].url, /^https:\/\/media\.base44\.com\//);
  }

  assert.match(game, /visualProfile\.base44Model \?\? visualProfile\.gobkitModel/);
  assert.match(game, /const isBase44 = modelId === visualProfile\.base44Model;/);
  assert.doesNotMatch(game, /createEnemyRoleKit\(/);
  assert.match(game, /if \(fallback && fallback !== modelId\)/);
  assert.match(packageJson, /fetch-base44-enemy-assets\.mjs --strict/);
  assert.match(packageJson, /fetch-base44-enemy-assets\.mjs &&/);
});

test('the model loader prefers the locally bundled GLB and retries the Base44 CDN in preview', async () => {
  const [registry, downloader] = await Promise.all([
    read('../src/gobkitAssets.ts'),
    read('../scripts/fetch-base44-enemy-assets.mjs'),
  ]);
  assert.match(registry, /assets\/base44-enemies\//);
  assert.match(registry, /loader\.loadAsync\(base44Asset\.url\)/);
  assert.match(downloader, /readGlbDocument/);
  assert.match(downloader, /sha256\(bytes\)/);
  assert.match(downloader, /document\.meshes/);
  assert.match(downloader, /document\.animations/);
  assert.match(downloader, /manifest\.json/);
});

test('all models keep the source filename and independent fallback mapping stable', () => {
  const files = Object.values(BASE44_ENEMY_ASSETS).map((asset) => asset.file);
  assert.equal(new Set(files).size, 6);
  for (const asset of Object.values(BASE44_ENEMY_ASSETS)) {
    assert.ok(asset.file.endsWith('.glb'));
    assert.ok(asset.label.length >= 5);
  }
});
