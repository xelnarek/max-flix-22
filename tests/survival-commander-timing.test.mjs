import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSurvivalCommanderTiming,
  SURVIVAL_COMMAND_INTERRUPT_COOLDOWN_RATIO,
  SURVIVAL_COMMAND_WINDUP_SECONDS,
} from '../src/survivalCommanderTiming.ts';

test('boss command cooldown opens a visible wind-up instead of firing immediately', () => {
  const waiting = advanceSurvivalCommanderTiming(0.4, 0, 0.1, false, 12);
  assert.equal(waiting.phase, 'cooldown');
  assert.equal(waiting.cooldownRemaining, 0.3);

  const started = advanceSurvivalCommanderTiming(0, 0, 0.016, false, 12);
  assert.equal(started.phase, 'windup-started');
  assert.equal(started.windupRemaining, SURVIVAL_COMMAND_WINDUP_SECONDS);
  assert.equal(started.cooldownRemaining, 0);
});

test('wind-up advances in bounded steps and executes only when its timer expires', () => {
  const inProgress = advanceSurvivalCommanderTiming(0, 0.72, 0.3, false, 12);
  assert.equal(inProgress.phase, 'windup');
  assert.equal(inProgress.windupRemaining, 0.42);

  const executed = advanceSurvivalCommanderTiming(0, 0.01, 0.016, false, 12);
  assert.equal(executed.phase, 'execute');
  assert.equal(executed.windupRemaining, 0);
  assert.equal(executed.cooldownRemaining, 12);
});

test('stunning a boss interrupts the telegraphed command and delays its next attempt', () => {
  const interrupted = advanceSurvivalCommanderTiming(0, 0.35, 0.016, true, 12);
  assert.equal(interrupted.phase, 'interrupted');
  assert.equal(interrupted.windupRemaining, 0);
  assert.equal(interrupted.cooldownRemaining, 12 * SURVIVAL_COMMAND_INTERRUPT_COOLDOWN_RATIO);
});

test('a stunned boss cannot start a command or silently drain its cooldown', () => {
  const paused = advanceSurvivalCommanderTiming(7, 0, 0.1, true, 12);
  assert.equal(paused.phase, 'cooldown');
  assert.equal(paused.cooldownRemaining, 7);
});

test('invalid timer values are normalized and large frame deltas cannot skip the warning', () => {
  const started = advanceSurvivalCommanderTiming(Number.NaN, Number.NaN, 8, false, Number.NaN);
  assert.equal(started.phase, 'windup-started');
  const step = advanceSurvivalCommanderTiming(0, 0.72, 8, false, 12);
  assert.equal(step.phase, 'windup');
  assert.equal(step.windupRemaining, 0.62);
});

test('interruptible command timing is wired into Survival boss updates', async () => {
  const { readFile } = await import('node:fs/promises');
  const [game, types] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/types.ts', import.meta.url), 'utf8'),
  ]);
  assert.ok(game.includes('advanceSurvivalCommanderTiming('));
  assert.ok(game.includes("if (this.gameMode === 'survival') this.updateSurvivalCommanderPulse(e, dt)"));
  assert.ok(game.includes("timing.phase === 'windup-started'"));
  assert.ok(game.includes("timing.phase === 'interrupted'"));
  assert.ok(types.includes('aiCommanderWindupTimer?: number'));
});
