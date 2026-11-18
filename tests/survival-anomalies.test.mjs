import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSurvivalAnomaly,
  createSurvivalAnomalyState,
  getSurvivalAnomalyDefinition,
  getSurvivalAnomalyModifiers,
} from '../src/survivalAnomalies.ts';

test('the first anomaly starts after the opening period and has a bounded duration', () => {
  const initial = createSurvivalAnomalyState();
  assert.equal(initial.nextAt, 42);
  const waiting = advanceSurvivalAnomaly(initial, 41.99, 0.1, 0.1, 0.5, 0.5);
  assert.equal(waiting.started, null);
  const started = advanceSurvivalAnomaly(initial, 42, 0.1, 0, 0.5, 0.5);
  assert.equal(started.started?.id, 'bhp_audit');
  assert.equal(started.started?.durationSeconds, 25);
  assert.equal(started.state.active?.remainingSeconds, 25);
});

test('anomalies expire and schedule a variable recovery gap', () => {
  let state = createSurvivalAnomalyState();
  state = advanceSurvivalAnomaly(state, 42, 0, 0.1, 0, 0.5).state;
  const expired = advanceSurvivalAnomaly(state, 62, 30, 0.5, 0.5, 0.75);
  assert.equal(expired.expired?.id, 'bhp_audit');
  assert.equal(expired.state.active, null);
  assert.equal(expired.state.nextAt, 62 + 24 + 0.75 * 18);
});

test('weighted RNG avoids the two most recent anomaly types', () => {
  let state = createSurvivalAnomalyState();
  const first = advanceSurvivalAnomaly(state, 42, 0, 0, 0, 0);
  state = first.state;
  assert.equal(first.started?.id, 'bhp_audit');
  const expired1 = advanceSurvivalAnomaly(state, 42, 31, 0.5, 0.5, 0);
  state = expired1.state;
  const second = advanceSurvivalAnomaly(state, state.nextAt, 0, 0, 0, 0);
  assert.notEqual(second.started?.id, 'bhp_audit');
  state = second.state;
  const expired2 = advanceSurvivalAnomaly(state, state.nextAt, 31, 0.5, 0.5, 0);
  state = expired2.state;
  const third = advanceSurvivalAnomaly(state, state.nextAt, 0, 0, 0, 0);
  assert.ok(third.started?.id !== first.started?.id);
  assert.ok(third.started?.id !== second.started?.id);
});

test('anomaly modifiers are neutral outside an event and match its tactical effect', () => {
  const neutral = getSurvivalAnomalyModifiers(createSurvivalAnomalyState());
  assert.equal(neutral.playerMoveMultiplier, 1);
  assert.equal(neutral.enemyHealthMultiplier, 1);
  const audit = advanceSurvivalAnomaly(createSurvivalAnomalyState(), 42, 0, 0, 0.2).state;
  const modifiers = getSurvivalAnomalyModifiers(audit);
  assert.equal(modifiers.enemyHealthMultiplier, 1.22);
  assert.equal(modifiers.playerDamageDealtMultiplier, 0.90);
  const spill = getSurvivalAnomalyDefinition('oil_spill');
  assert.equal(spill?.modifiers.playerMoveMultiplier, 0.82);
});

test('malformed clocks and random rolls stay finite and safe', () => {
  const state = createSurvivalAnomalyState();
  const result = advanceSurvivalAnomaly(state, Number.NaN, Number.NaN, Number.NaN, Number.POSITIVE_INFINITY, -1);
  assert.equal(result.started, null);
  assert.equal(result.state.active, null);
});
