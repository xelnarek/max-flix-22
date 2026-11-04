#!/usr/bin/env bash
# Configure Android upload signing in GitHub Actions and start a signed AAB build.
# Run from any directory on a trusted computer with GitHub CLI and JDK installed.
set -Eeuo pipefail
set +x
umask 077

REPOSITORY="xelnarek/max-flix-22"

fail() {
  printf 'BŁĄD: %s\n' "$1" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || fail "Zainstaluj GitHub CLI (gh) i zaloguj się poleceniem: gh auth login"
command -v keytool >/dev/null 2>&1 || fail "Nie znaleziono keytool. Zainstaluj JDK."
command -v base64 >/dev/null 2>&1 || fail "Nie znaleziono narzędzia base64."
gh auth status --hostname github.com >/dev/null 2>&1 || fail "Brak aktywnego logowania GitHub CLI. Uruchom: gh auth login"

printf '\nPaleciaki! Magazyn Chaosu — konfiguracja podpisywania AAB\n'
printf 'Repozytorium: %s\n\n' "$REPOSITORY"
read -r -p "Ścieżka do pliku .jks: " KEYSTORE_PATH
KEYSTORE_PATH="${KEYSTORE_PATH/#\~/$HOME}"
case "$KEYSTORE_PATH" in
  /*) ;;
  *) KEYSTORE_PATH="$PWD/$KEYSTORE_PATH" ;;
esac
[[ -f "$KEYSTORE_PATH" ]] || fail "Nie znaleziono pliku keystore."
read -r -p "Alias klucza: " KEY_ALIAS
[[ -n "$KEY_ALIAS" ]] || fail "Alias nie może być pusty."
read -r -s -p "Hasło keystore: " KEYSTORE_PASSWORD
printf '\n'
read -r -s -p "Hasło klucza: " KEY_PASSWORD
printf '\n'
[[ -n "$KEYSTORE_PASSWORD" && -n "$KEY_PASSWORD" ]] || fail "Hasła nie mogą być puste."

export KEYSTORE_PASSWORD KEY_PASSWORD
keytool -list -keystore "$KEYSTORE_PATH" -storepass:env KEYSTORE_PASSWORD \
  -keypass:env KEY_PASSWORD -alias "$KEY_ALIAS" >/dev/null 2>&1 \
  || fail "Nie można otworzyć keystore lub wskazany alias/hasła są nieprawidłowe."

printf '\nWysyłam cztery sekrety bez wypisywania ich wartości...\n'
base64 < "$KEYSTORE_PATH" | tr -d '\r\n' | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 --repo "$REPOSITORY"
printf '%s' "$KEYSTORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPOSITORY"
printf '%s' "$KEY_ALIAS" | gh secret set ANDROID_KEY_ALIAS --repo "$REPOSITORY"
printf '%s' "$KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD --repo "$REPOSITORY"

unset KEYSTORE_PASSWORD KEY_PASSWORD

printf '\nSekrety zapisane. Uruchamiam build Android na main...\n'
gh workflow run android-release.yml --ref main --repo "$REPOSITORY"

printf 'Oczekuję na identyfikator nowego uruchomienia...\n'
RUN_ID=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  RUN_ID="$(gh run list --workflow android-release.yml --branch main --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty' --repo "$REPOSITORY" 2>/dev/null || true)"
  [[ -n "$RUN_ID" ]] && break
  sleep 2
done
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || fail "Sekrety zapisane, ale nie udało się odczytać ID uruchomienia. Sprawdź zakładkę Actions."
printf 'Build ID: %s\n' "$RUN_ID"
gh run watch "$RUN_ID" --exit-status --repo "$REPOSITORY"
printf '\nGotowe. Pobierz signed .aab z artefaktów ukończonego workflow Android QA.\n'
