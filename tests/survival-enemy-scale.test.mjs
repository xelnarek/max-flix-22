import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalEnemySizeProfile } from '../src/survivalEnemyScale.ts';

test('Survival spawns a readable spread of small, normal and giant enemies', () => {
  assert.deepEqual(getSurvivalEnemySizeProfile(0), {
    scaleMultiplier: 0.72, healthMultiplier: 0.78, speedMultiplier: 1.18, label: 'KARZEŁ',
  });
  assert.equal(getSurvivalEnemySizeProfile(0.2).label, 'DROBIAZG');
  assert.equal(getSurvivalEnemySizeProfile(0.5).scaleMultiplier, 1);
  assert.equal(getSurvivalEnemySizeProfile(0.92).label, 'GIGANT');
  assert.equal(getSurvivalEnemySizeProfile(0.99).label, 'Kolos B4');
});

test('size profile keeps large bodies tougher and slower, small bodies weaker and faster', () => {
  const tiny = getSurvivalEnemySizeProfile(0.05);
  const giant = getSurvivalEnemySizeProfile(0.99);
  assert.ok(tiny.scaleMultiplier < 1 && tiny.healthMultiplier < 1 && tiny.speedMultiplier > 1);
  assert.ok(giant.scaleMultiplier > 1 && giant.healthMultiplier > 1 && giant.speedMultiplier < 1);
});

test('size rolls are finite-safe and bounded at both ends', () => {
  assert.deepEqual(getSurvivalEnemySizeProfile(-10), getSurvivalEnemySizeProfile(0));
  assert.deepEqual(getSurvivalEnemySizeProfile(1), getSurvivalEnemySizeProfile(0.999999999));
  assert.deepEqual(getSurvivalEnemySizeProfile(Number.NaN), getSurvivalEnemySizeProfile(0.5));
});
