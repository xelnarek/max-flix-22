import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the firearm asset registry selects nine small CC0 models and leaves unmatched archetypes procedural', async () => {
  const [assets, docs, fetcher] = await Promise.all([
    read('../src/survivalFirearmAssets.ts'),
    read('../docs/SURVIVAL_FIREARM_ASSETS.md'),
    read('../scripts/fetch-survival-firearm-assets.mjs'),
  ]);
  for (const assetId of [
    'fps-compact-pistol-19430',
    'fps-compact-smg-19433',
    'fps-assault-carbine-19436',
    'fps-pump-shotgun-19439',
    'fps-battle-rifle-19437',
    'arena-rocket-launcher-23139',
    'arena-plasma-gun-23143',
    'arena-rail-gun-23142',
    'arena-grenade-launcher-23140',
  ]) {
    assert.ok(assets.includes(assetId), 'missing curated external weapon model: ' + assetId);
    assert.ok(fetcher.includes(assetId), 'missing build-time download entry: ' + assetId);
  }
  assert.equal((assets.match(/sourceUrl:/g) || []).length, 9);
  assert.match(assets, /license: 'CC0-1\.0'/);
  assert.match(assets, /loadSurvivalFirearmModelAsset/);
  assert.match(assets, /loader\.loadAsync\(url\)/);
  assert.match(assets, /sourceCache/);
  assert.match(assets, /cloneWeaponScene/);
  assert.match(docs, /Minigun and flamethrower deliberately keep their bespoke procedural models/);
  assert.match(docs, /AI-generated/);
  assert.match(fetcher, /inspectGlb/);
  assert.match(fetcher, /createHash\('sha256'\)/);
  assert.match(fetcher, /--strict/);
});

test('external firearm models replace visuals asynchronously while preserving shared weapon gameplay and fallback', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private attachSurvivalFirearmAsset\(gun: THREE\.Group, firearmId: SurvivalFirearmId\)/);
  assert.match(game, /loadSurvivalFirearmModelAsset\(archetype\)/);
  assert.match(game, /private updateSurvivalFirearmAssetAnimation\(/);
  assert.match(game, /new THREE\.AnimationMixer\(asset\.model\)/);
  assert.match(game, /action\.setLoop\(THREE\.LoopOnce, 1\)/);
  assert.match(game, /assetMixer\?\.update\(dt\)/);
  assert.match(game, /fallback model remains available/);
  assert.match(game, /previous\.userData\.survivalFirearmDisposed = true/);
  assert.match(game, /drop\.mesh\.userData\.survivalFirearmDisposed = true/);
  assert.match(game, /this\.fireSurvivalFirearm\(/);
  assert.match(game, /private createSurvivalFirearmProjectileMesh\(/);
});

test('the nine selected external GLBs are fetched locally before development and strict production builds', async () => {
  const pkg = JSON.parse(await read('../package.json'));
  assert.ok(pkg.scripts.predev.includes('fetch-survival-firearm-assets.mjs'));
  assert.ok(pkg.scripts.prebuild.includes('fetch-survival-firearm-assets.mjs --strict'));
});
