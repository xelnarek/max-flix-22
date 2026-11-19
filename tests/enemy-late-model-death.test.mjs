import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');

test('an enemy rig that loads after defeat starts its Death clip and suppresses the LOD proxy', () => {
  const start = game.indexOf('private resumeEnemyAnimationAfterModelAttach');
  const end = game.indexOf('private hideProceduralVisuals', start);
  assert.ok(start >= 0 && end > start, 'enemy model attach recovery handler must exist');
  const handler = game.slice(start, end);
  const defeated = handler.indexOf("if (enemy.state === 'defeated')");
  const hit = handler.indexOf('const hitRemaining');
  assert.ok(defeated >= 0 && hit > defeated, 'defeat must take priority over stale hit/idle state');
  const defeatPath = handler.slice(defeated, hit);
  assert.match(defeatPath, /this\.lockEnemyDeathVisualToSingleRig\(mesh\)/);
  assert.match(defeatPath, /this\.enemyPendingAttackUntil\.delete\(enemy\)/);
  assert.match(defeatPath, /this\.requestGobkitAction\(track, 'Death', Math\.max\(0\.1, enemy\.deathVisualTimer \|\| 0\.1\)\)/);
  assert.match(game, /const deathVisualLocked = enemy\.state === 'defeated' \|\| mesh\.userData\.actorDeathVisualLocked === true/);
});
