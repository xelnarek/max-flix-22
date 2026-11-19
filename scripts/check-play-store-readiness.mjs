import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const readJson = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const packageJson = readJson('package.json');
const capacitor = readJson('capacitor.config.json');
const manifest = readJson('public/manifest.webmanifest');
const listing = readJson('play-store/listing-pl.json');
const firebase = readJson('firebase-applet-config.json');
const privacy = readFileSync(resolve('public/privacy.html'), 'utf8');

const blockers = [];
const warnings = [];
const manualChecks = [
  'W Firebase Console włącz Firebase Authentication → Anonymous i opublikuj reguły Firestore dla bazy ' + firebase.firestoreDatabaseId + ' w projekcie ' + firebase.projectId + '.',
  'Na fizycznym Androidzie sprawdź zimny start, dłuższą rozgrywkę, dotyk, tryb Oniryczny 2D, powrót z tła, tryby Survival/Campaign/PvP i zachowanie bez sieci.',
  'W Play Console uzupełnij App access, Ads declaration, Content rating, Target audience, Data safety i dane kontaktowe; uwzględnij SDK firm trzecich.',
  'Dla nowych kont osobistych utworzonych po 13.11.2023 sprawdź aktualny wymóg testu zamkniętego: co najmniej 12 testerów przez 14 dni.',
  'Dodaj co najmniej dwa prawdziwe zrzuty ekranu z urządzenia do karty sklepu.',
  'Zweryfikuj nazwę wydawcy, stronę pomocy, politykę prywatności, kraje dystrybucji, kategorię i ocenę treści.'
];

function check(condition, message) {
  if (!condition) blockers.push(message);
}

check(typeof listing.appName === 'string' && listing.appName.length <= 30, 'Nazwa aplikacji Play musi mieć maksymalnie 30 znaków.');
check(typeof listing.shortDescription === 'string' && listing.shortDescription.length <= 80, 'Krótki opis Play musi mieć maksymalnie 80 znaków.');
check(typeof listing.fullDescription === 'string' && listing.fullDescription.length <= 4000, 'Pełny opis Play musi mieć maksymalnie 4000 znaków.');
check(listing.appName === capacitor.appName, 'Nazwa w listing-pl.json nie zgadza się z capacitor.config.json.');
check(manifest.name === capacitor.appName, 'Nazwa PWA nie zgadza się z nazwą aplikacji Android.');
check(capacitor.appId === 'pl.paleciaki.magazynchaosu', 'Identyfikator pakietu zmienił się — sprawdź ciągłość aplikacji i podpisywania.');
check(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(packageJson.version), 'package.json version musi mieć poprawny format semver.');

const privacyPlaceholders = privacy.match(/\[(?:UZUPEŁNIĆ|DO UZUPEŁNIENIA)[^\]]*\]/gi) || [];
check(privacyPlaceholders.length === 0, 'Polityka prywatności nadal zawiera pola do uzupełnienia: dane prawne wydawcy i działający e-mail kontaktowy.');

const configuredAppId = process.env.ADMOB_APP_ID?.trim() || '';
const rewardedId = process.env.VITE_ADMOB_REWARDED_ID?.trim() || '';
const interstitialId = process.env.VITE_ADMOB_INTERSTITIAL_ID?.trim() || '';
const productionAdsConfigured =
  /^ca-app-pub-\d+~\d+$/.test(configuredAppId) &&
  /^ca-app-pub-\d+\/\d+$/.test(rewardedId) &&
  /^ca-app-pub-\d+\/\d+$/.test(interstitialId);

if (!productionAdsConfigured) {
  warnings.push('Brak kompletu produkcyjnych identyfikatorów AdMob. Build korzysta z bezpiecznych jednostek demo i nie generuje przychodu z reklam.');
}

const appAdsPath = resolve('public/app-ads.txt');
if (!existsSync(appAdsPath)) {
  warnings.push('Brak public/app-ads.txt. Dodaj go po uzyskaniu własnego Publisher ID w AdMob.');
} else if (/pub-0{6,}/.test(readFileSync(appAdsPath, 'utf8'))) {
  blockers.push('public/app-ads.txt zawiera przykładowy Publisher ID.');
}

const screenshotsDirectory = resolve('play-store/screenshots');
const screenshots = existsSync(screenshotsDirectory)
  ? readdirSync(screenshotsDirectory).filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
  : [];
if (screenshots.length < 2) {
  warnings.push('Brak co najmniej dwóch zrzutów ekranu z prawdziwego urządzenia w play-store/screenshots/.');
}

const report = {
  schemaVersion: 1,
  app: {
    name: listing.appName,
    applicationId: capacitor.appId,
    versionName: packageJson.version,
    shortDescriptionCharacters: listing.shortDescription.length,
    fullDescriptionCharacters: listing.fullDescription.length,
    firebaseProjectId: firebase.projectId,
    firestoreDatabaseId: firebase.firestoreDatabaseId
  },
  ads: {
    productionConfigured: productionAdsConfigured,
    mode: productionAdsConfigured ? 'production-ids-configured' : 'google-demo-ids-testing',
    appAdsTxtPresent: existsSync(appAdsPath)
  },
  storeAssets: { phoneScreenshots: screenshots.length },
  blockers,
  warnings,
  manualChecks,
  releaseReady: blockers.length === 0 && warnings.length === 0
};

const outputPath = resolve('play-store/generated/release-readiness-report.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');

const summary = [
  '## Google Play release preflight',
  '',
  '| Status | Count |',
  '|---|---:|',
  '| Blocking items | ' + blockers.length + ' |',
  '| Warnings / owner setup | ' + warnings.length + ' |',
  '| Physical screenshots | ' + screenshots.length + ' |',
  '| Production AdMob IDs | ' + (productionAdsConfigured ? 'configured' : 'not configured — demo mode') + ' |',
  '',
  ...blockers.map((item) => '- **BLOCKER:** ' + item),
  ...warnings.map((item) => '- **ACTION:** ' + item),
  '',
  'Full report: `play-store/generated/release-readiness-report.json`'
].join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(JSON.stringify(report, null, 2));
