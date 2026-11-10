import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Android CI caches Gradle and retries transient network failures across native dependency installs', async () => {
  const [workflow, retry] = await Promise.all([
    read('../.github/workflows/android-release.yml'),
    read('../scripts/retry-command.sh'),
  ]);
  assert.match(workflow, /uses: gradle\/actions\/setup-gradle@v6/);
  assert.match(workflow, /bash scripts\/retry-command\.sh npm install --no-audit --no-fund/);
  assert.match(workflow, /bash scripts\/retry-command\.sh npm install --no-save/);
  assert.match(workflow, /if \[ "\$ANDROID_SIGNING_ENABLED" = "true" \]/);
  assert.match(workflow, /bundleRelease assembleDebug assembleRelease/);
  assert.match(workflow, /bundleRelease assembleDebug/);
  assert.match(workflow, /unsigned release APK is not installable and wastes ~170 MB/);
  assert.match(workflow, /compression-level: 0/);
  assert.match(workflow, /android\/app\/build\/outputs\/apk\/debug\/\*\.apk/);
  assert.match(retry, /5\[0-9\]\{2\}/);
  assert.match(retry, /gateway time/);
  assert.match(retry, /for \(\(attempt = 1; attempt <= max_attempts; attempt\+\+\)/);
  assert.match(retry, /sleep "\$delay"/);
  assert.match(retry, /exit "\$status"/);
});

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


test('Android upload signing helper validates a keystore, stores four GitHub secrets and dispatches a signed build', async () => {
  const [script, workflow, docs] = await Promise.all([
    read('../scripts/configure-github-android-signing.sh'),
    read('../.github/workflows/android-release.yml'),
    read('../docs/GOOGLE_PLAY_READINESS.md'),
  ]);
  for (const secret of [
    'ANDROID_UPLOAD_KEYSTORE_BASE64',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ]) {
    assert.match(script, new RegExp(secret));
    assert.match(workflow, new RegExp('secrets\\.' + secret));
  }
  assert.match(script, /keytool -list/);
  assert.match(script, /EXPECTED_UPLOAD_CERT_SHA256/);
  assert.match(script, /paleciaki-upload/);
  assert.match(script, /gh secret set/);
  assert.match(script, /gh workflow run android-release\.yml --ref main/);
  assert.match(script, /gh run watch/);
  assert.doesNotMatch(script, /set -x/);
  assert.match(docs, /bash scripts\/configure-github-android-signing\.sh/);
});

test('Android artifact verifier blocks unsigned Play uploads and records hashes', async () => {
  const [script, pkg, prepare] = await Promise.all([
    read('../scripts/verify-android-release.mjs'),
    read('../package.json').then(JSON.parse),
    read('../scripts/prepare-android-release.mjs'),
  ]);
  assert.equal(pkg.scripts['android:verify-release'], 'node scripts/verify-android-release.mjs');
  assert.match(prepare, /ANDROID_SIGNING_ENABLED=/);
  assert.match(script, /jarsigner/);
  assert.match(script, /apksigner/);
  assert.match(script, /signingConfigured && !bundleSigned/);
  assert.match(script, /targetSdk !== 36/);
  assert.match(script, /playStoreUploadReady/);
  assert.match(script, /sha256/);
  assert.match(script, /createReadStream/);
  assert.match(script, /signingConfigured && releaseApk/);
  assert.match(script, /signingConfigured && !releaseApk/);
  assert.match(script, /await sha256\(path\)/);
  assert.match(script, /android-build-report\.json/);
});

test('Google Play upload is opt-in, credential-gated and limited to internal testing', async () => {
  const workflow = await read('../.github/workflows/android-release.yml');
  assert.ok(workflow.includes("vars.GOOGLE_PLAY_UPLOAD_ENABLED == 'true'"));
  assert.ok(workflow.includes('secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));
  assert.match(workflow, /ANDROID_SIGNING_ENABLED.*true/);
  assert.ok(workflow.includes('r0adkll/upload-google-play@e738b9dd8f2476ea806d921b64aacd24f34515a5'));
  assert.match(workflow, /tracks: internal/);
  assert.match(workflow, /status: completed/);
  assert.doesNotMatch(workflow, /tracks: production/);
});

test('Google Play service-account helper validates credentials and enables internal-track uploads safely', async () => {
  const [script, workflow, docs] = await Promise.all([
    read('../scripts/configure-google-play-upload.sh'),
    read('../.github/workflows/android-release.yml'),
    read('../docs/GOOGLE_PLAY_READINESS.md'),
  ]);
  assert.match(script, /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/);
  assert.match(script, /GOOGLE_PLAY_UPLOAD_ENABLED/);
  assert.match(script, /data\.type === 'service_account'/);
  assert.match(script, /BEGIN PRIVATE KEY/);
  assert.match(script, /gh secret set/);
  assert.match(script, /gh variable set/);
  assert.match(script, /gh workflow run android-release\.yml --ref main/);
  assert.doesNotMatch(script, /set -x/);
  assert.match(docs, /bash scripts\/configure-google-play-upload\.sh/);
});

test('Play Store artwork sources and CI exports meet the listing image dimensions', async () => {
  const [iconSvg, iconBackgroundSvg, featureSvg, artworkScript, workflow, listingText] = await Promise.all([
    read('../resources/icon-only.svg'),
    read('../resources/icon-background.svg'),
    read('../play-store/feature-graphic.svg'),
    read('../scripts/prepare-play-store-artwork.mjs'),
    read('../.github/workflows/android-release.yml'),
    read('../play-store/listing-pl.json'),
  ]);
  const listing = JSON.parse(listingText);

  assert.match(iconSvg, /width="1024" height="1024"/);
  assert.match(iconBackgroundSvg, /<rect width="1024" height="1024" fill="url\(#bg\)"/);
  assert.match(featureSvg, /width="1024" height="500"/);
  assert.match(artworkScript, /rsvg-convert/);
  assert.match(artworkScript, /--width', '512'[\s\S]*?--height', '512'/);
  assert.match(artworkScript, /--width', '1024'[\s\S]*?--height', '500'/);
  assert.match(artworkScript, /run\('convert',/);
  assert.doesNotMatch(artworkScript, /run\('magick',/);
  assert.match(artworkScript, /-alpha', 'off'[\s\S]*?-depth', '8'/);
  assert.match(artworkScript, /iconBackgroundSource = resolve\('resources\/icon-background\.svg'\)/);
  assert.match(artworkScript, /-compose', 'over'[\s\S]*?'-composite'/);
  assert.match(artworkScript, /identify', \['-format', '%\[opaque\]'/);
  assert.match(artworkScript, /opacity !== 'true'/);
  assert.match(artworkScript, /colorType !== 6/);
  assert.match(artworkScript, /validateJpeg/);
  assert.match(workflow, /sudo apt-get install -y librsvg2-bin imagemagick/);
  assert.match(workflow, /scripts\/prepare-play-store-artwork\.mjs/);
  assert.match(workflow, /node scripts\/prepare-play-store-artwork\.mjs/);
  assert.match(workflow, /play-store\/generated\/app-icon-512\.png/);
  assert.match(workflow, /play-store\/generated\/feature-graphic-1024x500\.jpg/);
  assert.ok(listing.shortDescription.length <= 80, 'Google Play short description must be at most 80 characters');

  const readiness = await read('../docs/GOOGLE_PLAY_READINESS.md');
  assert.match(readiness, /app-icon-512\.png/);
  assert.match(readiness, /feature-graphic-1024x500\.jpg/);
  assert.match(readiness, /nie są commitowane do repozytorium/);
});
