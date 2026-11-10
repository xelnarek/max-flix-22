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

test('non-human enemy threats use dedicated rigged GLB variants from the visual profile registry', async () => {
  const { ENEMY_GOBKIT_MODELS, GOBKIT_MODEL_FILES } = await import('../src/gobkitAssets.ts');
  for (const [enemy, model] of [
    ['zombie_pracownik', 'stitchedbrute'],
    ['mutant_gamma_forklift', 'bloodironjuggernaut'],
    ['radioactive_pip', 'nightwitch'],
    ['cyber_salesman', 'androidcommander'],
    ['walczak', 'werewolfcaptain'],
    ['krol_leto', 'bloodironjuggernaut'],
    ['elite_walczak_guard', 'bloodirongrunt'],
  ]) {
    assert.equal(ENEMY_GOBKIT_MODELS[enemy], model, 'wrong creature model for ' + enemy);
    assert.equal(GOBKIT_MODEL_FILES[model], model + '.glb', 'missing enemy GLB: ' + model);
  }
});
test('human warehouse enemy archetypes retain bespoke caricature models instead of generic humanoid GLBs', async () => {
  const [registry, game] = await Promise.all([
    read('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
  ]);
  for (const humanType of ['customer', 'architect', 'kurier', 'handlowiec', 'inspector', 'serwisant', 'monter', 'bosman_krakow']) {
    assert.doesNotMatch(registry, new RegExp('\\b' + humanType + ':'));
  }
  for (const factory of [
    'createArchitectEnemyModel()',
    'createCustomerEnemyModel()',
    'createKurierEnemyModel()',
    'createHandlowiecEnemyModel()',
    'createInspectorEnemyModel()',
    'createSerwisanciEnemyModel()',
    'createMonterEnemyModel()',
    'createBosmanKrakowBossModel()',
  ]) {
    assert.ok(game.includes(factory), 'missing bespoke human enemy factory: ' + factory);
  }
});

test('the visual registry explicitly covers every declared enemy type and has a role-matched profile', async () => {
  const [typesSource, registrySource, gameSource, profiles] = await Promise.all([
    read('../src/types.ts'),
    read('../src/enemyVisualProfiles.ts'),
    read('../src/game.ts'),
    import('../src/enemyVisualProfiles.ts'),
  ]);
  const unionStart = typesSource.indexOf('export type EnemyType =');
  const unionEnd = typesSource.indexOf(';', unionStart);
  const declared = [...typesSource.slice(unionStart, unionEnd).matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const configured = Object.keys(profiles.ENEMY_VISUAL_PROFILES).sort();
  assert.deepEqual(configured, [...declared].sort());
  assert.equal(configured.length, 23);
  for (const [type, profile] of Object.entries(profiles.ENEMY_VISUAL_PROFILES)) {
    assert.ok(profile.visualBrief.length >= 24, 'visual brief missing for ' + type);
    assert.ok(profile.fallbackFactory.startsWith('create'), 'fallback model factory missing for ' + type);
    assert.ok(gameSource.includes(profile.fallbackFactory), 'fallback model factory is not wired for ' + type);
    assert.ok(profile.targetHeight >= 0.7 && profile.targetHeight <= 2.2, 'invalid scale for ' + type);
  }
  assert.match(registrySource, /ENEMY_VISUAL_PROFILES/);
});

test('every enemy type has a distinct locomotion style preset tuned to its role', async () => {
  const [profilesSource, game, module] = await Promise.all([
    read('../src/enemyVisualProfiles.ts'),
    read('../src/game.ts'),
    import('../src/enemyVisualProfiles.ts'),
  ]);
  const presets = module.ENEMY_GAIT_PRESETS;
  for (const [type, profile] of Object.entries(module.ENEMY_VISUAL_PROFILES)) {
    const preset = presets[profile.gaitStyle];
    assert.ok(preset, 'missing gait preset for ' + type);
    assert.ok(preset.rate > 0 && preset.rate <= 1.5, 'invalid gait rate for ' + type);
    assert.ok(preset.legSwing >= 0 && preset.legSwing <= 0.8, 'invalid leg swing for ' + type);
    assert.ok(preset.armSwing >= 0 && preset.armSwing <= 0.6, 'invalid arm swing for ' + type);
  }
  assert.equal(module.ENEMY_VISUAL_PROFILES.zombie_pracownik.gaitStyle, 'shambling');
  assert.equal(module.ENEMY_VISUAL_PROFILES.radioactive_pip.gaitStyle, 'limping');
  assert.equal(module.ENEMY_VISUAL_PROFILES.kurier.gaitStyle, 'brisk');
  assert.equal(module.ENEMY_VISUAL_PROFILES.krol_leto.gaitStyle, 'heavy');
  assert.equal(module.ENEMY_VISUAL_PROFILES.piorun_dron.gaitStyle, 'hovering');
  assert.equal(module.ENEMY_VISUAL_PROFILES.forklift.gaitStyle, 'rolling');
  assert.match(profilesSource, /ENEMY_GAIT_PRESETS/);
  assert.match(game, /const gaitPreset = ENEMY_GAIT_PRESETS\[visualProfile\.gaitStyle\]/);
  assert.match(game, /visualProfile\\.gaitStyle === 'shambling'/);
  assert.match(game, /visualProfile\\.gaitStyle === 'limping'/);
  assert.match(game, /visualProfile\\.gaitStyle === 'robotic'/);
});

test('each imported rig gets a role-specific size and only creature/boss assets override bespoke human models', async () => {
  const [profiles, assets, game] = await Promise.all([
    import('../src/enemyVisualProfiles.ts'),
    import('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
  ]);
  assert.equal(profiles.ENEMY_VISUAL_PROFILES.architect.gobkitModel, undefined);
  assert.equal(profiles.ENEMY_VISUAL_PROFILES.inspector.gobkitModel, undefined);
  assert.equal(profiles.ENEMY_VISUAL_PROFILES.kurier.gobkitModel, undefined);
  assert.equal(profiles.ENEMY_VISUAL_PROFILES.bosman_krakow.gobkitModel, undefined);
  assert.equal(profiles.ENEMY_VISUAL_PROFILES.zombie_pracownik.gobkitModel, 'stitchedbrute');
  assert.equal(profiles.ENEMY_VISUAL_PROFILES.elite_walczak_guard.gobkitModel, 'bloodirongrunt');
  assert.equal(assets.ENEMY_GOBKIT_MODELS.zombie_pracownik, 'stitchedbrute');
  assert.equal(assets.ENEMY_GOBKIT_MODELS.elite_walczak_guard, 'bloodirongrunt');
  assert.match(game, /fitGobkitModel\(root, visualProfile\.targetHeight/);
});


test('player hit reaction is independent from the attack timer and both use pivot-based arm posing', async () => {
  const game = await read('../src/game.ts');
  const attackStart = game.indexOf('if (this.attackSwingTimer > 0 && this.attackSwingDuration > 0)');
  const hitStart = game.indexOf('if (this.playerHitReactTimer > 0 && this.playerHitReactDuration > 0)');
  assert.ok(attackStart >= 0 && hitStart > attackStart);
  const between = game.slice(attackStart, hitStart);
  assert.match(between, /addProceduralLimbPose\(\s*this\.rightArm/);
  assert.match(between, /addProceduralLimbPose\(\s*this\.leftArm/);
  assert.match(between, /\n      \}\s*\n\s*\/\/ Hit reaction is an additive layer/);
  assert.match(game, /this\.playerHitReactTimer = this\.playerHitReactDuration/);
  assert.match(game, /addProceduralLimbPose\(this\.leftArm, 0\.46 \* hit/);
  assert.doesNotMatch(game, /e\.legL\.rotation\.x = Math\.sin\(e\.walkCycle\)/);
  assert.doesNotMatch(game, /const armSwing = Math\.sin\(e\.walkCycle\)/);
});

test('defeated enemies remain visible through a short death animation before cleanup', async () => {
  const [game, types] = await Promise.all([
    read('../src/game.ts'),
    read('../src/types.ts'),
  ]);
  assert.match(types, /deathVisualTimer\?: number/);
  assert.match(types, /deathVisualRest\?: \{/);
  assert.match(game, /private beginEnemyDeathVisual\(enemy: EnemyItem\)/);
  assert.match(game, /private updateDefeatedEnemyVisual\(enemy: EnemyItem, dt: number\)/);
  assert.match(game, /e\.state === 'defeated'\)\s*\{\s*this\.updateDefeatedEnemyVisual\(e, dt\)/);
  assert.match(game, /this\.beginEnemyDeathVisual\(e\)/);
  assert.match(game, /mesh\.visible = true/);
  assert.match(game, /mesh\.visible = false/);
  assert.match(game, /this\.stopGobkitTrack\(track\)/);
  assert.match(game, /const duration = isBoss \? 1\.18 : 0\.82/);
  assert.match(game, /this\.requestGobkitAction\(track, 'Death', duration\)/);
});

test('ranged enemy attack poses start with launch recoil and relax after the shot', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /Projectile attacks are requested on the launch frame/);
  assert.match(game, /const reach = -0\.82 \* Math\.pow\(1 - progress, 1\.45\)/);
  assert.match(game, /const recoilRoll = 0\.07 \* Math\.pow\(1 - progress, 1\.2\)/);
  assert.match(game, /this\.requestEnemyAttackAnimation\(e, 0\.50\)/);
});

test('rebuilding an operator clears previous run attack and hit poses', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private rebuildPlayerMesh()');
  const end = game.indexOf('public startTitle()', start);
  const rebuild = game.slice(start, end);
  assert.match(rebuild, /this\.attackSwingTimer = 0/);
  assert.match(rebuild, /this\.specialSwingTimer = 0/);
  assert.match(rebuild, /this\.playerHitReactTimer = 0/);
  assert.match(rebuild, /this\.attackCooldownTimer = 0/);
});

test('enemy locomotion blends smoothly between idle, patrol and chase without duplicate gait trig calls', async () => {
  const [game, types] = await Promise.all([
    read('../src/game.ts'),
    read('../src/types.ts'),
  ]);
  assert.match(types, /gaitBlend\?: number/);
  assert.match(game, /e\.gaitBlend = THREE\.MathUtils\.damp\(e\.gaitBlend \?\? 0, targetGaitMovement, 10, dt\)/);
  assert.match(game, /const gaitWave = Math\.sin\(e\.walkCycle\)/);
  assert.match(game, /const gaitHalfWave = Math\.sin\(e\.walkCycle \* 0\.5\)/);
  assert.match(game, /const gait = gaitWave/);
  assert.match(game, /let leftArmZ = -gaitHalfWave/);
  assert.match(game, /const headBob = gaitHalfWave/);
});

test('procedural enemy rigs receive authored wind-up, strike and hit poses', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /enemy\.attackPoseDuration = poseDuration/);
  assert.match(game, /enemy\.attackPoseTimer = poseDuration/);
  assert.match(game, /const windup = progress < 0\.28/);
  assert.match(game, /const strike = progress < 0\.28/);
  assert.match(game, /const style = ENEMY_VISUAL_PROFILES\[e\.type\]\.attackStyle/);
  assert.match(game, /setProceduralLimbPose\(e\.armL/);
  assert.match(game, /setProceduralLimbPose\(e\.armR/);
  assert.match(game, /getEnemyHitPulse\(e\.hitReactTimer/);
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
  assert.ok(pkg.includes('"prebuild": "node scripts/fetch-gobkit-assets.mjs --strict && node scripts/fetch-polyhaven-assets.mjs --strict"'));
  assert.ok(pkg.includes('"predev": "node scripts/fetch-gobkit-assets.mjs && node scripts/fetch-polyhaven-assets.mjs"'));
});

test('playable operators retain the original stylized models in Survival and both PvP slots', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const built = createCharacterModel\(this\.charDef\)/);
  assert.match(game, /const built = createCharacterModel\(def\)/);
  assert.doesNotMatch(game, /void this\.attachMakeHumanOperatorModel/);
  assert.doesNotMatch(game, /void this\.attachMakeHumanEnemyModel/);
  assert.match(game, /ENEMY_VISUAL_PROFILES\[enemy\.type\]\.gobkitModel/);
  assert.match(game, /void this\.attachGobkitEnemyModel\(enemy, modelId\)/);
  assert.match(game, /createGobkitEnemyRoleSilhouette\(requestedType\)/);
});

test('CC0 enemy rigs receive a clear caricature silhouette matching their warehouse role', async () => {
  const silhouettes = await read('../src/gobkitEnemySilhouettes.ts');
  const game = await read('../src/game.ts');
  for (const role of ['architect', 'inspector', 'kurier', 'handlowiec', 'customer', 'monter', 'serwisant', 'zombie_pracownik', 'mutant_gamma_forklift', 'radioactive_pip', 'cyber_salesman', 'walczak', 'krol_leto', 'bosman_krakow', 'elite_walczak_guard']) {
    assert.match(silhouettes, new RegExp("case '" + role + "'"));
  }
  assert.match(silhouettes, /oversized sample fan/);
  assert.match(silhouettes, /exposed ribs/);
  assert.match(silhouettes, /sickly eyes/);
  assert.match(silhouettes, /Forklift mutant/);
  assert.match(silhouettes, /Werewolf foreman/);
  assert.match(silhouettes, /Elite warehouse enforcer/);
  assert.match(silhouettes, /case 'elite_walczak_guard'/);
  assert.match(game, /createGobkitEnemyRoleSilhouette/);
  assert.match(game, /actorRoleSilhouette === true/);
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
  assert.match(game, /child\.userData\.gobkitKeep = true/);
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
  assert.match(game, /private readonly enemyPendingAttackUntil = new WeakMap<EnemyItem, number>\(\)/);
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
  assert.match(game, /const visualProfile = ENEMY_VISUAL_PROFILES\[requestedType\]/);
  assert.match(game, /fitGobkitModel\(root, visualProfile\.targetHeight/);
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
    assert.match(context, /requestEnemyAttackAnimation\((e|enemy),/,
      'attack animation must be requested before: ' + marker);
  }
});


test('orphan imported rigs are cleaned without disposing shared MakeHuman assets', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private disposeUntrackedActorVisualRoot\(root: THREE\.Object3D\)/);
  assert.match(game, /if \(object\.userData\.gobkitAsset === true && object\.userData\.gobkitSharedGeometry !== true\) object\.geometry\.dispose\(\)/);
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
