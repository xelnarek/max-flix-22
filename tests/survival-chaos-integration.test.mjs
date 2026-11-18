import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival levels offer a separate B4 roulette every third level after the regular draft', async () => {
  const [game, app] = await Promise.all([read('../src/game.ts'), read('../src/index.ts')]);
  assert.match(game, /this\.survivalChaosRoulettePending = this\.survivalLevel % 3 === 0/);
  assert.match(game, /this\.callbacks\.onSurvivalLevelUp\?\.\(\[\], 'chaos-roulette'\)/);
  assert.match(game, /public spinSurvivalChaosRoulette\(\): boolean/);
  assert.match(game, /rollSurvivalChaosRoulette\(Math\.random\(\)\)/);
  assert.match(app, /isChaosRoulette/);
  assert.match(app, /spinSurvivalChaosRoulette\(\)/);
});

test('Survival crowds grow within device caps and receive collision-aware size variants', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /adaptivePerformanceTier >= 2 \? 16 : this\.adaptivePerformanceTier === 1 \? 20 : 22/);
  assert.match(game, /adaptivePerformanceTier >= 2 \? 5 : this\.adaptivePerformanceTier === 1 \? 7 : 8/);
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

test('each operator special gets a short bespoke limb follow-through and Mateusz calls his squad', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /if \(this\.specialSwingTimer > 0 && this\.currentCharacterId !== 'grzesiek'\)/);
  for (const id of ['marcin', 'dawid', 'mateusz', 'piotr']) {
    assert.ok(game.includes("this.currentCharacterId === '" + id + "'"));
  }
  assert.match(game, /MULTIWERŚUM, ZBIÓRKA!/);
});
