import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = game.indexOf(startMarker);
  const end = game.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, 'source section must exist: ' + startMarker);
  return game.slice(start, end);
}

test('enemy directional warnings retain dodge dimensions without rendering floor geometry', () => {
  const lane = section('private spawnBossLaneTelegraph(', 'private updateSebixBehaviour(');
  assert.match(lane, /owner\.chargeLaneLength = safeLength/);
  assert.match(lane, /owner\.chargeLaneWidth = safeWidth/);
  assert.match(lane, /return null/);
  assert.doesNotMatch(lane, /new THREE\.|levelRoot\.add|specialEffects\.push/);
});

test('boss area warnings no longer create coloured floor rings', () => {
  const impact = section('private spawnBossImpactTelegraph(', 'private updateSebixBehaviour(');
  assert.doesNotMatch(impact, /new THREE\.|levelRoot\.add|specialEffects\.push/);
  assert.match(impact, /no coloured floor ring/i);
});

test('Cthulhu attack lanes no longer paint coloured floor strips or particles', () => {
  const lane = section('private spawnCthulhuLashTelegraph(', 'private spawnCthulhuGrabEffect(');
  assert.doesNotMatch(lane, /new THREE\.|levelRoot\.add|specialEffects\.push/);
  const combat = section("if (isCthulhuBoss) {", "} else if (e.name.includes('Inwentaryzacja Gigant')) {");
  assert.doesNotMatch(combat, /spawnExplosionParticles\(e\.x|spawnParticleRing\(e\.x/);
  assert.match(combat, /isWithinBossImpactRadius/);
  assert.match(combat, /isWithinCthulhuLashLane/);
});

test('chasing enemies and the Survival Auditor do not create coloured floor halos', () => {
  assert.doesNotMatch(game, /Ground Threat Ring for actively chasing enemies/);
  assert.doesNotMatch(game, /e\.threatRing = ringMesh/);
  const auditor = section('private spawnSurvivalAuditor()', 'private updateSurvivalAuditorAura(');
  assert.doesNotMatch(auditor, /RingGeometry|auraRing|spawnParticleRing/);
  assert.match(game, /const insideAura = Boolean\(auditor && Math\.hypot\(enemy\.x - auditor\.x, enemy\.z - auditor\.z\) <= 8\.2\)/);
});

test('wind-up timing, interruption, collision and perfect-dodge calculations remain active', () => {
  assert.match(game, /private beginEnemyRangedAttackTelegraph\(/);
  assert.match(game, /private advanceEnemyRangedAttackTelegraph\(/);
  assert.match(game, /private beginEnemyMeleeAttackTelegraph\(/);
  assert.match(game, /private advanceEnemyMeleeAttackTelegraph\(/);
  assert.match(game, /cancelEnemyRangedAttackTelegraph\(enemy, true\)/);
  assert.match(game, /cancelEnemyMeleeAttackTelegraph\(enemy, true\)/);
  assert.match(game, /isInsideBossAttackLane\(/);
  assert.match(game, /isEffectiveBossLaneDodge\(/);
  assert.match(game, /isWithinBossImpactRadius\(/);
});
