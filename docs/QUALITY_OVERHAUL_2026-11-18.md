# Warehouse MaDDnes — przegląd jakości Web / Android
Data: 18 listopada 2026  
Baza audytu: `main` przed PR #316  
Gałąź wdrożeniowa: `feat/mobile-ux-visual-combat-overhaul-20261118`

## 1. Menu, identyfikacja wizualna i ikony
- Menu posiada już osobny responsywny arkusz, rozdzielone widoki operatorów/map/ustawień oraz własną typografię.
- W tej aktualizacji dodano wyraźny stan focus-visible, obsługę reduced-motion i jednolity feedback dla przycisków.
- Tablica PvP przestała używać emoji jako głównej identyfikacji postaci; obaj gracze dostają portrety operatorów z tego samego źródła SVG co pozostałe UI.
- Nie wymieniano bez potrzeby działającego menu ani zestawu ikon, żeby nie dublować wcześniejszego polish pass.

## 2. Loader i inicjalizacja
- Zastąpiono techniczny nagłówek „CENTRUM B4 3D LOGISTICS ENGINE” ekranem Warehouse MaDDnes z oryginalną ilustracją wózka, etykietą zmiany, krótszym opisem i wskazówkami utrzymanymi w humorystycznym tonie gry.
- Zachowano identyfikatory elementów pobieranych przez `B4AssetLoader`, licznik postępu, status kategorii, procent i tekst wskazówki.
- Ujednolicono widok z `index.html` i awaryjny fallback generowany w `src/assets.ts`. Fallback nie tworzy drugiego, zagnieżdżonego overlayu.
- Pasek postępu otrzymał semantykę `progressbar` i aktualizowane `aria-valuenow`.

## 3. Survival HUD i komunikacja
- W pionowym widoku mobilnym pasek dialogów był przy dolnej krawędzi i nachodził na joystick ruchu. Przeniesiono go pod identyfikator operatora, do wąskiego lewego pasa.
- Dialog radiowy jest czasowo ukrywany, gdy aktywny jest duży komunikat wydarzenia. Dzięki temu tekst celu, dialog i elementy sterowania nie konkurują o ten sam obszar.
- Zachowano istniejący cooldown antyspamowy dialogów i bezpieczne wstawianie tekstu przez `textContent`.

## 4. PvP — HUD, portrety i instrukcja
- Tablica wyników była dzieckiem kontenera gry z własnymi transformacjami. Na telefonie mogła trafić pod warstwę WebGL. Przy starcie meczu jest teraz przenoszona do `document.body`, podobnie jak dotykowe sterowanie.
- Tablica jest przypięta do safe-area i ma osobny, responsywny układ dla małych ekranów. Status perka nie wypycha już dodatkowego paska poza środkową kolumnę.
- Dodano oryginalne portrety SVG operatorów oraz stan dostępności `aria-hidden`.
- Instrukcja rozróżnia ruch, ustawienie kierunku i moment oddania strzału: należy nacisnąć STRZAŁ, gdy znacznik łuku pokrywa się z przeciwnikiem.
- Zachowano ręczne celowanie i brak aim-assista. To nie jest automatyczne śledzenie przeciwnika.

## 5. Grafika, rozdzielczość i kamera
- Profile mobile-balanced i mobile-high otrzymały wyższy limit pixel ratio: odpowiednio 1.44 / 1.25 dla Survival oraz 1.90 / 1.55 dla urządzeń high.
- Zachowano szybkie obniżanie skali przy spadku FPS i stopniowe odzyskiwanie jakości po stabilizacji. Niski profil urządzenia pozostał bez zmian.
- Kamera w pionowym Survival została delikatnie przybliżona (wysokość 14.6, odsunięcie 9.55 zamiast 15.8 / 10.2). Zmiana nie obejmuje Kampanii ani PvP.
- Nowe style używają istniejących safe-area i nie dodają kosztownych filtrów blur na całym ekranie.

## 6. Mapy i otoczenie
- Audyt potwierdził cztery odrębne biomy z osobnymi paletami, światłem, atlasem podłoża i fizycznymi elementami osłony: B4, terminal kontenerowy, chłodnia i sortownia nocna.
- Są też osobne landmarki, ślady zużycia podłoża, kraterowe dressing i UFO w sortowni nocnej.
- W tej aktualizacji nie dokładano masy dekoracji do pętli renderowania. Priorytetem były czytelność kamery, istniejące obiekty kolizyjne i prezentacja na telefonie.

## 7. Przeciwnicy, animacje i zachowanie
- W gałęzi głównej są już role-kit PPE, odrębne profile chodu, animacje zsynchronizowane z fazami klipów oraz osobne przygotowanie i recovery ataków wręcz/dystansowych.
- Zwykli przeciwnicy mają role-specific telegraphy i krótkie, przerywalne okna ataku. AI ma też predykcyjne uniki pocisków.
- W tej aktualizacji dodano testy ochronne, aby zmiany UI i kamery nie odłączyły tych systemów. Nie zmieniano statystyk, obrażeń ani cooldownów.

## 8. Pociski i kolizje
- Przegląd potwierdził swept collision: pocisk sprawdza cały odcinek przemieszczenia, a nie tylko pozycję końcową. Sprawdzenie obejmuje poziomy promień ciała i zakres pionowy.
- PvP ma również swept test przeciw przeszkodom i graczom; najwcześniejsze przecięcie wygrywa, więc ściana lub cel przed graczem blokuje strzał.
- Pozostawiono istniejące rekordy scratch i pule, aby wielokrotne testy kolizji nie alokowały zbędnych obiektów w każdej klatce.

## 9. Dźwięk i feedback
- Silnik posiada już odrębne proceduralne efekty ruchu, zbierania XP, ataków, trafień, eksplozji, alarmów i umiejętności.
- Dodano osobny sygnał potwierdzenia trafienia PvP dla lokalnego strzelca (krótki niski impact + jasny tick). Otrzymanie obrażeń zachowuje dotychczasowy dźwięk uderzenia.
- Sygnał jest ograniczony do jednego na paczkę zdarzeń w klatce, żeby szybkie serie nie powodowały nadmiernego hałasu.

## 10. Web, Capacitor i Android
- Zmiany dotyczą wspólnych plików Web/Three.js oraz arkuszy ładowanych przez Vite; ten sam bundle jest wejściem do synchronizacji Capacitor.
- Nie dodano zależności zewnętrznych ani nowych fontów/tekstur sieciowych. Ilustracja loadera jest lokalnym SVG, więc działa również offline.
- Gotowość APK/AAB zostanie potwierdzona dopiero po workflow Android uruchomionym dla scalonego commitu.

## 11. Testy regresyjne dodane w tej aktualizacji
- Spójność ID loadera i fallbacku, semantyka paska postępu, tekst nowego brandingu.
- Pozycja/warstwa HUD PvP, dostępność, portrety operatorów i treść instrukcji timing-sweep.
- Pozycja dialogów Survival, blokowanie nakładania się z eventami i reduced-motion.
- Kamera portretowego Survival i wyższe limity rozdzielczości przy zachowaniu adaptacyjnego fallbacku.
- Zachowanie integracji swept collision, blokowania pocisków na przeszkodach, telegraphów AI, uników i animacji.

## 12. Granice tej aktualizacji
- To jest duży, celowany quality pass dla najbardziej widocznych usterek ze screenów oraz stabilności istniejących systemów.
- Ręczny playtest na telefonie, pomiary FPS na urządzeniach o różnej klasie i kontrola odczuć sterowania nadal wymagają fizycznego uruchomienia gry.
- Dostępność publicznego pojedynku online zależy osobno od dostępności skonfigurowanego serwera WebSocket; lokalny trening PvP i warstwa klienta nie są tym samym co stan hostowanego backendu.
