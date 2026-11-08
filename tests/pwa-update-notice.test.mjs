import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAnnounceServiceWorkerUpdate } from '../src/pwaUpdateNotice.ts';

test('first-time service worker installation does not trigger an update prompt', () => {
  assert.equal(shouldAnnounceServiceWorkerUpdate(false, false), false);
});

test('a replacement controller prompts a page that was already controlled', () => {
  assert.equal(shouldAnnounceServiceWorkerUpdate(true, false), true);
});

test('one page only announces the same controller change once', () => {
  assert.equal(shouldAnnounceServiceWorkerUpdate(true, true), false);
});
