import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Play Store metadata stays within title and description limits and describes Survival only', async () => {
  const [listingText, manifestText, capacitorText] = await Promise.all([
    read('../play-store/listing-pl.json'),
    read('../public/manifest.webmanifest'),
    read('../capacitor.config.json'),
  ]);
  const listing = JSON.parse(listingText);
  const manifest = JSON.parse(manifestText);
  const capacitor = JSON.parse(capacitorText);
  assert.ok(listing.appName.length <= 30);
  assert.ok(listing.shortDescription.length <= 80);
  assert.ok(listing.fullDescription.length <= 4000);
  assert.equal(listing.appName, capacitor.appName);
  assert.equal(manifest.name, capacitor.appName);
  assert.match(listing.fullDescription, /Jeden rozbudowany tryb Survival/);
  assert.doesNotMatch(listing.fullDescription, /kampania|tryb kampanii/i);
});

test('Google Play preflight reports privacy, ad, screenshot and Firebase setup without failing CI builds', async () => {
  const result = spawnSync(process.execPath, ['scripts/check-play-store-readiness.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, ADMOB_APP_ID: '', VITE_ADMOB_REWARDED_ID: '', VITE_ADMOB_INTERSTITIAL_ID: '' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.app.applicationId, 'pl.paleciaki.magazynchaosu');
  assert.ok(report.app.firebaseProjectId);
  assert.ok(report.app.firestoreDatabaseId);
  assert.ok(report.blockers.some((item) => /Polityka prywatności/.test(item)));
  assert.ok(report.warnings.some((item) => /AdMob/.test(item)));
  assert.ok(report.manualChecks.some((item) => /Anonymous/.test(item)));
  assert.ok(report.manualChecks.some((item) => /12 testerami/.test(item)));
  assert.equal(report.ads.productionConfigured, false);
});
