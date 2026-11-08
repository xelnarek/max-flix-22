import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');

test('Firebase leaderboard SDK is split out of the initial game entry', () => {
  assert.doesNotMatch(index, /from ['"]\.\/firebase\.ts['"]/);
  assert.match(index, /import\(['"]\.\/firebase\.ts['"]\)/);
  assert.match(index, /firebaseLeaderboardServicesPromise/);
});

test('leaderboard services load only after opening the leaderboard or submitting a score', () => {
  assert.match(index, /if \(targetId === 'tab-leaderboard'\) \{\s*leaderboardHasBeenOpened = true;\s*renderLeaderboard\(\);/);
  assert.match(index, /const services = await loadFirebaseLeaderboardServices\(\);\s*const isConnected = await services\.ensureLeaderboardServices\(\);/);
  assert.match(index, /const services = await loadFirebaseLeaderboardServices\(\);\s*const result = await services\.submitScore\(/);
  const bootSection = index.slice(
    index.indexOf("bindScoreSubmission('btn-submit-score'"),
    index.indexOf('// Do not let a backgrounded mobile browser continue a live run invisibly.'),
  );
  assert.doesNotMatch(bootSection, /^\s*renderLeaderboard\(\);\s*$/m);
  assert.doesNotMatch(bootSection, /ensureLeaderboardServices\(\)/);
});

test('reconnect refreshes the leaderboard only while its panel is active', () => {
  assert.match(index, /if \(leaderboardHasBeenOpened && document\.getElementById\('tab-leaderboard'\)\?\.classList\.contains\('active'\)\)\s*\{\s*void renderLeaderboard\(\);/);
});
