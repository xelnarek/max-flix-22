# Audit technicznego długu — 18 listopada 2026

## Zakres i metoda

Przejrzano główny dispatcher umiejętności, importy src/game.ts i src/index.ts, silnik proceduralnego audio (src/sound.ts), zasoby magazynu (src/warehouseAssets.ts), konfigurację TypeScript oraz referencje modułów używanych przez intro i ekran gry. Kandydat do usunięcia musiał nie mieć żadnego wywołania poza własną deklaracją w kodzie produkcyjnym.

## Zmiany wykonane w tym pakiecie

1. Usunięto z src/game.ts nieużywany import getB4LogoTexture. Sama funkcja pozostaje, ponieważ createDeliveryVan() w warehouseAssets.ts używa jej do tekstury zabudowy auta.
2. Usunięto sześć nieużywanych metod generatora audio: playCoffeePowerup, playCatPounce, playHonk, playReclamation, playGlassBreak i playApplause. W repozytorium nie znaleziono wywołań tych metod poza ich własnymi deklaracjami. Pozostałe, podobnie nazwane efekty pozostają, jeśli mają aktywne odwołania.
3. Zastąpiono pięć sztywnych kwestii skilla pulami po cztery warianty na operatora. Wybór nie powtarza poprzedniej kwestii tej samej postaci. Okrzyk jest wyświetlany przez istniejący dymek; nie dodano sztucznego TTS ani ciężkich plików audio.

## Elementy celowo zachowane

- getB4LogoTexture() — aktywna zależność createDeliveryVan(); usunięto tylko zbędny import w silniku.
- playCinematicBoom() — używany przez cinematicIntro.ts.
- cthulhuRetroArena.ts — importowany przez index.ts; nie jest osieroconym modułem.
- Pozostałe metody dźwiękowe i moduły logiki walki — nie usuwano ich na podstawie samej nazwy, bo repozytorium zawiera aktywne odwołania w engine/UI.

## Ryzyko i dalsze zalecenia

- noUnusedLocals nie jest włączone w tsconfig.json; obecna kontrola TypeScript nie wymusza wykrywania wszystkich martwych importów. Włączenie tej reguły dla całego repozytorium powinno być osobnym zadaniem po przejrzeniu ewentualnych błędów w istniejących modułach.
- Nie usuwano plików modułów ani gałęzi Campaign/Survival/PvP na podstawie heurystyki. Usunięcie modułu wymaga pełnego grafu zależności, kontroli dynamicznych importów i testów regresyjnych.
