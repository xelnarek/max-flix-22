import assert from 'node:assert/strict';
import * as THREE from 'three';
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
test('all humanoid and creature enemies use bundled animated GLB rigs; only four non-humanoid archetypes stay bespoke', async () => {
  const [profiles, assets, downloader] = await Promise.all([
    import('../src/enemyVisualProfiles.ts'),
    import('../src/gobkitAssets.ts'),
    read('../scripts/fetch-gobkit-assets.mjs'),
  ]);
  const bespoke = new Set(['forklift', 'agv_robot', 'piorun_dron', 'pomazaniec']);
  assert.equal(Object.keys(profiles.ENEMY_VISUAL_PROFILES).length, 23);
  const mapped = Object.entries(profiles.ENEMY_VISUAL_PROFILES).filter(([type]) => !bespoke.has(type));
  assert.equal(mapped.length, 19);
  for (const [type, profile] of Object.entries(profiles.ENEMY_VISUAL_PROFILES)) {
    if (bespoke.has(type)) {
      assert.equal(profile.gobkitModel, undefined, type + ' must keep its purpose-built non-humanoid model');
      continue;
    }
    assert.ok(profile.gobkitModel, 'missing imported enemy rig for ' + type);
    assert.equal(assets.ENEMY_GOBKIT_MODELS[type], profile.gobkitModel, 'runtime registry mismatch for ' + type);
    assert.equal(assets.GOBKIT_MODEL_FILES[profile.gobkitModel], profile.gobkitModel + '.glb');
    assert.ok(downloader.includes("'" + profile.gobkitModel + "'"), 'build does not download ' + profile.gobkitModel);
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
  assert.equal(module.ENEMY_VISUAL_PROFILES.customer.gaitStyle, 'nervous');
  assert.equal(module.ENEMY_VISUAL_PROFILES.handlowiec.gaitStyle, 'swagger');
  assert.equal(module.ENEMY_VISUAL_PROFILES.monter.gaitStyle, 'braced');
  assert.equal(module.ENEMY_VISUAL_PROFILES.walczak.gaitStyle, 'stalking');
  assert.equal(module.ENEMY_VISUAL_PROFILES.pan_roman.gaitStyle, 'uneven');
  assert.match(profilesSource, /ENEMY_GAIT_PRESETS/);
  assert.match(game, /const gaitPreset = ENEMY_GAIT_PRESETS\[visualProfile\.gaitStyle\]/);
  assert.match(game, /visualProfile\.gaitStyle === 'shambling'/);
  assert.match(game, /visualProfile\.gaitStyle === 'limping'/);
  assert.match(game, /visualProfile\.gaitStyle === 'robotic'/);
  assert.match(game, /const actionProgress = activeClipAction && activeClipDuration > 0/);
  assert.match(game, /activeAction,\s*actionProgress,/);
});

test('each imported enemy rig is role-mapped, correctly fitted and attached to the live enemy container', async () => {
  const [profiles, assets, game] = await Promise.all([
    import('../src/enemyVisualProfiles.ts'),
    import('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
  ]);
  for (const [type, model] of [
    ['customer', 'shoplifter'],
    ['architect', 'officemanager'],
    ['inspector', 'hazmattech'],
    ['handlowiec', 'salesrep'],
    ['monter', 'forcibleentryfirefighter'],
    ['kurier', 'foodcourier'],
    ['przedstawiciel_włoski', 'storemanager'],
    ['sztaplar_szalony', 'baggagehandler'],
    ['pan_roman', 'stockclerk'],
    ['serwisant', 'firechief'],
    ['bosman_krakow', 'securityguard'],
    ['sebix_m', 'bloodirongrunt'],
    ['zombie_pracownik', 'stitchedbrute'],
    ['elite_walczak_guard', 'bloodirongrunt'],
  ]) {
    assert.equal(profiles.ENEMY_VISUAL_PROFILES[type].gobkitModel, model);
    assert.equal(assets.ENEMY_GOBKIT_MODELS[type], model);
  }
  assert.match(game, /fitGobkitModel\(root, visualProfile\.targetHeight/);
  assert.match(game, /void this\.attachGobkitEnemyModel\(enemy, modelId\)/);
  assert.match(game, /this\.hideProceduralVisuals\(mesh as THREE\.Group, overlays\)/);
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
  assert.match(game, /addProceduralLimbPose\(this\.leftArm, reaction\.armRecoil \* hit/);
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
  assert.match(game, /getEnemyDeathMotionProfile\(enemy\.type\)\.duration/);
  assert.match(game, /getEnemyDeathMotionPose\(enemy\.type, progress, side\)/);
  assert.match(game, /this\.requestGobkitAction\(track, 'Death', duration\)/);
});

test('ranged enemy attack poses start with launch recoil and relax after the shot', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /Projectile attacks are requested on the launch frame/);
  assert.match(game, /const reach = -0\.82 \* Math\.pow\(1 - progress, 1\.45\)/);
  assert.match(game, /const recoilRoll = 0\.07 \* Math\.pow\(1 - progress, 1\.2\)/);
  assert.match(game, /this\.beginEnemyRangedAttackTelegraph\(e\)/);
  assert.match(game, /this\.requestEnemyAttackAnimation\(enemy, profile\.windupSeconds\s*\/\s*0\.60\)/);
  assert.match(game, /private advanceEnemyRangedAttackTelegraph\(enemy: EnemyItem, dt: number\)/);
  assert.match(game, /this\.advanceEnemyRangedAttackTelegraph\(e, dt\)/);
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
  assert.match(game, /const style = visualProfile\.attackStyle/);
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
  assert.ok(pkg.includes('"prebuild": "node scripts/fetch-base44-enemy-assets.mjs --strict && node scripts/fetch-gobkit-assets.mjs --strict && node scripts/fetch-polyhaven-assets.mjs --strict"'));
  assert.ok(pkg.includes('"predev": "node scripts/fetch-base44-enemy-assets.mjs && node scripts/fetch-gobkit-assets.mjs && node scripts/fetch-polyhaven-assets.mjs"'));
});

test('playable operators retain the original stylized models in Survival and both PvP slots', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const built = createCharacterModel\(this\.charDef\)/);
  assert.match(game, /const built = createCharacterModel\(def\)/);
  assert.doesNotMatch(game, /void this\.attachMakeHumanOperatorModel/);
  assert.doesNotMatch(game, /void this\.attachMakeHumanEnemyModel/);
  assert.match(game, /visualProfile\.base44Model \?\? visualProfile\.gobkitModel/);
  assert.match(game, /void this\.attachGobkitEnemyModel\(enemy, modelId\)/);
  assert.match(game, /createEnemyRoleKit\(requestedType, root\)/);
});

test('CC0 enemy rigs receive articulated, role-specific body shapes and equipment', async () => {
  const kits = await read('../src/enemyRoleKits.ts');
  const game = await read('../src/game.ts');
  for (const role of ['architect', 'inspector', 'kurier', 'handlowiec', 'customer', 'monter', 'serwisant', 'przedstawiciel_włoski', 'sztaplar_szalony', 'pan_roman', 'sebix_m', 'zombie_pracownik', 'mutant_gamma_forklift', 'radioactive_pip', 'cyber_salesman', 'walczak', 'krol_leto', 'bosman_krakow', 'elite_walczak_guard']) {
    assert.ok(kits.includes(role + ':'), 'missing geometry profile: ' + role);
  }
  assert.match(kits, /case 'wolf'/);
  assert.match(kits, /case 'gasMask'/);
  assert.match(kits, /case 'crown'/);
  assert.match(kits, /case 'forks'/);
  assert.match(kits, /bone\.attach\(attachment\)/);
  assert.match(kits, /out\[a\]\.name='role-kit-'\+a/);
  assert.match(kits, /out\[a\]\.userData\.actorRigAnchor=a/);
  assert.match(game, /createEnemyRoleKit\(requestedType, root\)/);
  assert.match(game, /ENEMY_GAIT_PRESETS\[ENEMY_VISUAL_PROFILES\[enemy\.type\]\.gaitStyle\]/);
});


test('articulated role kits merge by rig anchor and share immutable crowd geometry', async () => {
  const kits = await read('../src/enemyRoleKits.ts');
  assert.match(kits, /mergeGeometries\(parts,false\)/);
  assert.match(kits, /vertexColors:true/);
  assert.match(kits, /const templates\s*=\s*new Map<EnemyType,\s*THREE\.Group\s*\|\s*null>\(\)/);
  assert.match(kits, /mesh\.castShadow=false/);
  assert.match(kits, /mesh\.userData\.gobkitSharedGeometry=true/);
  assert.match(kits, /sharedKitMaterial\.userData\.gobkitSharedMaterial\s*=\s*true/);
  assert.match(kits, /template\.clone\(true\)/);
  assert.match(kits, /actorRoot\.userData\.enemyRoleKit=type/);
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

test('late enemy model attachment cannot reveal both the full rig and its LOD proxy after defeat', async () => {
  const game = await read('../src/game.ts');
  const attachStart = game.indexOf('private installEnemyVisualLodProxy(enemy: EnemyItem, fullRoot: THREE.Group)');
  const attachEnd = game.indexOf('\n  }', attachStart) + 4;
  assert.ok(attachStart >= 0 && attachEnd > attachStart, 'enemy LOD attachment method should exist');
  const attach = game.slice(attachStart, attachEnd);
  assert.match(attach, /enemy\.state === 'defeated' \|\| mesh\.userData\.actorDeathVisualLocked === true/);
  assert.match(attach, /proxy\.visible = false/);
  assert.match(attach, /fullRoot\.visible = !deathVisualLocked/);
  assert.doesNotMatch(attach, /proxy\.visible = !deathVisualLocked/);
  const lodStart = game.indexOf('const deathVisualLocked = enemy.state === \'defeated\'', attachEnd);
  assert.ok(lodStart > attachEnd, 'runtime LOD update should enforce the death visibility lock');
  const lodSlice = game.slice(lodStart, lodStart + 700);
  assert.match(lodSlice, /const useProxy = !deathVisualLocked/);
  assert.match(lodSlice, /lodProxy\.visible = useProxy/);
  assert.match(lodSlice, /fullVisual\.visible = !useProxy/);
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
  assert.match(game, /this\.createGobkitAnimationTrack\(\s*gltf,\s*root,\s*mesh\.position/);
});


test('ranged and special enemy attacks release only after their wind-up or committed boss charge', async () => {
  const game = await read('../src/game.ts');
  for (const marker of [
    'this.spawnPenaltyNotice(e.x, e.y + 1.2, e.z)',
    'this.spawnDyscyplinarkaNotice(e.x, e.y + 1.2, e.z, lockedDirection)',
    'this.spawnSparkZapProjectile(e.x, e.y + 0.75, e.z, lockedDirection)',
    'this.spawnPomazaniecLollipop(',
    'this.spawnSanitarywareProjectile(e.x, e.y + 0.8, e.z, release.direction)',
    'this.spawnOdprawaClipboardProjectile(e.x, e.y + 1.0, e.z, lockedDirection)',
    'this.spawnSebixBrick(enemy.x,enemy.y+1.35',
  ]) {
    assert.ok(game.includes(marker), 'missing ranged/special release: ' + marker);
  }
  assert.match(game, /this\.requestEnemyAttackAnimation\(enemy, profile\.windupSeconds\s*\/\s*0\.60\)/);
  assert.match(game, /const release = this\.advanceEnemyRangedAttackTelegraph\(e, dt\)/);
  assert.match(game, /this\.beginEnemyRangedAttackTelegraph\(e\)/);
});


test('orphan imported rigs are cleaned without disposing shared MakeHuman assets', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private disposeUntrackedActorVisualRoot\(root: THREE\.Object3D\)/);
  assert.match(game, /object\.userData\.gobkitAsset === true/);
  assert.match(game, /object\.userData\.gobkitSharedGeometry !== true/);
  assert.match(game, /object\.userData\.actorLodSharedGeometry !== true/);
  assert.match(game, /material\.userData\.actorLodSharedMaterial !== true/);
  assert.match(game, /material\.userData\.makeHumanShared !== true/);
  assert.match(game, /this\.disposeUntrackedActorVisualRoot\(child\)/);
});


test('Gobkit rig clones share immutable geometry and marked source materials without cloning the mesh resources', async () => {
  const [assets, game] = await Promise.all([
    read('../src/gobkitAssets.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(assets, /cloneSkinnedScene\(gltf\.scene\)/);
  assert.match(assets, /object\.userData\.gobkitSharedGeometry = true/);
  assert.doesNotMatch(assets, /object\.geometry = object\.geometry\.clone\(\)/);
  assert.match(assets, /material\.userData\.gobkitSharedMaterial = true/);
  assert.doesNotMatch(assets, /object\.material\.clone\(\)/);
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
  assert.match(game, /this\.specialSwingTimer = 0\.86 \* abilityDurationScale/);
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

test('enemy archetypes share only the two documented source-rig pairs, never stack two rigs on one entity', async () => {
  const { ENEMY_GOBKIT_MODELS } = await import('../src/gobkitAssets.ts');
  const byModel = new Map();
  for (const [enemy, model] of Object.entries(ENEMY_GOBKIT_MODELS)) {
    const group = byModel.get(model) || [];
    group.push(enemy);
    byModel.set(model, group);
  }
  const shared = [...byModel.entries()]
    .filter(([, enemies]) => enemies.length > 1)
    .map(([model, enemies]) => ({ model, enemies: enemies.sort() }))
    .sort((a, b) => a.model.localeCompare(b.model));
  assert.deepEqual(shared, [
    { model: 'bloodirongrunt', enemies: ['elite_walczak_guard', 'sebix_m'] },
    { model: 'bloodironjuggernaut', enemies: ['krol_leto', 'mutant_gamma_forklift'] },
  ]);
  const game = await read('../src/game.ts');
  assert.match(game, /this\.removeAttachedActorVisuals\(group\);[\s\S]{0,180}root\.visible = true/);
  assert.match(game, /disposeActorOwnedRenderResources\(mesh\)/);
});

test('Gobkit actor clones keep unique skeleton roots while sharing immutable source geometry and materials', async () => {
  const { cloneGobkitModel, fitGobkitModel } = await import('../src/gobkitAssets.ts');
  const source = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  source.add(new THREE.Mesh(geometry, material));
  const first = cloneGobkitModel({ scene: source });
  const second = cloneGobkitModel({ scene: source });
  const firstMesh = first.children[0];
  const secondMesh = second.children[0];

  assert.notEqual(first, second);
  assert.notEqual(firstMesh, secondMesh);
  assert.equal(firstMesh.geometry, geometry);
  assert.equal(secondMesh.geometry, geometry);
  assert.equal(firstMesh.material, material);
  assert.equal(secondMesh.material, material);
  assert.equal(material.userData.gobkitSharedMaterial, true);

  const originalSetFromObject = THREE.Box3.prototype.setFromObject;
  let boundsReads = 0;
  THREE.Box3.prototype.setFromObject = function (...args) {
    boundsReads++;
    return originalSetFromObject.apply(this, args);
  };
  try {
    fitGobkitModel(first, 1.4, 1, source);
    const configuredMaterialVersion = material.version;
    fitGobkitModel(second, 1.8, 1, source);
    assert.equal(boundsReads, 1, 'shared source bounds are calculated only once per loaded rig');
    assert.equal(material.version, configuredMaterialVersion, 'spawning another clone does not dirty the shared shader again');
    assert.ok(first.scale.x > 0 && second.scale.x > first.scale.x);
  } finally {
    THREE.Box3.prototype.setFromObject = originalSetFromObject;
  }
});


test('Base44 and DCC-exported rig clips resolve to stable runtime action names', async () => {
  const { canonicalizeGobkitClipName } = await import('../src/gobkitAnimation.ts');
  assert.equal(canonicalizeGobkitClipName('Armature|Idle_01'), 'Idle');
  assert.equal(canonicalizeGobkitClipName('mixamorig:Walk_Cycle'), 'Walk');
  assert.equal(canonicalizeGobkitClipName('Character_Run_Fast'), 'Run');
  assert.equal(canonicalizeGobkitClipName('Take_02_Death'), 'Death');
  assert.equal(canonicalizeGobkitClipName('Damage_Reaction'), 'Hit');
  assert.equal(canonicalizeGobkitClipName('Uppercut_Attack'), 'Attack');
  assert.equal(canonicalizeGobkitClipName('Take_001'), null);
});

test('humanoid rigs without canonical locomotion/death clips receive articulated fallbacks', async () => {
  const { createRigLocomotionFallbackClips } = await import('../src/rigCombatClips.ts');
  const root = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'Hips'; root.add(hips);
  const spine = new THREE.Bone(); spine.name = 'Spine'; hips.add(spine);
  const chest = new THREE.Bone(); chest.name = 'Chest'; spine.add(chest);
  const head = new THREE.Bone(); head.name = 'Head'; chest.add(head);
  const leftArm = new THREE.Bone(); leftArm.name = 'LeftUpperArm'; chest.add(leftArm);
  const rightArm = new THREE.Bone(); rightArm.name = 'RightUpperArm'; chest.add(rightArm);
  const leftLeg = new THREE.Bone(); leftLeg.name = 'LeftThigh'; hips.add(leftLeg);
  const rightLeg = new THREE.Bone(); rightLeg.name = 'RightThigh'; hips.add(rightLeg);
  const clips = createRigLocomotionFallbackClips(root, 'krol_leto');
  const byName = new Map(clips.map((clip) => [clip.name, clip]));
  for (const name of ['Idle', 'Walk', 'Run', 'Death']) {
    assert.ok(byName.has(name), 'missing generated clip ' + name);
    assert.ok(byName.get(name).tracks.length >= 3, 'clip should animate multiple joints: ' + name);
    assert.ok(byName.get(name).duration > 0.4);
  }
  assert.equal(byName.get('Death').duration, 0.94);
});

test('runtime registers canonical aliases and only fills missing baseline clips', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /canonicalizeGobkitClipName\(safeClip\.name\)/);
  assert.match(game, /createRigLocomotionFallbackClips\(root, enemyType\)/);
  assert.match(game, /if \(!actions\.has\(clip\.name\)\) actions\.set\(clip\.name, mixer\.clipAction\(clip\)\)/);
});


test('imported enemy Attack clip peaks on the 60 percent telegraph release frame', async () => {
  const { createRigCombatClips } = await import('../src/rigCombatClips.ts');
  const root = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'Hips'; root.add(hips);
  const spine = new THREE.Bone(); spine.name = 'Spine'; hips.add(spine);
  const chest = new THREE.Bone(); chest.name = 'Chest'; spine.add(chest);
  const head = new THREE.Bone(); head.name = 'Head'; chest.add(head);
  const leftArm = new THREE.Bone(); leftArm.name = 'LeftUpperArm'; chest.add(leftArm);
  const rightArm = new THREE.Bone(); rightArm.name = 'RightUpperArm'; chest.add(rightArm);
  const leftForearm = new THREE.Bone(); leftForearm.name = 'LeftLowerArm'; leftArm.add(leftForearm);
  const rightForearm = new THREE.Bone(); rightForearm.name = 'RightLowerArm'; rightArm.add(rightForearm);
  const clips = createRigCombatClips(root, 'tool-melee', 'customer');
  const attack = clips.find((clip) => clip.name === 'Attack');
  assert.ok(attack, 'generated rig should have an Attack clip');
  const shoulderTrack = attack.tracks.find((track) => track.name === 'RightUpperArm.quaternion');
  assert.ok(shoulderTrack, 'attack must articulate the leading arm');
  assert.ok(Math.abs(shoulderTrack.times[2] / attack.duration - 0.60) < 0.002,
    'strike peak must coincide with the telegraph release frame');
});

test('enemy model attachment never displays the imported rig and LOD proxy together', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private installEnemyVisualLodProxy(');
  const end = game.indexOf('\n  /**', start);
  assert.ok(start >= 0 && end > start, 'enemy visual installation method must exist');
  const install = game.slice(start, end);
  assert.match(install, /proxy\.visible = false/);
  assert.match(install, /fullRoot\.visible = !deathVisualLocked/);
  assert.doesNotMatch(install, /proxy\.visible = !deathVisualLocked/);
  assert.match(game, /lodProxy\.visible = useProxy;\s*fullVisual\.visible = !useProxy/);
  assert.match(game, /if \(lodProxy\) lodProxy\.visible = false;\s*if \(fullVisual\) fullVisual\.visible = true/);
});


test('regular enemies defer expensive animated GLB rigs until they enter useful detail range', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private shouldLoadEnemyFullRig\(enemy: EnemyItem, distanceSquared: number\)/);
  assert.match(game, /const detailRadius = this\.isHandheldViewport \? 23 : 31/);
  assert.match(game, /isMajorSurvivalBossType\(enemy\.type\) \|\| enemy\.type === 'sebix_m'/);
  assert.match(game, /!this\.requestedGobkitEnemies\.has\(enemy\) && this\.shouldLoadEnemyFullRig\(enemy, distanceSquared\)/);
  assert.match(game, /this\.requestedGobkitEnemies\.delete\(enemy\)/);
});

test('enemy animation update avoids rebuilding an unused per-frame membership set', async () => {
  const game = await read('../src/game.ts');
  assert.doesNotMatch(game, /activeEnemyAnimationScratch/);
});
