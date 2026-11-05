import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalLeaderLossTargets,
  getSurvivalMoraleBreakMultiplier,
  SURVIVAL_LEADER_LOSS_BREAK_SECONDS,
  SURVIVAL_LEADER_LOSS_SPEED_MULTIPLIER,
} from '../src/survivalMorale.ts';

test('leader loss briefly affects only living members of the leaderless coalition', () => {
  const targets = getSurvivalLeaderLossTargets([
    { id: 'fallen-leader', state: 'defeated', coalitionId: 4, leaderId: 'fallen-leader' },
    { id: 'bruiser', state: 'chase', coalitionId: 4, leaderId: 'fallen-leader' },
    { id: 'ranged', state: 'patrol', coalitionId: 4, leaderId: 'fallen-leader' },
    { id: 'other-squad', state: 'chase', coalitionId: 5, leaderId: 'other-leader' },
    { id: 'dead-member', state: 'defeated', coalitionId: 4, leaderId: 'fallen-leader' },
    { id: 'new-leader', state: 'chase', coalitionId: 4, leaderId: 'new-leader' },
  ]);
  assert.deepEqual(targets, ['bruiser', 'other-squad', 'ranged']);
});

test('a living leader prevents false morale breaks and missing squad metadata is ignored', () => {
  const targets = getSurvivalLeaderLossTargets([
    { id: 'leader', state: 'chase', coalitionId: 1, leaderId: 'leader' },
    { id: 'member', state: 'chase', coalitionId: 1, leaderId: 'leader' },
    { id: 'unassigned', state: 'chase' },
    { id: 'invalid-coalition', state: 'chase', coalitionId: Number.NaN, leaderId: 'missing' },
  ]);
  assert.deepEqual(targets, []);
});

test('leader loss selection is deterministic and duplicate IDs are returned once', () => {
  const targets = getSurvivalLeaderLossTargets([
    { id: 'z-member', state: 'chase', coalitionId: 2, leaderId: 'missing' },
    { id: 'a-member', state: 'chase', coalitionId: 2, leaderId: 'missing' },
    { id: 'a-member', state: 'chase', coalitionId: 3, leaderId: 'missing' },
  ]);
  assert.deepEqual(targets, ['a-member', 'z-member']);
});

test('morale break is mild, bounded and expires without affecting normal movement', () => {
  assert.equal(SURVIVAL_LEADER_LOSS_BREAK_SECONDS, 1.45);
  assert.equal(SURVIVAL_LEADER_LOSS_SPEED_MULTIPLIER, 0.76);
  assert.equal(getSurvivalMoraleBreakMultiplier(0.5), 0.76);
  assert.equal(getSurvivalMoraleBreakMultiplier(0), 1);
  assert.equal(getSurvivalMoraleBreakMultiplier(-1), 1);
  assert.equal(getSurvivalMoraleBreakMultiplier(Number.NaN), 1);
});

test('morale break is wired only into Survival coalition updates and has typed timer state', async () => {
  const { readFile } = await import('node:fs/promises');
  const [game, types] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/types.ts', import.meta.url), 'utf8'),
  ]);
  assert.ok(game.includes('getSurvivalLeaderLossTargets('));
  assert.ok(game.includes('getSurvivalMoraleBreakMultiplier(enemy.aiMoraleBreakTimer ?? 0)'));
  assert.ok(game.includes('enemy.aiMoraleBreakTimer = Math.max('));
  assert.ok(game.includes('e.aiMoraleBreakTimer = Math.max(0, (e.aiMoraleBreakTimer ?? 0) - dt)'));
  assert.ok(types.includes('aiMoraleBreakTimer?: number'));
});
