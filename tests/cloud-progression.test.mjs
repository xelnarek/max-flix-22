import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const firebase = await readFile(new URL('../src/firebase.ts', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const progression = await readFile(new URL('../src/accountProgression.ts', import.meta.url), 'utf8');

test('account progression cloud storage requires a Firebase-authenticated user and a transaction', () => {
  assert.match(firebase, /export async function loadAccountProgressionProfileFromCloud/);
  assert.match(firebase, /export async function saveAccountProgressionProfileToCloud/);
  assert.match(firebase, /await withTimeout\(initAuth\(\)/);
  assert.match(firebase, /runTransaction\(db, async \(transaction\)/);
  assert.match(firebase, /mergeAccountProgressionProfiles\(localProfile, cloudProfile\)/);
  assert.match(firebase, /users', userId, 'gameData', ACCOUNT_PROGRESSION_DOCUMENT_ID/);
});

test('Firestore rules restrict progression reads and writes to the owning UID and validated profile schema', () => {
  assert.match(rules, /match \/users\/\{userId\}\/gameData\/\{documentId\}/);
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /isValidAccountProgressionDocument\(request\.resource\.data\)/);
  assert.match(rules, /documentId == 'accountProgression'/);
  assert.match(rules, /profile\.level is int && profile\.level >= 1 && profile\.level <= 37/);
  assert.match(rules, /ranks\.keys\(\)\.hasOnly/);
  assert.match(rules, /allow delete: if false/);
});

test('account menu exposes a user-triggered cloud sync and sync runs on progression panels', () => {
  assert.match(app, /btn-account-cloud-sync/);
  assert.match(app, /account-cloud-sync-status/);
  assert.match(app, /loadAccountProgressionProfileFromCloud\(\)/);
  assert.match(app, /saveAccountProgressionProfileToCloud\(accountProgressionProfile\)/);
  assert.match(app, /void this\.syncAccountProgressionWithCloud\(\)/);
  assert.match(progression, /export function mergeAccountProgressionProfiles/);
});
