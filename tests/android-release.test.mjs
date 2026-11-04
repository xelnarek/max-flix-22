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
  assert.match(workflow, /uses: android-actions\\/setup-android@v4\\s+with:\\s+packages: 'platform-tools'/);
  assert.match(workflow, /platforms;android-36/);
  assert.match(workflow, /bundleRelease/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /UPLOAD_KEYSTORE_BASE64/);
  assert.match(workflow, /upload-artifact@v4/);
  assert.doesNotMatch(workflow, /-----BEGIN (?:RSA )?PRIVATE KEY-----/);
});
