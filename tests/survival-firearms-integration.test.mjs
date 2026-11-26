import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');


test('the shared ballistic model computes deterministic arc height and ground-contact timing', async () => {
  const { evaluateBallisticHeight, getBallisticGroundContactTime } = await import('../src/survivalFirearmBallistics.ts');
  const initialHeight = 0.6;
  const launchVelocity = 7.4;
  const gravity = 12.5;
  const apexTime = launchVelocity / gravity;
  const apexHeight = evaluateBallisticHeight(initialHeight, launchVelocity, gravity, apexTime);
  const landingTime = getBallisticGroundContactTime(initialHeight, launchVelocity, gravity, 0.14);
  assert.ok(apexHeight > initialHeight + 2);
  assert.ok(landingTime > apexTime && landingTime < 1.4);
  assert.ok(Math.abs(evaluateBallisticHeight(initialHeight, launchVelocity, gravity, landingTime) - 0.14) < 1e-9);
  assert.equal(getBallisticGroundContactTime(0.6, 0, 0), null);
});

test('each 3D firearm model has unique visible weapon-specific accessories and silhouette details', async () => {
  const game = await read('../src/game.ts');
  const detailParts = [
    'firearm-detail-pistol-rear-sight',
    'firearm-detail-smg-suppressor',
    'firearm-detail-smg-optic',
    'firearm-detail-rifle-optic',
    'firearm-detail-rifle-muzzle-brake',
    'firearm-detail-shotgun-shell-saddle',
    'firearm-detail-shotgun-spare-shell-',
    'firearm-detail-heavy-rifle-scope',
    'firearm-detail-heavy-rifle-bipod-',
    'firearm-detail-minigun-barrel-brace',
    'firearm-detail-minigun-belt-link-',
    'firearm-detail-rocket-shoulder-pad',
    'firearm-detail-rocket-sight',
    'firearm-detail-grenade-drum',
    'firearm-detail-flame-pressure-gauge',
    'firearm-detail-flame-tank-strap-',
    'firearm-detail-plasma-left-coil-guard',
    'firearm-detail-plasma-charge-indicator-',
    'firearm-detail-gauss-muzzle-aperture',
    'firearm-detail-gauss-cooling-vent-',
  ];
  for (const partName of detailParts) {
    assert.ok(game.includes(partName), 'missing 3D weapon detail: ' + partName);
  }
  assert.equal((game.match(/firearm-detail-/g) || []).length >= 35, true,
    'the shared 3D weapon builder must expose a substantial set of dedicated model details');
  assert.match(game, /private createSurvivalFirearmModel\(firearmId: SurvivalFirearmId\)/);
});

test('every firearm renders a unique physical projectile, muzzle signature, trail and impact in the shared game renderer', async () => {
  const [game, presentation] = await Promise.all([
    read('../src/game.ts'),
    read('../src/survivalFirearmPresentation.ts'),
  ]);
  for (const style of [
    'pistol-crack', 'smg-stutter', 'rifle-flash', 'buckshot-fan', 'heavy-charge',
    'rotary-strobe', 'rocket-ignition', 'flame-cone', 'plasma-pulse', 'grenade-launch', 'gauss-discharge',
  ]) assert.ok(presentation.includes(style), 'missing dedicated muzzle signature: ' + style);
  for (const style of [
    'warm-brass', 'compact-dash', 'copper-line', 'pellet-glint', 'heavy-streak',
    'rotary-dash', 'exhaust-smoke', 'ember-wake', 'ion-residue', 'smoke-fragment', 'magnetic-lance',
  ]) assert.ok(presentation.includes(style), 'missing dedicated projectile trail: ' + style);
  for (const style of [
    'pin-spark', 'micro-hit', 'clean-punch', 'buckshot-burst', 'armor-punch',
    'rotary-chips', 'pressure-blast', 'ember-splash', 'ion-bloom', 'fragmentation-burst', 'magnetic-punch',
  ]) assert.ok(presentation.includes(style), 'missing dedicated impact signature: ' + style);
  assert.match(game, /private createSurvivalFirearmProjectileMesh\([\s\S]*?firearm-projectile-smg-tracer-stripe[\s\S]*?firearmProjectileStyle/);
  assert.match(game, /private spawnSurvivalFirearmMuzzleFx\([\s\S]*?switch \(profile\.muzzleStyle\)/);
  assert.match(game, /const recoilKick = THREE\.MathUtils\.clamp\(profile\.recoilDepth \* 0\.18, 0\.008, 0\.045\)/,
    'every primary firearm must provide profile-scaled camera recoil');
  assert.match(game, /this\.triggerScreenShake\(recoilKick \* \(handheld \? 0\.42 : 1\), recoilDuration\)/,
    'camera recoil must be reduced on touch devices rather than omitted');
  assert.match(game, /private spawnSurvivalFirearmTrail\([\s\S]*?switch \(profile\.trailStyle\)[\s\S]*?this\.particlePool\.acquire/);
  assert.match(game, /private spawnSurvivalFirearmImpactFx\([\s\S]*?switch \(profile\.impactStyle\)/);
  assert.match(game, /opacity: firearmProfile\?\.trailOpacity/);
  assert.match(game, /profile\.muzzleLifeSeconds/);
  assert.match(game, /profile\.trailLifeSeconds/);
  assert.match(game, /pvpLastObservedRemoteShotsFired/);
  assert.match(game, /remoteShotsSinceLastSync/);
  assert.match(game, /this\.spawnSurvivalFirearmMuzzleFx\([\s\S]*?remoteFirearmDefinition\.archetype/);
  assert.match(game, /private readonly survivalFirearmProjectileVisualCache = new Map<string, THREE\.Mesh>\(\)/,
    'immutable projectile templates must be kept in a bounded per-engine cache');
  assert.match(game, /cachedTemplate\.clone\(true\) as THREE\.Mesh/,
    'new shots must clone transforms without rebuilding GPU geometry and materials');
  assert.match(game, /object\.userData\.sharedFirearmProjectileResource = true/);
  assert.match(game, /this\.disposeTemporaryObject\(template\)/,
    'cached GPU resources must be explicitly released when the game engine is disposed');
  assert.match(game, /if \(object\.userData\.sharedFirearmProjectileResource === true\) return/,
    'PVP cleanup must not dispose shared projectile resources after each shot');
  assert.doesNotMatch(game.slice(game.indexOf('private fireSurvivalFirearm('), game.indexOf('private spawnBallisticGrenadeDetonationFx(')),
    /disposeOnRemove: true/,
    'cached firearm projectiles must not be disposed individually');
  assert.doesNotMatch(game, /spawnCompactImpact\(start\.x, start\.y, start\.z, definition\.color\)/,
    'firearm muzzle effects must not be masked by the same generic three-particle burst');
});

test('the ballistic grenade is a shared 11th firearm with its own projectile, sound, reload, impact and damage source', async () => {
  const [firearms, presentation, sound, game] = await Promise.all([
    read('../src/survivalFirearms.ts'),
    read('../src/survivalFirearmPresentation.ts'),
    read('../src/sound.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(firearms, /ballistic_grenade_launcher: \{[\s\S]*?rangeMeters: 24[\s\S]*?magazineSize: 4[\s\S]*?reloadSeconds: 4\.6[\s\S]*?projectileGravity: 12\.5[\s\S]*?projectileFuseSeconds: 1\.4/);
  assert.match(presentation, /grenade: \{[\s\S]*?projectileStyle: 'grenade-ballistic'/);
  assert.match(sound, /grenade: \{ wave: 'sine'/);
  assert.match(sound, /grenade: \[108, 0\.23, 0\.15\]/);
  assert.match(game, /case 'grenade':/);
  assert.match(game, /case 'grenade-ballistic':/);
  assert.match(game, /detonateBallisticFirearmProjectile/);
  assert.match(game, /damageEnemy\(enemy, baseSplashDamage,[\s\S]*?projectile\.damageSource/);
  assert.match(game, /ballistic_grenade_launcher: 0\.58/);
});

test('primary firearms are a separate shared slot, not a perk or roulette reward', async () => {
  const [game, firearms, draft, roulette] = await Promise.all([
    read('../src/game.ts'), read('../src/survivalFirearms.ts'),
    read('../src/survivalDraft.ts'), read('../src/survivalChaosRoulette.ts'),
  ]);
  assert.match(game, /private survivalFirearm: SurvivalFirearmState = createStartingSurvivalFirearmState\(\)/);
  assert.match(game, /this\.survivalFirearm = createStartingSurvivalFirearmState\(\)/);
  assert.match(game, /private fireSurvivalFirearm\(target\?: EnemyItem\)/);
  assert.match(game, /this\.fireSurvivalFirearm\(target\)/);
  assert.match(game, /rollSurvivalFirearmDrop\(\s*this\.survivalFirearmKillCount/);
  assert.match(game, /rollSurvivalFirearmId\(this\.survivalFirearm\.id/);
  assert.match(firearms, /STARTING_SURVIVAL_FIREARM: SurvivalFirearmId = 'starter_pistol'/);
  assert.doesNotMatch(draft, /SurvivalFirearmId|firearm:/);
  assert.doesNotMatch(roulette, /SurvivalFirearmId|firearm:/);
  assert.match(draft, /isLegacyWeaponOffer/);
  assert.doesNotMatch(roulette, /weapon_draft/);
});

test('firearm pickups are physical 3D models with weapon-specific silhouettes', async () => {
  const game = await read('../src/game.ts');
  const dropFactory = game.slice(
    game.indexOf('private createSurvivalFirearmDropVisual'),
    game.indexOf('private spawnSurvivalFirearmDrop', game.indexOf('private createSurvivalFirearmDropVisual')),
  );
  const modelFactory = game.slice(
    game.indexOf('private createSurvivalFirearmModel'),
    game.indexOf('private updateHeldSurvivalFirearmVisual', game.indexOf('private createSurvivalFirearmModel')),
  );
  assert.match(game, /private createSurvivalFirearmDropVisual\(firearmId: SurvivalFirearmId\)/);
  assert.match(dropFactory, /createSurvivalFirearmModel\(firearmId\)/);
  assert.doesNotMatch(dropFactory, /CanvasTexture|THREE\.Sprite/);
  assert.match(modelFactory, /new THREE\.Mesh\(new THREE\.BoxGeometry/);
  assert.match(modelFactory, /new THREE\.Mesh\(new THREE\.CylinderGeometry/);
  for (const archetype of ['pistol', 'smg', 'rifle', 'shotgun', 'heavy-rifle', 'minigun', 'rocket', 'flame', 'plasma', 'gauss', 'grenade']) {
    assert.ok(modelFactory.includes("case '" + archetype + "':"), 'missing 3D model: ' + archetype);
  }
  assert.match(game, /drop\.mesh\.position\.y = drop\.baseY \+ 0\.13 \+ Math\.sin/);
  assert.match(game, /const distance = Math\.hypot\(drop\.x - this\.playerPos\.x/);
  assert.ok(game.includes('const storedFirearmState = this.survivalFirearmStates.get(drop.firearmId)'));
  assert.match(game, /gun\.position\.set\(\s*0,\s*-0\.36 - reloadDip \* 0\.12/);
  for (const part of ['firearm-magazine', 'firearm-bolt', 'firearm-pump', 'firearm-rotor', 'firearm-rocket-cell', 'firearm-tank-valve', 'firearm-coils', 'firearm-energy-cell']) {
    assert.ok(modelFactory.includes("'" + part + "'"), 'missing animated model part: ' + part);
  }
  const minigunModel = modelFactory.slice(modelFactory.indexOf("case 'minigun':"), modelFactory.indexOf("case 'rocket':"));
  assert.match(minigunModel, /addMagazine\(/, 'minigun needs a visible feed drum that can drop during reload');
  assert.match(game, /SURVIVAL_FIREARM_DROP_POLICY\.dropLifetimeSeconds/);
});

test('magazine, reload, projectile archetype and damage are driven by the active firearm profile', async () => {
  const [game, firearms] = await Promise.all([read('../src/game.ts'), read('../src/survivalFirearms.ts')]);
  assert.match(game, /private reloadSurvivalFirearm\(\)/);
  assert.match(game, /public requestSurvivalFirearmReload\(\)/);
  assert.match(game, /private updateHeldSurvivalFirearmAction\(dt: number\)/);
  assert.match(game, /this\.survivalFirearm\.reloadRemaining = definition\.reloadSeconds/);
  assert.match(game, /survivalFirearmRecoilTimer = SURVIVAL_FIREARM_PRESENTATION\[definition\.archetype\]\.recoilSettleSeconds/);
  assert.match(game, /if \(firearm\.ammoInMagazine <= 0\)/);
  assert.match(game, /createSurvivalFirearmProjectileMesh\(definition\.archetype, definition\.color, definition\.projectileRadius\)/);
  assert.match(game, /case 'rocket':[\s\S]*?geometry = new THREE\.CylinderGeometry/);
  assert.match(game, /case 'flame':[\s\S]*?geometry = new THREE\.ConeGeometry/);
  assert.match(game, /firearm-rocket-exhaust-outer/);
  assert.match(game, /firearm-rocket-exhaust-core/);
  assert.match(game, /firearm-flame-projectile-core/);
  assert.match(game, /private spawnFlamethrowerMuzzleJet\(/);
  assert.match(game, /private spawnRocketDetonationFx\(/);
  assert.match(game, /private detonateRocketFirearmProjectile\(/);
  assert.match(game, /spawnSurvivalFirearmMuzzleFx\(definition\.archetype, definition\.color, start, forward\)/);
  assert.match(game, /getSurvivalFirearmCyclePose\(archetype, cycleProgress\)/);
  assert.match(game, /cyclePose\.boltOffsetZ/);
  assert.match(game, /cyclePose\.pumpOffsetZ/);
  assert.match(game, /cyclePose\.rotorSpin/);
  assert.match(game, /case 'gauss':/);
  assert.match(game, /firearmProjectile: true/);
  assert.match(game, /firearmExplosion: definition\.archetype === 'rocket' \|\| definition\.archetype === 'grenade'/);
  assert.match(firearms, /rocket_launcher: \{[\s\S]*?detonateOnImpact: true/);
  assert.match(game, /p\.firearmId === 'rocket_launcher'[\s\S]*?this\.detonateRocketFirearmProjectile/);
  assert.doesNotMatch(game, /p\.firearmId !== 'ballistic_grenade_launcher'\) sound\.playBossWarning/);
  assert.match(game, /aoeDamageMultiplier: definition\.aoeDamageMultiplier/);
  assert.match(game, /damageSource: getSurvivalFirearmDamageSource\(definition\.id\)/);
  assert.match(game, /const adjustedProjectileDamage = p\.firearmProjectile/);
});


test('every primary firearm has a unique hard range and that range is enforced in gameplay', async () => {
  const [game, firearms] = await Promise.all([read('../src/game.ts'), read('../src/survivalFirearms.ts')]);
  for (const [id, range] of [
    ['starter_pistol', 28], ['smg_45', 23], ['assault_rifle', 38], ['shotgun_12g', 10],
    ['battle_rifle', 46], ['minigun', 29], ['rocket_launcher', 34], ['flamethrower', 6],
    ['plasma_rifle', 32], ['gauss_rifle', 80], ['ballistic_grenade_launcher', 24],
  ]) {
    assert.match(firearms, new RegExp(id + ': \\{[\\s\\S]*?rangeMeters: ' + range));
  }
  assert.ok(game.includes('firearmRange * this.survivalRangeMultiplier'));
  assert.ok(game.includes('maxRangeMeters: effectiveRangeMeters'));
  assert.ok(game.includes("const effectiveRangeMeters = definition.rangeMeters * (this.gameMode === 'survival' ? this.survivalRangeMultiplier : 1)"));
  assert.ok(game.includes('p.travelledDistance = (p.travelledDistance ?? 0) + frameDistance'));
  assert.ok(game.includes('if (p.travelledDistance >= p.maxRangeMeters - 0.0001) p.life = 0'));
});

test('firearm drops are shared by Survival and Campaign and use the central bounded policy', async () => {
  const [game, firearms] = await Promise.all([read('../src/game.ts'), read('../src/survivalFirearms.ts')]);
  assert.match(firearms, /SURVIVAL_FIREARM_DROP_POLICY/);
  assert.match(game, /SURVIVAL_FIREARM_DROP_POLICY/);
  assert.match(game, /if \(this\.gameMode === 'survival' \|\| this\.gameMode === 'campaign'\) \{[\s\S]*?this\.survivalFirearmKillCount\+\+/);
  assert.match(game, /const firearmElapsed = this\.survivalElapsed/);
  assert.match(game, /campaignRemainingSeconds: this\.campaignStage \? Math\.max\(0, Math\.ceil\(this\.campaignStage\.durationSeconds - this\.survivalElapsed\)\)/);
  assert.match(game, /firearmElapsed >= SURVIVAL_FIREARM_DROP_POLICY\.unlockElapsedSeconds/);
  assert.match(game, /this\.survivalFirearmKillCount >= SURVIVAL_FIREARM_DROP_POLICY\.minimumKills/);
  assert.match(game, /this\.survivalFirearmDrops\.length < SURVIVAL_FIREARM_DROP_POLICY\.maximumActiveDrops/);
  assert.match(game, /firearmElapsed - this\.survivalFirearmLastDropSeconds >= SURVIVAL_FIREARM_DROP_POLICY\.minimumIntervalSeconds/);
  assert.match(game, /SURVIVAL_FIREARM_DROP_POLICY\.dropLifetimeSeconds/);
  assert.match(game, /SURVIVAL_FIREARM_DROP_POLICY\.pityMisses/);
  assert.match(game, /this\.gameMode !== 'survival' && this\.gameMode !== 'campaign'/);
  assert.match(game, /const currentGameMode = this\.gameMode;\s*if \(currentGameMode !== 'pvp'\) \{\s*this\.fireSurvivalFirearm\(\)/);
  assert.match(game, /if \(this\.gameMode === 'pvp'\) \{\s*this\.updatePvpMode/);
});

test('each firearm archetype has a dedicated synthesized report rather than a melee whoosh', async () => {
  const sound = await read('../src/sound.ts');
  assert.match(sound, /public playFirearmShot\(archetype:/);
  const profilesStart = sound.indexOf('const profiles = {');
  const profilesEnd = sound.indexOf('} as const', profilesStart);
  const profileSource = sound.slice(profilesStart, profilesEnd);
  for (const archetype of ['pistol', 'smg', 'rifle', 'shotgun', 'heavy-rifle', 'minigun', 'rocket', 'flame', 'plasma', 'gauss', 'grenade']) {
    assert.ok(profileSource.includes(archetype), 'missing audio profile: ' + archetype);
  }
  assert.equal((profileSource.match(/wave:/g) || []).length, 11);
  assert.match(sound, /body\.frequency\.exponentialRampToValueAtTime/);
  assert.match(sound, /transientEnvelope\.gain\.exponentialRampToValueAtTime/);
  const game = await read('../src/game.ts');
  assert.match(game, /sound\.playFirearmShot\(definition\.archetype\)/);
});

test('Survival HUD exposes the active primary firearm and removes the retired module rack', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'), read('../src/index.ts'), read('../src/hud-layout.css')
  ]);
  for (const id of ['survival-firearm-status', 'survival-firearm-icon', 'survival-firearm-name', 'survival-firearm-ammo', 'survival-firearm-reload', 'survival-firearm-ammo-fill', 'survival-firearm-action-fill', 'btn-survival-reload']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing HUD field ' + id);
  }
  assert.doesNotMatch(html, /survival-weapons-list|survival-weapon-rack-label/);
  assert.match(html, /survival-firearm-name/);
  assert.match(app, /const primaryFirearm = snapshot\.primaryFirearm/);
  assert.match(app, /primaryFirearm\.ammoInMagazine/);
  assert.match(app, /primaryFirearm\.reloadRemainingSeconds/);
  assert.match(app, /primaryFirearm\.reloadDurationSeconds/);
  assert.match(app, /primaryFirearm\.fireCooldownSeconds/);
  assert.match(app, /const reloadProgress = reloading/);
  assert.match(app, /const cycleProgress = cycling/);
  assert.match(css, /survival-firearm-action-track/);
  assert.match(css, /survival-firearm-ammo/);
  assert.doesNotMatch(app, /survival-weapons-list/);
});


test('the armory explains drop odds and renders a dedicated 3D grenade-launcher icon', async () => {
  const [html, app, firearms] = await Promise.all([read('../index.html'), read('../src/index.ts'), read('../src/survivalFirearms.ts')]);
  assert.ok(html.includes('id="armory-drop-policy"'));
  assert.ok(app.includes('SURVIVAL_FIREARM_DROP_POLICY'));
  assert.ok(app.includes('firearmDropPolicyElement.textContent'));
  const iconStart = app.indexOf('const renderSurvivalFirearmCatalogIcon');
  const iconEnd = app.indexOf('// Build the armory', iconStart);
  assert.ok(iconStart >= 0 && iconEnd > iconStart);
  const iconBuilder = app.slice(iconStart, iconEnd);
  assert.ok(iconBuilder.includes("case 'grenade': {"));
  assert.ok(iconBuilder.includes('CylinderGeometry') && iconBuilder.includes('drum'));
  for (const name of ['Pojedynczy, celny strzał do kontrolowania tempa walki', 'Ciężka salwa siedmiu śrutów', 'Wyrzuca ciężki granat po łuku balistycznym', 'Ładuje i wystrzeliwuje długą lancę elektromagnetyczną']) {
    assert.ok(firearms.includes(name), 'missing tactical armory description: ' + name);
  }
});
test('the armory menu is a real navigation destination driven by live firearm definitions', async () => {
  const [html, app, css, menu] = await Promise.all([
    read('../index.html'), read('../src/index.ts'), read('../src/firearm-armory.css'), read('../src/menuSegments.ts'),
  ]);
  assert.match(html, /data-tab="tab-arsenal"/);
  assert.match(html, /id="tab-arsenal" class="tab-panel firearm-armory-panel"/);
  assert.match(html, /id="firearm-catalog-grid"/);
  assert.ok(app.includes("import { getSurvivalFirearmAmmoAlert, SURVIVAL_FIREARM_DEFS, SURVIVAL_FIREARM_DROP_POLICY } from './survivalFirearms.ts'"));
  assert.ok(app.includes('firearm.rangeMeters'));
  assert.ok(app.includes('firearm.damage'));
  assert.ok(app.includes('firearm.fireIntervalSeconds'));
  assert.ok(app.includes('firearm.reloadSeconds'));
  assert.ok(css.includes('#title-screen #tab-arsenal .armory-grid'));
  assert.match(menu, /'tab-arsenal'/);
});

test('each firearm keeps its own magazine and reload progress when swapped out', async () => {
  const game = await read('../src/game.ts');
  assert.ok(game.includes('private survivalFirearmStates = new Map<SurvivalFirearmId, SurvivalFirearmState>()'));
  assert.match(game, /survivalFirearmStates\.set\(this\.survivalFirearm\.id, this\.survivalFirearm\)/);
  assert.ok(game.includes('const storedFirearmState = this.survivalFirearmStates.get(drop.firearmId)'));
  assert.match(game, /this\.survivalFirearmStates\.clear\(\)/);
  assert.match(game, /sound\.playFirearmReload\(definition\.archetype, 'start'\)/);
  assert.match(game, /sound\.playFirearmReload\(definition\.archetype, 'complete'\)/);
});

test('firearm hits use distinct synthesized impact audio and class-specific hit effects', async () => {
  const [game, sound] = await Promise.all([read('../src/game.ts'), read('../src/sound.ts')]);
  assert.ok(sound.includes('public playFirearmReload(archetype:'));
  assert.ok(sound.includes('public playFirearmImpact(archetype:'));
  assert.match(game, /sound\.playFirearmImpact\(SURVIVAL_FIREARM_DEFS\[p\.firearmId\]\.archetype\)/);
  for (const archetype of ['shotgun', 'rocket', 'flame', 'plasma', 'gauss', 'heavy-rifle', 'minigun']) {
    assert.ok(game.includes("case '" + archetype + "':"), 'missing hit feedback: ' + archetype);
  }
});

test('all eleven firearm rates are slower and every firing animation has a deliberate weapon-specific duration', async () => {
  const [game, firearms] = await Promise.all([read('../src/game.ts'), read('../src/survivalFirearms.ts')]);
  assert.match(game, /private readonly survivalFirearmAttackAnimationSeconds: Readonly<Record<SurvivalFirearmId, number>>/);
  const timingBlock = game.slice(
    game.indexOf('private readonly survivalFirearmAttackAnimationSeconds:'),
    game.indexOf('};', game.indexOf('private readonly survivalFirearmAttackAnimationSeconds:')) + 2,
  );
  for (const [id, duration] of Object.entries({
    starter_pistol: 0.28, smg_45: 0.17, assault_rifle: 0.24, shotgun_12g: 0.48, battle_rifle: 0.46,
    minigun: 0.18, rocket_launcher: 0.62, flamethrower: 0.20, plasma_rifle: 0.32, gauss_rifle: 0.54,
    ballistic_grenade_launcher: 0.58,
  })) {
    assert.ok(timingBlock.includes(id + ': ' + duration), 'wrong attack animation duration: ' + id);
  }
  assert.match(firearms, /fireIntervalSeconds: 2\.15/);
  assert.match(firearms, /reloadSeconds: 4\.60/);
  for (const id of ['starter_pistol', 'smg_45', 'assault_rifle', 'shotgun_12g', 'battle_rifle', 'minigun', 'rocket_launcher', 'flamethrower', 'plasma_rifle', 'gauss_rifle']) {
    assert.ok(firearms.includes(id + ':'), 'missing firearm definition: ' + id);
    assert.ok(game.includes(id + ':'), 'missing firing animation profile: ' + id);
  }
});

test('pistol, SMG, rifle and minigun use distinct projectile silhouettes', async () => {
  const game = await read('../src/game.ts');
  const presentation = await read('../src/survivalFirearmPresentation.ts');
  for (const style of ['pistol-slug', 'compact-tracer', 'rifle-tracer', 'buckshot', 'heavy-slug', 'rotary-tracer', 'rocket', 'flame', 'plasma', 'gauss-lance', 'grenade-ballistic']) {
    assert.ok(presentation.includes("projectileStyle: '" + style + "'"), 'missing projectile profile ' + style);
  }
  assert.match(game, /case 'pistol-slug':\s*geometry = new THREE\.CylinderGeometry/);
  assert.match(game, /case 'compact-tracer':\s*geometry = new THREE\.BoxGeometry/);
  assert.match(game, /case 'rifle-tracer':\s*geometry = new THREE\.CylinderGeometry/);
  assert.match(game, /case 'rotary-tracer':\s*geometry = new THREE\.BoxGeometry/);
});


test('the armory renders individual firearm icons from actual Three.js meshes, not emoji glyphs', async () => {
  const app = await read('../src/index.ts');
  assert.match(app, /new THREE\.WebGLRenderer\(\{ alpha: true, antialias: true, preserveDrawingBuffer: true \}\)/);
  assert.match(app, /renderSurvivalFirearmCatalogIcon\(firearm\.archetype, firearm\.color\)/);
  assert.match(app, /new THREE\.BoxGeometry/);
  assert.match(app, /new THREE\.CylinderGeometry/);
  assert.match(app, /iconData && icon instanceof HTMLImageElement/);
});
test('Survival haste is capped so operator synergies cannot undo the slower primary-firearm cadence', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const uncappedAttackRate = this\.gameMode === 'survival'/);
  assert.match(game, /const attackRate = Math\.min\(1\.05, Math\.max\(0\.65, uncappedAttackRate\)\)/);
  assert.match(game, /firearm\.cooldown = definition\.fireIntervalSeconds \* hasteFactor \/ attackRate/);
});

// VFX regression coverage also guards against stale generic rocket and flame projectiles.
