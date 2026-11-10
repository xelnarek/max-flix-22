import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the Gobkit roster maps all five operators to distinct rigged 3D models', async () => {
  const [registry, characters] = await Promise.all([
    read('../src/gobkitAssets.ts'),
    read('../src/characters.ts'),
  ]);
  for (const id of ['storemanager', 'firechief', 'stockclerk', 'baggagehandler', 'securityguard']) {
    assert.ok(registry.includes(id + ".glb"), 'missing model file: ' + id);
  }
  for (const id of ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']) {
    assert.ok(registry.includes(id + ':'), 'missing operator mapping: ' + id);
  }
  assert.match(characters, /visualModelName: 'Store Manager/);
  assert.match(characters, /visualModelName: 'Fire Chief/);
  assert.match(characters, /visualModelName: 'Stock Clerk/);
  assert.match(characters, /visualModelName: 'Baggage Handler/);
  assert.match(characters, /visualModelName: 'Security Guard/);
});

test('Survival enemy families have dedicated role-matched GLB variants', async () => {
  const registry = await read('../src/gobkitAssets.ts');
  for (const [enemy, model] of [
    ['customer', 'shoplifter'],
    ['architect', 'officemanager'],
    ['kurier', 'foodcourier'],
    ['handlowiec', 'salesrep'],
    ['inspector', 'hazmattech'],
    ['serwisant', 'forcibleentryfirefighter'],
    ['zombie_pracownik', 'stitchedbrute'],
    ['mutant_gamma_forklift', 'bloodironjuggernaut'],
    ['radioactive_pip', 'nightwitch'],
    ['cyber_salesman', 'androidcommander'],
    ['walczak', 'werewolfcaptain'],
    ['bosman_krakow', 'bloodirongrunt'],
  ]) {
    assert.ok(registry.includes(enemy + ": '" + model + "'"), 'wrong model for ' + enemy);
    assert.ok(registry.includes(model + '.glb'), 'missing enemy GLB: ' + model);
  }
});

test('runtime clones skinned models safely and drives named locomotion/combat clips', async () => {
  const [registry, game] = await Promise.all([
    read('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(registry, /SkeletonUtils\.js/);
  assert.match(registry, /cloneSkinnedScene\(gltf\.scene\)/);
  assert.match(registry, /new GLTFLoader\(\)/);
  assert.match(game, /new THREE\.AnimationMixer\(root\)/);
  assert.match(game, /'Idle'/);
  assert.match(game, /'Walk'/);
  assert.match(game, /'Run'/);
  assert.match(game, /'Death'/);
  assert.match(game, /'Hit'/);
  assert.match(game, /requestGobkitAction\(this\.playerGobkitTrack, 'Attack'/);
  assert.match(game, /this\.hp <= 0 \? 'Death' : 'Hit'/);
  assert.match(game, /enemy\.hitReactTimer.*'Hit'/s);
  assert.match(game, /oneShotRemaining/);
  assert.match(game, /this\.updateGobkitAnimations\(simDt\)/);
});

test('the build downloader validates CC0, rigging, animation clips and GLB binary headers', async () => {
  const [script, pkg] = await Promise.all([
    read('../scripts/fetch-gobkit-assets.mjs'),
    read('../package.json'),
  ]);
  assert.match(script, /https:\/\/gobkit\.com\/api\/free/);
  assert.match(script, /CC0 1\.0/);
  assert.match(script, /model\.rigged !== true/);
  assert.match(script, /'Idle', 'Walk', 'Run', 'Death', 'Hit'/);
  assert.match(script, /validateGlbAsset\(bytes, model\.id, model\.clipNames\)/);
  assert.match(pkg, /"prebuild": "node scripts\/fetch-gobkit-assets\.mjs --strict && node scripts\/fetch-makehuman-assets\.mjs --strict && node scripts\/fetch-polyhaven-assets\.mjs --strict"/);
  assert.match(pkg, /"predev": "node scripts\/fetch-gobkit-assets\.mjs && node scripts\/fetch-makehuman-assets\.mjs && node scripts\/fetch-polyhaven-assets\.mjs"/);
});

test('Survival actors and both PvP operator slots use the new models without changing combat APIs', async () => {
  const [game, arena] = await Promise.all([
    read('../src/game.ts'),
    read('../src/pvpArena.ts'),
  ]);
  assert.match(game, /ENEMY_GOBKIT_MODELS\[enemy\.type\]/);
  assert.match(game, /attachMakeHumanOperatorModel\(this\.currentCharacterId/);
  assert.match(game, /attachMakeHumanOperatorModel\(def\.id, this\.remotePlayerGroup/);
  assert.match(game, /enemy\.legL = undefined/);
  assert.match(game, /this\.hideProceduralVisuals/);
  assert.match(arena, /export function createDefaultPvpObstacles/);
});


test('Gobkit build validates the embedded GLB JSON, skeleton, animation clips and checksum before reuse', async () => {
  const [script, validator] = await Promise.all([
    read('../scripts/fetch-gobkit-assets.mjs'),
    read('../scripts/glbValidation.mjs'),
  ]);
  assert.match(script, /validateGlbAsset\(bytes, id, model\.clipNames\)/);
  assert.match(script, /sha256ForBytes\(bytes\)/);
  assert.match(script, /existingFileIsValid\(filePath, \{ \.\.\.model, id \}\)/);
  assert.match(validator, /declaredLength !== bytes\.length/);
  assert.match(validator, /document\.skins/);
  assert.match(validator, /document\.animations/);
  assert.match(validator, /REQUIRED_RIG_CLIPS/);
});


test('per-frame actor animation reuses persistent scratch vectors and quaternion', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private readonly actorDisplacementScratch = new THREE\\.Vector3\\(\\)/);
  assert.match(game, /private readonly actorLocalMovementScratch = new THREE\\.Vector3\\(\\)/);
  assert.match(game, /private readonly actorRotationScratch = new THREE\\.Quaternion\\(\\)/);
  assert.match(game, /const displacement = this\\.actorDisplacementScratch/);
  assert.match(game, /const localMovement = this\\.actorLocalMovementScratch/);
  assert.match(game, /const actorRotation = this\\.actorRotationScratch/);
  assert.doesNotMatch(game, /updateGobkitAnimations\\(dt: number\\) \\{[\\s\\S]{0,300}const displacement = new THREE\\.Vector3\\(\\)/);
});
