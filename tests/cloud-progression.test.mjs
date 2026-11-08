import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const firebase = await readFile(new URL('../src/firebase.ts', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const progression = await readFile(new URL('../src/accountProgression.ts', import.meta.url), 'utf8');
const firebaseConfig = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const firebaseGuide = await readFile(new URL('../docs/FIREBASE_ACCOUNT_SYNC.md', import.meta.url), 'utf8');

test('account progression cloud storage requires a Firebase-authenticated user and a transaction', () => {
  assert.match(firebase, /export async function loadAccountProgressionProfileFromCloud/);
  assert.match(firebase, /export async function saveAccountProgressionProfileToCloud/);
  assert.match(firebase, /export async function connectAccountWithGoogle/);
  assert.match(firebase, /linkWithPopup\(user, provider\)/);
  assert.match(firebase, /signInWithPopup\(auth, provider\)/);
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
  assert.match(app, /btn-account-google-connect/);
  assert.match(app, /connectAccountWithGoogle\(\)/);
  assert.match(app, /account-cloud-sync-status/);
  assert.match(app, /loadAccountProgressionProfileFromCloud\(\)/);
  assert.match(app, /saveAccountProgressionProfileToCloud\(accountProgressionProfile\)/);
  assert.match(app, /void this\.syncAccountProgressionWithCloud\(\)/);
  assert.match(progression, /export function mergeAccountProgressionProfiles/);
});

test('Firebase CLI config targets only the named database used by the game and documents deployment', () => {
  assert.equal(firebaseConfig.firestore.length, 1);
  assert.equal(firebaseConfig.firestore[0].database, 'ai-studio-maxflixvol2-938de3b7-0d7d-4164-9dae-7d99b2e46560');
  assert.equal(firebaseConfig.firestore[0].rules, 'firestore.rules');
  assert.equal(packageJson.scripts['firebase:deploy-rules'],
    'npx firebase-tools deploy --only firestore:ai-studio-maxflixvol2-938de3b7-0d7d-4164-9dae-7d99b2e46560');
  assert.match(firebaseGuide, /Authentication → Sign-in method/);
  assert.match(firebaseGuide, /xelnarek\.github\.io/);
  assert.match(firebaseGuide, /SYNCHRONIZUJ/);
});
