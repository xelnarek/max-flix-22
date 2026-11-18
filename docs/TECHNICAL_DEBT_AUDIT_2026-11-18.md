# Audit technicznego długu — 18 listopada 2026

## Zakres i metoda

Przejrzano wspólny dispatcher umiejętności, importy głównych entrypointów `src/game.ts` i `src/index.ts`, wywołania publicznych metod `src/sound.ts`, użycie tekstur w `src/warehouseAssets.ts`, konfigurację TypeScript oraz manifesty zależności. Kandidat do natychmiastowego usunięcia musiał nie mieć żadnego wywołania poza własną deklaracją w kodzie produkcyjnym.

## Zmiany wykonane w tym pakiecie

1. Usunięto z `src/game.ts` nieużywany import `getB4LogoTexture`. Sama funkcja pozostaje, ponieważ `createDeliveryVan()` w `warehouseAssets.ts` używa jej do tekstury zabudowy auta.
2. Usunięto sześć nieużywanych metod generatora audio: `playCoffeePowerup`, `playCatPounce`, `playHonk`, `playReclamation`, `playGlassBreak` i `playApplause`. W repozytorium nie znaleziono wywołań tych metod poza ich własnymi deklaracjami. Pozostałe, podobnie nazwane efekty pozostają, jeśli mają aktywne odwołania.
3. Zastąpiono pięć sztywnych kwestii skilla pulami po cztery warianty na operatora. Wybór nie powtarza poprzedniej kwestii tej samej postaci. Okrzyk jest wyświetlany przez istniejący dymek; nie dodano sztucznego TTS ani ciężkich plików audio.

## Kandydaci do osobnego, kontrolowanego porządkowania

Poniższe elementy nie zostały usunięte w tym PR, ponieważ wymagają sprawdzenia zależności pośrednich i regeneracji lockfile:

- `@preact/signals-core` — wyszukiwanie kodu nie wykazało bezpośredniego importu z `src/`; występuje w manifestach i lockfile. Kandydat na zbędną zależność bezpośrednią, ale najpierw należy sprawdzić, czy nie jest wymagana przez zależność pośrednią lub środowisko narzędziowe.
- `@pmndrs/uikit` — nie znaleziono bezpośredniego importu w kodzie źródłowym, ale pakiet jest wpisany do `vite.config.ts` w `optimizeDeps.include` i `rollupOptions.external`. Przed usunięciem trzeba sprawdzić peer-dependencies `xrblocks` i usunąć lub poprawić wpisy Vite razem z manifestem.
- Alias `rapier3d` oraz alias/deklaracja `troika-three-text` — znaleziono je w konfiguracji TypeScript i deklaracjach typów, bez bezpośredniego importu z obecnego `src/`. To kandydaci do usunięcia z `paths`/ambient declarations po potwierdzeniu, że nie są potrzebni zewnętrznym typom lub narzędziom.
- `bun.lock` i `package-lock.json` mają nazwę workspace `xrblocks-example`, podczas gdy `package.json` nazywa projekt `paleciaki-magazyn-chaosu`. To niespójna metadana lockfile; pliki należy wygenerować ponownie przy użyciu jednego uzgodnionego package managera, zamiast ręcznie zmieniać wpisy.
- `tsconfig.json` nie włącza `noUnusedLocals`. Włączenie tej opcji w osobnym PR pozwoli wykrywać podobne martwe importy w przyszłości, ale może ujawnić dodatkowy istniejący dług do naprawienia.

## Elementy celowo zachowane

- `getB4LogoTexture()` — aktywna zależność `createDeliveryVan()`; usunięto tylko zbędny import w silniku.
- `playCinematicBoom()` — używany przez `cinematicIntro.ts`.
- `cthulhuRetroArena.ts` — importowany przez `index.ts`; nie jest osieroconym modułem.
- `xrblocks` — intensywnie używany w `index.ts` do inicjalizacji sceny, renderera, klatki i obsługi XR; nie jest kandydatem do usunięcia.
- Pozostałe metody dźwiękowe i moduły logiki walki — nie usuwano ich na podstawie samej nazwy, bo istnieją aktywne odwołania w engine/UI.

## Granice audytu

Nie wykonano automatycznego usunięcia całych modułów ani gałęzi Campaign/Survival/PvP na podstawie heurystyki. Usunięcie modułu wymaga pełnego grafu zależności, kontroli dynamicznych importów, weryfikacji zależności pośrednich i testów regresyjnych. Powyższa lista rozdziela potwierdzone martwe metody/import od zależności, których brak użycia bezpośredniego nie wystarcza do bezpiecznego usunięcia.
