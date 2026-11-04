# Google Play — gotowość wydawnicza: Paleciaki! Magazyn Chaosu

## Przygotowanie techniczne wykonane w repozytorium

- Publiczna nazwa, opis i metadane produktu: **Paleciaki! Magazyn Chaosu**.
- Publiczny odczyt i zapis rankingu są obecnie dostępne na podstawie reguł Firestore; klient próbuje użyć anonimowego Firebase Authentication, ale kod ma również ścieżkę gościa. Reguła `leaderboard` nie wymaga obecnie `isSignedIn()`, więc nie wolno traktować wpisów jako uwierzytelnionych ani odpornych na fałszowanie.
- Nowe 11,8-sekundowe intro Canvas 2D: dynamiczny najazd, alarm, wózek, nadciągająca horda, prezentacja operatorów i plansza tytułowa. Bez zewnętrznego pliku wideo.
- Manifest PWA, kolor motywu, ikona SVG i strona awaryjna offline z nowym brandingiem.
- Link do polityki prywatności umieszczony w ustawieniach gry.
- Konfiguracja Capacitor 8.6.0: `pl.paleciaki.magazynchaosu`, `dist` jako webDir.
- Workflow Android QA/release przygotowuje natywny projekt od zera, testuje kod, buduje APK debug i AAB. AAB jest podpisywany wyłącznie po skonfigurowaniu sekretów klucza uploadowego.
- Wspólne ID operatorów i lokalne klucze starych zapisów pozostają zachowane, aby nie niszczyć danych użytkownika.

## Wymagane środowisko dla Androida

- Node.js 24 i JDK 21.
- Workflow generuje natywny projekt Android na czystym runnerze; lokalnie `npm run android:setup` tworzy katalog `android/`.
- Android SDK 36 / Android 16 oraz aktualne Android Build Tools.
- Capacitor 8.6.0; target i compile SDK 36; minimalny SDK 24.
- Do wydania produkcyjnego: Android App Bundle (.aab) podpisany własnym kluczem uploadowym.

## GitHub Actions — podpisywanie

W repozytorium dodaj sekrety Actions:
- `ANDROID_UPLOAD_KEYSTORE_BASE64` — plik keystore zakodowany Base64.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Bez tych sekretów workflow buduje APK debug i niepodpisany AAB do kontroli technicznej. Taki AAB nie nadaje się do wysłania jako produkcyjne wydanie w Play Console. Klucz uploadowy przechowuj także w bezpiecznej kopii poza GitHubem.

## Polityka prywatności — bloker do uzupełnienia

Plik `public/privacy.html` jest przygotowany jako szkic i wyjaśnia obecne wykorzystanie pseudonimu, wyników, anonimowej sesji Firebase Authentication, Firestore oraz lokalnej pamięci. Zawiera celowe placeholdery:
- pełna nazwa prawna wydawcy / administratora;
- działający adres e-mail do żądań prywatności i usuwania danych.

Nie wolno publikować tej strony z placeholderami. Właściciel gry musi potwierdzić, że konfiguracja Firebase, reguły Firestore i faktyczne SDK odpowiadają treści polityki. W formularzu Data safety trzeba zadeklarować prawdziwe przepływy i publiczny ranking. Pseudonim i statystyki rankingu są publicznie widoczne.

## Listing i grafiki sklepu

Propozycja polskiej karty sklepu: `play-store/listing-pl.json`. Przed publikacją potrzebne są:
- ikona sklepu PNG 512×512;
- feature graphic 1024×500;
- aktualne zrzuty ekranu gry z urządzenia fizycznego;
- zweryfikowana kategoria, rating treści, grupa docelowa, reklamy i opis funkcji sieciowych.

Ikona SVG w `public/icons/b4-icon.svg` jest ikoną aplikacji webowej. Android adaptive icons generuje workflow Android z osobnych źródeł w `resources/`.

## Testy przed produkcją

Po pobraniu artefaktów z workflow zainstaluj APK debug na urządzeniu Android i sprawdź:
- zimny start, animację intro, skip i przejście do menu;
- WebGL/Three.js, rozgrywkę Kampanii i Survivalu przez dłuższą sesję;
- dotykowy joystick, atak, atak specjalny, pauzę i wznowienie;
- powrót aplikacji z tła, obrót ekranu, utratę sieci, kolejkowanie i synchronizację rankingu;
- uprawnienia, pasek systemowy, tryb immersyjny, dźwięk i stan aplikacji po ubiciu procesu.

## Co nadal blokuje publikację

**Krytyczny bloker bezpieczeństwa rankingu:** aktualna reguła `firestore.rules` pozwala tworzyć dokumenty `leaderboard` bez zalogowania. Aplikacja próbuje rozpocząć anonimową sesję Firebase, ale przy jej niedostępności przechodzi w tryb gościa; obecna reguła nadal pozwala wtedy zapisać wynik. Publiczny klient może więc wysyłać zmyślone wyniki lub spamować ranking. Przed publikacją należy potwierdzić w Firebase Console, że Anonymous Authentication jest włączone, a następnie zaprojektować i przetestować regułę wymagającą uwierzytelnienia oraz powiązania wpisu z UID. Samo uwierzytelnienie nie chroni wyniku przed manipulacją po stronie klienta — ranking konkurencyjny wymaga dodatkowej walidacji serwerowej i ograniczania nadużyć.

To nie jest jeszcze zatwierdzona aplikacja Google Play. Właściciel musi uzupełnić dane wydawcy, skonfigurować i zabezpieczyć klucz podpisujący, zweryfikować politykę oraz Data safety, potwierdzić licencje assetów i wykonać testy na urządzeniach. W nowych kontach osobistych może być wymagany zamknięty test z 12 testerami przez nieprzerwane 14 dni przed wnioskiem o dostęp do produkcji. Wymagania Play Console sprawdź ponownie bezpośrednio przed wysłaniem wersji.
