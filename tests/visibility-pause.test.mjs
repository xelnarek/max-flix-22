import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibilityPauseAction } from '../src/visibilityPause.ts';

test('hiding the page pauses an active run exactly once', () => {
  assert.equal(getVisibilityPauseAction(true, 'playing'), 'pause');
  assert.equal(getVisibilityPauseAction(true, 'paused'), 'none');
});

test('returning to the app keeps a visibility-paused run paused until explicit resume', () => {
  assert.equal(getVisibilityPauseAction(false, 'paused'), 'none');
  assert.equal(getVisibilityPauseAction(false, 'playing'), 'none');
});

test('manual pauses and non-playing screens are never changed by visibility events', () => {
  assert.equal(getVisibilityPauseAction(true, 'paused'), 'none');
  assert.equal(getVisibilityPauseAction(false, 'paused'), 'none');
  assert.equal(getVisibilityPauseAction(true, 'title'), 'none');
  assert.equal(getVisibilityPauseAction(true, 'levelup'), 'none');
});

test('unknown states fail closed without changing the session', () => {
  assert.equal(getVisibilityPauseAction(true, 'loading'), 'none');
  assert.equal(getVisibilityPauseAction(false, 'loading'), 'none');
});
