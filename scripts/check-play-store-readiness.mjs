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
  'In Firebase Console włącz Firebase Authentication → Anonymous, a reguły z firestore.rules opublikuj dla bazy o ID: ' + firebase.firestoreDatabaseId + ' w projekcie ' + firebase.projectId + '. Repozytorium nie ma firebase.json/.firebaserc, więc nie wdraża tych reguł automatycznie.',
  'Na fizycznym Androidzie sprawdź zimny start, dłuższą rozgrywkę, dotykowe sterowanie, 2D Oniryczny sen, powrót z tła i pracę bez sieci oraz synchronizację kolejki po odzyskaniu połączenia.',
  'W Play Console uzupełnij App access, Ads declaration, Content rating, Target audience, Data safety i informacje kontaktowe. Dane SDK innych firm muszą być uwzględnione w Data safety.',
  'Z Play Console pobierz aktualny link testowy i dodaj testerów. Dla nowego konta osobistego utworzonego po 13.11.2023 wymagany jest zamknięty test z co najmniej 12 testerami, którzy pozostają zapisani nieprzerwanie przez 14 dni przed wnioskiem o dostęp do produkcji.',
  'Dodaj co najmniej dwa prawdziwe zrzuty z urządzenia do karty sklepu. Nie używaj obrazów promocyjnych jako zrzutów ekranu aplikacji.',
  'Przed publikacją sprawdź w Play Console nazwę wydawcy, stronę pomocy, politykę prywatności, kraje dystrybucji, kategorię i ocenę treści.',
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
check(privacyPlaceholders.length === 0, 'Polityka prywatności nadal zawiera pola do uzupełnienia: nazwa prawna wydawcy i działający e-mail kontaktowy.');

const configuredAppId = process.env.ADMOB_APP_ID?.trim() || '';
const rewardedId = process.env.VITE_ADMOB_REWARDED_ID?.trim() || '';
const interstitialId = process.env.VITE_ADMOB_INTERSTITIAL_ID?.trim() || '';
const productionAdsConfigured =
  /^ca-app-pub-\d+~\d+$/.test(configuredAppId) &&
  /^ca-app-pub-\d+\/\d+$/.test(rewardedId) &&
  /^ca-app-pub-\d+\/\d+$/.test(interstitialId);

if (!productionAdsConfigured) {
  warnings.push('Brak kompletu trzech produkcyjnych identyfikatorów AdMob. Build użyje bezpiecznych jednostek demo i isTesting=true — nie zarabia na reklamach.');
}

const appAdsPath = resolve('public/app-ads.txt');
if (!existsSync(appAdsPath)) {
  warnings.push('Brak public/app-ads.txt. Ten plik jest rekomendowany do weryfikacji sprzedawcy reklam w AdMob; dodaj go dopiero z własnym Publisher ID.');
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
    firestoreDatabaseId: firebase.firestoreDatabaseId,
  },
  ads: {
    productionConfigured: productionAdsConfigured,
    mode: productionAdsConfigured ? 'production-ids-configured' : 'google-demo-ids-testing',
    appAdsTxtPresent: existsSync(appAdsPath),
  },
  storeAssets: { phoneScreenshots: screenshots.length },
  blockers,
  warnings,
  manualChecks,
  releaseReady: blockers.length === 0 && warnings.length === 0,
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
  'Full report: `play-store/generated/release-readiness-report.json`',
].join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(JSON.stringify(report, null, 2));
