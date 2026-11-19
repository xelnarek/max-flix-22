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

test('overflow loading is a high-risk, high-reward anomaly with bounded stacked pressure', () => {
  const started = advanceSurvivalAnomaly(createSurvivalAnomalyState(), 42, 0, 0.94, 0.5, 0.5);
  assert.equal(started.started?.id, 'overflow_loading');
  const modifiers = getSurvivalAnomalyModifiers(started.state);
  assert.equal(modifiers.enemyHealthMultiplier, 1.16);
  assert.equal(modifiers.enemyAbilityRateMultiplier, 1.12);
  assert.equal(modifiers.spawnIntervalMultiplier, 0.88);
  assert.equal(modifiers.enemyGroupSizeBonus, 2);
  assert.equal(modifiers.playerDamageTakenMultiplier, 1.12);
  assert.equal(modifiers.xpDropChanceMultiplier, 1.28);
  assert.equal(modifiers.xpValueMultiplier, 1.28);
});

test('maintenance window temporarily changes the risk-reward balance in the operator favour', () => {
  const definition = getSurvivalAnomalyDefinition('maintenance_window');
  assert.equal(definition?.modifiers.enemyHealthMultiplier, 0.94);
  assert.equal(definition?.modifiers.enemyAbilityRateMultiplier, 0.88);
  assert.equal(definition?.modifiers.spawnIntervalMultiplier, 1.16);
  assert.equal(definition?.modifiers.enemyGroupSizeBonus, -1);
  assert.equal(definition?.modifiers.playerDamageDealtMultiplier, 1.08);
  assert.equal(definition?.modifiers.playerDamageTakenMultiplier, 0.86);
  assert.equal(definition?.modifiers.attackCooldownMultiplier, 0.94);
  assert.equal(definition?.modifiers.abilityCooldownMultiplier, 0.92);
  assert.equal(definition?.modifiers.abilityDurationMultiplier, 1.06);
  assert.equal(definition?.modifiers.xpPickupMultiplier, 1.12);
  const started = advanceSurvivalAnomaly(createSurvivalAnomalyState(), 42, 0, 0.999, 0.5, 0.5);
  assert.equal(started.started?.id, 'maintenance_window');
});

test('new anomalies remain inside the existing event duration and anti-repeat rules', () => {
  const first = advanceSurvivalAnomaly(createSurvivalAnomalyState(), 42, 0, 0.94, 0.5, 0.5);
  assert.equal(first.started?.id, 'overflow_loading');
  const duration = first.started?.durationSeconds ?? 0;
  assert.ok(duration >= 20 && duration <= 30);
  const expired = advanceSurvivalAnomaly(first.state, 72, 30, 0.5, 0.5, 0);
  const second = advanceSurvivalAnomaly(expired.state, expired.state.nextAt, 0, 0.999, 0.5, 0.5);
  assert.equal(second.started?.id, 'maintenance_window');
  assert.notEqual(second.started?.id, first.started?.id);
});

test('anomaly modifier and definition lookups return stable template references', () => {
  const active = {
    active: { id: 'overflow_loading', title: '', description: '', durationSeconds: 20, remainingSeconds: 20 },
    nextAt: 100,
    sequence: 1,
    recentIds: [],
  };
  const firstModifiers = getSurvivalAnomalyModifiers(active);
  const secondModifiers = getSurvivalAnomalyModifiers(active);
  assert.equal(firstModifiers, secondModifiers);
  assert.equal(getSurvivalAnomalyDefinition('overflow_loading'), getSurvivalAnomalyDefinition('overflow_loading'));
  assert.equal(getSurvivalAnomalyModifiers(createSurvivalAnomalyState()), getSurvivalAnomalyModifiers(createSurvivalAnomalyState()));
});
