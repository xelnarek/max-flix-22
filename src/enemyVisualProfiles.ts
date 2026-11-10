import type { EnemyType } from './types.ts';
import type { GobkitModelId } from './gobkitAssets.ts';

export type EnemyVisualCategory =
  | 'warehouse-caricature'
  | 'undead'
  | 'mutant'
  | 'boss-creature'
  | 'machine'
  | 'vehicle'
  | 'secret-event';

export type EnemyAttackStyle =
  | 'tool-melee'
  | 'heavy-melee'
  | 'ranged'
  | 'vehicle'
  | 'none';

export interface EnemyVisualProfile {
  /** Existing bespoke fallback builder used before/when an optional GLB is unavailable. */
  readonly fallbackFactory: string;
  /** Optional locally packaged rigged asset; procedural fallback stays available. */
  readonly gobkitModel?: GobkitModelId;
  readonly category: EnemyVisualCategory;
  readonly attackStyle: EnemyAttackStyle;
  /** Target world height after fitting imported GLB assets. */
  readonly targetHeight: number;
  /** Short visual brief used to keep model choice aligned with the enemy description. */
  readonly visualBrief: string;
}

/**
 * One complete visual contract for every EnemyType.
 * 23/23 enemy definitions are covered. Human warehouse roles keep their bespoke
 * caricature builders; imported rigs are reserved for undead, mutants, monsters
 * and the armored elite guard. The gameplay spawn names/AI remain unchanged.
 */
export const ENEMY_VISUAL_PROFILES: Readonly<Record<EnemyType, EnemyVisualProfile>> = Object.freeze({
  customer: {
    fallbackFactory: 'createCustomerEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.45,
    visualBrief: 'Przesadnie ekspresyjny klient z reklamacją, fakturą i wielką teczką',
  },
  walczak: {
    fallbackFactory: 'createWalczakBossModel',
    gobkitModel: 'werewolfcaptain',
    category: 'boss-creature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.96,
    visualBrief: 'Potężny wilkołaczy nadzorca z szerokimi barkami i ciężkimi szponami',
  },
  forklift: {
    fallbackFactory: 'createForkliftModel',
    category: 'vehicle',
    attackStyle: 'vehicle',
    targetHeight: 1.78,
    visualBrief: 'Wózek widłowy z masztem, widłami, kabiną i lampą ostrzegawczą',
  },
  architect: {
    fallbackFactory: 'createArchitectEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.48,
    visualBrief: 'Architekt wnętrz: beret, wielkie okulary, wachlarz próbek i rulon projektu',
  },
  inspector: {
    fallbackFactory: 'createInspectorEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.50,
    visualBrief: 'Inspektor BHP z dużym kaskiem, kamizelką odblaskową, clipboardem i gwizdkiem',
  },
  agv_robot: {
    fallbackFactory: 'createAgvRobotModel',
    category: 'machine',
    attackStyle: 'ranged',
    targetHeight: 1.22,
    visualBrief: 'Niski autonomiczny robot AGV z czujnikami, światłami i pancernym zderzakiem',
  },
  handlowiec: {
    fallbackFactory: 'createHandlowiecEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'ranged',
    targetHeight: 1.48,
    visualBrief: 'Handlowiec w przesadnym garniturze z teczką, krawatem i gadżetem reklamowym',
  },
  monter: {
    fallbackFactory: 'createMonterEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.50,
    visualBrief: 'Monter z pasem narzędziowym, rękawicami i dużym kluczem',
  },
  piorun_dron: {
    fallbackFactory: 'createPiorunDronModel',
    category: 'machine',
    attackStyle: 'ranged',
    targetHeight: 0.82,
    visualBrief: 'Latający dron patrolowy z czterema wirnikami, reflektorem i emiterem iskier',
  },
  elite_walczak_guard: {
    fallbackFactory: 'createEliteGuardEnemyModel',
    gobkitModel: 'bloodirongrunt',
    category: 'boss-creature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.78,
    visualBrief: 'Opancerzony elitarny ochroniarz-berserker z masywnymi naramiennikami i przyłbicą',
  },
  kurier: {
    fallbackFactory: 'createKurierEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'ranged',
    targetHeight: 1.48,
    visualBrief: 'Kurier z ogromnym termicznym plecakiem, paczkami i czapką dostawczą',
  },
  'przedstawiciel_włoski': {
    fallbackFactory: 'createItalianVendorEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.48,
    visualBrief: 'Włoski sprzedawca z przesadną gestykulacją, eleganckim strojem i próbkami',
  },
  sztaplar_szalony: {
    fallbackFactory: 'createSztaplarEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.56,
    visualBrief: 'Szalony operator paleciaka w ochronnym wyposażeniu i masywnych rękawicach',
  },
  krol_leto: {
    fallbackFactory: 'createKrolLetoBossModel',
    gobkitModel: 'bloodironjuggernaut',
    category: 'boss-creature',
    attackStyle: 'heavy-melee',
    targetHeight: 2.12,
    visualBrief: 'Monstrualny król-magazynu w ciężkim pancerzu z koroną i energią bossów',
  },
  pan_roman: {
    fallbackFactory: 'createPanRomanEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'ranged',
    targetHeight: 1.48,
    visualBrief: 'Pan Roman: dostawca sanitariatów z pomarańczową kamizelką i wózkiem transportowym',
  },
  serwisant: {
    fallbackFactory: 'createSerwisanciEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.48,
    visualBrief: 'Serwisant z narzędziami, miernikiem i technicznym pasem',
  },
  bosman_krakow: {
    fallbackFactory: 'createBosmanKrakowBossModel',
    category: 'warehouse-caricature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.86,
    visualBrief: 'Bosman Kraków: przesadnie szeroki kierownik w granatowym mundurze, złotej odznace i czapce',
  },
  zombie_pracownik: {
    fallbackFactory: 'createZombieWorkerEnemyModel',
    gobkitModel: 'stitchedbrute',
    category: 'undead',
    attackStyle: 'heavy-melee',
    targetHeight: 1.62,
    visualBrief: 'Nieumarły pracownik z poszarpaną kamizelką, odsłoniętymi żebrami, ranami i świecącymi oczami',
  },
  pomazaniec: {
    fallbackFactory: 'createPomazaniecRiderModel',
    category: 'secret-event',
    attackStyle: 'ranged',
    targetHeight: 1.18,
    visualBrief: 'Karykaturalny mały rowerzysta z kolorową czapką, wiatraczkiem i salwą lizaków',
  },
  sebix_m: {
    fallbackFactory: 'createSebixEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.58,
    visualBrief: 'Przerysowany osiłek bez koszulki, w krótkich spodenkach, z agresywną miną i cegłami',
  },
  mutant_gamma_forklift: {
    fallbackFactory: 'createMutantGammaForkliftModel',
    gobkitModel: 'bloodironjuggernaut',
    category: 'mutant',
    attackStyle: 'heavy-melee',
    targetHeight: 2.08,
    visualBrief: 'Radioaktywny mutant-sztaplarka z metalowym zderzakiem, widłami i ostrzegawczym światłem',
  },
  radioactive_pip: {
    fallbackFactory: 'createRadioactivePipModel',
    gobkitModel: 'nightwitch',
    category: 'mutant',
    attackStyle: 'ranged',
    targetHeight: 1.78,
    visualBrief: 'Skażony inspektor PIP z toksycznymi oczami, żółto-czarnymi oznaczeniami i zieloną aurą',
  },
  cyber_salesman: {
    fallbackFactory: 'createCyberSalesmanModel',
    gobkitModel: 'androidcommander',
    category: 'machine',
    attackStyle: 'ranged',
    targetHeight: 1.78,
    visualBrief: 'Cyber-handlowiec: android z neonowym wizjerem, ekranem ofertowym i mechanicznymi kończynami',
  },
});
