import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('primary firearms are a separate shared slot, not a perk or roulette reward', async () => {
  const [game, firearms, draft, roulette] = await Promise.all([
    read('../src/game.ts'), read('../src/survivalFirearms.ts'),
    read('../src/survivalDraft.ts'), read('../src/survivalChaosRoulette.ts'),
  ]);
  assert.match(game, /private survivalFirearm: SurvivalFirearmState = createStartingSurvivalFirearmState\(\)/);
  assert.match(game, /this\.survivalFirearm = createStartingSurvivalFirearmState\(\)/);
  assert.match(game, /private fireSurvivalFirearm\(target\?: EnemyItem\)/);
  assert.match(game, /this\.fireSurvivalFirearm\(target\)/);
  assert.match(game, /rollSurvivalFirearmDrop\(this\.survivalFirearmKillCount/);
  assert.match(game, /rollSurvivalFirearmId\(this\.survivalFirearm\.id/);
  assert.match(firearms, /STARTING_SURVIVAL_FIREARM: SurvivalFirearmId = 'starter_pistol'/);
  assert.doesNotMatch(draft, /SurvivalFirearmId|firearm:/);
  assert.doesNotMatch(roulette, /SurvivalFirearmId|firearm:/);
});

test('firearm pickups have a unique world silhouette, bobbing timer and direct weapon replacement', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private createSurvivalFirearmDropVisual\(firearmId: SurvivalFirearmId\)/);
  assert.match(game, /texture\.userData\.disposeOnObjectCleanup = true/);
  assert.ok(game.includes('survivalFirearmSoundCooldown = Math.min(0.12, definition.fireIntervalSeconds * 0.65)'));
  assert.match(game, /case 'shotgun':[\s\S]*?context\.fillRect/);
  assert.match(game, /case 'rocket':[\s\S]*?context\.beginPath/);
  assert.match(game, /case 'gauss':[\s\S]*?context\.fillRect/);
  assert.match(game, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(game, /drop\.mesh\.position\.y = drop\.baseY \+ 0\.13 \+ Math\.sin/);
  assert.match(game, /const distance = Math\.hypot\(drop\.x - this\.playerPos\.x/);
  assert.match(game, /this\.survivalFirearm = createSurvivalFirearmState\(drop\.firearmId\)/);
  assert.match(game, /gun\.position\.set\(0, -0\.36, 0\.18\)/);
  assert.match(game, /\(this\.rightArm \?\? this\.playerGroup\)\.add\(gun\)/);
  assert.match(game, /life: 28/);
});

test('magazine, reload, projectile archetype and damage are driven by the active firearm profile', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private reloadSurvivalFirearm\(\)/);
  assert.match(game, /this\.survivalFirearm\.reloadRemaining = definition\.reloadSeconds/);
  assert.match(game, /if \(firearm\.ammoInMagazine <= 0\)/);
  assert.match(game, /case 'rocket': geometry = new THREE\.ConeGeometry/);
  assert.match(game, /case 'flame': geometry = new THREE\.SphereGeometry/);
  assert.match(game, /case 'gauss':/);
  assert.match(game, /firearmProjectile: true/);
  assert.match(game, /firearmExplosion: definition\.archetype === 'rocket'/);
  assert.match(game, /aoeDamageMultiplier: definition\.aoeDamageMultiplier/);
  assert.match(game, /damageSource: getSurvivalFirearmDamageSource\(definition\.id\)/);
  assert.match(game, /const adjustedProjectileDamage = p\.firearmProjectile/);
});

test('all enemy kills can spawn firearms while PvP remains on its authoritative shooting path', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /if \(this\.gameMode !== 'pvp'\) \{[\s\S]*?this\.survivalFirearmKillCount\+\+/);
  assert.match(game, /const firearmBoss =[\s\S]*?const firearmElite =[\s\S]*?const firearmTier:/);
  assert.match(game, /const currentGameMode = this\.gameMode;\s*if \(currentGameMode !== 'pvp'\) \{\s*this\.fireSurvivalFirearm\(\)/);
  assert.match(game, /if \(this\.gameMode === 'pvp'\) \{\s*this\.updatePvpMode/);
});

test('each firearm archetype has a dedicated synthesized report rather than a melee whoosh', async () => {
  const sound = await read('../src/sound.ts');
  assert.match(sound, /public playFirearmShot\(archetype:/);
  const profilesStart = sound.indexOf('const profiles = {');
  const profilesEnd = sound.indexOf('} as const', profilesStart);
  const profileSource = sound.slice(profilesStart, profilesEnd);
  for (const archetype of ['pistol', 'smg', 'rifle', 'shotgun', 'heavy-rifle', 'minigun', 'rocket', 'flame', 'plasma', 'gauss']) {
    assert.ok(profileSource.includes(archetype), 'missing audio profile: ' + archetype);
  }
  assert.equal((profileSource.match(/wave:/g) || []).length, 10);
  assert.match(sound, /body\.frequency\.exponentialRampToValueAtTime/);
  assert.match(sound, /transientEnvelope\.gain\.exponentialRampToValueAtTime/);
  const game = await read('../src/game.ts');
  assert.match(game, /sound\.playFirearmShot\(definition\.archetype\)/);
});

test('Survival HUD exposes the primary firearm, magazine and live reload state separately from module arsenal', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'), read('../src/index.ts'), read('../src/hud-layout.css')
  ]);
  for (const id of ['survival-firearm-status', 'survival-firearm-icon', 'survival-firearm-name', 'survival-firearm-ammo', 'survival-firearm-reload']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing HUD field ' + id);
  }
  assert.match(html, /survival-weapon-rack-label">MODUŁY/);
  assert.match(app, /const primaryFirearm = snapshot\.primaryFirearm/);
  assert.match(app, /primaryFirearm\.ammoInMagazine/);
  assert.match(app, /primaryFirearm\.reloadRemainingSeconds/);
  assert.match(css, /survival-firearm-status/);
  assert.match(css, /survival-firearm-ammo/);
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

test('fire rate and firing animation are individually tuned for all primary firearms', async () => {
  const [game, firearms] = await Promise.all([read('../src/game.ts'), read('../src/survivalFirearms.ts')]);
  assert.match(game, /const recoilAnimationSeconds: Readonly<Record<SurvivalFirearmId, number>>/);
  for (const id of ['starter_pistol', 'smg_45', 'assault_rifle', 'shotgun_12g', 'battle_rifle', 'minigun', 'rocket_launcher', 'flamethrower', 'plasma_rifle', 'gauss_rifle']) {
    assert.ok(firearms.includes(id + ':'), 'missing firearm definition: ' + id);
    assert.ok(game.includes(id + ':'), 'missing firing animation profile: ' + id);
  }
});
