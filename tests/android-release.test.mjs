import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Android wrapper targets the selected Paleciaki package and built web assets', async () => {
  const config = JSON.parse(await read('../capacitor.config.json'));
  assert.equal(config.appId, 'pl.paleciaki.magazynchaosu');
  assert.equal(config.appName, 'Paleciaki! Magazyn Chaosu');
  assert.equal(config.webDir, 'dist');
  assert.equal(config.android.allowMixedContent, false);
});

test('Android release preparation keeps upload signing secrets out of committed Gradle values', async () => {
  const [script, workflow, pkg] = await Promise.all([
    read('../scripts/prepare-android-release.mjs'),
    read('../.github/workflows/android-release.yml'),
    read('../package.json'),
  ]);
  for (const key of [
    'ANDROID_UPLOAD_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ]) {
    assert.ok(script.includes(key), 'release configuration should read ' + key);
    assert.ok(workflow.includes(key), 'CI workflow should pass ' + key);
  }
  assert.match(script, /pl\.paleciaki\.magazynchaosu/);
  assert.match(script, /versionCode/);
  assert.match(script, /versionName/);
  assert.match(pkg, /android:setup/);
  assert.match(pkg, /android:sync/);
});

test('Android CI builds API 36 AAB and a debug APK without embedding credentials', async () => {
  const workflow = await read('../.github/workflows/android-release.yml');
  assert.match(workflow, /uses: android-actions\/setup-android@v4\s+with:\s+packages: 'platform-tools'/);
  assert.match(workflow, /platforms;android-36/);
  assert.match(workflow, /bundleRelease/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /UPLOAD_KEYSTORE_BASE64/);
  assert.match(workflow, /upload-artifact@v4/);
  assert.doesNotMatch(workflow, /-----BEGIN (?:RSA )?PRIVATE KEY-----/);
});

test('Play Store artwork sources and CI exports meet the listing image dimensions', async () => {
  const [iconSvg, featureSvg, artworkScript, workflow, listingText] = await Promise.all([
    read('../resources/icon-only.svg'),
    read('../play-store/feature-graphic.svg'),
    read('../scripts/prepare-play-store-artwork.mjs'),
    read('../.github/workflows/android-release.yml'),
    read('../play-store/listing-pl.json'),
  ]);
  const listing = JSON.parse(listingText);

  assert.match(iconSvg, /width="1024" height="1024"/);
  assert.match(featureSvg, /width="1024" height="500"/);
  assert.match(artworkScript, /rsvg-convert/);
  assert.match(artworkScript, /--width', '512'[\s\S]*?--height', '512'/);
  assert.match(artworkScript, /--width', '1024'[\s\S]*?--height', '500'/);
  assert.match(artworkScript, /-alpha', 'off'[\s\S]*?-depth', '8'/);
  assert.match(artworkScript, /colorType !== 6/);
  assert.match(artworkScript, /validateJpeg/);
  assert.match(workflow, /sudo apt-get install -y librsvg2-bin imagemagick/);
  assert.match(workflow, /node scripts\/prepare-play-store-artwork\.mjs/);
  assert.match(workflow, /play-store\/generated\/app-icon-512\.png/);
  assert.match(workflow, /play-store\/generated\/feature-graphic-1024x500\.jpg/);
  assert.ok(listing.shortDescription.length <= 80, 'Google Play short description must be at most 80 characters');

  const readiness = await read('../docs/GOOGLE_PLAY_READINESS.md');
  assert.match(readiness, /app-icon-512\.png/);
  assert.match(readiness, /feature-graphic-1024x500\.jpg/);
  assert.match(readiness, /nie są commitowane do repozytorium/);
});
