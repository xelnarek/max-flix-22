import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival levels offer a separate B4 roulette every third level after the regular draft', async () => {
  const [game, app] = await Promise.all([read('../src/game.ts'), read('../src/index.ts')]);
  assert.match(game, /this\.survivalChaosRoulettePending = this\.survivalLevel % 3 === 0/);
  assert.match(game, /this\.callbacks\.onSurvivalLevelUp\?\.\(\[\], 'chaos-roulette'\)/);
  assert.match(game, /public spinSurvivalChaosRoulette\(\): boolean/);
  assert.match(game, /public getSurvivalChaosRouletteLastResult\(\)/);
  assert.match(game, /survivalChaosRouletteLastResult = \{ kind: outcome, title: selected.title, icon: selected.icon \}/);
  assert.match(game, /rollSurvivalChaosRoulette\(Math\.random\(\), this\.survivalChaosRouletteRecentKinds\)/);
  assert.match(app, /isChaosRoulette/);
  assert.match(app, /spinSurvivalChaosRoulette\(\)/);
});

test('Survival crowds, spawn batches and combat effects use one adaptive device budget', async () => {
  const [game, budget] = await Promise.all([
    read('../src/game.ts'), read('../src/survivalPerformanceBudget.ts')
  ]);
  assert.match(game, /getSurvivalPerformanceBudget\(isMobile, this\.adaptivePerformanceTier\)/);
  assert.match(game, /performanceBudget\.enemyCap/);
  assert.match(game, /performanceBudget\.groupCap/);
  assert.match(game, /budget\.novaProjectileCount/);
  assert.match(game, /budget\.explosionParticleCount/);
  assert.match(budget, /enemyCap: 22/);
  assert.match(budget, /enemyCap: 20/);
  assert.match(budget, /enemyCap: 16/);
  assert.match(game, /private applySurvivalEnemySize\(enemy: EnemyItem\)/);
  assert.match(game, /enemy\.collisionRadius = getEnemyCollisionRadius/);
  assert.match(game, /enemy\.mesh\.scale\.multiplyScalar\(profile\.scaleMultiplier\)/);
});

test('rare combat drops use existing perk pickup cleanup and a live protective aura', async () => {
  const [game, types] = await Promise.all([read('../src/game.ts'), read('../src/types.ts')]);
  for (const perk of ['radioactive_field', 'crimson_burst', 'bullet_nova']) {
    assert.ok(types.includes("'" + perk + "'"));
    assert.ok(game.includes("perkId === '" + perk + "'"));
  }
  assert.match(game, /private ensureRadiationFieldAura\(\)/);
  assert.match(game, /this\.radiationFieldCooldown = 0\.85/);
  assert.match(game, /private triggerSurvivalCrimsonExplosion/);
  assert.match(game, /private triggerSurvivalBulletNova/);
  assert.match(game, /damageSource: 'ability'[\s\S]*?homingTrailColor: 0xffa34a/);
});

test('seventeen roulette outcomes have concrete handlers for loot, control and risk/reward RNG', async () => {
  const [game, roulette, app, css] = await Promise.all([
    read('../src/game.ts'), read('../src/survivalChaosRoulette.ts'), read('../src/index.ts'),
    read('../src/visual-polish.css')
  ]);
  for (const outcome of [
    'xp_rain', 'overdrive', 'bounty', 'time_lock', 'elite_delivery',
    'magnet_surge', 'xp_surge', 'golden_crate', 'hazard_clear', 'double_or_nothing',
  ]) {
    assert.ok(roulette.includes("'" + outcome + "'"), 'missing roulette outcome ' + outcome);
    assert.ok(game.includes("case '" + outcome + "'"), 'missing gameplay handler ' + outcome);
  }
  assert.match(game, /private triggerSurvivalXpRain\(\)/);
  assert.match(game, /private triggerSurvivalTimeLock\(\)/);
  assert.match(game, /private spawnSurvivalEliteDelivery\(\)/);
  assert.match(game, /private clearSurvivalEnemyProjectiles\(\)/);
  assert.match(game, /this\.activatePerk\('order_magnet', 18\)/);
  assert.match(game, /this\.activatePerk\('xp_surge', 20\)/);
  assert.match(game, /650 \+ Math\.floor\(Math\.random\(\) \* 1551\)/);
  assert.match(game, /if \(Math\.random\(\) < 0\.55\)/);
  assert.match(game, /const maxDelivery = Math\.max\(1, Math\.floor\(budget\.maxRouletteExtraEnemies\)\)/);
  assert.match(game, /const requestedCount = 1 \+ Math\.floor\(Math\.random\(\) \* maxDelivery\)/);
  assert.ok(game.includes('this.survivalChaosRouletteRecentKinds = [...this.survivalChaosRouletteRecentKinds.slice(-1), outcome]'));
  assert.match(game, /weaponOptions = this\.rollSurvivalUpgradeOptions\(\)\.filter/);
  assert.match(game, /enemy\.stunTimer = Math\.max\(enemy\.stunTimer, isBoss \? 0\.82 : 1\.8\)/);
  assert.match(game, /enemy\.state = 'stunned'/);
  assert.doesNotMatch(roulette, /weapon_draft/);
  assert.match(game, /DOSTAWA PRIORYTETOWA ×/);
  assert.match(game, /ELITA B4 • KONTROLER/);
  assert.match(game, /ELITA B4 • KURIER/);
  assert.match(app, /Trzy obracające się bębny, siedemnaście możliwych wyników, jeden spin/);
  assert.match(app, /survival-chaos-reels/);
  assert.match(css, /survival-chaos-marquee \.survival-chaos-lamp/);
  assert.match(app, /survival-chaos-reel-symbol/);
  assert.match(app, /window\.setInterval/);
  assert.match(app, /stopAt = reducedMotion \? \[80, 150, 220\] : \[1420, 1960, 2520\]/);
  assert.match(app, /getSurvivalChaosRouletteLastResult\(\)/);
  assert.match(app, /rewardStyles/);
  assert.match(app, /NAGRODA WYLOSOWANA/);
  assert.match(app, /}, 2300\)/);
});

test('bullet nova projectiles make a physical splash impact and time-lock visual work is capped', async () => {
  const [game, budget] = await Promise.all([
    read('../src/game.ts'), read('../src/survivalPerformanceBudget.ts')
  ]);
  assert.match(game, /aoeRadius: 1\.35/);
  assert.match(game, /stunDuration: 0\.32/);
  assert.match(game, /impactRings < budget\.timeLockImpactLimit/);
  assert.match(budget, /timeLockImpactLimit: 5/);
  assert.match(budget, /timeLockImpactLimit: 18/);
});

test('each operator special keeps its bespoke limb follow-through and Mateusz shout identity', async () => {
  const [game, shouts] = await Promise.all([
    read('../src/game.ts'), read('../src/characterAbilityShouts.ts')
  ]);
  assert.match(game, /if \(this\.specialSwingTimer > 0 && this\.currentCharacterId !== 'grzesiek'\)/);
  for (const id of ['marcin', 'dawid', 'mateusz', 'piotr']) {
    assert.ok(game.includes("this.currentCharacterId === '" + id + "'"));
  }
  assert.match(shouts, /Multiwersum, wejście na serwer/);
  assert.match(shouts, /Avengers i Liga/);
});

test('elite delivery assigns distinct roles, visible identity markers and a breakable timed controller shield', async () => {
  const [game, types, visuals] = await Promise.all([
    read('../src/game.ts'), read('../src/types.ts'), read('../src/survivalEliteVisuals.ts')
  ]);
  assert.match(game, /spawnSurvivalEnemy\(this\.survivalWave, \{ allowSpecialEncounters: false \}\)/);
  assert.match(game, /role: 'controller'/);
  assert.match(game, /role: 'courier'/);
  assert.match(game, /enemy\.survivalEliteInsignia = createSurvivalEliteInsignia\(profile\.role\)/);
  assert.match(game, /e\.survivalEliteInsignia\.rotation\.y \+= dt/);
  assert.match(game, /enemy\.shieldActive = true;[\s\S]*?enemy\.supportShieldTimer = 5/);
  assert.match(game, /enemy\.mesh\.add\(shieldRing\)/);
  assert.match(types, /survivalEliteRole\?: 'controller' \| 'courier'/);
  assert.match(types, /survivalEliteInsignia\?: any/);
  assert.match(visuals, /ELITE_ROLE_VISUALS/);
  assert.match(game, /enemy\.survivalEliteInsignia, enemy\.speechMesh/);
});


test('roulette history is bounded to two results and resets between Survival runs', async () => {
  const game = await read('../src/game.ts');
  assert.ok(game.includes('private survivalChaosRouletteRecentKinds: SurvivalChaosRouletteKind[] = []'));
  assert.equal((game.match(/this\.survivalChaosRouletteRecentKinds = \[\];/g) || []).length, 2);
  assert.ok(game.includes('this.survivalChaosRouletteRecentKinds = [...this.survivalChaosRouletteRecentKinds.slice(-1), outcome]'));
});
