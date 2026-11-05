import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withTimeout } from '../src/asyncTimeout.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('async timeout helper returns the original result when it completes in time', async () => {
  const value = await withTimeout(Promise.resolve('ready'), 100, 'fast task');
  assert.equal(value, 'ready');
});

test('async timeout helper rejects a stalled operation with an actionable label', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 5, 'ranking request'),
    /ranking request timed out after 5 ms/,
  );
});

test('a late rejection after timeout remains observed and does not replace the timeout result', async () => {
  const delayedFailure = new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('late Firestore failure')), 20);
  });
  await assert.rejects(
    withTimeout(delayedFailure, 3, 'Firestore query'),
    /Firestore query timed out after 3 ms/,
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
});

test('Firebase ranking operations have finite auth, probe, query and write limits', async () => {
  const firebase = await read('../src/firebase.ts');
  assert.match(firebase, /const AUTH_INIT_TIMEOUT_MS = 10_000/);
  assert.match(firebase, /const FIRESTORE_PROBE_TIMEOUT_MS = 7_000/);
  assert.match(firebase, /const FIRESTORE_QUERY_TIMEOUT_MS = 12_000/);
  assert.match(firebase, /const FIRESTORE_WRITE_TIMEOUT_MS = 12_000/);
  assert.match(firebase, /authTimeout = setTimeout\(/);
  assert.match(firebase, /withTimeout\([\s\S]*?getDocFromServer\(probeDoc\)/);
  assert.match(firebase, /withTimeout\([\s\S]*?getDocs\(survivalQuery\)/);
  assert.match(firebase, /withTimeout\([\s\S]*?setDoc\(doc\(db, collectionPath, cleanId\), payload\)/);
});

test('ranking UI prevents overlapping refreshes and differentiates offline cache from an empty online board', async () => {
  const app = await read('../src/index.ts');
  assert.match(app, /let leaderboardRenderInFlight = false/);
  assert.match(app, /!leaderboardList \|\| leaderboardRenderInFlight\) return/);
  assert.match(app, /finally \{\s*leaderboardRenderInFlight = false/);
  assert.match(app, /Nie udało się połączyć z rankingiem online/);
  assert.match(app, /Wysyłanie wyniku do rankingu Survival/);
  assert.match(app, /Wynik jest już w rankingu Survival online/);
});
