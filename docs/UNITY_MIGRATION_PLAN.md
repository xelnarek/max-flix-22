# Max Flix — migracja do Unity

## Decyzja technologiczna

Docelowy silnik: **Unity 6000.6.8f1 (Unity 6.6.8f1)**, wydany 3 listopada 2026 r. Wybrana jest najnowsza wspierana wersja z gałęzi Unity 6.6, a nie wersja Alpha/Beta. Render pipeline: **URP 17.5.0** (dopasowany do Unity 6000.6), z uGUI 2.6.0 i Input System 1.20.1; osobne profile jakości dla Androida, przeglądarki i PC.

Dlaczego ta wersja:
- Unity 6.6 wprowadza produkcyjną obsługę WebGPU dla Web Player; WebGL 2 pozostaje ścieżką zgodności i może być używany jako fallback.
- Web Player obsługuje Progressive Asset Loading — można ładować zasoby scenami, zamiast wymuszać pobranie całej zawartości przed rozpoczęciem gry.
- URP obejmuje urządzenia mobilne, PC i Web; nie wybieramy HDRP, które byłoby niepotrzebnie kosztowne dla Poco F6 i wersji przeglądarkowej.
- 6000.6.8f1 jest konkretną, przypiętą wersją edytora, nie ruchomym aliasem latest.

Unity opisuje aktualizacje wspierane jako produkcyjnie weryfikowane do czasu wydania kolejnej wersji. Dla gry usługowej Unity rekomenduje LTS, ale ten projekt rozpoczyna nową migrację i wymaga najnowszej obsługi WebGPU. Wersja edytora zostaje przypięta; aktualizacja do kolejnego wydania nie będzie automatyczna.

## Zasada bezpieczeństwa migracji

**Nie zastępujemy działającej gry Three.js w miejscu.** Obecny projekt, serwer PvP, Firebase, GitHub Pages i Android pozostają produkcyjnym punktem odniesienia. Unity powstaje równolegle w katalogu unity/MaxFlixUnity. Nie zmieniamy routingu, domeny, linku do gry ani konfiguracji Google Play na Unity, dopóki buildy Unity nie przejdą wszystkich bramek zgodności.

Nie kopiujemy mechanik na oko. Każdy system ma źródło referencyjne, implementację C#, testy równoważności oraz kryteria akceptacji. Zachowujemy istniejące identyfikatory operatorów, map, trybów, rekordów konta i kontraktów sieciowych.

## Stan początkowy i zakres

Obecna gra ma 79 modułów TypeScript w src/ oraz 87 testów automatycznych w tests/. Główna pętla 3D jest skoncentrowana w src/game.ts, dane i modele w src/types.ts, src/characters.ts i src/warehouseAssets.ts, a interfejs i integracje w src/index.ts. PvP ma osobny, autorytatywny serwer Node/WebSocket. To duża gra z wieloma powiązanymi systemami — nie jest to jednorazowa konwersja jednego pliku.

Pierwszy commit Unity jest **fundamentem migracji i grywalnym wycinkiem technicznym B4**, a nie deklaracją pełnej zgodności funkcjonalnej. Na tym etapie dodano projekt Unity, katalog danych pięciu operatorów, bootstrap sceny, proceduralny magazyn testowy, ruch postaci, podstawowy atak, przeciwników i ekran HUD. Pozostałe systemy mają jawny status do przeniesienia.

## Mapa przenoszenia funkcji

| Obszar | Źródła referencyjne | Docelowa implementacja Unity |
|---|---|---|
| Rdzeń gry, stany i pętla symulacji | src/game.ts, src/types.ts | Runtime/Game, deterministyczny tick symulacji, jawne stany scen |
| Pięciu operatorów i dane bazowe | src/characters.ts, src/characterBalance.ts | ScriptableObject/data catalog; zachowane ID, bazowe HP, prędkości, skoki, mnożniki |
| Modele i animacje operatorów | src/warehouseAssets.ts, src/characterMotion.ts, src/characterAttackMotion.ts | Rig humanoidalny, punkty obrotu barków/bioder, Animator/Animation Rigging, wyposażenie przypięte do kości |
| Ataki i balans | src/combatBalance.ts, src/archeroMechanics.ts, src/enemyCombatFeedback.ts, src/particlePool.ts | Wspólne reguły obrażeń, pociski, trafienia krytyczne, pooling, hit-stop, recoil i efekty trafień |
| Kampania | src/campaignRewards.ts, src/game.ts | Sceny kampanii, cele poziomów, nagrody, przejścia sektorów, bossowie |
| Survival | src/survival*.ts | Director fal, spawn, mutatory, trudność, wydarzenia, kontrakty, konwoje, koalicje, morale, wsparcie, bossowie i nagrody |
| Mapy Survival | src/survivalMaps.ts, src/survivalMapLayouts.ts, src/survivalMapPreference.ts | Cztery osobne sceny/Addressables: B4, terminal kontenerowy, chłodnia, sortownia nocna; własne kolizje, oświetlenie i materiały |
| System rozwoju | src/characterProgression.ts, src/accountProgression.ts, src/survivalProgression.ts | Mistrzostwo operatorów, talenty konta, rangi, XP i bezpieczne wersjonowanie zapisów |
| PvP — reguły | src/pvpArena.ts, src/pvpAim.ts, src/pvpCamera.ts, src/pvpBotTactics.ts | Identyczna symulacja walki, celowanie ręczne, dash, cooldowny, pickupy, boty i wyniki |
| PvP — transport i serwer | src/pvpClient.ts, src/server/pvpServer.ts, src/server/standalone.ts | Zachowujemy istniejący serwer Node/WebSocket i protokół; tworzymy klienta C# z takim samym kontraktem |
| Reconnect PvP | src/pvpClient.ts, src/server/pvpServer.ts | Token capability, hash SHA-256 po stronie serwera, 20 s grace period, ponowne dołączanie i rotacja tokena |
| Konto, zapis i ranking | src/firebase.ts, src/leaderboard.ts, src/accountProgression.ts | Zachowanie schematów Firestore, identyfikatorów, migracji danych i synchronizacji offline |
| Reklamy i prywatność | src/ads.ts, tests/admob-integration.test.mjs | Native Google Mobile Ads + UMP; zgoda przed inicjalizacją SDK, testy urządzeń, Web bez mobilnego SDK |
| Menu i interfejs | src/index.ts, src/menuInteraction.ts, src/menuTabNavigation.ts, src/visual-polish.css, src/quality-pass.css | UI Toolkit/UGUI, osobne panele: operatorzy, mapy, tryby, BHP, kodeks, drzewka, ranking i ustawienia |
| Sterowanie | src/virtualJoystick.ts, src/touchControlLayout.ts, src/uiViewport.ts, src/visibilityPause.ts | New Input System, ekranowe joysticki i przyciski, mysz/klawiatura/gamepad, bez nakładania kontrolek |
| Kamera i jakość | src/renderQuality.ts, src/worldVisualQuality.ts, src/selectiveBloom.ts, src/bloomPolicy.ts | Cinemachine/rig kamery, URP Volume, dynamiczna skala renderowania, LOD, pooling i profile urządzeń |
| Audio i intro | src/sound.ts, src/cinematicIntro.ts | AudioMixer, pule audio, intro, dialogi i redukcja ruchu |
| Sekrety i minigra | src/oniricPlatformer.ts, src/game.ts | Sekret Króliczej Nory z osobnym trybem 2D, wydarzenia specjalne, MafiKapibary i Pomazaniec |
| PWA i aktualizacje | src/pwaUpdateNotice.ts, public/sw.js, public/manifest.webmanifest | Bezpośredni odpowiednik nie jest wymagany w natywnej aplikacji; Web Player otrzyma wersjonowanie i informację o aktualizacji |

## Kolejność prac i bramki

### Etap 0 — zabezpieczenie i kontrakty
- zamrożenie bazowej wersji Three.js jako referencji;
- eksport i inwentaryzacja danych, schematów zapisu, map, postaci i kontraktów PvP;
- zapis wyników testów i kontrola zgodności identyfikatorów;
- brak zmian w produkcyjnym wdrożeniu.

### Etap 1 — fundament Unity i pionowy wycinek B4
- projekt Unity 6000.6.8f1, URP, New Input System i scena startowa;
- pięciu operatorów w jednym katalogu danych;
- ruch, kamera, HUD, atak podstawowy, przeciwnik oraz podstawowe kolizje;
- profil uruchomieniowy Web/Android/PC;
- walidacja w Unity Editor oraz na rzeczywistym Poco F6. (Etap rozpoczęty.)

### Etap 2A — pierwsze przeniesienie walki operatorów (wdrożone w kodzie, bez walidacji Unity Editor)

- Pięć odrębnych ścieżek ataku podstawowego zamiast jednego wspólnego pocisku.
- Efekty trafień: ogłuszenie, spowolnienie, odrzut, przebijanie celów oraz powracający atak Piotra.
- Pierwsze implementacje umiejętności: eskortujący WZ-404, obszarowy ścisk i tryb tarana Grześka, pięć płyt Dawida z leczeniem i krótką osłoną, trzy koty Mateusza oraz wybuch pentagramu i trzy MafiKapibary Piotra.
- Pasywy odzwierciedlone w pętli walki: pieczęć co trzeci atak, mocniejszy rzut co trzeci atak, rozrzut stretchu, Speedrun co dziewiąte trafienie, podwójny skok i bumerang z powrotem.
- Osobny przycisk umiejętności z odliczaniem, sterowanie E na PC oraz obsługa dotyku.
- Dodane testy regresji kodu dla pięciu ścieżek ataków, umiejętności, statusów trafień, skoku i przycisku HUD.

W tej fazie przeniesiono też źródłowe czasy ataków podstawowych oddzielnie dla Kampanii i Survival, mnożniki obrażeń Survival (0,62 zadawanych / 1,30 otrzymywanych), czas nietykalności po trafieniu 0,78 s oraz skalowanie cooldownu umiejętności (×1,25 Kampania / ×2 Survival).

W podetapie 2B dodano katalog wszystkich 23 identyfikatorów przeciwników (z rozróżnieniem sztaplarki jako hazardu), źródłowe bazowe HP/prędkości dla archetypów oraz 17-elementową tabelę odblokowań i wag Survival. Pierwszy przebieg AI ma oddzielne rodziny: wręcz, dystans, wsparcie tarczą, taran/szarżę i fazę drugą bossów. B4 pokazuje na razie trzy archetypy testowe (Klient, AGV, Inspektor), nie pełną falę ani całą populację.

**Ograniczenia:** to pierwszy port logiki, a nie zatwierdzona zgodność 1:1. Trzeba zweryfikować wartości i zachowanie w Unity Editor, porównać przebieg walki z wersją Three.js, zbalansować obrażenia/czasy, poprawić animacje i zastąpić obecne generowanie/niszczenie pocisków pulą obiektów. Nie ma jeszcze pełnej implementacji wszystkich archetypów przeciwników, AI bossów ani systemu dropów/perków.

### Etap 2C — rdzeń fal Survival (wdrożony w kodzie, bez walidacji Unity Editor)

- Port wzorów źródłowych krzywej trudności: HP, prędkości, interwału spawnu, rozmiaru grup i tempa umiejętności przeciwników.
- Zachowane limity populacji: mobile 18/16/13 zależnie od poziomu adaptacji, desktop 34; rozmiary grup 5/4/3 na mobile i 7 na desktop.
- Fale co 60 sekund, spawn z 17-entry roster z uwzględnieniem wag oraz minimalnej fali/czasu.
- Pierścień falowej szarży: 12 przeciwników mobile / 16 desktop, 18 sekund, 0,48 s między spawnami, promień 13,4 → 6,8 m.
- Główny boss co 300 sekund, ostrzeżenie 6 sekund i rotacja Walczak → Dyrektor Widmo → Bosman Kraków.
- Spawn potrafi przekazać mnożniki HP, prędkości i tempa ataków do AI; B4 factory buduje teraz warianty wizualne wybranych archetypów.

**Ograniczenia:** Survival wave director ma ścieżkę uruchomienia, ale główny bootstrap nadal wybiera Campaign. Menu wyboru trybu/mapy, pełna progresja XP/perków/broni/dropów/kontraktów/eventów/sekretów oraz modele wszystkich archetypów wymagają kolejnych etapów. Aktualnie jest to funkcjonalny szkielet fali, nie pełna zgodność Survival 1:1.

### Etap 2D — arsenal Survival, progresja i raport obrażeń (wdrożone w kodzie, bez walidacji Unity Editor)

- Katalog dwunastu broni ma czasy odblokowania, czasy przeładowania, poziomy, ewolucje i poziomy startowe wynikające z rzadkości.
- SurvivalWeaponController obsługuje automatyczne wybieranie celu i kolejkę strzałów (1,05 s pomiędzy dispatchami), niezależne cooldowny, pooling pocisków oraz pierwsze zachowania broni: AOE, spowolnienia, naprowadzanie, przebijanie, orbitowanie, odbicie i powrót.
- Kryształy XP są tworzone z puli, przyciągane do operatora i przeliczane przez mnożnik wybranej mapy.
- Po awansie gra zatrzymuje symulację i pokazuje trzy karty. Dodano rzadkości, progi awansu rang, przerzuty, odblokowania/ulepszenia/ewolucje broni oraz pierwszą grupę pasywów.
- Nagrody głównych bossów otwierają osobny wybór legendarnego ulepszenia.
- SurvivalDamageTracker zapisuje efektywne obrażenia po uwzględnieniu zdrowia i osłon; ekran końca rundy pokazuje rozkład źródeł i procent całkowitych obrażeń.
- Rozszerzono HUD o poziom, rangę, XP, skrócony arsenał oraz raport obrażeń; stan LevelUp blokuje ruch i AI.

**Ograniczenia:** zachowania dwunastu broni i wartości kart są pierwszym portem, część pasywów źródłowych, kontraktów, zdarzeń, mutatorów, streaków i szczegółów ewolucji nadal wymaga mapowania. Nie ma jeszcze testu C# z Unity Editor ani balansu na urządzeniu. Nie należy traktować statycznych testów kodu jako potwierdzenia pełnej zgodności rozgrywki.

W etapie 2D uzupełniono też dwa źródłowe rzadkie spotkania (Bosman od fali 6 z szansą 4%, Sebix od fali 8 z szansą 6,5%), limit pojedynczej aktywnej instancji każdego oraz równomierne rozmieszczenie wejścia hordy. AI otrzymało współdzielony cache przestrzenny i separację, aby ograniczać nakładanie przeciwników w tłumie.



### Etap 3B — grywalna kampania Unity: trzy sektory, bramy bossów i dostawa VIP

- Kampania nie uruchamia już treningowej areny B4. Otwiera fizycznie połączoną mapę mega-magazynu z sektorami A (B4), B (showroom SPA) i C (terminal VIP).
- Dwie bramy mają rzeczywiste collidery. Pokonanie Bosmana Kraków w sektorze A otwiera B; pokonanie Dyrektora Widmo w B otwiera C. Odblokowanie sektora jest zapisywane lokalnie w PlayerPrefs.
- Każdy sektor ma własne zagęszczenie przeciwników i elementy otoczenia; w terminalu trzeba pokonać Nadzorcę Zero i Dyrektora Widmo.
- Dodano pięć fizycznych, dotykowo-zbieralnych zamówień VIP. Do zakończenia kampanii wymagane są co najmniej cztery.
- Dostawa kończy się dopiero po pokonaniu obu bossów terminalu, zebraniu wymaganych VIP i dojściu do bramy wyjazdowej. Ekran zwycięstwa pokazuje czas, eliminacje, bossów i wynik.
- Przycisk Kampania w menu uruchamia teraz właściwy tryb, a nie treningową arenę.

**Walidacja i ograniczenia:** CI sprawdza statyczne połączenia, warunki postępu i testy regresji. Nadal wymagają testów w Unity Editor: przejście CharacterController przez bramy po odblokowaniu, odbiór triggerów, zachowanie kamery na długości 242 m, zachowanie bossów, nawigacja przy regałach i wydajność na Poco F6. To funkcjonalny pionowy wycinek kampanii, nie pełny port wszystkich pułapek, pobocznych zadań i easter eggów.

### Etap 3A — odrębna geometria czterech map Unity (wdrożone w kodzie, bez walidacji Unity Editor)

- Wybór mapy prowadzi teraz do osobnego generatora geometrii, zamiast nakładać dekoracje na jeden wspólny układ regałów.
- B4 ma dwa bloki regałów, otwartą aleję, strefy odkładcze i oznakowanie BHP.
- Port Kontenerowy 17 ma rozmieszczone pod kątem kontenery z kolizjami, korytarze slalomowe i konstrukcję suwnicy.
- Chłodnia Zero ma izolowane ściany, banki sprężarek, regały, przewody chłodnicze i pasy lodowe.
- Sortownia Widmowa ma dwa pasy przenośników, prowadnice świetlne, trzy bramki skanerów i wieżę sterowniczą.
- Powiększono podłoże i dodano cztery fizyczne granice areny, aby pozycje gracza i spawnów fal pozostały na mapie.

**Ograniczenia:** to proceduralna geometria z prostych brył; nie zastępuje finalnych modeli, tekstur PBR ani ręcznie zaprojektowanych scen. Geometria, nawigacja przeciwników, kolizje i wydajność nadal wymagają sprawdzenia w Unity Editor oraz na Poco F6.

### Etap 2 — pełny rdzeń walki i pięciu operatorów
- wszystkie ataki podstawowe, pasywy i umiejętności specjalne;
- animacje i wyposażenie operatorów;
- wszystkie typy przeciwników, bossów, pocisków, trafień i efekty;
- porównanie obrażeń, czasów odnowienia, ruchu i skoku z referencyjnym kodem TS.

### Etap 3 — Kampania i Survival
- wszystkie sektory kampanii i cztery mapy Survival;
- pułapki, pickupy, fale, cele, mutatory, koalicje, wydarzenia i sekrety;
- rozwój postaci, nagrody, statystyki obrażeń i ekrany końca rundy.

### Etap 4 — PvP
- kompatybilny klient Unity z dotychczasowym serwerem;
- lobby, matchmaking, boty, ręczne celowanie, dash, umiejętności, wynik meczu;
- reconnect, przerwanie połączenia i bezpieczeństwo tokenów;
- test dwóch urządzeń oraz test sieci z opóźnieniem/utratą pakietów.

### Etap 5 — konto, UI i monetyzacja
- logowanie i synchronizacja Firebase/Google, ranking, zapisy lokalne i chmurowe;
- reklamy nagradzane/interstitial, UMP i ustawienia prywatności;
- pełne menu, kodeks, osiągnięcia, rangi, ustawienia i intro;
- przepisanie wszystkich ekranów na spójne UI Unity.

### Etap 6 — optymalizacja i wydanie
- WebGPU, WebGL 2 fallback, Android ARM64/IL2CPP i PC;
- progressive asset loading na Web, kompresja tekstur i LOD;
- profilowanie CPU/GPU, pamięci, czasu startu i baterii;
- testy na Poco F6, telefonie słabszej klasy, PC i przeglądarkach;
- dopiero po spełnieniu bramek: kandydat produkcyjny i przełączenie dystrybucji.

## Kryteria zgodności przed wyłączeniem wersji Three.js

1. Wszystkie pięć operatorów, wszystkie mapy, typy przeciwników, bronie, umiejętności i wydarzenia mają odpowiednik.
2. Kampania, Survival i PvP są uruchamialne i przechodzą testy regresji.
3. Zachowane są zapisy kont, rankingi, identyfikatory, Firebase i kontrakt protokołu PvP.
4. PvP przechodzi test reconnect i test dwóch klientów; serwer nadal autorytatywnie rozstrzyga wynik.
5. UI działa na PC i dotyku; żaden przycisk nie nachodzi na inny, a safe areas i rotacja ekranu są obsłużone.
6. Android APK/AAB, Web Player i build PC przechodzą build oraz testy uruchomieniowe.
7. Nie ma regresji wydajności na Poco F6; cel to stabilne 60 FPS w normalnej walce i kontrolowany spadek jakości przy dużej hordzie.
8. Stary build Three.js pozostaje dostępny do czasu zatwierdzenia migracji i nie jest usuwany z repozytorium.

## Świadome ograniczenia pierwszego etapu

Pierwszy wycinek Unity jest prototypem technicznym. Nie zawiera jeszcze pełnej Kampanii, całego Survival, PvP, Firebase, rankingów, reklam, wszystkich bossów, broni, wydarzeń i menu. Nie wolno oznaczać migracji jako zakończonej, dopóki nie przejdą powyższe kryteria.
