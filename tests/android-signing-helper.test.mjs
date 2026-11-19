import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Android upload signer requires the expected certificate and does not expose secrets', async () => {
  const [script, workflow, docs] = await Promise.all([
    read('../scripts/configure-github-android-signing.sh'),
    read('../.github/workflows/android-release.yml'),
    read('../docs/ANDROID_RELEASE_SIGNING.md'),
  ]);

  const secrets = [
    'ANDROID_UPLOAD_KEYSTORE_BASE64',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ];
  for (const secret of secrets) {
    assert.ok(script.includes(secret), 'signing helper should set ' + secret);
    assert.ok(workflow.includes('secrets.' + secret), 'workflow should read ' + secret);
  }

  assert.match(script, /EXPECTED_UPLOAD_CERT_SHA256/);
  assert.ok(script.includes('CERT_SHA256=') && script.includes('EXPECTED_UPLOAD_CERT_SHA256'), 'helper must verify the expected upload certificate');
  assert.match(script, /gh secret set/);
  assert.match(script, /set \+x/);
  assert.doesNotMatch(script, /set -x/);
  assert.match(workflow, /vars\.GOOGLE_PLAY_UPLOAD_ENABLED == 'true'/);
  assert.match(workflow, /secrets\.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/);
  assert.match(docs, /Nie generuj nowego klucza na ślepo/);
  assert.match(docs, /release-readiness-report\.json/);
  assert.match(docs, /Nie publikuj placeholderów/);
});
