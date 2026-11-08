import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibilityPauseAction } from '../src/visibilityPause.ts';

test('hiding the page pauses an active run exactly once', () => {
  assert.equal(getVisibilityPauseAction(true, 'playing', false), 'pause');
  assert.equal(getVisibilityPauseAction(true, 'paused', true), 'none');
});

test('returning to a page resumes only a visibility-paused run', () => {
  assert.equal(getVisibilityPauseAction(false, 'paused', true), 'resume');
  assert.equal(getVisibilityPauseAction(false, 'paused', false), 'none');
});

test('manual pauses and non-playing screens are never changed by visibility events', () => {
  assert.equal(getVisibilityPauseAction(true, 'paused', false), 'none');
  assert.equal(getVisibilityPauseAction(false, 'paused', false), 'none');
  assert.equal(getVisibilityPauseAction(true, 'title', false), 'none');
  assert.equal(getVisibilityPauseAction(true, 'levelup', false), 'none');
  assert.equal(getVisibilityPauseAction(false, 'playing', true), 'none');
});

test('unknown states fail closed without changing the session', () => {
  assert.equal(getVisibilityPauseAction(true, 'loading', false), 'none');
  assert.equal(getVisibilityPauseAction(false, 'loading', true), 'none');
});
