# Plan Aktualizacji: Retro-Arkada, Komiksowa Oprawa 3D, Hybrydowe Ewolucje i Zmutowana Elita

Kompleksowy plan modernizacji gry *Paleciaki! Magazyn Chaosu (Max-Fliz vol 2)*: wprowadzenie unikalnych portretów pixel art w klimacie retro-arkadowym, nowoczesnego układu menu z centralną selekcją operatora, mocno kontrastowej komiksowej oprawy 3D (obrysy, komiksowe efekty uderzeń, pop-artowe znaczniki), a także nowych hybrydowych ewolucji broni oraz zmutowanych elitarnych wrogów z unikalnymi mechanikami.

## Decyzje i Wybory Użytkownika

> [!IMPORTANT]
> Na podstawie odpowiedzi udzielonych w fazie planowania ustalono następujące kluczowe założenia projektowe:

- **Styl Ikon i Kart Postaci**: Styl pixel art w klimacie retro arkadówki – autorskie, wyraziste portrety pixel art dla każdego z 5 operatorów (Marcin, Grzesiek, Dawid, Mateusz, Piotr) z neonowo-arkadową ramką klasy i subtelnym efektem CRT scanline.
- **Oprawa Graficzna 3D Areny**: Mocno kontrastowy styl komiksowy z wyrazistymi akcentami barwnymi – cel-shadingowe obrysy, komiksowe dymki i iskry uderzeń (*POW!*, *BUM!*, *WZ-CRIT!*), dynamiczne pop-artowe cyfry obrażeń oraz neonowe, kontrastowe pasy stref magazynowych.
- **Rozwój Rozgrywki i Różnorodność**: Nowe hybrydowe ewolucje broni (synergie łączące dwie bronie/perki w niszczycielskie formy ostateczne) oraz zmutowani elitarni wrogowie (wyposażeni w aury obszarowe, ślady skażenia i telegrafowane ataki specjalne).

---

## 1. Przegląd i Koncepcja Główna

- **Co realizuje aktualizacja**:
  1. **Menu Główne & Arcade Roster**: Przebudowa ekranu wyboru operatora na format retro-arkadowego terminala z dużym portretem pixel art wybranego bohatera, podglądem statystyk, unikalnym cytatem audio i natychmiastowym przejściem do gry.
  2. **Stylistyka Komiksowa 3D**: Dodanie wyrazistych wizualnych akcentów komiksowych podczas starć – pop-artowe etykiety trafień krytycznych, neonowe linie posadzkowe w alejach magazynu, soczyste cząsteczki zderzeń oraz wyraziste oświetlenie podkreślające geometrię maszyn i regałów.
  3. **Hybrydowe Ewolucje Broni**: Połączenie zaawansowanych broni z perkami na maksymalnym poziomie w nowe narzędzia zagłady (np. *Cyber-Segregator Singularności*, *Tytanowy Młot 44T*, *Wielkoformatowa Burza Diamentowa*, *Hiper-Kocia Bateria B4*).
  4. **Zmutowani Elitarni Wrogowie**: Wprowadzenie rzadkich, niebezpiecznych wariantów przeciwników (m.in. *Zmutowany Sztaplarz Gamma*, *Radioaktywny Inspektor PIP*, *Cyber-Handlowiec Overclocked*) z pulsującymi aurami i specjalnymi nagrodami w postaci skrzyń z zaopatrzeniem.
- **Grupa Docelowa**: Gracze poszukujący dynamicznego, czytelnego i satysfakcjonującego top-down roguelite w klimacie absurdalnego polskiego magazynu logistycznego z soczystą oprawą retro-komiksową.

---

## 2. Architektura Wizualna i Doświadczenie Użytkownika (UX)

### A. Nowy Układ Menu (Arcade Operator Showcase)
- **Centralna Karta Selekcji**:
  - Na górze: pozioma wstęga 5 kart postaci z precyzyjnymi ikonami w stylu retro pixel art (Marcin w krawacie i kasku z dokumentem WZ, Grzesiek z gigantycznym bicepsem 44cm, Dawid z płytą 120x280, Mateusz ze słuchawkami i neonowym padem, Piotr z wąsem weterana i odznaką B4).
  - Poniżej: powiększona wizytówka aktywnego operatora z animowanym portretem, dynamicznym paskiem ról, metrykami walki oraz przyciskiem odsłuchania kultowego okrzyku bojowego.
  - Wyraźne, czytelne przyciski trybów: **SURVIVAL SHIFT** (główny tryb arenowy) oraz **KAMPANIA B4** (3 połączone sektory).
- **Zero-Pill & Typografia**:
  - Rezygnacja z przeładowanych pigułek na rzecz czystych etykiet typograficznych z dyskretnymi separatorami (`·`, `/`).
  - Zastosowanie kontrastowych nagłówków w stylu arcade sans oraz czytelnych liczb w tabelach i statystykach (`tabular-nums`).

### B. Komiksowa Oprawa Graficzna 3D Areny
- **Pop-Art FX & Hit Sparks**:
  - Trafienia krytyczne i mocne uderzenia generują dynamiczne komiksowe dymki 2D/3D (*POW!*, *KRACH!*, *BUM!*, *WZ-CRIT!*, *-44 HP!*).
  - Wyraziste, kontrastowe linie ostrzegawcze na podłodze (żółto-czarne pasy BHP, błękitne linie audytu, purpurowe ślady przeciążenia energetycznego).
- **Czytelność i Oświetlenie**:
  - Podbicie kontrastu cieni i świateł kierunkowych na posadzce magazynu, dzięki czemu sylwetki bohaterów, wrogów i pocisków odcinają się perfekcyjnie od tła.
  - Efekt halo wokół kryształów XP i skrzyń z perkami w żywych komiksowych barwach (żółty, błękitny, fioletowy, szmaragdowy).

---

## 3. Nowości w Gameplayu i Różnorodność Mechanik

### A. System Hybrydowych Ewolucji Broni
Gdy gracz osiągnie 5. poziom broni oraz posiada powiązany moduł BHP, pojawia się możliwość odblokowania fuzji hybrydowej:

```
┌─────────────────────────────────┐     ┌───────────────────────────────┐
│         BROŃ BAZOWA             │  +  │          MODUŁ BHP            │
│  (Segregator ERP, Hantla 44cm,  │     │  (Magnes, Kask BHP, Espresso, │
│   Gres 120x280, Paralizator...) │     │   Folia Stretch, Furia KFC...)│
└────────────────┬────────────────┘     └───────────────┬───────────────┘
                 │                                      │
                 └───────────────────┬──────────────────┘
                                     ▼
                  ┌──────────────────────────────────────┐
                  │          HYBRYDOWA EWOLUCJA          │
                  │   • Nowy wygląd pocisku / promienia  │
                  │   • Potrójne pole rażenia            │
                  │   • Unikalny komiksowy efekt statusu │
                  └──────────────────────────────────────┘
```

1. **Cyber-Segregator Singularności** (Segregator + Magnes): Wystrzeliwuje wirujące wiry dokumentów ERP, które przyciągają wrogów do centrum i detonują potężnym impulsem audytowym.
2. **Tytanowy Młot 44T** (Hantla 44cm + Furia KFC): Rzut generuje sejsmiczną falę uderzeniową miażdżącą całe szeregi wrogów z komiksowym tąpnięciem.
3. **Marmurowy Bastion 45°** (Gres 120x280 + Kask BHP): Wokół operatora krążą 3 gigantyczne płyty gresowe blokujące pociski i tnące każdego, kto podejdzie za blisko.
4. **Przeciążenie Sieci 1000V** (Paralizator + Turbo Skaner): Promienie elektryczne przeskakują między nawet 8 przeciwnikami jednocześnie, wywołując łańcuchowe eksplozje.
5. **Legion Kapibar Don B4** (Klucz Weterana + Złoty Paleciak): Wzywa pancerny konwój limuzyn kapibar, który przejeżdża przez środek areny czyszcząc całą aleję.

### B. Zmutowani Elitarni Wrogowie (Mutant Elites)
W wybranych minutach fali (np. minuta 2, 4, 7, 10) pojawiają się wrogowie o specjalnym statusie:
- **Zmutowany Sztaplarz Gamma**: Pozostawia za sobą parujący szlam spowalniający i zadający periodyczne obrażenia.
- **Radioaktywny Inspektor PIP**: Emituje pulsującą falę dźwiękową z megafonu wymuszającą uniki skokiem lub dashem.
- **Cyber-Handlowiec Overclocked**: Strzela samonaprowadzającymi prospektami i teleportuje się na krótki dystans przy niskim poziomie HP.
- Każdy pokonany elitarny mutant gwarantuje zrzut **Złotej Skrzyni Paletowej** z natychmiastowym wyborem perku lub leczenia.

---

## 4. Architektura Techniczna i Schemat Przepływu

```
┌────────────────────────────────────────────────────────────────────────┐
│                          INDEX.HTML / DOM HUD                          │
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Retro-Arcade Roster   │  │ Comic Floating Popups & Damage Floaters│ │
│  │ (Pixel Art Icons,     │  │ (POW!, WZ-CRIT!, -44 HP, Komiksowe FX) │ │
│  │  Active Hero Deck)    │  └────────────────────────────────────────┘ │
│  └───────────────────────┘  ┌────────────────────────────────────────┐ │
│                             │ Survival & Arsenal HUD (Hybrid Badges) │ │
│                             └────────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Zdarzenia UI & Render Loop
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE LOGIC (src/game.ts)                        │
│  ┌────────────────────────┐ ┌────────────────────────────────────────┐ │
│  │ Hybrid Weapons Engine  │ │ Mutant Elite AI & Hazard Auras         │ │
│  │ (Fuzje, Skalowanie,    │ │ (Skażenia, fale dźwiękowe, mini-bossy) │ │
│  │  Ewolucje poziomu 5)   │ └────────────────────────────────────────┘ │
│  └────────────────────────┘ ┌────────────────────────────────────────┐ │
│                             │ Comic Hit Particle System (Three.js)   │ │
│                             └────────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Geometria, Shadery, PBR
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   3D VISUALS (src/warehouseAssets.ts)                  │
│   • Kontrastowe materiały komiksowe (wyraziste obrysy, żywe kolory)    │
│   • Zmutowane tekstury i aury wrogów (glow shaders, pulsujące światła) │
│   • Pop-artowe billboardy cząsteczek trafień                           │
└────────────────────────────────────────────────────────────────────────┘
```

### Plan Wdrożenia (Etapy Realizacji po Akceptacji)
1. **Etap 1: Assety i Ikonki Pixel Art Postaci**
   - Stworzenie dedykowanych, stylizowanych portretów pixel art SVG/Canvas dla Marcina, Grześka, Dawida, Mateusza i Piotra w `index.html` oraz `src/visual-polish.css`.
   - Zintegrowanie stylistyki retro-arkadowej (ramki neonowe, tabliczki znamionowe ID, stan wyboru).
2. **Etap 2: Przebudowa Układu Menu Głównego**
   - Unifikacja panelu wyboru bohatera z dużym podglądem, statystykami i natychmiastowym przełączeniem trybów.
   - Usunięcie zbędnych elementów i uporządkowanie zakładek zgodnie z zasadami *zero-pill discipline*.
3. **Etap 3: Mocno Kontrastowa Komiksowa Oprawa 3D**
   - Implementacja systemu komiksowych dymków uderzeń (*POW!*, *BUM!*, *WZ-CRIT!*) i kolorowych liczb obrażeń w `src/game.ts`.
   - Podbicie kontrastu oświetlenia areny, dodanie neonowych pasów i wyrazistych obrysów modeli w `src/warehouseAssets.ts`.
4. **Etap 4: Nowe Hybrydowe Ewolucje Broni & Zmutowani Elitarni Wrogowie**
   - Implementacja 5 potężnych hybrydowych ewolucji w systemie rozwoju broni w `src/game.ts`.
   - Dodanie zmutowanych wariantów wrogów z aurami i specjalnymi atakami w falach Survival.
5. **Etap 5: Weryfikacja i Testy**
   - Uruchomienie `compile_applet` i `lint_applet`.
   - Testy płynności, czytelności i balansu rozgrywki na urządzeniach desktopowych i dotykowych.
