# Operacja B4 — przygotowanie do Google Play

## Stan po tym etapie

- [x] Neutralna nazwa produktu i fikcyjne nazwy postaci w publicznym interfejsie.
- [x] Metadane mobilne: theme color, standalone display, manifest i ikona SVG.
- [x] Rejestracja service workera w zakresie katalogu aplikacji.
- [x] Awaryjna strona offline dla nawigacji bez sieci.
- [x] Cache ograniczony do zasobów statycznych samego originu; brak cache dla Firebase i innych usług zewnętrznych.
- [ ] Natywny projekt Android (Capacitor lub Trusted Web Activity) i stabilny applicationId.
- [ ] Podpisany Android App Bundle (.aab) i test na urządzeniu fizycznym.
- [ ] Zweryfikowana polityka prywatności z danymi administratora i opisem faktycznych przepływów Firebase.
- [ ] Formularz Data safety, klasyfikacja treści, docelowa grupa wiekowa i deklaracje reklam.
- [ ] Zasoby sklepu: ikona 512×512 PNG, grafiki promocyjne, zrzuty ekranu i opis.
- [ ] Testy stabilności, wydajności, cyklu życia aplikacji, trybu offline i powrotu z tła.

## Ważne ograniczenia

To repozytorium jest obecnie aplikacją webową Vite/Three.js. Manifest PWA i service worker nie tworzą aplikacji Android i nie generują pliku AAB. Nie wolno przedstawiać tego etapu jako gotowej publikacji w Google Play.

Service worker buforuje wyłącznie małe zasoby statyczne z własnej domeny. Nie buforuje zapytań Firebase, wyników rankingu ani odpowiedzi z usług zewnętrznych. Strona offline informuje o ograniczeniu; nie deklaruje pełnej rozgrywki offline.

## Blokery przed publikacją

1. Ustalić docelowy identyfikator pakietu Android (applicationId) i właściciela podpisywania.
2. Ustalić publiczny adres polityki prywatności oraz prawdziwy kontakt administratora. Nie wpisywać fikcyjnych danych.
3. Przejrzeć konfigurację Firebase, logowanie, reguły Firestore i zakres przechowywanych danych.
4. Zweryfikować, czy wszystkie modele, grafiki, fonty, dźwięki i biblioteki mają licencje pozwalające na dystrybucję komercyjną.
5. Zbudować natywny wrapper, skonfigurować Android lifecycle/back button/status bar/immersive mode i wykonać testy na urządzeniach.

## Testy tego etapu

Uruchomić npm test, npm run lint i npm run build. Po deployu sprawdzić manifest i service worker pod adresem projektu, a następnie instalację PWA na Androidzie. PWA nie zastępuje testów natywnego AAB.
