#!/usr/bin/env bash
# Configure the Google Play Developer API service account and enable internal-track CI upload.
# Run on a trusted computer with GitHub CLI and Node.js installed.
set -Eeuo pipefail
set +x
umask 077

REPOSITORY="xelnarek/max-flix-22"

fail() {
  printf 'BŁĄD: %s\n' "$1" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || fail "Zainstaluj GitHub CLI (gh) i zaloguj się poleceniem: gh auth login."
command -v node >/dev/null 2>&1 || fail "Wymagany jest Node.js do walidacji pliku JSON."
gh auth status --hostname github.com >/dev/null 2>&1 || fail "Brak aktywnego logowania GitHub CLI."

printf '\nPaleciaki! Magazyn Chaosu — konfiguracja uploadu do Google Play Internal testing\n'
printf 'Repozytorium: %s\n\n' "$REPOSITORY"

# Do not enable the upload until all four Android signing secrets already exist.
EXISTING_SECRETS="$(gh secret list --repo "$REPOSITORY" --json name --jq '.[].name')"
for name in \
  ANDROID_UPLOAD_KEYSTORE_BASE64 \
  ANDROID_KEYSTORE_PASSWORD \
  ANDROID_KEY_ALIAS \
  ANDROID_KEY_PASSWORD; do
  grep -Fxq "$name" <<<"$EXISTING_SECRETS" \
    || fail "Brakuje sekretu $name. Najpierw uruchom scripts/configure-github-android-signing.sh."
done

read -r -p "Ścieżka do JSON konta usługi Google Play: " SERVICE_JSON_PATH
case "$SERVICE_JSON_PATH" in
  "~/"*) SERVICE_JSON_PATH="$HOME/$(printf '%s' "$SERVICE_JSON_PATH" | cut -c3-)" ;;
  /*) ;;
  *) SERVICE_JSON_PATH="$PWD/$SERVICE_JSON_PATH" ;;
esac
[[ -f "$SERVICE_JSON_PATH" ]] || fail "Nie znaleziono wskazanego pliku JSON."

node - "$SERVICE_JSON_PATH" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
let data;
try {
  data = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch {
  console.error('Plik nie jest poprawnym JSON. Wartości klucza nie zostały wyświetlone.');
  process.exit(1);
}
const valid =
  data &&
  data.type === 'service_account' &&
  typeof data.project_id === 'string' &&
  typeof data.client_email === 'string' &&
  data.client_email.endsWith('.gserviceaccount.com') &&
  typeof data.private_key === 'string' &&
  data.private_key.includes('BEGIN PRIVATE KEY') &&
  typeof data.token_uri === 'string';
if (!valid) {
  console.error('JSON nie wygląda na klucz konta usługi Google Cloud. Wartości nie zostały wyświetlone.');
  process.exit(1);
}
console.log('Struktura klucza konta usługi poprawna; wartości prywatne ukryte.');
NODE

printf '\nZapisuję sekret konta usługi i włączam wyłącznie upload do Internal testing...\n'
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON --repo "$REPOSITORY" < "$SERVICE_JSON_PATH"
gh variable set GOOGLE_PLAY_UPLOAD_ENABLED --body "true" --repo "$REPOSITORY"

printf 'Uruchamiam Android QA i wysłanie podpisanego AAB na ścieżkę Internal testing...\n'
gh workflow run android-release.yml --ref main --repo "$REPOSITORY"

RUN_ID=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  RUN_ID="$(gh run list --workflow android-release.yml --branch main --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty' --repo "$REPOSITORY" 2>/dev/null || true)"
  [[ -n "$RUN_ID" ]] && break
  sleep 2
done
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || fail "Sekret zapisano, ale nie udało się odczytać ID workflow. Sprawdź GitHub Actions."

printf 'Uruchomienie Android QA: %s\n' "$RUN_ID"
gh run watch "$RUN_ID" --exit-status --repo "$REPOSITORY"
printf '\nSprawdź w Play Console, czy release Internal testing pojawił się na liście wersji.\n'
