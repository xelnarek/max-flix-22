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

export type EnemyGaitStyle =
  | 'theatrical'
  | 'heavy'
  | 'rolling'
  | 'deliberate'
  | 'precise'
  | 'robotic'
  | 'hovering'
  | 'brisk'
  | 'shambling'
  | 'compact'
  | 'aggressive'
  | 'limping';

export interface EnemyGaitPreset {
  /** Base gait-cycle multiplier during movement. */
  readonly rate: number;
  /** Leg swing amplitude in radians. */
  readonly legSwing: number;
  /** Arm counter-swing amplitude in radians. */
  readonly armSwing: number;
  /** Lateral arm gesture in radians. */
  readonly armSway: number;
  /** Small head movement that makes the gait readable at distance. */
  readonly headBob: number;
}

export const ENEMY_GAIT_PRESETS: Readonly<Record<EnemyGaitStyle, EnemyGaitPreset>> = Object.freeze({
  theatrical: { rate: 1.06, legSwing: 0.42, armSwing: 0.56, armSway: 0.34, headBob: 0.035 },
  heavy: { rate: 0.78, legSwing: 0.68, armSwing: 0.46, armSway: 0.10, headBob: 0.075 },
  rolling: { rate: 1.00, legSwing: 0, armSwing: 0, armSway: 0, headBob: 0 },
  deliberate: { rate: 0.82, legSwing: 0.30, armSwing: 0.20, armSway: 0.08, headBob: 0.025 },
  precise: { rate: 0.96, legSwing: 0.22, armSwing: 0.12, armSway: 0.045, headBob: 0.015 },
  robotic: { rate: 0.94, legSwing: 0.32, armSwing: 0.14, armSway: 0.035, headBob: 0.018 },
  hovering: { rate: 0.72, legSwing: 0, armSwing: 0, armSway: 0, headBob: 0.04 },
  brisk: { rate: 1.35, legSwing: 0.58, armSwing: 0.40, armSway: 0.12, headBob: 0.035 },
  shambling: { rate: 0.72, legSwing: 0.52, armSwing: 0.28, armSway: 0.08, headBob: 0.065 },
  compact: { rate: 1.22, legSwing: 0.38, armSwing: 0.32, armSway: 0.16, headBob: 0.025 },
  aggressive: { rate: 1.17, legSwing: 0.64, armSwing: 0.52, armSway: 0.08, headBob: 0.055 },
  limping: { rate: 0.88, legSwing: 0.48, armSwing: 0.28, armSway: 0.07, headBob: 0.06 },
});

export interface EnemyVisualProfile {
  /** Existing bespoke fallback builder used before/when an optional GLB is unavailable. */
  readonly fallbackFactory: string;
  /** Optional locally packaged rigged asset; procedural fallback stays available. */
  readonly gobkitModel?: GobkitModelId;
  readonly category: EnemyVisualCategory;
  readonly attackStyle: EnemyAttackStyle;
  /** Distinct locomotion gait for procedural rigs; vehicles/drones use non-foot styles. */
  readonly gaitStyle: EnemyGaitStyle;
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
    gaitStyle: 'theatrical',
    fallbackFactory: 'createCustomerEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.45,
    visualBrief: 'Przesadnie ekspresyjny klient z reklamacją, fakturą i wielką teczką',
  },
  walczak: {
    gaitStyle: 'heavy',
    fallbackFactory: 'createWalczakBossModel',
    gobkitModel: 'werewolfcaptain',
    category: 'boss-creature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.96,
    visualBrief: 'Potężny wilkołaczy nadzorca z szerokimi barkami i ciężkimi szponami',
  },
  forklift: {
    gaitStyle: 'rolling',
    fallbackFactory: 'createForkliftModel',
    category: 'vehicle',
    attackStyle: 'vehicle',
    targetHeight: 1.78,
    visualBrief: 'Wózek widłowy z masztem, widłami, kabiną i lampą ostrzegawczą',
  },
  architect: {
    gaitStyle: 'deliberate',
    fallbackFactory: 'createArchitectEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.48,
    visualBrief: 'Architekt wnętrz: beret, wielkie okulary, wachlarz próbek i rulon projektu',
  },
  inspector: {
    gaitStyle: 'precise',
    fallbackFactory: 'createInspectorEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.50,
    visualBrief: 'Inspektor BHP z dużym kaskiem, kamizelką odblaskową, clipboardem i gwizdkiem',
  },
  agv_robot: {
    gaitStyle: 'robotic',
    fallbackFactory: 'createAgvRobotModel',
    category: 'machine',
    attackStyle: 'ranged',
    targetHeight: 1.22,
    visualBrief: 'Niski autonomiczny robot AGV z czujnikami, światłami i pancernym zderzakiem',
  },
  handlowiec: {
    gaitStyle: 'theatrical',
    fallbackFactory: 'createHandlowiecEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'ranged',
    targetHeight: 1.48,
    visualBrief: 'Handlowiec w przesadnym garniturze z teczką, krawatem i gadżetem reklamowym',
  },
  monter: {
    gaitStyle: 'deliberate',
    fallbackFactory: 'createMonterEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.50,
    visualBrief: 'Monter z pasem narzędziowym, rękawicami i dużym kluczem',
  },
  piorun_dron: {
    gaitStyle: 'hovering',
    fallbackFactory: 'createPiorunDronModel',
    category: 'machine',
    attackStyle: 'ranged',
    targetHeight: 0.82,
    visualBrief: 'Latający dron patrolowy z czterema wirnikami, reflektorem i emiterem iskier',
  },
  elite_walczak_guard: {
    gaitStyle: 'heavy',
    fallbackFactory: 'createEliteGuardEnemyModel',
    gobkitModel: 'bloodirongrunt',
    category: 'boss-creature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.78,
    visualBrief: 'Opancerzony elitarny ochroniarz-berserker z masywnymi naramiennikami i przyłbicą',
  },
  kurier: {
    gaitStyle: 'brisk',
    fallbackFactory: 'createKurierEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'ranged',
    targetHeight: 1.48,
    visualBrief: 'Kurier z ogromnym termicznym plecakiem, paczkami i czapką dostawczą',
  },
  'przedstawiciel_włoski': {
    gaitStyle: 'theatrical',
    fallbackFactory: 'createItalianVendorEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.48,
    visualBrief: 'Włoski sprzedawca z przesadną gestykulacją, eleganckim strojem i próbkami',
  },
  sztaplar_szalony: {
    gaitStyle: 'aggressive',
    fallbackFactory: 'createSztaplarEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.56,
    visualBrief: 'Szalony operator paleciaka w ochronnym wyposażeniu i masywnych rękawicach',
  },
  krol_leto: {
    gaitStyle: 'heavy',
    fallbackFactory: 'createKrolLetoBossModel',
    gobkitModel: 'bloodironjuggernaut',
    category: 'boss-creature',
    attackStyle: 'heavy-melee',
    targetHeight: 2.12,
    visualBrief: 'Monstrualny król-magazynu w ciężkim pancerzu z koroną i energią bossów',
  },
  pan_roman: {
    gaitStyle: 'deliberate',
    fallbackFactory: 'createPanRomanEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'ranged',
    targetHeight: 1.48,
    visualBrief: 'Pan Roman: dostawca sanitariatów z pomarańczową kamizelką i wózkiem transportowym',
  },
  serwisant: {
    gaitStyle: 'precise',
    fallbackFactory: 'createSerwisanciEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'tool-melee',
    targetHeight: 1.48,
    visualBrief: 'Serwisant z narzędziami, miernikiem i technicznym pasem',
  },
  bosman_krakow: {
    gaitStyle: 'heavy',
    fallbackFactory: 'createBosmanKrakowBossModel',
    category: 'warehouse-caricature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.86,
    visualBrief: 'Bosman Kraków: przesadnie szeroki kierownik w granatowym mundurze, złotej odznace i czapce',
  },
  zombie_pracownik: {
    gaitStyle: 'shambling',
    fallbackFactory: 'createZombieWorkerEnemyModel',
    gobkitModel: 'stitchedbrute',
    category: 'undead',
    attackStyle: 'heavy-melee',
    targetHeight: 1.62,
    visualBrief: 'Nieumarły pracownik z poszarpaną kamizelką, odsłoniętymi żebrami, ranami i świecącymi oczami',
  },
  pomazaniec: {
    gaitStyle: 'compact',
    fallbackFactory: 'createPomazaniecRiderModel',
    category: 'secret-event',
    attackStyle: 'ranged',
    targetHeight: 1.18,
    visualBrief: 'Karykaturalny mały rowerzysta z kolorową czapką, wiatraczkiem i salwą lizaków',
  },
  sebix_m: {
    gaitStyle: 'aggressive',
    fallbackFactory: 'createSebixEnemyModel',
    category: 'warehouse-caricature',
    attackStyle: 'heavy-melee',
    targetHeight: 1.58,
    visualBrief: 'Przerysowany osiłek bez koszulki, w krótkich spodenkach, z agresywną miną i cegłami',
  },
  mutant_gamma_forklift: {
    gaitStyle: 'heavy',
    fallbackFactory: 'createMutantGammaForkliftModel',
    gobkitModel: 'bloodironjuggernaut',
    category: 'mutant',
    attackStyle: 'heavy-melee',
    targetHeight: 2.08,
    visualBrief: 'Radioaktywny mutant-sztaplarka z metalowym zderzakiem, widłami i ostrzegawczym światłem',
  },
  radioactive_pip: {
    gaitStyle: 'limping',
    fallbackFactory: 'createRadioactivePipModel',
    gobkitModel: 'nightwitch',
    category: 'mutant',
    attackStyle: 'ranged',
    targetHeight: 1.78,
    visualBrief: 'Skażony inspektor PIP z toksycznymi oczami, żółto-czarnymi oznaczeniami i zieloną aurą',
  },
  cyber_salesman: {
    gaitStyle: 'robotic',
    fallbackFactory: 'createCyberSalesmanModel',
    gobkitModel: 'androidcommander',
    category: 'machine',
    attackStyle: 'ranged',
    targetHeight: 1.78,
    visualBrief: 'Cyber-handlowiec: android z neonowym wizjerem, ekranem ofertowym i mechanicznymi kończynami',
  },
});
