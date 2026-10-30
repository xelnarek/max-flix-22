# Plan Implementacji: Rozbudowa Max-Fliz 3D

## 1. UI Polish (Menu główne)
- **Stylizacja**: Dodanie efektów glow (CSS `box-shadow`) do aktywnych zakładek i przycisków w menu.
- **Płynność**: Implementacja CSS `transition` dla animacji hover i stanów aktywnych w menu.
- **Tło**: Dodanie lekkiego systemu cząsteczkowego (Three.js `Points`) w menu głównym (`state === 'title'`), renderowanego w `src/index.ts`.

## 2. Przeciwnicy (Wszyscy na wszystkich mapach)
- **Aktualizacja `src/game.ts`**: Modyfikacja metod `buildLevel1()`, `buildLevel2()`, `buildLevel3()` w celu dodania `PanRoman`, `Serwisanci`, oraz `BosmanKrakow` do każdej z map.

## 3. System Skrzynek z Łupem (Loot Crates)
- **Assety**: Dodanie `createLootCrateModel()` w `src/warehouseAssets.ts`.
- **Logika**: Implementacja `spawnLootCrate` w `src/game.ts`, które będą losowo generować perki lub punkty.
- **Rozmieszczenie**: Dodanie skrzynek na wszystkich poziomach.
