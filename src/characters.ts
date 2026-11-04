import { CharacterDef, CharacterId } from './types.ts';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  marcin: {
    id: 'marcin',
    name: 'Atlas',
    role: 'Kierownik Zmiany & Główny Audytor Logistyki',
    title: 'Dowódca Logistyki B4',
    color: 0x1e3a8a, // Navy / Royal Blue
    secondaryColor: 0xf59e0b, // Amber / Gold
    speed: 7.5,
    jumpForce: 8.8,
    passiveName: 'Mistrz Zaklęć ERP',
    passiveDescription: 'Podstawowy atak przywołuje cyfrowe zaklęcia z systemu ERP: błękitne runy, zlecenia i pieczęcie. Co trzeci czar tworzy mocniejszą pieczęć audytu. Zasięg przyciągania VIP +100%.',
    abilityName: 'KONWÓJ WZ-404! DO BOJU!',
    abilityDescription: 'Przywołuje opancerzony czołg WZ-404, który przez 8 sekund podąża za Atlasem, obraca wieżyczką i automatycznie ostrzeliwuje najbliższych przeciwników pociskami wybuchowymi. W Survival działa 6 sekund. Załoga melduje: „Cel zatwierdzony przez system ERP!”.',
    abilityCooldown: 17.0,
    voiceLines: [
      'Gdzie jest podpis na dokumencie WZ?! Bez podpisu paleta nie wyjedzie!',
      'Paleta z Włoch miała być na regale B4, ale sam to ogarnę!',
      'Kto zjadł moje drugie śniadanie z regału B?! To był audytowany kabanos!',
      'Zaraz wypiszę wam protokół niedopełnienia dylatacji!',
      'Spokojnie panowie, zgodnie z procedurą Kompleks B4: porządek i precyzja!',
      'Kto przestawił gres Biały Marmur bez mojej autoryzacji?!',
      'Protokół reklamacji otwarty – zamykam tę aleję na własnych warunkach!'
    ],
    bio: 'Legenda nocnej logistyki Kompleks B4 i człowiek, który potrafi rozpoznać błędnie wystawioną WZ-tkę po samym dźwięku drukarki. Na zmianę przynosi pancerny tablet, aluminiową podkładkę i minę człowieka, który już wie, że ktoś pomylił sektor. Pamięta kody produktów, układ regałów i wszystkie obietnice dostawców, których nikt nigdy nie potwierdził na piśmie. W walce stawia na kontrolę sytuacji, precyzję i autorytet kierownika. Jego najgroźniejszy okrzyk brzmi: „KTO TO PODPISAŁ?!”. Nawet sztaplarka wtedy przechodzi na luz.',
    stats: {
      speed: 4,
      jump: 3,
      power: 4,
      defense: 5
    }
  },
  grzesiek: {
    id: 'grzesiek',
    name: 'Forge',
    role: 'Ściskacz & Taran Magazynowy',
    title: 'Mistrz 44 cm w Obwodzie Ramienia',
    color: 0x16a34a, // Emerald Green
    secondaryColor: 0x22c55e,
    speed: 8.9,
    jumpForce: 8.5,
    passiveName: 'Hantla 44 cm — Rzut Siłacza',
    passiveDescription: 'Podstawowy atak to ciężki rzut hantlem. Co trzeci rzut jest mocniejszy, przebija kilku przeciwników i odrzuca ich na boki.',
    abilityName: 'Ścisk Zagłady 44cm + Tryb Tarana',
    abilityDescription: 'Wzywa obracające się hydrauliczne ramię miażdżące o sile 44 ton (3 HP obrażeń obszarowych) oraz aktywuje na 6 sekund Tryb Tarana – rozjeżdżasz wrogów samym biegiem!',
    abilityCooldown: 12.0,
    voiceLines: [
      'Ściskam, bo muszę! To nie jest agresja, to czysta logistyczna potrzeba!',
      '44 cm obwodu ramienia i jeden ruch, a cała aleja robi się pusta!',
      'Pan Sztaplarz Turbo mówił, że tak nie wolno, ale tak jest 3 razy szybciej!',
      'Trąbcie jak wjeżdżam w korytarz, bo nie biorę jeńców!',
      'Maksymalny załadunek regału? Dla mnie to dopiero rozgrzewka!',
      'Jeden ścisk i Nadzorca Zero leży na palecie ze zniżką!',
      'HDS-em bym to szybciej zdjął, ale biceps też daje radę!',
      'Ściskacz 44cm to nie tylko ksywka, to styl życia na Magazynie C!'
    ],
    bio: 'Gladiator korytarza C, legenda siłowni i jedyny człowiek, który patrzy na paletę kleju jak na rozgrzewkę. Słynne 44 centymetry w ramieniu nie są jednostką miary, tylko ostrzeżeniem dla wszystkich, którzy zastawiają przejazd. Potrafi zrobić nawrót wózkiem na monecie pięciozłotowej, a ciężar hantla ocenia po tym, jak głośno jęknie regał. W walce stawia na brutalną siłę i przebijanie się przez tłum. Nie zna pojęcia „za ciężkie” — zna tylko „podaj drugą stronę”.',
    stats: {
      speed: 5,
      jump: 3,
      power: 5,
      defense: 4
    }
  },
  dawid: {
    id: 'dawid',
    name: 'Vector',
    role: 'Operator Wielkiego Formatu',
    title: 'Siłacz Wielkiego Formatu ("Ja Wiem Lepiej!")',
    color: 0xd97706, // Amber / Terracotta
    secondaryColor: 0xb45309,
    speed: 7.2,
    jumpForce: 10.2,
    passiveName: 'Rolka Stretch — Owinięcie Problemu',
    passiveDescription: 'Podstawowy atak wyrzuca rolkę folii stretch. Trafiony przeciwnik zostaje spowolniony i na krótko owinięty folią; co trzeci rzut rozrzuca dodatkowe pasma.',
    abilityName: 'Salwa Marmurowa Wielkiego Formatu',
    abilityDescription: 'Wyrzuca 5 gigantycznych rykoszetujących płyt gresowych, aktywuje Kask BHP oraz zrzuca gorący Kubełek Mocy (+HP i Furia Energetyczna)!',
    abilityCooldown: 13.0,
    voiceLines: [
      'Ja wiem lepiej, jak kłaść ten gres! Nadzorca Zero nie ma zielonego pojęcia!',
      'Przywiozłem świeży Kubełek Mocy! Kto pierwszy ten lepszy, reszta robi dylatację!',
      'Zemsta za wyszczerbione płytki będzie cięta diamentem pod kątem 45 stopni!',
      'Format 120x280 cm? Dajcie mi dwie sztuki na raz pod pachę!',
      'Dla Kompleks B4 i dla mnie fizyka budowlana nie ma żadnych tajemnic!',
      'Spójrz na tę fazę – gładka jak lustro! Odsunąć się, gres leci!',
      'Ja tu rządzę formatem, ty zajmij się fugą!',
      '45 stopni to nie tylko kąt, to moja życiowa filozofia montażu!'
    ],
    bio: 'Arcymistrz wielkiego formatu, samozwańczy ekspert od ceramiki premium i nocny dostawca energetycznych przekąsek. Jego ulubione zdanie „Ja wiem lepiej!” potrafi zakończyć dyskusję szybciej niż komunikat o zamknięciu magazynu. Format 120×280 nosi z dumą, a rolką stretchu potrafi opakować problem, którego nie rozwiązałby cały dział reklamacji. W walce wykorzystuje zasięg, spowalnianie przeciwników i potężne skoki. Twierdzi, że każda płytka ma właściwą stronę — po prostu inni jeszcze jej nie odkryli.',
    stats: {
      speed: 4,
      jump: 5,
      power: 5,
      defense: 4
    }
  },
  mateusz: {
    id: 'mateusz',
    name: 'Volt',
    role: 'Entuzjasta Technologii i Gier',
    title: 'Zdobywca Platyn i Pogromca Lagów',
    color: 0x7c3aed, // Purple / Indigo
    secondaryColor: 0xec4899,
    speed: 8.7,
    jumpForce: 9.5,
    passiveName: 'Paralizator — Impuls Trzech Elektrod',
    passiveDescription: 'Podstawowy atak wystrzeliwuje impuls paralizatora. Trafienie elektryzuje i spowalnia cel; co dziewiąte trafienie uruchamia Speedrun (+Sprint i Nietykalność)!',
    abilityName: 'KOCIA ARMIA ONLINE • 3× MIAU-CRITICAL',
    abilityDescription: 'Volt przywołuje dokładnie trzy bojowe koty w gamingowych obrożach. Przez 9,5 sekundy (6,5 w Survival) krążą wokół niego, doskakują do przeciwników i zadają im obrażenia. Każdy pounce kończy się błyskiem pazurów i komunikatem MIAU-CRITICAL.',
    abilityCooldown: 16.0,
    voiceLines: [
      'Pad mi się rozładował! Kto zajumał kabel USB-C z salonu?!',
      'Mam umowę na 9 miesięcy, jeszcze tylko 270 dni do platyny w prawdziwym życiu!',
      'To nie jest magazyn, to jest tryb Hardcore w hardcorowe RPG, a Nadzorca Zero to tylko średni boss.',
      'Laga mam! Ktoś na biurze znowu odpalił platformę streamingowąa na łączu magazynowym!',
      'Zaraz wpadnie trofeum: "Przetrwanie Zmiany bez Reklamacji"!',
      'Press F to pay respects dla tej palety gresu... Nadzorca Zero, GG WP!',
      'Ten wózek widłowy ma hitboxy jak w gra fantasy!',
      'Spawn-kill na klientach to moja specjalność!'
    ],
    bio: 'Łowca platyn, specjalista od padów i człowiek, który potrafi porównać każdą zmianę na magazynie do poziomu trudności w grze. Umowę na dziewięć miesięcy traktuje jak długi quest poboczny, a każdy kolejny dzień odhacza z precyzją speedrunnera. W showroomie ma mentalne stanowisko gamingowe, a w głowie mapę wszystkich skrótów, które pozwalają ominąć nudne obowiązki. W walce stawia na mobilność, impulsy elektryczne i kocią asystę. Gdy słyszy „lag”, najpierw sprawdza ping, a dopiero później, czy to przypadkiem nie wózek AGV.',
    stats: {
      speed: 5,
      jump: 4,
      power: 4,
      defense: 4
    }
  },
  piotr: {
    id: 'piotr',
    name: 'Rook',
    role: 'Senior Magazynier & Weteran Rezerw',
    title: 'Weteran Kompleks B4 i Mistrz Płonących Mieszanek',
    color: 0xef4444, // Crimson Red
    secondaryColor: 0xfacc15, // Bright Yellow
    speed: 9.0,
    jumpForce: 9.4,
    passiveName: 'Weteran B4 — Droga Powrotna',
    passiveDescription: 'Rook ma stały podwójny skok i 100% szansy na drop perków. Klucz grzechotkowy wraca po rzucie, więc dobrze ustawiony tor pozwala przeciąć linię wrogów również podczas powrotu.',
    abilityName: 'Potrójna Salwa Płonących Butli (3 kapsuły zapalające)',
    abilityDescription: 'Rook wyjmuje zza regału B4 aż 3 płonące butelki specjalna mieszanka zapalająca jednocześnie i miota nimi przed siebie, zamieniając cały korytarz w ścianę żywego ognia!',
    abilityCooldown: 13.5,
    voiceLines: [
      'Zapas płonącej mieszanki! Trzy kapsuły gotowe do użycia!',
      'Z drogi, bo rzucam butlą! To stary przepis magazynowy – pali się lepiej niż napalm!',
      'Nadzorca Zero myślał, że znalazł wszystkie moje ukryte zapasy? Ta butelka leżakowała od 2012 roku!',
      'Płonąca butla kończy każdy spór o przejazd!',
      'Za moich czasów zimą ogrzewaliśmy się tylko tym koktajlem!',
      'Jeden rzut i w korytarzu robi się ciepło! Ogień na gresie!',
      'Pamiętam jak tu szczere pole było, a Nadzorca Zero jeszcze w pieluchy dzwonił!',
      'To nie dym, to aromat tradycji z rocznika 2012!'
    ],
    bio: 'Weteran Kompleks B4, człowiek-instytucja i żywe archiwum każdej reorganizacji, przeprowadzki oraz tajemniczego zniknięcia palety. Zna skróty za regałami, pamięta stare oznaczenia sektorów i wie, które drzwi otwierają się dopiero po mocniejszym pociągnięciu. W zanadrzu trzyma klucz grzechotkowy B4 oraz legendarny zapas płonącej mieszanki, którego pochodzenie pozostaje przedmiotem wewnętrznego dochodzenia. W walce jest wszechstronny, odporny i nie odpuszcza nawet wtedy, gdy reszta zmiany dawno odbiła kartę. Jego motto: „Za moich czasów palety same się nie przesuwały”.',
    stats: {
      speed: 5,
      jump: 4,
      power: 5,
      defense: 5
    }
  }
};

