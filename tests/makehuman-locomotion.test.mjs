import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMakeHumanLocomotion, getMakeHumanPlaybackRate } from '../src/makeHumanLocomotion.ts';

test('MakeHuman locomotion distinguishes forward, backward and side movement in local actor space', () => {
  assert.equal(chooseMakeHumanLocomotion(0, 0), 'Idle');
  assert.equal(chooseMakeHumanLocomotion(0, 1.8), 'Walk');
  assert.equal(chooseMakeHumanLocomotion(0, 6.3), 'Run');
  assert.equal(chooseMakeHumanLocomotion(0, -1.4), 'WalkBackward');
  assert.equal(chooseMakeHumanLocomotion(1.2, 0.1), 'StrafeLeft');
  assert.equal(chooseMakeHumanLocomotion(-1.2, 0.1), 'StrafeRight');
  assert.equal(chooseMakeHumanLocomotion(4.0, 0.4, true), 'Fall');
});

test('animation cadence follows actor speed inside safe bounds', () => {
  assert.equal(getMakeHumanPlaybackRate('Idle', 0), 1);
  assert.ok(getMakeHumanPlaybackRate('Walk', 1.3032) > 0.99);
  assert.ok(getMakeHumanPlaybackRate('Run', 6.8) <= 2.25);
  assert.equal(getMakeHumanPlaybackRate('StrafeLeft', 0.05), 0.72);
});
