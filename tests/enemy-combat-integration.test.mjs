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
  assert.match(game, /const inwardVelocity = this\.playerVel\.x \* playerContact\.normalX/);
  assert.match(game, /getEnemyPlayerContactDistance\(enemy\.type\)/);
});

test('hostile projectiles stop at the first enemy body or the player along the swept segment', () => {
  assert.match(game, /findFirstProjectileEnemyImpact\(/);
  assert.match(game, /enemyImpact && \(!playerImpact \|\| enemyImpact\.t < playerImpact\.t\)/);
  assert.match(game, /if \(playerImpact\)/);
  assert.match(game, /this\.spawnCompactImpact\(enemyImpact\.x, enemyImpact\.y, enemyImpact\.z, impactColor\)/);
  assert.match(game, /previousX, y: previousY, z: previousZ/);
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
  const start = game.indexOf('const projectileStart = { x: previousX, y: previousY, z: previousZ }');
  const end = game.indexOf('if (enemyImpact &&', start);
  const collision = game.slice(start, end);
  assert.match(collision, /this\.enemySpatialIndexCachedCount === this\.enemies\.length/);
  assert.match(collision, /this\.enemySpatialIndex\.query\(/);
  assert.match(collision, /Math\.hypot\(projectileDeltaX, projectileDeltaZ\) \* 0\.5 \+ 1\.9/);
  assert.match(collision, /findFirstProjectileEnemyImpact\(projectileStart, projectileEnd, projectileCandidates\)/);
});

test('Survival enemies scan for incoming player shots and commit a short role-weighted sidestep', async () => {
  const types = await readFile(new URL('../src/types.ts', import.meta.url), 'utf8');
  const start = game.indexOf('private updateSurvivalEnemyTactics');
  const end = game.indexOf('private damageEnemy', start);
  const tactics = game.slice(start, end);
  assert.match(tactics, /calculateEnemyProjectileDodge\(enemy, this\.projectiles, 0\.72, 1\.02, 0\.95\)/);
  assert.match(tactics, /enemy\.aiDodgeScanTimer = 0\.12/);
  assert.match(tactics, /enemy\.aiDodgeTimer = 0\.28/);
  assert.match(tactics, /evasionWeight = role === 'bruiser'/);
  assert.match(tactics, /evasion: projectileDodge/);
  assert.match(tactics, /hasProjectileDodge \? 0\.76/);
  assert.match(types, /aiDodgeScanTimer\?: number/);
});

test('ordinary enemy projectiles lead a moving operator while locked boss telegraphs keep their committed lane', () => {
  assert.match(game, /private predictPlayerAimPoint\(/);
  assert.match(game, /predictEnemyAimPoint\(/);
  assert.match(game, /this\.predictPlayerAimPoint\(x, z, 7\.6, targetX, targetZ, 0\.64\)/);
  assert.match(game, /this\.predictPlayerAimPoint\(x, z, 7\.2, targetX, targetZ, 0\.62\)/);
  assert.match(game, /const aim = this\.predictPlayerAimPoint\(x, z, 7\.5\)/);
  assert.match(game, /Number\.isFinite\(lockedDirection\) \? null : this\.predictPlayerAimPoint/);
  assert.match(game, /Math\.sin\(lockedDirection as number\)/);
});
