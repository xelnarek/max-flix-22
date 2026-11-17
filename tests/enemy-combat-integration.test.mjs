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
  assert.match(game, /enemyImpact && \(!hitsPlayer \|\| enemyImpact\.t < projection\)/);
  assert.match(game, /if \(hitsPlayer\)/);
  assert.match(game, /this\.spawnCompactImpact\(enemyImpact\.x, enemyImpact\.y, enemyImpact\.z, impactColor\)/);
  assert.match(game, /previousX, y: previousY, z: previousZ/);
});

test('hostile and friendly shot impacts have a visible pooled contact response', () => {
  assert.match(game, /this\.spawnCompactImpact\(impactX, impactY, impactZ, impactColor\)/);
  assert.match(game, /this\.spawnParticleRing\(this\.playerPos\.x, this\.playerPos\.y \+ 0\.55, this\.playerPos\.z, impactColor\)/);
  assert.match(game, /this\.spawnCompactImpact\(e\.x, e\.y \+ 0\.72, e\.z/);
});
