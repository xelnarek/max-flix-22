import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('mobile install metadata is complete and points to project-relative assets', async () => {
  const [manifestText, html] = await Promise.all([
    read('../public/manifest.webmanifest'),
    read('../index.html'),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, 'Paleciaki! Magazyn Chaosu');
  assert.equal(manifest.short_name, 'Paleciaki!');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some((icon) => icon.src === './icons/b4-icon.svg'));
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /theme-color/);
  assert.match(html, /<meta name="application-name" content="Paleciaki! Magazyn Chaosu" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Paleciaki! Magazyn Chaosu" \/>/);
  assert.equal((html.match(/<meta name="theme-color"/g) || []).length, 1);
  assert.doesNotMatch(html, /content="Operacja B4"/);
});

test('service worker keeps remote services and API data outside its cache', async () => {
  const worker = await read('../public/sw.js');
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /\/api\//);
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /MAX_CACHEABLE_BYTES/);
  assert.match(worker, /offline\.html/);
  assert.match(worker, /searchParams\.get\('build'\)/);
  assert.match(worker, /paleciaki-magazyn-chaosu-shell-\$\{BUILD_ID\}/);
});

test('mobile lifecycle pauses and resumes active gameplay through one visibility handler', async () => {
  const [app, policy] = await Promise.all([
    read('../src/index.ts'),
    read('../src/visibilityPause.ts'),
  ]);
  assert.match(app, /getVisibilityPauseAction\(/);
  assert.match(app, /if \(action === 'pause'\)/);
  assert.doesNotMatch(app, /else if \(action === 'resume'\)/);
  assert.equal((app.match(/getVisibilityPauseAction\(/g) || []).length, 1);
  assert.match(policy, /documentHidden && gameState === 'playing'/);
  assert.doesNotMatch(policy, /return 'resume'/);
  assert.match(app, /Aplikacja wróciła z tła/);
  assert.match(app, /navigator\.serviceWorker\.register\(`\.\/sw\.js\?build=\$\{__PALIECIAKI_BUILD_ID__\}`/);
});

test('leaderboard reads stay public while writes and profile access require authentication', async () => {
  const rules = await read('../firestore.rules');
  assert.match(rules, /match \/leaderboard\/\{scoreId\}\s*\{\s*allow read: if true;/);
  assert.match(rules, /allow create: if isSignedIn\(\) && isValidId\(scoreId\) && isValidLeaderboardEntry\(request\.resource\.data\);/);
  assert.match(rules, /allow update, delete: if false;/);
  assert.match(rules, /allow read: if isSignedIn\(\) && request\.auth\.uid == userId;/);
});

test('score submission never attempts Firestore writes without a Firebase session', async () => {
  const firebase = await read('../src/firebase.ts');
  assert.match(firebase, /const user = await initAuth\(\);\s*if \(!user\?\.uid\)\s*\{[\s\S]*?throw new Error\('Firebase authentication unavailable/);
  assert.match(firebase, /if \(!user\?\.uid\)\s*\{[\s\S]*?return 0;[\s\S]*?\}\s*\n\s*const remaining:/);
  assert.match(firebase, /if \(!user && retryOnFailure\) authPromise = null;/);
  assert.match(firebase, /void initAuth\(\)\.catch/);
  assert.match(firebase, /query\(collection\(db, 'leaderboard'\), limit\(1\)\)/);
  assert.doesNotMatch(firebase, /if \(!currentUser\?\.uid\)[\s\S]*?return false;/);
});

test('npm only runs the reviewed dependency install scripts required by the build', async () => {
  const pkg = JSON.parse(await read('../package.json'));
  assert.deepEqual(pkg.allowScripts, {
    '@firebase/util@1.15.3': true,
    'esbuild@0.25.12': true,
    'protobufjs@7.6.6': true,
  });
});
