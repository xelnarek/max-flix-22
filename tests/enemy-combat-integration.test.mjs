import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');

test('enemy pursuit has an arrival dead-zone and does not orbit around a reached slot', () => {
  const start = game.indexOf('private updateSurvivalEnemyTactics');
  const end = game.indexOf('private damageEnemy', start);
  const tactics = game.slice(start, end);
  assert.match(tactics, /const atFormationSlot = steerLength < 0\.24/);
  assert.match(tactics, /const arrivalScale = atFormationSlot/);
  assert.match(tactics, /const movementSpeed = speed \* arrivalScale/);
  assert.match(tactics, /getEnemyPlayerContactDistance\(enemy\.type\) \+ 0\.08/);
  assert.doesNotMatch(tactics, /steerLength < 0\.72 && engaged/);
  assert.match(tactics, /role === 'bruiser' \|\| role === 'flanker'[\s\S]*?defaultEngageRadius/);
});

test('player movement blocks on enemy bodies and slides instead of tunnelling', () => {
  assert.match(game, /resolvePlayerMovementAgainstEnemies\(/);
  assert.match(game, /const contactY = landed \? this\.playerPos\.y : nextY/);
  assert.match(game, /projectVelocityOutOfEnemyContacts\(this\.playerVel, contactNormals\)/);
  assert.match(game, /getEnemyPlayerContactDistance\(enemy\.type\)/);
});

test('hostile projectiles stop at the first enemy body or the player along the swept segment', () => {
  assert.match(game, /findFirstProjectileEnemyImpact\(/);
  assert.match(game, /enemyImpact && \(!playerImpact \|\| enemyImpact\.t < playerImpact\.t\)/);
  assert.match(game, /if \(playerImpact\)/);
  assert.match(game, /this\.spawnCompactImpact\(enemyImpact\.x, enemyImpact\.y, enemyImpact\.z, impactColor\)/);
  assert.match(game, /const projectileStart = this\.enemyProjectileStartScratch;/);
  assert.match(game, /projectileStart\.x = previousX;[\s\S]*projectileStart\.y = previousY;[\s\S]*projectileStart\.z = previousZ;/);
});

test('hostile and friendly shot impacts have a visible pooled contact response', () => {
  assert.match(game, /this\.spawnCompactImpact\(impactX, impactY, impactZ, impactColor\)/);
  assert.match(game, /this\.spawnParticleRing\(this\.playerPos\.x, this\.playerPos\.y \+ 0\.55, this\.playerPos\.z, impactColor\)/);
  assert.match(game, /this\.spawnCompactImpact\(e\.x, e\.y \+ 0\.72, e\.z/);
});

test('campaign melee AI closes into attack range and holds without contact jitter', () => {
  const start = game.indexOf('// Dynamic Chase / Tracking AI for ground enemies');
  const end = game.indexOf('// The Sentinel commits to a visible lane', start);
  const campaign = game.slice(start, end);
  assert.match(campaign, /const attackDistance = Math\.max\(1\.10, getEnemyPlayerContactDistance\(e\.type\) \+ 0\.10\)/);
  assert.match(campaign, /const inContactLane = distToPlayer <= attackDistance \+ 0\.08/);
  assert.match(campaign, /const arrivalScale = inContactLane/);
  assert.match(campaign, /separationLength < 0\.34/);
  assert.match(campaign, /e\.x \+= move\.x \* chaseSpeed \* arrivalScale \* dt/);
});

test('large enemy crowds use a conservative spatial broadphase for player contact', () => {
  const start = game.indexOf('const contactY = landed ? this.playerPos.y : nextY');
  const end = game.indexOf('// Re-apply the gate after platform carry and crowd contact', start);
  const contact = game.slice(start, end);
  assert.match(contact, /this\.enemySpatialIndexCachedCount === this\.enemies\.length/);
  assert.match(contact, /this\.enemySpatialIndex\.query\(/);
  assert.match(contact, /Math\.hypot\(movementDeltaX, movementDeltaZ\) \* 0\.5 \+ 2\.1/);
  assert.match(contact, /: this\.enemies/);
  assert.match(contact, /resolvePlayerMovementAgainstEnemies\([\s\S]*?collisionCandidates/);
});

test('large hostile projectile crowds use the segment spatial broadphase before exact impact tests', () => {
  const start = game.indexOf('const projectileStart = this.enemyProjectileStartScratch;');
  assert.notEqual(start, -1, 'enemy projectile sweep must use reusable start-point storage');
  const end = game.indexOf('if (enemyImpact &&', start);
  const collision = game.slice(start, end);
  assert.match(collision, /projectileStart\.x = previousX;[\s\S]*projectileStart\.y = previousY;[\s\S]*projectileStart\.z = previousZ;/);
  assert.match(collision, /projectileEnd\.x = ep\.mesh\.position\.x;[\s\S]*projectileEnd\.z = ep\.mesh\.position\.z;/);
  assert.match(collision, /this\.enemySpatialIndexCachedCount === this\.enemies\.length/);
  assert.match(collision, /this\.enemySpatialIndex\.query\(/);
  assert.match(collision, /Math\.hypot\(projectileDeltaX, projectileDeltaZ\) \* 0\.5 \+ 1\.9/);
  assert.match(collision, /findFirstProjectileEnemyImpact\([\s\S]*?projectileCandidates,[\s\S]*?this\.enemyProjectileEnemyImpactScratch/);
});

test('Survival enemies scan for incoming player shots and commit a short role-weighted sidestep', async () => {
  const types = await readFile(new URL('../src/types.ts', import.meta.url), 'utf8');
  const start = game.indexOf('private updateSurvivalEnemyTactics');
  const end = game.indexOf('private damageEnemy', start);
  const tactics = game.slice(start, end);
  assert.match(tactics, /calculateEnemyProjectileDodge\([\s\S]*?0\.72,[\s\S]*?1\.02,[\s\S]*?0\.95,[\s\S]*?this\.enemyProjectileDodgeScanScratch/);
  assert.match(tactics, /enemy\.aiDodgeScanTimer = 0\.12/);
  assert.match(tactics, /enemy\.aiDodgeTimer = 0\.28/);
  assert.match(tactics, /evasionWeight = role === 'bruiser'/);
  assert.match(tactics, /const projectileDodge = this\.enemyProjectileDodgeScratch/);
  assert.match(tactics, /steeringInput\.evasionWeight = evasionWeight/);
  assert.match(game, /evasion: this\.enemyProjectileDodgeScratch/);
  assert.match(tactics, /hasProjectileDodge \? 0\.76/);
  assert.match(types, /aiDodgeScanTimer\?: number/);
});

test('enemy projectiles are slower, less accurate and have longer enemy attack windows', async () => {
  const combat = await readFile(new URL('../src/combatBalance.ts', import.meta.url), 'utf8');
  assert.match(game, /private predictPlayerAimPoint\(/);
  assert.match(game, /predictEnemyAimPoint\(/);
  for (const speed of ['7.6', '7.2', '7.5', '10.0', '8.2', '9.5']) {
    assert.ok(game.includes('getEnemyProjectileSpeed(' + speed + ')'));
  }
  assert.match(game, /Number\.isFinite\(lockedDirection\) \? null : this\.predictPlayerAimPoint/);
  assert.match(game, /Math\.sin\(lockedDirection as number\)/);
  assert.match(combat, /ENEMY_PROJECTILE_SPEED_MULTIPLIER = 0\.76/);
  assert.match(combat, /ENEMY_PROJECTILE_AIM_LEAD_MULTIPLIER = 0\.42/);
  assert.match(combat, /ENEMY_PROJECTILE_AIM_ERROR_METERS = 0\.78/);
  assert.match(combat, /ENEMY_MOVEMENT_SPEED_MULTIPLIER = 0\.88/);
  assert.match(game, /enemy\.attackCooldown = isHeavy \? 1\.02 : 1\.18/);
  assert.match(game, /leadFraction \* ENEMY_PROJECTILE_AIM_LEAD_MULTIPLIER/);
  assert.match(game, /missDistance = ENEMY_PROJECTILE_AIM_ERROR_METERS/);
  assert.match(game, /SURVIVAL_ENEMY_SPECIAL_RATE_MULTIPLIER/);
});
