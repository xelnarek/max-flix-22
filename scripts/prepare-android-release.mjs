import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const applicationId = 'pl.paleciaki.magazynchaosu';
const gradlePath = resolve('android/app/build.gradle');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const versionName = process.env.ANDROID_VERSION_NAME || packageJson.version || '0.1.0';
const runNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
const versionCode = Math.max(1, Number.isFinite(runNumber) ? runNumber + 1 : 1);

if (!existsSync(gradlePath)) {
  throw new Error('Android Gradle file not found. Run npx cap add android before preparing the release.');
}

let gradle = readFileSync(gradlePath, 'utf8');
const replacements = [
  [/namespace\s*=\s*["'][^"']+["']/, 'namespace = "' + applicationId + '"'],
  [/applicationId\s+["'][^"']+["']/, 'applicationId "' + applicationId + '"'],
  [/versionCode\s+\d+/, 'versionCode ' + versionCode],
  [/versionName\s+["'][^"']+["']/, 'versionName "' + versionName + '"'],
];

for (const [pattern, replacement] of replacements) {
  if (!pattern.test(gradle)) {
    throw new Error('Android Gradle template changed; expected setting not found: ' + pattern);
  }
  gradle = gradle.replace(pattern, replacement);
}

const signingValues = [
  'ANDROID_UPLOAD_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];
const configuredSigningValues = signingValues.filter((key) => Boolean(process.env[key]));
if (configuredSigningValues.length > 0 && configuredSigningValues.length !== signingValues.length) {
  throw new Error('Incomplete Android signing configuration. Set all four ANDROID_* signing secrets or none of them.');
}

const signingEnabled = configuredSigningValues.length === signingValues.length;
if (signingEnabled) {
  const keystorePath = process.env.ANDROID_UPLOAD_KEYSTORE_PATH;
  if (!existsSync(keystorePath)) {
    throw new Error('Upload keystore file is missing at ANDROID_UPLOAD_KEYSTORE_PATH.');
  }
  const signingBlock = '\n    signingConfigs {\n        release {\n            storeFile file(System.getenv(\\'ANDROID_UPLOAD_KEYSTORE_PATH\\'))\n            storePassword System.getenv(\\'ANDROID_KEYSTORE_PASSWORD\\')\n            keyAlias System.getenv(\\'ANDROID_KEY_ALIAS\\')\n            keyPassword System.getenv(\\'ANDROID_KEY_PASSWORD\\')\n        }\n    }\n';
  if (!/buildTypes\s*\{\s*release\s*\{/.test(gradle)) {
    throw new Error('Android Gradle template does not contain the expected release build type.');
  }
  gradle = gradle.replace(/\n\s*buildTypes\s*\{/, '\n' + signingBlock + '\n    buildTypes {');
  gradle = gradle.replace(
    /(buildTypes\s*\{\s*release\s*\{)/,
    '$1\n            signingConfig signingConfigs.release',
  );
}

writeFileSync(gradlePath, gradle);
console.log(JSON.stringify({
  applicationId,
  versionName,
  versionCode,
  signingEnabled,
  buildType: signingEnabled ? 'signed-release-and-debug' : 'unsigned-release-and-debug',
}, null, 2));
