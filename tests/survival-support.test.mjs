import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectSurvivalSupportPulseTargets,
  SURVIVAL_SUPPORT_PULSE_RADIUS,
  SURVIVAL_SUPPORT_PULSE_INTERVAL_SECONDS,
  SURVIVAL_SUPPORT_SHIELD_SECONDS,
} from '../src/survivalSupport.ts';

const support = { id: 'inspector-1', coalitionId: 2, x: 0, z: 0, state: 'chase', type: 'inspector' };

test('support pulse shields only nearby living members of the same coalition', () => {
  const targets = selectSurvivalSupportPulseTargets(support, [
    { id: 'ally-near', coalitionId: 2, x: 2, z: 0, state: 'chase', type: 'kurier' },
    { id: 'other-squad', coalitionId: 3, x: 0.5, z: 0, state: 'chase', type: 'kurier' },
    { id: 'ally-defeated', coalitionId: 2, x: 1, z: 0, state: 'defeated', type: 'kurier' },
    { id: 'ally-far', coalitionId: 2, x: 10, z: 0, state: 'chase', type: 'kurier' },
    { id: 'inspector-1', coalitionId: 2, x: 0, z: 0, state: 'chase', type: 'inspector' },
    { id: 'boss', coalitionId: 2, x: 1, z: 0, state: 'chase', type: 'sebix_m' },
    { id: 'ally-second', coalitionId: 2, x: 3, z: 0, state: 'chase', type: 'monter' },
  ]);
  assert.deepEqual(targets, ['ally-near', 'ally-second']);
});

test('support pulse is deterministic, distance ordered and capped at three allies', () => {
  const candidates = [
    { id: 'third', coalitionId: 2, x: 3, z: 0, state: 'chase' },
    { id: 'first', coalitionId: 2, x: 1, z: 0, state: 'chase' },
    { id: 'second', coalitionId: 2, x: 2, z: 0, state: 'chase' },
    { id: 'fourth', coalitionId: 2, x: 4, z: 0, state: 'chase' },
  ];
  assert.deepEqual(selectSurvivalSupportPulseTargets(support, candidates), ['first', 'second', 'third']);
});

test('support pulse rejects invalid inputs and clamps target limits', () => {
  assert.deepEqual(selectSurvivalSupportPulseTargets({ ...support, coalitionId: undefined }, []), []);
  assert.deepEqual(selectSurvivalSupportPulseTargets(support, [], 6, 0), []);
  assert.deepEqual(selectSurvivalSupportPulseTargets(support, [
    { id: 'ally', coalitionId: 2, x: 1, z: 0, state: 'chase' },
  ], Number.NaN), ['ally']);
  assert.equal(SURVIVAL_SUPPORT_PULSE_RADIUS, 6.4);
  assert.equal(SURVIVAL_SUPPORT_PULSE_INTERVAL_SECONDS, 8.5);
  assert.equal(SURVIVAL_SUPPORT_SHIELD_SECONDS, 4.6);
});

test('support pulses are wired into the Survival engine and shields absorb one hit', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  const types = await readFile(new URL('../src/types.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('selectSurvivalSupportPulseTargets('));
  assert.ok(game.includes("if (role === 'support') this.updateSurvivalSupportPulse(enemy, dt)"));
  assert.ok(game.includes('ally.shieldActive = true'));
  assert.ok(game.includes('if (enemy.shieldActive) {'));
  assert.ok(game.includes('this.clearSurvivalSupportShield(enemy)'));
  assert.ok(game.includes('e.supportShieldTimer = Math.max(0, (e.supportShieldTimer ?? 0) - dt)'));
  assert.ok(types.includes('aiSupportPulseTimer?: number'));
  assert.ok(types.includes('supportShieldTimer?: number'));
});
