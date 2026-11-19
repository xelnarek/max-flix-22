# Android release signing and Google Play readiness

Stan dokumentacji: 19 listopada 2026. Repozytorium: `xelnarek/max-flix-22`.

## Ostatni zweryfikowany build

Build Android QA **#733** powstał z commita `2382450607eeef35c43815fa0c65cfe2aaf5c0f1`. Raport wskazuje:

- `applicationId`: `pl.paleciaki.magazynchaosu`;
- `versionName`: `0.1.0`;
- `versionCode`: `734`;
- `minSdk`: 24; `targetSdk` i `compileSdk`: 36;
- APK debug: podpisany kluczem debug, przeznaczony do instalacji i QA;
- AAB release: **niepodpisany** — nie jest gotowy do wysłania do Play Console.

Workflow potwierdził testy, budowę web gry, synchronizację Capacitor, budowę pakietów oraz weryfikację APK/AAB. Fizyczny test na Poco F6 lub innym urządzeniu nie jest wykonywany przez CI.

## Podpis uploadowy — ważne

Nie generuj nowego klucza na ślepo. Projekt ma kontrolę SHA-256 certyfikatu uploadowego. Skrypt `scripts/configure-github-android-signing.sh` akceptuje wyłącznie keystore z oczekiwanym certyfikatem i przerywa pracę przed zmianą sekretów, gdy fingerprint się nie zgadza. To zabezpiecza przed przypadkowym zastąpieniem istniejącego klucza.

Zachowaj plik keystore oraz hasła w bezpiecznej kopii poza repozytorium. Nie wysyłaj ich na czat, nie dodawaj do Git i nie używaj klucza debug jako klucza uploadowego.

## Sekrety GitHub Actions

Workflow używa czterech sekretów repozytorium:

- `ANDROID_UPLOAD_KEYSTORE_BASE64` — oryginalny keystore zakodowany Base64;
- `ANDROID_KEYSTORE_PASSWORD`;
- `ANDROID_KEY_ALIAS`;
- `ANDROID_KEY_PASSWORD`.

Do automatycznej publikacji na wewnętrznym tracku wymagane są dodatkowo:
- zmienna repozytorium `GOOGLE_PLAY_UPLOAD_ENABLED=true`;
- sekret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` z poprawnie skonfigurowanym kontem usługi Google Play Developer API.

### Konfiguracja

Na zaufanym komputerze przygotuj GitHub CLI (`gh`) i JDK, zaloguj się przez `gh auth login`, a następnie uruchom:

```bash
bash scripts/configure-github-android-signing.sh
```

Skrypt pobiera ścieżkę do keystore, alias oraz hasła bez wyświetlania ich wartości. Weryfikuje certyfikat uploadowy, pyta o wyraźne potwierdzenie `USTAW`, zapisuje cztery sekrety i uruchamia workflow Android na `main`.

**Uwaga:** jeżeli `GOOGLE_PLAY_UPLOAD_ENABLED` jest ustawione na `true` i sekret konta usługi jest prawidłowy, ten workflow może wysłać podpisany AAB na track `internal`. Nie uruchamiaj skryptu, dopóki nie sprawdzisz ustawień publikacji.

Po buildzie otwórz artefakt `paleciaki-android-...` i sprawdź raport `android-build-report.json`. Wymagane wartości dla wydania:
- `signingConfigured=true`;
- `appBundleSigned=true`;
- `playStoreUploadReady=true`;
- brak blokerów podpisu.

## Pozostałe blokery z raportu #733

Raport `release-readiness-report.json` nie oznaczał aplikacji jako gotowej do publikacji:

1. **Polityka prywatności:** uzupełnij prawdziwą nazwę prawną administratora/wydawcy i działający adres kontaktowy w `public/privacy.html`. Nie publikuj placeholderów.
2. **Reklamy:** build używał testowych identyfikatorów AdMob. Wstaw własne produkcyjne identyfikatory dopiero po konfiguracji konta. Dodaj publiczny `app-ads.txt` z właściwym Publisher ID.
3. **Grafiki sklepu:** dodaj co najmniej dwa aktualne zrzuty ekranu prawdziwej rozgrywki z urządzenia do `play-store/screenshots/`. Artefakt CI zawiera również wygenerowaną ikonę 512×512 i grafikę funkcji 1024×500.
4. **Firebase i ranking:** potwierdź Firebase Authentication → Anonymous, opublikowane reguły Firestore i zgodność rzeczywistych przepływów danych z polityką. Anonimowa sesja sama w sobie nie chroni rankingu przed spreparowanymi wynikami.
5. **Play Console:** uzupełnij i sprawdź deklaracje Data safety, reklam, grupy docelowej, ocenę treści, kategorię, dane kontaktowe i dostęp do funkcji sieciowych.

Wymagania Play Console mogą się zmieniać; sprawdź je w konsoli przed wysłaniem wydania. Nie wpisuj fikcyjnych danych wydawcy, kontaktu, reklam ani zrzutów ekranu.

## Kontrola przed publikacją

```bash
npm run play:preflight
npm test
npm run lint
```

Dodatkowo przetestuj APK na urządzeniu fizycznym: zimny start, intro, menu i przewijanie, Campaign, Survival, PvP, sterowanie dotykowe, Oniryczny 2D, dłuższą sesję, powrót z tła oraz pracę bez sieci.
