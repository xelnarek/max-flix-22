import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSurvivalShiftEvent,
  createSurvivalShiftEventState,
  registerSurvivalShiftEventAction,
} from '../src/survivalShiftEvents.ts';

test('events begin after the warm-up and rotate through distinct play styles', () => {
  const initial = createSurvivalShiftEventState();
  const first = advanceSurvivalShiftEvent(initial, 70, 0);
  assert.equal(first.started?.id, 'xp_sweep');
  const second = advanceSurvivalShiftEvent({ ...first.state, active: null, nextAt: 122 }, 122, 0);
  assert.equal(second.started?.id, 'clean_lane');
  const third = advanceSurvivalShiftEvent({ ...second.state, active: null, nextAt: 174 }, 174, 0);
  assert.equal(third.started?.id, 'combo_chain');
});

test('event progress accepts only its requested action and caps at the target', () => {
  const started = advanceSurvivalShiftEvent(createSurvivalShiftEventState(), 70, 0).state;
  const ignored = registerSurvivalShiftEventAction(started, 'kills', 99, 71);
  assert.equal(ignored.state.active?.progress, 0);
  const partial = registerSurvivalShiftEventAction(started, 'xp', 4, 72);
  assert.equal(partial.state.active?.progress, 4);
  const complete = registerSurvivalShiftEventAction(partial.state, 'xp', 99, 73);
  assert.equal(complete.completed?.progress, 9);
  assert.equal(complete.state.active, null);
  assert.equal(complete.state.successStreak, 1);
});

test('combo event tracks the best chain and expires exactly once', () => {
  const started = advanceSurvivalShiftEvent({ ...createSurvivalShiftEventState(), sequence: 2 }, 70, 0).state;
  const partial = registerSurvivalShiftEventAction(started, 'combo', 3, 71);
  const lower = registerSurvivalShiftEventAction(partial.state, 'combo', 2, 72);
  assert.equal(lower.state.active?.progress, 3);
  const expired = advanceSurvivalShiftEvent(lower.state, 106, 34);
  assert.equal(expired.expired?.id, 'combo_chain');
  assert.equal(expired.state.active, null);
  assert.equal(expired.state.successStreak, 0);
  assert.equal(advanceSurvivalShiftEvent(expired.state, 107, 1).expired, null);
});

test('three successful events preserve a streak for the hidden golden-pallet reward', () => {
  let state = createSurvivalShiftEventState();
  for (let index = 0; index < 3; index++) {
    const start = advanceSurvivalShiftEvent({ ...state, active: null, nextAt: 70 + index * 52, sequence: index }, 70 + index * 52, 0);
    const action = start.state.active.action;
    const done = registerSurvivalShiftEventAction(start.state, action, 99, 71 + index * 52);
    state = done.state;
  }
  assert.equal(state.successStreak, 3);
  assert.equal(state.active, null);
});

test('invalid elapsed time and delta do not poison the event clock', () => {
  const advanced = advanceSurvivalShiftEvent(createSurvivalShiftEventState(), Number.NaN, Number.NaN);
  assert.equal(advanced.state.nextAt, 70);
  assert.equal(advanced.state.active, null);
});
