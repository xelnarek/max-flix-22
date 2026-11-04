import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const applicationId = process.env.ANDROID_APPLICATION_ID || 'pl.paleciaki.magazynchaosu';
const versionName = process.env.ANDROID_VERSION_NAME || '0.1.0';
const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE || '0', 10);
const signingConfigured = process.env.ANDROID_SIGNING_ENABLED === 'true';
const variablesPath = resolve('android/variables.gradle');

const releaseApkCandidates = signingConfigured
  ? ['app-release.apk', 'app-release-unsigned.apk']
  : ['app-release-unsigned.apk', 'app-release.apk'];
const releaseApk = releaseApkCandidates
  .map((name) => resolve('android/app/build/outputs/apk/release', name))
  .find((candidate) => existsSync(candidate));
const outputs = {
  appBundle: resolve('android/app/build/outputs/bundle/release/app-release.aab'),
  debugApk: resolve('android/app/build/outputs/apk/debug/app-debug.apk'),
  releaseApk: releaseApk || resolve('android/app/build/outputs/apk/release', releaseApkCandidates[0]),
};
const missing = Object.entries(outputs).filter(([, path]) => !existsSync(path));
if (missing.length) {
  throw new Error('Missing Android build outputs: ' + missing.map(([name]) => name).join(', '));
}

function gradleNumber(source, variable) {
  const match = source.match(new RegExp('\\b' + variable + '\\s*=\\s*(\\d+)'));
  return match ? Number.parseInt(match[1], 10) : null;
}

if (!existsSync(variablesPath)) {
  throw new Error('Android SDK variables file is missing: android/variables.gradle');
}
const variables = readFileSync(variablesPath, 'utf8');
const minSdk = gradleNumber(variables, 'minSdkVersion');
const compileSdk = gradleNumber(variables, 'compileSdkVersion');
const targetSdk = gradleNumber(variables, 'targetSdkVersion');
if (targetSdk !== 36 || compileSdk !== 36) {
  throw new Error(`Google Play release requires compileSdk/targetSdk 36; found compileSdk=${compileSdk}, targetSdk=${targetSdk}.`);
}

function verify(command, args, label) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(label + ' verification failed: ' + output.slice(-2500));
  }
  return output;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const bundleVerification = verify('jarsigner', ['-verify', '-certs', outputs.appBundle], 'AAB signature');
const bundleSigned = /jar verified\./i.test(bundleVerification) && !/jar is unsigned/i.test(bundleVerification);
if (signingConfigured && !bundleSigned) {
  throw new Error('Upload signing secrets were configured, but the AAB is not cryptographically signed.');
}
if (!signingConfigured && bundleSigned) {
  throw new Error('AAB unexpectedly contains a signature although upload signing was not configured. Verify which key signed it.');
}

const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/usr/local/lib/android/sdk';
const apksigner = process.env.APKSIGNER_PATH || resolve(sdkRoot, 'build-tools', '36.0.0', 'apksigner');
verify(apksigner, ['verify', '--verbose', outputs.debugApk], 'Debug APK signature');
if (signingConfigured) {
  verify(apksigner, ['verify', '--verbose', outputs.releaseApk], 'Release APK signature');
}

const artifacts = Object.fromEntries(Object.entries(outputs).map(([name, path]) => [
  name,
  {
    file: path.replace(process.cwd() + '/', ''),
    bytes: statSync(path).size,
    sha256: sha256(path),
    signed: name === 'appBundle' ? bundleSigned : (name === 'debugApk' || signingConfigured),
  },
]));

const report = {
  schemaVersion: 1,
  app: { applicationId, versionName, versionCode, minSdk, compileSdk, targetSdk },
  build: {
    commit: process.env.GITHUB_SHA || null,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    event: process.env.GITHUB_EVENT_NAME || null,
    signingConfigured,
    appBundleSigned: bundleSigned,
    playStoreUploadReady: signingConfigured && bundleSigned,
  },
  artifacts,
  blockers: signingConfigured && bundleSigned
    ? ['Verify Play Console declarations, privacy policy, store listing, and physical-device testing before rollout.']
    : ['AAB is unsigned. Configure all four Android upload-signing secrets before uploading to Google Play.'],
};

const reportPath = resolve('play-store/generated/android-build-report.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

const summary = [
  '## Android package verification',
  '',
  '| Check | Result |',
  '|---|---|',
  '| Package | ' + applicationId + ' |',
  '| Version | ' + versionName + ' (' + versionCode + ') |',
  '| Android SDK | compile ' + compileSdk + ' / target ' + targetSdk + ' / min ' + minSdk + ' |',
  '| AAB signature | ' + (bundleSigned ? 'verified' : 'unsigned') + ' |',
  '| Google Play upload-ready | ' + (report.build.playStoreUploadReady ? 'yes' : 'no — signing key required') + ' |',
  '',
  'SHA-256:',
  ...Object.entries(artifacts).map(([name, data]) => '- ' + name + ': `' + data.sha256 + '`'),
  '',
  'Readiness report: `play-store/generated/android-build-report.json`',
].join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(JSON.stringify(report, null, 2));
