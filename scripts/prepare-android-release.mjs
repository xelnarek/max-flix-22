import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const applicationId = 'pl.paleciaki.magazynchaosu';
const gradlePath = resolve('android/app/build.gradle');
const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const demoAdMobAppId = 'ca-app-pub-3940256099942544~3347511713';
const configuredAdMobAppId = process.env.ADMOB_APP_ID?.trim() || '';
const adMobAppId = /^ca-app-pub-\d+~\d+$/.test(configuredAdMobAppId)
  ? configuredAdMobAppId
  : demoAdMobAppId;
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
  const signingBlock = [
    '    signingConfigs {',
    '        release {',
    "            storeFile file(System.getenv('ANDROID_UPLOAD_KEYSTORE_PATH'))",
    "            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')",
    "            keyAlias System.getenv('ANDROID_KEY_ALIAS')",
    "            keyPassword System.getenv('ANDROID_KEY_PASSWORD')",
    '        }',
    '    }',
  ].join('\n');
  if (!/buildTypes\s*\{\s*release\s*\{/.test(gradle)) {
    throw new Error('Android Gradle template does not contain the expected release build type.');
  }
  gradle = gradle.replace(/\n\s*buildTypes\s*\{/, '\n' + signingBlock + '\n\n    buildTypes {');
  gradle = gradle.replace(
    /(buildTypes\s*\{\s*release\s*\{)/,
    '$1\n            signingConfig signingConfigs.release',
  );
}

if (!existsSync(manifestPath)) {
  throw new Error('Android manifest not found. Run npx cap add android before preparing the release.');
}

let manifest = readFileSync(manifestPath, 'utf8');
const appIdAttribute = 'android:name="com.google.android.gms.ads.APPLICATION_ID"';
const admobMetaData = '        <meta-data ' + appIdAttribute + ' android:value="' + adMobAppId + '" />';
const existingAppIdStart = manifest.indexOf(appIdAttribute);
if (existingAppIdStart >= 0) {
  const tagStart = manifest.lastIndexOf('<meta-data', existingAppIdStart);
  const tagEnd = manifest.indexOf('/>', existingAppIdStart);
  if (tagStart < 0 || tagEnd < 0) throw new Error('Malformed existing AdMob manifest metadata.');
  manifest = manifest.slice(0, tagStart) + admobMetaData + manifest.slice(tagEnd + 2);
} else if (manifest.includes('</application>')) {
  manifest = manifest.replace('</application>', admobMetaData + '\n    </application>');
} else {
  throw new Error('Android manifest does not contain a valid application element.');
}
writeFileSync(manifestPath, manifest);

writeFileSync(gradlePath, gradle);
if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, [
    'ANDROID_SIGNING_ENABLED=' + String(signingEnabled),
    'ANDROID_APPLICATION_ID=' + applicationId,
    'ANDROID_VERSION_NAME=' + versionName,
    'ANDROID_VERSION_CODE=' + versionCode,
    '',
  ].join('\n'));
}
console.log(JSON.stringify({
  applicationId,
  versionName,
  versionCode,
  signingEnabled,
  buildType: signingEnabled ? 'signed-release-and-debug' : 'unsigned-release-and-debug',
}, null, 2));
