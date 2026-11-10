import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  clampGobkitActionDuration,
  getGobkitActionPriority,
  isGobkitOneShotAction,
  resolveGobkitActionName,
  shouldKeepGobkitAction,
} from '../src/gobkitAnimation.ts';

test('optional combat clips resolve to the best available visual fallback', () => {
  assert.equal(resolveGobkitActionName('Attack', new Set(['Hit', 'Idle'])), 'Hit');
  assert.equal(resolveGobkitActionName('Special', new Set(['Run', 'Idle'])), 'Run');
  assert.equal(resolveGobkitActionName('Jump', new Set(['Idle', 'Walk'])), 'Walk');
  assert.equal(resolveGobkitActionName('Jump', new Set(['Idle'])), 'Idle');
  assert.equal(resolveGobkitActionName('Run', new Set(['Walk', 'Idle'])), 'Walk');
  assert.equal(resolveGobkitActionName('Walk', new Set(['Idle'])), 'Idle');
  assert.equal(resolveGobkitActionName('Idle', new Set(['Walk'])), 'Walk');
});

test('airborne Jump loops while combat and death reactions remain one-shot', () => {
  assert.equal(isGobkitOneShotAction('Jump'), false);
  for (const action of ['Hit', 'Attack', 'Special', 'Death']) {
    assert.equal(isGobkitOneShotAction(action), true, action + ' must be one-shot');
  }
  assert.equal(isGobkitOneShotAction('Walk'), false);
  assert.equal(isGobkitOneShotAction('Run'), false);
});

test('damage and death reactions outrank special attacks and regular attacks', () => {
  assert.equal(getGobkitActionPriority('Death'), 4);
  assert.equal(getGobkitActionPriority('Hit'), 3);
  assert.equal(getGobkitActionPriority('Special'), 2);
  assert.equal(getGobkitActionPriority('Attack'), 1);
  assert.equal(shouldKeepGobkitAction(0.2, 3, 1), true);
  assert.equal(shouldKeepGobkitAction(0.2, 1, 3), false);
  assert.equal(shouldKeepGobkitAction(0, 3, 1), false);
  assert.equal(shouldKeepGobkitAction(Number.POSITIVE_INFINITY, 4, 1), true);
});

test('animation windows are finite and bounded', () => {
  assert.equal(clampGobkitActionDuration(Number.NaN), 0.28);
  assert.equal(clampGobkitActionDuration(-1), 0.12);
  assert.equal(clampGobkitActionDuration(0.4), 0.4);
  assert.equal(clampGobkitActionDuration(2), 1.2);
});

test('the game engine synchronizes authored clip duration with gameplay reaction windows', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /next\.setDuration\(clampGobkitActionDuration\(durationSeconds as number\)\)/);
  assert.match(game, /isGobkitOneShotAction\(name\)/);
  assert.match(game, /playGobkitAction\(track, resolvedName, track\.oneShotRemaining, true\)/);
  assert.doesNotMatch(game, /name === 'Special' \|\| name === 'Jump'/);
});
