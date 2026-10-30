import { CharacterDef, CharacterId } from './types.ts';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  marcin: {
    id: 'marcin',
    name: 'Marcin',
    role: 'Kierownik Zmiany & Główny Audytor Logistyki',
    title: 'Władca WZ-tek, Harmonogramu i Strefy Bezpieczeństwa',
    color: 0x1e3a8a, // Navy / Royal Blue
    secondaryColor: 0xf59e0b, // Amber / Gold
    speed: 7.5,
    jumpForce: 8.8,
    passiveName: 'Autorytet BHP & Magnetyczny Segregator WZ',
    passiveDescription: 'Atak podstawowy rzuca Segregatorem WZ, który wywołuje falę magnetyczną przyciągającą fugi z okolicy, a co 3. rzut to Złoty Audyt (2x obrażeń i ogłuszenie). Zasięg przyciągania VIP +100%.',
    abilityName: 'Pieczęć WZ-tki & Protokół Reklamacji',
    abilityDescription: 'Wbija gigantyczną złotą pieczęć w podłogę! Odzyskuje +1 Kawę, ogłusza wrogów w promieniu 9m na 5s, daje 8s nietykalności i generuje bonusowe zrzuty WZ.',
    abilityCooldown: 6.0,
    voiceLines: [
      'Gdzie jest podpis na dokumencie WZ?! Bez podpisu paleta nie wyjedzie!',
      'Paleta z Włoch miała być na regale B4, ale sam to ogarnę!',
      'Kto zjadł moje drugie śniadanie z regału B?! To był audytowany kabanos!',
      'Zaraz wypiszę wam protokół niedopełnienia dylatacji!',
      'Spokojnie panowie, zgodnie z procedurą Max-Fliz: porządek i precyzja!',
      'Kto przestawił gres Calacatta Gold bez mojej autoryzacji?!',
      'Protokół reklamacji otwarty – zamykam tę aleję na własnych warunkach!'
    ],
    bio: 'Legenda krakowskiej logistyki Max-Fliz. Nigdy nie rozstaje się z aluminiową podkładką z dokumentami i pancernym tabletem. Zna kod kreskowy każdego formatu płytek na pamięć. Gdy Marcin krzyknie "KTO TO PODPISAŁ?!", na hali cichną nawet silniki spalinowych sztaplarek.',
    stats: {
      speed: 4,
      jump: 3,
      power: 4,
      defense: 5
    }
  },
  grzesiek: {
    id: 'grzesiek',
    name: 'Grzesiek',
    role: 'Ściskacz & Taran Magazynowy',
    title: 'Mistrz 44 cm w Obwodzie Ramienia',
    color: 0x16a34a, // Emerald Green
    secondaryColor: 0x22c55e,
    speed: 8.9,
    jumpForce: 8.5,
    passiveName: 'Szeroki Zamach Łatą 200cm & Łamacz Tarcz',
    passiveDescription: 'Atak podstawowy wykonuje potężny zamach 2-metrową łatą brukarską (szeroki łuk 140° + fala uderzeniowa), zadaje 2 HP obrażeń, odrzuca wrogów i natychmiast rozbija tarcze ochroniarzy.',
    abilityName: 'Ścisk Zagłady 44cm + Tryb Tarana',
    abilityDescription: 'Wzywa obracające się hydrauliczne ramię miażdżące o sile 44 ton (3 HP obrażeń obszarowych) oraz aktywuje na 6 sekund Tryb Tarana – rozjeżdżasz wrogów samym biegiem!',
    abilityCooldown: 4.5,
    voiceLines: [
      'Ściskam, bo muszę! To nie jest agresja, to czysta logistyczna potrzeba!',
      '44 cm obwodu ramienia i jeden ruch, a cała aleja robi się pusta!',
      'Pan Zdzichu mówił, że tak nie wolno, ale tak jest 3 razy szybciej!',
      'Trąbcie jak wjeżdżam w korytarz, bo nie biorę jeńców!',
      'Maksymalny załadunek regału? Dla mnie to dopiero rozgrzewka!',
      'Jeden ścisk i Walczak leży na palecie ze zniżką!',
      'HDS-em bym to szybciej zdjął, ale biceps też daje radę!',
      'Ściskacz 44cm to nie tylko ksywka, to styl życia na Magazynie C!'
    ],
    bio: 'Prawdziwy gladiator korytarza C. Potrafi podnieść paletę kleju bez użycia paleciaka i zawrócić wózkiem widłowym na monecie 5-złotowej. W ramieniu ma dumne 44 cm obwodu wypracowane na tysiącach ton hiszpańskiego gresu. Kiedy rusza do przodu, żadna przeszkoda nie ma racji bytu.',
    stats: {
      speed: 5,
      jump: 3,
      power: 5,
      defense: 4
    }
  },
  dawid: {
    id: 'dawid',
    name: 'Dawid',
    role: 'Arcymistrz Gresu & Dostawca KFC',
    title: 'Siłacz Wielkiego Formatu ("Ja Wiem Lepiej!")',
    color: 0xd97706, // Amber / Terracotta
    secondaryColor: 0xb45309,
    speed: 7.2,
    jumpForce: 10.2,
    passiveName: 'Diamentowa Tarcza 45° z Rykoszetem',
    passiveDescription: 'Atak podstawowy wystrzeliwuje wirującą tarczę diamentową i gres 45°, który przebija wielu wrogów na wylot (2 HP obrażeń), rykoszetuje od ścian i zbiera po drodze fugi!',
    abilityName: 'Salwa Calacatta 120x280 & Dostawa Kubełka KFC',
    abilityDescription: 'Wyrzuca 5 gigantycznych rykoszetujących płyt gresowych, aktywuje Kask BHP oraz zrzuca gorący Kubełek KFC (+HP i Furia KFC)!',
    abilityCooldown: 5.0,
    voiceLines: [
      'Ja wiem lepiej, jak kłaść ten gres! Walczak nie ma zielonego pojęcia!',
      'Przywiozłem świeży kubełek z KFC! Kto pierwszy ten lepszy, reszta robi dylatację!',
      'Zemsta za wyszczerbione płytki będzie cięta diamentem pod kątem 45 stopni!',
      'Format 120x280 cm? Dajcie mi dwie sztuki na raz pod pachę!',
      'Dla Max-Fliz i dla mnie fizyka budowlana nie ma żadnych tajemnic!',
      'Spójrz na tę fazę – gładka jak lustro! Odsunąć się, gres leci!',
      'Ja tu rządzę formatem, ty zajmij się fugą!',
      '45 stopni to nie tylko kąt, to moja życiowa filozofia montażu!'
    ],
    bio: 'Bezkompromisowy autorytet ceramiki luksusowej i król nocnych dostaw z KFC. Jego motto: "Ja wiem lepiej!" uciszyło już setki pseudo-ekspertów i zdezorientowanych architektów. Posiada tytaniczny skok, dzięki któremu bez trudu sięga najwyższych poziomów regałów wysokiego składu.',
    stats: {
      speed: 4,
      jump: 5,
      power: 5,
      defense: 4
    }
  },
  mateusz: {
    id: 'mateusz',
    name: 'Mateusz',
    role: 'Gejmer & Maniak PlayStation (9 mies. kontraktu)',
    title: 'Zdobywca Platyn i Pogromca Lagów',
    color: 0x7c3aed, // Purple / Indigo
    secondaryColor: 0xec4899,
    speed: 8.7,
    jumpForce: 9.5,
    passiveName: 'Salwa DualSense RGB & Kontrakt 9 Miesięcy',
    passiveDescription: 'Szybkostrzelny atak podstawowy wystrzeliwuje 3 samonaprowadzające pociski RGB (□ △ ○), które spowalniają wrogów o 40% (Glitch). Co 9 akcji odpala Speedrun (+Sprint i Nietykalność)!',
    abilityName: 'Atak Specjalny: "Kopuła BSOD & Overclock"',
    abilityDescription: 'Wywołuje hologram "Niebieskiego Ekranu Śmierci" (BSOD) – zamraża wrogów w promieniu 11m na 5.5s, odnawia +1 Kawę i daje 6s Podwójnego Skoku oraz Sprintu!',
    abilityCooldown: 5.2,
    voiceLines: [
      'Pad mi się rozładował! Kto zajumał kabel USB-C z salonu?!',
      'Mam umowę na 9 miesięcy, jeszcze tylko 270 dni do platyny w prawdziwym życiu!',
      'To nie jest magazyn, to jest tryb Hardcore w Dark Souls, a Walczak to tylko średni boss.',
      'Laga mam! Ktoś na biurze znowu odpalił Netflixa na łączu magazynowym!',
      'Zaraz wpadnie trofeum: "Przetrwanie Zmiany bez Reklamacji"!',
      'Press F to pay respects dla tej palety gresu... Walczak, GG WP!',
      'Ten wózek widłowy ma hitboxy jak w Elden Ring!',
      'Spawn-kill na klientach to moja specjalność!'
    ],
    bio: 'Maniak konsolowy, który każdą wolną chwilę na magazynie spędza planując kolejne trofeum. Podpisał umowę na 9 miesięcy i odlicza dni do wolności, traktując korytarze Max-Fliz jak mapę w wymagającym souliksie. Jego biurko w showroomie to w rzeczywistości zamaskowane stanowisko gamingowe z PS5.',
    stats: {
      speed: 5,
      jump: 4,
      power: 4,
      defense: 4
    }
  },
  piotr: {
    id: 'piotr',
    name: 'Piotr',
    role: 'Senior Magazynier & Weteran Rezerw',
    title: 'Weteran Max-Fliz i Mistrz Ukrytej Flaszki Bimbru 70%',
    color: 0xef4444, // Crimson Red
    secondaryColor: 0xfacc15, // Bright Yellow
    speed: 9.0,
    jumpForce: 9.4,
    passiveName: 'Bumerangowy Klucz Francuski & Podwójny Skok',
    passiveDescription: 'Atak podstawowy rzuca ciężkim Kluczem Francuskim, który wraca jak bumerang (trafiając wrogów dwukrotnie i podpalając ich iskrą!). Stały podwójny skok i 100% szansy na drop perków.',
    abilityName: 'Potrójna Salwa Flaszek z Bimbrem 70% (Mołotow x3)',
    abilityDescription: 'Piotr wyjmuje zza regału B4 aż 3 płonące butelki 70% bimbru jednocześnie i miota nimi przed siebie, zamieniając cały korytarz w ścianę żywego ognia!',
    abilityCooldown: 4.8,
    voiceLines: [
      'Bimber ze skarbczyka! 70 voltów zrobionych na drożdżach szlachetnych zza regału B4!',
      'Z drogi, bo rzucam flaszką! To stary przepis magazynowy – pali się lepiej niż napalm!',
      'Walczak myślał, że znalazł wszystkie moje ukryte zapasy? Ta butelka leżakowała od 2012 roku!',
      'Płonąca flaszka rozwiązuje każdy problem logistyczny w trzy sekundy!',
      'Za moich czasów zimą ogrzewaliśmy się tylko tym koktajlem!',
      'Jeden rzut i w korytarzu robi się ciepło! Ogień na gresie!',
      'Pamiętam jak tu szczere pole było, a Walczak jeszcze w pieluchy dzwonił!',
      'To nie dym, to aromat tradycji z rocznika 2012!'
    ],
    bio: 'Żywa historia i fundament magazynu Max-Fliz. Przetrwał kilkanaście reorganizacji, przeprowadzek i fuzji. Zna każdy zakamarek hali i tajemne schowki za paletami gresu. Jego sekretna broń to ukryta flaszka z 70-procentowym bimbrem domowej roboty, którą podpala i ciska niczym koktajl Mołotowa, zamieniając korytarz w morze ognia.',
    stats: {
      speed: 5,
      jump: 4,
      power: 5,
      defense: 5
    }
  }
};

