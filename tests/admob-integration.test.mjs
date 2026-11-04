import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('AdMob is Android-only and UMP consent precedes Google Mobile Ads initialization', async () => {
  const [ads, vite, workflow, pkg] = await Promise.all([
    read('../src/ads.ts'),
    read('../vite.config.ts'),
    read('../.github/workflows/android-release.yml'),
    read('../package.json'),
  ]);
  assert.match(pkg, /"@capacitor-community\/admob": "8\.2\.1"/);
  assert.match(ads, /Capacitor\.isNativePlatform\(\)/);
  assert.match(ads, /AdMob\.requestConsentInfo\(\)/);
  assert.match(ads, /AdMob\.showConsentForm\(\)/);
  assert.match(ads, /consent\.canRequestAds/);
  assert.match(ads, /AdMob\.initialize\(\)/);
  assert.ok(ads.indexOf('AdMob.requestConsentInfo()') < ads.indexOf('AdMob.initialize()'));
  assert.match(vite, /__PALIECIAKI_ADS__/);
  for (const variable of ['ADMOB_APP_ID', 'VITE_ADMOB_REWARDED_ID', 'VITE_ADMOB_INTERSTITIAL_ID']) {
    assert.match(workflow, new RegExp(variable));
  }
});

test('Rewarded ad grants Survival reroll only after positive SDK reward', async () => {
  const [ads, game, app, html] = await Promise.all([
    read('../src/ads.ts'),
    read('../src/game.ts'),
    read('../src/index.ts'),
    read('../index.html'),
  ]);
  assert.match(ads, /Number\(reward\.amount\) > 0/);
  assert.match(game, /public grantSurvivalRerollFromAd\(\)/);
  assert.match(game, /survivalAdRerollGranted/);
  assert.match(app, /if \(earned && this\.engine\.grantSurvivalRerollFromAd\(\)\)/);
  assert.match(html, /id="btn-survival-ad-reroll"/);
});

test('Interstitial is limited to chosen result-to-menu transitions', async () => {
  const [ads, app] = await Promise.all([
    read('../src/ads.ts'),
    read('../src/index.ts'),
  ]);
  assert.match(ads, /returns % 3 !== 0/);
  assert.match(ads, /4 \* 60 \* 1000/);
  assert.equal((app.match(/void showInterstitialAfterRun\(\)/g) || []).length, 2);
});

test('UMP privacy-options screen is exposed in settings', async () => {
  const [html, app, ads] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/ads.ts'),
  ]);
  assert.match(html, /id="btn-ad-privacy-options" class="ad-privacy-options-btn hidden"/);
  assert.match(app, /btn-ad-privacy-options/);
  assert.match(ads, /AdMob\.showPrivacyOptionsForm\(\)/);
});
