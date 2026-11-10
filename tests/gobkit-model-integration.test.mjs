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
  assert.match(game, /private readonly actorDisplacementScratch = new THREE\.Vector3\(\)/);
  assert.match(game, /private readonly actorLocalMovementScratch = new THREE\.Vector3\(\)/);
  assert.match(game, /private readonly actorRotationScratch = new THREE\.Quaternion\(\)/);
  assert.match(game, /const displacement = this\.actorDisplacementScratch/);
  assert.match(game, /const localMovement = this\.actorLocalMovementScratch/);
  assert.match(game, /const actorRotation = this\.actorRotationScratch/);
});

test('only one imported actor rig can be installed per player or enemy group', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private removeAttachedActorVisuals\(group: THREE\.Group\)/);
  assert.match(game, /private installActorVisualRoot\(group: THREE\.Group, root: THREE\.Group\)/);
  assert.match(game, /root\.traverse\(\(object\) => \{ object\.userData\.actorVisualRoot = true; \}\)/);
  assert.match(game, /group\.userData\.actorVisualRoot = root/);
  assert.match(game, /this\.stopGobkitTrack\(this\.playerGobkitTrack\)/);
  assert.match(game, /this\.stopGobkitTrack\(this\.remoteGobkitTrack\)/);
  assert.match(game, /this\.gobkitEnemyTracks\.delete\(enemy\)/);
  assert.equal((game.match(/this\.installActorVisualRoot\(/g) || []).length, 4,
    'all four model attachment paths must use the single-root installer');
});


test('one-shot action timing is not overwritten by locomotion speed scaling', async () => {
  const game = await read('../src/game.ts');
  const locomotion = await read('../src/makeHumanLocomotion.ts');
  assert.match(locomotion, /export function isMakeHumanVelocityAction/);
  assert.match(game, /track\.sharedGeometry && isMakeHumanVelocityAction\(activeAction\)/);
  assert.match(game, /Do not overwrite setDuration\(\) for one-shot Attack\/Hit\/Jump\/Land clips/);
  assert.match(game, /track\.mixer\.uncacheRoot\(track\.root\)/);
});

test('enemy death action supersedes any active hit reaction', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /enemy\.state === 'defeated'[\s\S]{0,220}track\.oneShotPriority < getGobkitActionPriority\('Death'\)/);
  assert.match(game, /this\.requestGobkitAction\(track, 'Death', 1\.08\)/);
});

test('procedural fallback hides every renderable body primitive but keeps explicit overlays', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /object instanceof THREE\.Mesh \|\| object instanceof THREE\.Line/);
  assert.match(game, /object instanceof THREE\.Points \|\| object instanceof THREE\.Sprite/);
  assert.match(game, /object\.userData\.gobkitKeep = true/);
  assert.match(game, /object\.visible = false/);
});


test('MakeHuman movement selects stable directional clips and keeps one-shot clips out of speed scaling', async () => {
  const locomotion = await import('../src/makeHumanLocomotion.ts');
  assert.equal(locomotion.chooseMakeHumanLocomotion(0, 0, false), 'Idle');
  assert.equal(locomotion.chooseMakeHumanLocomotion(0, 5.2, false), 'Run');
  assert.equal(locomotion.chooseMakeHumanLocomotion(0, -1.1, false), 'WalkBackward');
  assert.equal(locomotion.chooseMakeHumanLocomotion(2.0, 0.4, false), 'StrafeLeft');
  assert.equal(locomotion.chooseMakeHumanLocomotion(-2.0, 0.4, false), 'StrafeRight');
  for (const action of ['Walk', 'Run', 'WalkBackward', 'StrafeLeft', 'StrafeRight']) {
    assert.equal(locomotion.isMakeHumanVelocityAction(action), true);
  }
  for (const action of ['Idle', 'Fall', 'Jump', 'Land', 'Attack', 'Hit', 'Death', 'Special']) {
    assert.equal(locomotion.isMakeHumanVelocityAction(action), false);
  }
});

test('Death has higher animation priority than Hit and overrides an active hit reaction', async () => {
  const animation = await import('../src/gobkitAnimation.ts');
  assert.equal(animation.getGobkitActionPriority('Hit'), 4);
  assert.equal(animation.getGobkitActionPriority('Death'), 5);
  assert.equal(animation.shouldKeepGobkitAction(0.25, 4, 5), false);
  assert.equal(animation.isGobkitOneShotAction('Death'), true);
});


test('async rig attachment restores pending player and enemy combat reactions', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private enemyPendingAttackUntil = new WeakMap<EnemyItem, number>\(\)/);
  assert.match(game, /this\.resumePlayerAnimationAfterModelAttach\(track\)/);
  assert.match(game, /this\.resumeEnemyAnimationAfterModelAttach\(enemy, track\)/);
  assert.match(game, /this\.enemyPendingAttackUntil\.set\(enemy, now \+ durationSeconds \* 1000\)/);
  assert.match(game, /if \(this\.invulnerableTimer > 0\)[\s\S]{0,180}requestGobkitAction\(track, 'Hit'/);
  assert.match(game, /if \(hitRemaining > 0\.015 \|\| enemy\.state === 'stunned'\)[\s\S]{0,180}requestGobkitAction\(track, 'Hit'/);
});


test('all imported humanoid rigs keep root motion aligned with physics hitboxes', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /function cloneRootMotionFreeClip\(sourceClip: THREE\.AnimationClip\)/);
  assert.match(game, /sourceTrack\.name\.toLowerCase\(\)\.includes\('root\.position'\)/);
  assert.match(game, /cleaned\.values\[index\] = firstX/);
  assert.match(game, /cleaned\.values\[index \+ 1\] = firstY/);
  assert.match(game, /cleaned\.values\[index \+ 2\] = firstZ/);
  assert.match(game, /const safeClip = cloneRootMotionFreeClip\(clip\)/);
  assert.match(game, /const clip = cloneRootMotionFreeClip\(sourceClip\)/);
});


test('late enemy model loads cannot attach to a recycled mesh or changed archetype', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const mesh = enemy\.mesh;\s+const requestedType = enemy\.type;/);
  assert.match(game, /enemy\.mesh !== mesh \|\| enemy\.type !== requestedType/);
  assert.match(game, /mesh\.parent !== this\.levelRoot \|\| enemy\.state === 'defeated'/);
  assert.match(game, /const largeEnemy = requestedType === 'walczak'/);
  assert.match(game, /this\.createMakeHumanAnimationTrack\(actor\.root, actor\.clips, mesh\.position/);
  assert.match(game, /this\.createGobkitAnimationTrack\(gltf, root, mesh\.position/);
});


test('ranged and special enemy attacks request visible attack poses at projectile launch', async () => {
  const game = await read('../src/game.ts');
  for (const marker of [
    'spawnPenaltyNotice(e.x, e.y + 1.2, e.z)',
    'spawnDyscyplinarkaNotice(e.x, e.y + 1.2, e.z, lockedDirection)',
    'spawnSparkZapProjectile(e.x, e.y + 0.75, e.z, lockedDirection)',
    'spawnPomazaniecLollipop(e.x, e.y + 1.03, e.z',
    'spawnSanitarywareProjectile(e.x, e.y + 0.8, e.z)',
    'spawnOdprawaClipboardProjectile(e.x, e.y + 1.0, e.z, lockedDirection)',
    'spawnSebixBrick(enemy.x,enemy.y+1.35',
  ]) {
    const index = game.indexOf(marker);
    assert.ok(index >= 0, 'missing ranged/special attack: ' + marker);
    const context = game.slice(Math.max(0, index - 260), index);
    assert.match(context, /requestEnemyAttackAnimation\\((e|enemy),/,
      'attack animation must be requested before: ' + marker);
  }
});


test('orphan imported rigs are cleaned without disposing shared MakeHuman assets', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private disposeUntrackedActorVisualRoot\(root: THREE\.Object3D\)/);
  assert.match(game, /if \(object\.userData\.gobkitAsset === true\) object\.geometry\.dispose\(\)/);
  assert.match(game, /material\.userData\.makeHumanShared !== true/);
  assert.match(game, /this\.disposeUntrackedActorVisualRoot\(child\)/);
});


test('Gobkit rig clones share immutable geometry but keep actor-local materials', async () => {
  const [assets, game] = await Promise.all([
    read('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(assets, /cloneSkinnedScene\(gltf\.scene\)/);
  assert.match(assets, /object\.userData\.gobkitSharedGeometry = true/);
  assert.doesNotMatch(assets, /object\.geometry = object\.geometry\.clone\(\)/);
  assert.match(assets, /object\.material\.clone\(\)/);
  assert.match(game, /object\.userData\.gobkitSharedGeometry !== true/);
});


test('per-frame animation cleanup reuses the active-enemy membership set', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private readonly activeEnemyAnimationScratch = new Set<EnemyItem>\(\)/);
  assert.match(game, /const activeEnemies = this\.activeEnemyAnimationScratch/);
  assert.match(game, /activeEnemies\.clear\(\)/);
  assert.match(game, /for \(const enemy of this\.enemies\) activeEnemies\.add\(enemy\)/);
});


test('playable operators receive a dedicated special-ability animation', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private specialSwingTimer = 0/);
  assert.match(game, /this\.specialSwingTimer = 0\.72/);
  assert.match(game, /this\.requestGobkitAction\(this\.playerGobkitTrack, 'Special', this\.specialSwingTimer\)/);
  assert.match(game, /else if \(this\.specialSwingTimer > 0\)[\s\S]{0,120}requestGobkitAction\(track, 'Special'/);
  assert.match(game, /this\.specialSwingTimer = Math\.max\(0, this\.specialSwingTimer - dt\)/);
});


test('jump and landing transitions use available clips on fallback operator rigs too', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /airborne && !track\.wasAirborne && track\.actions\.has\('Jump'\)/);
  assert.match(game, /!airborne && track\.wasAirborne && track\.actions\.has\('Land'\)/);
  assert.match(game, /track\.wasAirborne = airborne/);
});
