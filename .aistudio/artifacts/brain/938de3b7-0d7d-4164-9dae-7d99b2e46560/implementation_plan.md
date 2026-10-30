# Plan Przebudowy: Widok i Tempo Vampire Survivors oraz Uporządkowanie UI

Plan przebudowy perspektywy gry na szeroki widok z góry w stylu *Vampire Survivors*, znaczącego stonowania tempa ruchu (50% na starcie) oraz likwidacji nakładających się ramek i chaosu w interfejsie na smartfonach.

---

## 1. Wybrane Decyzje Użytkownika

- **Kamera & Widok Mapy**: Szeroki rzut z góry (*Top-Down / Isometric Overview* ~60° z dużą odległością), ukazujący duży obszar magazynu, alejek i zbliżających się wrogów – dokładnie tak jak w *Vampire Survivors*.
- **Tempo Rozgrywki**: **Bardzo stonowany start przy 50% prędkości bazowej**, z wolnym, płynnym narastaniem tempa w czasie trwania starcia (do 100% w 150 sekund).
- **Czyszczenie i Reorganizacja Interfejsu (Mobile UI)**:
  - Przeniesienie aktywnej listy perków (`#hud-perks-row`) na **prawą krawędź ekranu**.
  - Umieszczenie dymków dialogowych / powiadomień na **górze na środku** z mniejszym rozmiarem i szybkim znikaniem (2.8s), by nigdy nie zasłaniały statystyk ani paska HP.
  - Wyśrodkowanie paska Bossa (`#boss-hud-bar`) na samej górze.
  - Skompresowanie ikonek i usunięcie nakładania się ramek na małych ekranach.

---

## 2. Plan Modyfikacji Krok po Kroku

### Krok 1: Nowy Kąt i Dystans Kamery w `src/game.ts`
- Zaktualizowanie bazowych offsetów kamery w trybie `tpp`:
  ```ts
  baseOffsetX = 0.0;
  baseOffsetY = 16.5; // Wysoki widok z góry
  baseOffsetZ = 12.5;
  ```
- Zwiększenie zasięgu pola widzenia (FOV) na urządzeniach mobilnych, zapewniające przegląd dużej części mapy.

### Krok 2: Wolniejsze Tempo w `src/game.ts`
- Zmiana wzoru `getPacingFactor()`:
  ```ts
  // Start od 0.50 (50%), płynny przyrost do 1.0 w ciągu 150s
  return Math.min(1.0, 0.50 + (elapsedSec / 150) * 0.50);
  ```
- Dostosowanie prędkości gracza, skoku i przeciwników do nowego widoku taktycznego.

### Krok 3: Reorganizacja CSS i HTML w `src/index.css` & `src/index.ts`
- **Prawa strona ekranu**: `#hud-perks-row` otrzymuje pozycję `right: 12px; top: 72px; flex-direction: column; align-items: flex-end;`.
- **Środek na górze**:
  - Dymki tekstowe `.speech-bubble-pop` – wyśrodkowane na górze (`top: 56px; left: 50%; transform: translateX(-50%);`), maks. szerokość 320px, kompaktowy padding.
  - Pasek bossa `#boss-hud-bar` – umieszczony wyżej, z powężonymi marginesami.
- **Top cluster**: Zmniejszenie rozmiarów ikonek w lewym górnym rogu na telefonach, wyeliminowanie nakładania się tekstu i przycisków.

---

## 3. Weryfikacja

- Skompilowanie za pomocą `compile_applet` oraz `lint_applet`.
- Sprawdzenie braku nakładania się elementów UI w widoku pionowym na smartfonach.
