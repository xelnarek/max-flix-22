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
  assert.equal((assets.match(/sourceUrl: 'https:\/\/cdn/g) || []).length, 9);
  assert.match(assets, /license: 'CC0-1\.0'/);
  assert.match(assets, /expectedAnimations/);
  assert.match(assets, /SURVIVAL_FIREARM_PROCEDURAL_MECHANISM_PARTS/);
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
  assert.match(game, /procedural model remains available/);
  assert.match(game, /previous\.userData\.survivalFirearmDisposed = true/);
  assert.match(game, /drop\.mesh\.userData\.survivalFirearmDisposed = true/);
  assert.match(game, /this\.fireSurvivalFirearm\(/);
  assert.match(game, /private createSurvivalFirearmProjectileMesh\(/);
  assert.match(game, /remoteGun = this\.remotePlayerGroup\?\.getObjectByName\('pvp_remote_primary_firearm'\)/);
  assert.match(game, /remoteAssetMixer\?\.update\(dt\)/);
});

test('the nine selected external GLBs are fetched locally before development and strict production builds', async () => {
  const pkg = JSON.parse(await read('../package.json'));
  assert.ok(pkg.scripts.predev.includes('fetch-survival-firearm-assets.mjs'));
  assert.ok(pkg.scripts.prebuild.includes('fetch-survival-firearm-assets.mjs --strict'));
});


test('static sci-fi GLBs retain matching procedural reload mechanisms in local and remote weapon rigs', async () => {
  const [assets, game, docs] = await Promise.all([
    read('../src/survivalFirearmAssets.ts'),
    read('../src/game.ts'),
    read('../docs/SURVIVAL_FIREARM_ASSETS.md'),
  ]);
  for (const part of [
    "rocket: ['firearm-rocket-cell']",
    "plasma: ['firearm-coils', 'firearm-energy-cell']",
    "gauss: ['firearm-bolt', 'firearm-energy-cell', 'firearm-coils']",
    "grenade: ['firearm-rocket-cell']",
  ]) assert.ok(assets.includes(part), 'missing static-model mechanism mapping: ' + part);
  assert.match(game, /asset\.animations\.length === 0[\s\S]*?SURVIVAL_FIREARM_PROCEDURAL_MECHANISM_PARTS/);
  assert.match(game, /if \(mechanismNames\.has\(child\.name\)\)[\s\S]*?preservedMechanisms\.push\(child\)/);
  assert.match(game, /private updateSurvivalFirearmMechanismParts\(/);
  assert.match(game, /this\.updateSurvivalFirearmMechanismParts\([\s\S]*?gun, definition\.archetype/);
  assert.match(game, /this\.updateSurvivalFirearmMechanismParts\([\s\S]*?remoteGun, remoteDefinition\.archetype/);
  assert.match(docs, /retained as lightweight overlays/);
});

test('production asset preparation rejects missing required GLB reload and slide clips', async () => {
  const fetcher = await read('../scripts/fetch-survival-firearm-assets.mjs');
  for (const clip of ['magazine-open', 'magazine-close', 'slide-open', 'slide-close', 'stock-open', 'stock-close', 'open', 'close']) {
    assert.ok(fetcher.includes("'" + clip + "'"), 'missing required clip: ' + clip);
  }
  assert.match(fetcher, /missingAnimations = asset\.expectedAnimations\.filter/);
  assert.match(fetcher, /GLB is missing required animation clips/);
});
