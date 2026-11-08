import * as THREE from 'three';
import { disposePvpObjectTree } from './pvpResourceCleanup.ts';
import { calculatePvpCameraFrame, calculatePvpCameraTrackingBounds, isPvpPortraitViewport } from './pvpCamera.ts';
import { createArenaObstacleFootprint, createPvpFloorTexture, createPvpObstacleTexture } from './pvpTextures.ts';
import {
  calculatePvpAimPreview, getPvpAimAngle, getPvpSweepAimAngle, getPvpAimSweepCenterAngle,
  pvpAimDirectionFromAngle, pvpScreenMovementToWorld,
  PVP_AIM_SWEEP_HALF_ARC, PVP_AIM_SWEEP_PERIOD_SECONDS, PVP_AIM_SWEEP_RADIUS,
  PVP_AIM_SWEEP_SEGMENTS, type PvpAimDirection,
} from './pvpAim.ts';
import type { IPvpSession } from './pvpClient.ts';
import {
  createDefaultPvpObstacles,
  PVP_ARENA_BOUNDS,
  PVP_DASH_COOLDOWN,
  PVP_NORMALIZED_HP,
  PVP_SPAWN_P1,
  PVP_SPAWN_P2,
  type PvpArenaState,
  type PvpHitEvent,
} from './pvpArena.ts';
import { clampHorizontalPosition } from './arenaBounds.ts';
import { EnemySpatialIndex, calculateEnemySeparationVector, chooseSpacedSpawnPoint, resolveEnemyPlayerSeparation } from './enemySpacing.ts';
import { calculateEnemyObstacleAvoidanceVector } from './enemyNavigation.ts';
import { createEnemyHitReaction, getEnemyHitPulse } from './enemyCombatFeedback.ts';
import { isEffectiveBossLaneDodge, isInsideBossAttackLane, isWithinBossImpactRadius } from './combatTelegraphs.ts';
import { getHordeRingPoint, getHordeRingRadius, getSurvivalHordeSettings } from './survivalHorde.ts';
import { chooseSurvivalEventSpawnPoint } from './survivalSpawn.ts';
import { getSurvivalUpgradeRarityMeta, getSurvivalWeaponInitialLevel, getSurvivalWeaponUpgradeSteps, promoteSurvivalUpgradeRarity, rollSurvivalUpgradeRarity, type SurvivalUpgradeRarity } from './survivalRarity.ts';
import { createSurvivalBossRewardOptions } from './survivalBossRewards.ts';
import { getSurvivalBossVariant, isMajorSurvivalBossType, shouldSpawnBosmanKrakow } from './survivalEncounters.ts';
import { applySurvivalWaveMutator, getSurvivalWaveMutator } from './survivalWaveMutators.ts';
import { getSurvivalConvoyHazardCount } from './survivalConvoy.ts';
import { applySurvivalMapCombatModifier, chooseRandomSurvivalMap, getSurvivalMapDefinition, type SurvivalMapId } from './survivalMaps.ts';
import { getSurvivalMapRouteFeatures } from './survivalMapLayouts.ts';
import { chooseCampaignNearbyRewardSpawnPoint } from './campaignRewards.ts';
import { chooseNearbySpawnPoint } from './arenaSpawn.ts';
import { chooseSurvivalEnemySpawnType } from './survivalEnemySpawns.ts';
import { findNextReadyWeaponIndex, getNextWeaponDispatchCursor } from './survivalWeaponDispatch.ts';
import { buildSurvivalDamageReport, createSurvivalDamageStats, getSurvivalWeaponDamageSource, recordSurvivalDamage, recordSurvivalKill, SURVIVAL_DAMAGE_WEAPONS, type SurvivalDamageReport, type SurvivalDamageSource, type SurvivalDamageWeaponId, type SurvivalDamageStats } from './survivalDamageStats.ts';
import { getSurvivalDifficultyProfile } from './survivalDifficulty.ts';
import { getSurvivalKillScoreMultiplier, getSurvivalWaveClearBonus } from './survivalScoring.ts';
import { chooseSurvivalRicochetTarget, getSurvivalRadiationProfile, getSurvivalRicochetProfile } from './survivalCombatDraft.ts';
import { getSurvivalShrapnelProfile } from './survivalShrapnel.ts';
import { buildSurvivalCoalitionOrders, getSurvivalCoalitionRole } from './survivalCoalition.ts';
import { getSurvivalCommanderProfile, selectSurvivalCommanderTargets } from './survivalCommander.ts';
import { advanceSurvivalCommanderTiming } from './survivalCommanderTiming.ts';
import { getSurvivalLeaderLossTargets, getSurvivalMoraleBreakMultiplier, SURVIVAL_LEADER_LOSS_BREAK_SECONDS } from './survivalMorale.ts';
import { selectSurvivalSupportPulseTargets, SURVIVAL_SUPPORT_PULSE_RADIUS, SURVIVAL_SUPPORT_PULSE_INTERVAL_SECONDS, SURVIVAL_SUPPORT_SHIELD_SECONDS } from './survivalSupport.ts';
import { getSurvivalProgressionInfo, getSurvivalPromotionRarityFloor, getSurvivalXpRequirement } from './survivalProgression.ts';
import { createSurvivalXpStreakState, registerSurvivalXpPickup, type SurvivalXpStreakState } from './survivalXpStreak.ts';
import { advanceSurvivalShiftEvent, createSurvivalShiftEventState, registerSurvivalShiftEventAction, type SurvivalShiftEvent, type SurvivalShiftEventAction, type SurvivalShiftEventState } from './survivalShiftEvents.ts';
import { advanceSurvivalContract, createSurvivalContract, registerSurvivalContractAction, type SurvivalContractAction, type SurvivalContractState } from './survivalContracts.ts';
import {
  advanceAbilityCooldown,
  applyAbilityKillRecharge,
  createAbilityCooldown,
  getAbilityKillRechargeCapRatio,
  getAbilityKillRechargeSeconds,
  getAbilityCooldownProgress,
  scaleAbilityCooldown,
  type AbilityCooldownState,
} from './abilityCooldown.ts';
import {
  getAbilityCooldownSeconds,
  getBaseAttackCooldownSeconds,
  getPiotrBoomerangMaxLifeSeconds,
  getPrimaryAttackLifetimeSeconds,
  getSurvivalWeaponReloadSeconds,
  getWeaponRecoveryAfterUpgrade,
  SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS,
  SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR,
  SURVIVAL_WEAPON_UNLOCK_SECONDS,
  SURVIVAL_AUTO_AIM_RANGE_METERS,
} from './combatBalance.ts';
import { ParticleMeshPool, type ParticleShape } from './particlePool.ts';
import { applyPerfectDodgeCounterattack, getSurvivalDashCooldownSeconds, getSurvivalDashProgress, rollSurvivalCriticalDamage } from './archeroMechanics.ts';
import { advanceSurvivalMomentum, createSurvivalMomentumState, getSurvivalMomentumDamageMultiplier, getSurvivalMomentumMoveMultiplier, getSurvivalMomentumRateMultiplier, registerSurvivalKill, type SurvivalMomentumState } from './survivalMomentum.ts';
import { selectSurvivalAutoTarget } from './survivalTargeting.ts';
import { CHARACTERS } from './characters.ts';
import { NEUTRAL_CHARACTER_COMBAT_BONUSES, type CharacterCombatBonuses } from './characterProgression.ts';
import { getCharacterMotionProfile } from './characterMotion.ts';
import { getAttackPoseStrength, getCharacterAttackMotionProfile } from './characterAttackMotion.ts';
import { resolveCharacterIncomingDamage, scaleCharacterBasicAttackDamage, scaleSurvivalOutgoingDamage, scaleSurvivalIncomingDamage, SURVIVAL_HIT_INVULNERABILITY_SECONDS } from './characterBalance.ts';
import { sound } from './sound.ts';
import {
  ActivePerks,
  AVAILABLE_PERKS,
  CharacterDef,
  CharacterId,
  CollectibleItem,
  DroppedPerkItem,
  EnemyItem,
  GameState,
  HazardItem,
  PerkType,
  PlatformBlock,
} from './types.ts';
import {
  createArchitectEnemyModel,
  createAgvRobotModel,
  createAisleArrow,
  createBathtubModel,
  createBhpDigitalScoreboard,
  createBimberBottleMolotov,
  createMolotovFirePuddle,
  createCoffeeVendingMachineModel,
  createCarraraCollectible,
  createCharacterModel,
  createCustomerEnemyModel,
  createDeliveryVan,
  createDroppedPerkCrate,
  createEliteGuardEnemyModel,
  createEspressoCollectible,
  createFinishGate,
  createForkliftModel,
  createGoldenCutterCollectible,
  createGoldenThroneEasterEgg,
  createGroutCollectible,
  createHandlowiecEnemyModel,
  createHighBayCatwalk,
  createHighBayLamp,
  createIndustrialSteamVent,
  createInspectorEnemyModel,
  createMagnetCollectible,
  createMonterEnemyModel,
  createNeonShowroomSign,
  createPenaltyNoticeProjectile,
  createPiorunDronModel,
  createSecretFolderEasterEgg,
  createTilePallet,
  createVintageCoffeeCornerEasterEgg,
  createVolumetricLightBeam,
  createWalczakBossModel,
  createWarehouseRack,
  createKurierEnemyModel,
  createItalianVendorEnemyModel,
  createSztaplarEnemyModel,
  createMutantGammaForkliftModel,
  createRadioactivePipModel,
  createCyberSalesmanModel,
  createSprayGraffitiDecal,
  createCrimeSceneBodyOutlineDecal,
  createKrolLetoBossModel,
  createDisplayPodium,
  createGlassPartition,
  createShowroomPlant,
  createTrackSpotlights,
  createExplosiveBarrelModel,
  createLargeTileModel,
  createLootCrateModel,
  createPanRomanEnemyModel,
  createSanitarywareProjectile,
  createSerwisanciEnemyModel,
  createSparkZapProjectile,
  createBosmanKrakowBossModel,
  createOdprawaClipboardProjectile,
  getFloorTexture,
  getShowroomMarbleFloorTexture,
  getShowroomWallTexture,
  getTerminalGraniteFloorTexture,
  getHazardStripeTexture,
  getB4LogoTexture,
  getWallTexture,
  createKfcBucketCollectible,
  createZombieWorkerEnemyModel,
  createCementSpillTrapModel,
  createStretchFilmBarrierModel,
  createRollerGateTrapModel,
  createLaserCutterTrapModel,
  createSteamGeyserTrapModel,
  createHydraulicPressTrapModel,
  applyIndustrialPbr,
} from './warehouseAssets.ts';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Shared floor-guide geometry/materials. Instanced markings add readable scale and
// route structure to the large warehouse floors with only one draw call per sector.
const PLAYER_UNIT_SCALE = new THREE.Vector3(1, 1, 1);
const SECTOR_FLOOR_GUIDE_GEOMETRY = new THREE.BoxGeometry(1.25, 0.014, 0.055);
const SECTOR_FLOOR_GUIDE_MATERIALS: Record<1 | 2 | 3, THREE.MeshBasicMaterial> = {
  1: new THREE.MeshBasicMaterial({ color: 0xf59e0b, toneMapped: false }),
  2: new THREE.MeshBasicMaterial({ color: 0xc19a5b, toneMapped: false }),
  3: new THREE.MeshBasicMaterial({ color: 0x58b7d8, toneMapped: false }),
};

export interface SurvivalUpgradeOption {
  id: string;
  icon: string;
  title: string;
  description: string;
  rarity: SurvivalUpgradeRarity;
  rarityLabel: string;
  strengthMultiplier: number;
}

export type SurvivalWeaponId = 'pallet_cannon' | 'diamond_saw' | 'glue_mine' | 'kfc_bomber' | 'piorun_drone' | 'forklift_bolter' | 'scanner_pulse' | 'orbit_blades' | 'calacatta_shards' | 'steam_bomb' | 'forklift_horn' | 'wz_boomerang';
export interface SurvivalWeaponState { id: SurvivalWeaponId; level: number; cooldown: number; evolved?: boolean; }
type SurvivalPassiveId = 'damage' | 'rapid' | 'boots' | 'magnet' | 'reinforced' | 'medkit' | 'range' | 'growth' | 'scavenger' | 'regen' | 'drone' | 'armor' | 'ability';
const SURVIVAL_WEAPON_DEFS: Record<SurvivalWeaponId, {
  name: string; evolvedName: string; icon: string; description: string; cooldown: number;
  unlockAfter: number; color: number; evolutionPassive: SurvivalPassiveId; evolutionPassiveLabel: string;
}> = {
  // First weapon at 2 minutes; one new option unlocks every 90 seconds.
  // The complete 12-weapon arsenal is a long-run reward, not an early-run power spike.
  pallet_cannon: { name: 'Działo paletowe', evolvedName: 'PALETA GIGA', icon: '🧱', description: 'Precyzyjny pocisk z kontrolowaną falą uderzeniową.', cooldown: 8.6, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.pallet_cannon, color: 0xf59e0b, evolutionPassive: 'damage', evolutionPassiveLabel: 'Wzmocniona amunicja' },
  diamond_saw: { name: 'Tarcza diamentowa', evolvedName: 'TARCZA RYKOSZETU', icon: '💿', description: 'Ostrze przebija linię przeciwników i może odbić się od granicy areny.', cooldown: 9.7, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.diamond_saw, color: 0x22d3ee, evolutionPassive: 'range', evolutionPassiveLabel: 'Zasięg audytu' },
  glue_mine: { name: 'Mina Mapei', evolvedName: 'MAPEI BLACKOUT', icon: '🟣', description: 'Mina obszarowa spowalniająca i rozbijająca szyk wrogów.', cooldown: 11.3, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.glue_mine, color: 0xa78bfa, evolutionPassive: 'magnet', evolutionPassiveLabel: 'Magnes XP' },
  kfc_bomber: { name: 'Kubełek bombowy', evolvedName: 'KUBEŁEK FURII', icon: '⚡', description: 'Pocisk obszarowy z podpaleniem celów.', cooldown: 12.7, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.kfc_bomber, color: 0xef4444, evolutionPassive: 'scavenger', evolutionPassiveLabel: 'Łowca okazji' },
  piorun_drone: { name: 'Dron Piorun', evolvedName: 'PIORUN CHAIN MK II', icon: '🤖', description: 'Szybki pocisk samonaprowadzający z dodatkowym przebiciem.', cooldown: 10.4, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.piorun_drone, color: 0x38bdf8, evolutionPassive: 'drone', evolutionPassiveLabel: 'Dron asystujący' },
  forklift_bolter: { name: 'Nitownica UDT', evolvedName: 'NITOWNICA OBLĘŻNICZA', icon: '🔩', description: 'Wąski, szybki pocisk przebijający kilka celów.', cooldown: 7.0, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.forklift_bolter, color: 0xfbbf24, evolutionPassive: 'rapid', evolutionPassiveLabel: 'Rytm ataku' },
  scanner_pulse: { name: 'Impuls skanera B4', evolvedName: 'SKANER TOTALNY', icon: '📡', description: 'Namierzający impuls przebijający zwartą formację.', cooldown: 9.0, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.scanner_pulse, color: 0x67e8f9, evolutionPassive: 'range', evolutionPassiveLabel: 'Zasięg audytu' },
  orbit_blades: { name: 'Wirujące tarcze', evolvedName: 'ORBITALNA STREFA BHP', icon: '⚙️', description: 'Ostrza krążące wokół operatora i chroniące bliski dystans.', cooldown: 14.5, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.orbit_blades, color: 0x86efac, evolutionPassive: 'armor', evolutionPassiveLabel: 'Paleta ochronna' },
  calacatta_shards: { name: 'Odłamki Calacatty', evolvedName: 'BURZA WIELKIEGO FORMATU', icon: '💎', description: 'Ciężkie odłamki gresu lecące w wachlarzu i przebijające kilka celów.', cooldown: 12.0, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.calacatta_shards, color: 0xe5e7eb, evolutionPassive: 'damage', evolutionPassiveLabel: 'Wzmocniona amunicja' },
  steam_bomb: { name: 'Bomba Parowa', evolvedName: 'KOCIOŁ B4', icon: '♨️', description: 'Ciśnieniowy pocisk tworzący strefę spowolnienia wśród przeciwników.', cooldown: 13.5, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.steam_bomb, color: 0x7dd3fc, evolutionPassive: 'regen', evolutionPassiveLabel: 'Przerwa regeneracyjna' },
  forklift_horn: { name: 'Klakson Sztaplarki', evolvedName: 'ALARM CAŁEJ HALI', icon: '📣', description: 'Fala dźwiękowa odrzuca i ogłusza wrogów wokół operatora.', cooldown: 17.0, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.forklift_horn, color: 0xfb923c, evolutionPassive: 'armor', evolutionPassiveLabel: 'Paleta ochronna' },
  wz_boomerang: { name: 'WZ-Bumerang', evolvedName: 'PROTOKÓŁ POWROTU', icon: '📜', description: 'Magiczna WZ-tka przecina linię wrogów i wraca do operatora.', cooldown: 13.0, unlockAfter: SURVIVAL_WEAPON_UNLOCK_SECONDS.wz_boomerang, color: 0xfbbf24, evolutionPassive: 'growth', evolutionPassiveLabel: 'Premia za normę' },
};
export interface SurvivalSnapshot {
  elapsedSeconds: number; wave: number; kills: number; perfectDodges: number; counterattackReady: boolean; level: number; xp: number; xpToNext: number; xpStreak: number;
  rankName: string; nextRankName: string; nextRankLevel: number;
  aliveEnemies: number; rerolls: number; skips: number; activeHazards: number;
  killStreak: number; overdriveRemainingSeconds: number;
  mapId: SurvivalMapId; mapName: string; mapSubtitle: string;
  secretsFound: number; totalSecrets: number; bossesDefeated: number;
  contract: SurvivalContractState;
  event: SurvivalShiftEvent | null;
  weapons: Array<{ id: SurvivalWeaponId; name: string; icon: string; level: number; evolved: boolean }>;
}

export interface GameCallbacks {
  onScoreUpdate: (score: number, collectedVip: number, totalVip: number) => void;
  onHpUpdate: (hp: number, maxHp: number) => void;
  onAbilityCooldown: (progress: number, ready: boolean, remainingSeconds: number, killRechargeEnabled: boolean) => void;
  onSpeechBubble: (text: string) => void;
  onLevelComplete: (levelId: number, score: number, timeStr: string) => void;
  onGameOver: (reason: string) => void;
  onBossUpdate?: (name: string, hp: number, maxHp: number, visible: boolean, phase?: number) => void;
  onPerksUpdate?: (perks: ActivePerks) => void;
  onFloatingText?: (text: string, x: number, y: number, z: number, type?: 'points' | 'vip' | 'easter-egg' | 'damage' | 'perk' | 'combo' | 'enemy_shout', metadata?: any) => void;
  onPerkDropBanner?: (name: string, icon: string, desc: string, color: string) => void;
  onSurvivalAnnouncement?: (title: string, subtitle: string, detail: string) => void;
  onSurvivalUpdate?: (snapshot: SurvivalSnapshot) => void;
  onSurvivalSecretFound?: (mapId: SurvivalMapId, secretId: string, secretName: string) => void;
  onSurvivalLevelUp?: (options: SurvivalUpgradeOption[], context?: 'levelup' | 'rank-up' | 'boss-reward') => void;
  onSurvivalDashUpdate?: (progress: number, ready: boolean, remainingSeconds: number) => void;
  onPvpUpdate?: (state: PvpArenaState, localSlot: 'p1' | 'p2') => void;
  onPvpMatchEnd?: (state: PvpArenaState, localSlot: 'p1' | 'p2') => void;
}

export class PaleciakiGameEngine {
  public static readonly ENEMY_QUOTES: Record<string, string[]> = {
    customer: [
      "Gdzie moja faktura proforma?! Czekam od rana!",
      "Ta fuga miała być popielata, a jest mysia!",
      "Żądam natychmiastowej rozmowy z kierownikiem!",
      "Panie, w Castoramie mieli to 30% taniej!",
      "Dlaczego ten gres jest krzywy o pół milimetra?!",
      "Kierownik Nadzorca Zero obiecał mi rabat 40% na płytki!",
      "Kto mi zapłaci za przestój ekipy kafelkarzy?!",
    ],
    architect: [
      "Ten beż jest zbyt chłodny o 2 Kelvin!",
      "Czy to na pewno oryginalny spiek kwarcowy z Bolonii?!",
      "Kto pozwolił na fugę 2mm?! Tylko bezfugowo i z mikro-fazą!",
      "Mój projekt penthouse'u w Sopocie legnie w gruzach!",
      "Ostrożnie z tym 샘plem! To limitowana edycja z Mediolanu!",
      "Zmieńcie to oświetlenie, gres traci swoją organiczną duszę!",
    ],
    pan_roman: [
      "Panowie spieszę się, na pace mam 8 wanien wolnostojących!",
      "Gdzie mam zrzucić te kible?! Byle nie na deszczu!",
      "Kurier Ekspresowy znowu zajął moją rampę rozładunkową!",
      "Panie kierowniku, pieczątka na WZ-tce i mnie nie ma!",
      "Uwaga na paleciak, hamulce skończyły się w 2018 roku!",
      "Rzucam umywalką, łap pan albo będzie po premii!",
    ],
    kurier: [
      "Awizo zostawione w gaśnicy BHP na trzecim piętrze!",
      "Dostawa Kurier Express dla prezesa!",
      "Mam 40 paczek i 12 minut do końca zmiany!",
      "Podpisz pan cokolwiek palcem po brudnym ekranie!",
      "Paczka lekko obita, ale w środku na bank nic nie pękło!",
      "Paczkomat był pełny, więc rzuciłem pod drzwi rampy!",
      "PILNE NA JUŻ! PODPIS PÓŹNIEJ, PACZKA TERAZ!",
      "NIE MA CZASU NA AWIZACJĘ — EXPRESS B4!",
    ],
    serwisant: [
      "Kto wcisnął grzałkę w wannie bez wlanej wody?!",
      "Tu jest zwarcie na pompie hydromasażu, zaraz wywali korki!",
      "Nie dotykaj tej fazy, to kabel zasilający od prezesa!",
      "Gdzie jest schemat bezpieczników z sektora B?!",
      "Trzymaj probówkę, jak zaiskrzy to znaczy że działa!",
    ],
    sztaplar_szalony: [
      "Z drogi, paleciak nie ma ABS-u ani litości!",
      "Drift na mokrym gresie Marmur B4 to moja jedyna pasja!",
      "Kto zostawił puste kartony w alei głównej?!",
      "Paleta 800 kilo leci z góry, klakson zepsuty!",
      "Kierownik mówił 'ostrożnie', ale ja mam normę do wyrobienia!",
    ],
    inspector: [
      "Protokół BHP: brak atestowanego kasku i gilotyna bez osłony!",
      "Zaraz wstrzymam wydawanie towaru na cały długi weekend!",
      "Gdzie jest certyfikat CE na te wanny z masażem bąbelkowym?!",
      "Mandat 5000 zł za brak żółtych linii ostrzegawczych!",
      "Widzę tu rażące naruszenie przepisów przeciwpożarowych!",
    ],
    handlowiec: [
      "Tylko dzisiaj: rabat inwestycyjny 35% na armaturę!",
      "Mam klienta na 1200 metrów kwadratowych mozaiki!",
      "Kierownik zgodzi się na darmowy transport z wniesieniem!",
      "Podpiszmy aneks, dorzucę zapas fugi epoksydowej gratis!",
      "Ten marmur sprzedaje się sam, proszę brać zanim zdrożeje!",
    ],
    monter: [
      "Wiesław, podaj poziomicę, tu jest centymetr spadku na metrze!",
      "Klej dwuskładnikowy już wiąże w wiadrze, ruszajcie się!",
      "Za taką stawkę za metr to ja mogę co najwyżej fugować!",
      "Kto kładł te płytki pod prąd słojów drewna?!",
      "Dociągnij ten syfon, bo znowu zaleje showroom na dole!",
    ],
    agv_robot: [
      "BEEP-BOOP: Wykryto przeszkodę biologiczną w alei B4.",
      "SYSTEM: Kurs kolizyjny z wanną akrylową. Manewr omijania nieudany.",
      "BATERIA: 98%. Przewożę 16 misek wiszących bezkołnierzowych.",
      "OSTRZEŻENIE: Algorytm autonomiczny żąda podwyżki w watogodzinach.",
    ],
    piorun_dron: [
      "SKAN KODU KRESKOWEGO: Błąd sumy kontrolnej!",
      "ALERT DRONA: Wykryto operatora bez uprawnień UDT kat. II!",
      "PROMIENIOWANIE WI-FI: Sygnał z centrali Kompleks B4 100%.",
      "RADAR LASEROWY: Paleta krzywo ustawiona o 3 stopnie!",
    ],
    elite_walczak_guard: [
      "Wstęp do Sektora VIP tylko z przepustką dyrektorską!",
      "Chronimy ostatnią paletę Biały Marmur przed spekulantami!",
      "Stój! Nadzorca Zero nie przyjmuje już żadnych reklamacji!",
      "Tylko przez mój trup dotkniesz tej armatury z 24k złota!",
    ],
    mutant_gamma_forklift: [
      "PROMIENIUJĘ SZYBCIEJ NIŻ KUCHENKA MIKROFALOWA W POKOJU SOCJALNYM!",
      "UDT NIE MA JURYSDYKCJI W STREFIE SKAŻENIA GAMMA B4!",
      "Z DROGI ŚLEDZIE, WÓZEK PO TRZECH AWARIACH REAKTORA JEDZIE!",
      "TA PALETA WAŻY 14 TON I ŚWIECI ZIELONYM NEONEM!",
    ],
    radioactive_pip: [
      "MANDAT 50 000 ZŁ ZA NARUSZENIE DYLATACJI CZASOPRZESTRZENNEJ!",
      "MOJE KARTOTEKI MAJĄ POŁOWICZNY ROZPAD 400 LAT!",
      "LICZNIK GEIGERA WSKAZUJE KOMPLETNY BRAK PROTOKOŁU ODBIORU!",
      "PROSZĘ ZAŁOŻYĆ OŁOWIANY KASK BHP LUB ZAMYKAM TĘ HALĘ NA ZAWSZE!",
    ],
    cyber_salesman: [
      "CYBER-OFERTA 3.0: PŁYTKI Z METAWERSUM Z RABATEM 99%!",
      "POBIERAM FAKTURĘ PROFORMA BEZPOŚREDNIO DO TWOJEGO NEURO-ZŁĄCZA!",
      "MOJE PREZENTACJE POWERPOINT ZADAJĄ REALNE OBRAŻENIA OBSZAROWE!",
      "CYBER-CERAMIKA: ZERO FUGI, 100% MIESIĘCZNEJ SUBKRYPCJI!",
    ],
    bosman_krakow: [
      "Odprawa 3-miesięczna czeka na każdego marudera!",
      "W Krakowie na centrali nikt tak flegmatycznie palet nie nosił!",
      "Podpisuj rozwiązanie umowy za porozumieniem stron!",
      "Rzucam teczką personalną, unikaj jak potrafisz!",
      "Na mój pokład wchodzą tylko ludzie z certyfikatem UDT!",
    ],
    walczak: [
      "Ja tu byłem kierownikiem zanim wybudowano ten salon!",
      "Na mojej zmianie nie ma przerw na papierosa ani kawę!",
      "Karę umowną 50 000 zł wyślę ci poleconym za potwierdzeniem!",
      "Szczekaczka Nadzorcy Zero zagłuszy twoje żałosne prośby o premię!",
      "TRYB SZAŁU: Cały magazyn zostaje na bezpłatne nadgodziny!",
      "Zafuguję cię w tym regale wysokiego składowania!",
    ],
    krol_leto: [
      "Jam jest Dyrektor Widmo, Pan na Spiekach i Władca Wszystkich Salonów!",
      "Twoja umowa na czas określony właśnie dobiegła końca!",
      "Na kolana przed majestatem włoskiego gresu 120x280!",
      "Dyscyplinarka ze skutkiem natychmiastowym bez prawa do odprawy!",
      "Zostaniesz zafugowany w postumencie ekspozycyjnym na wieczność!",
      "Żaden magazynier nie opuści tego terminala żywy!",
    ],
    zombie_pracownik: [
      "Kubełek Mocy?! Dostawa dotarła! Z drogi!",
      "STRIIIaaPSY... czuję gorącą panierkę z pięciu alejek!",
      "Trzecia zmiana bez obiadu... oddawaj skrzydełka!",
      "Kubełek jest MÓJ! Nie dzielę się frytkami!",
      "Móóózg... znaczy KURCZAAAK z dostawy!",
    ],
    pomazaniec: [
      "POMAZAŃCEEEE! KTO MA JESZCZE DWA KÓŁKA?!",
      "Razem mamy w siedmiu więcej lat niż rozumu!",
      "Lizak w dłoń! Rowerowy boss nam nie ucieknie!",
      "Dzwonek działa, hamulce są opcjonalne!",
      "MAM CZAPKĘ Z WIATRAKIEM, CZYLI JESTEM DOWÓDCĄ!",
      "Rowerowy boss! Nadciągamy z prędkością trzech kilometrów na godzinę!",
    ],
    sebix_m: [
      "CO SIĘ GAPISZ?! CEGŁA JEST NAJPIERWOTNIEJSZYM ARGUMENTEM!",
      "DOPIERO SIĘ ROZGRZEWAM! ZARAZ ZOBACZYSZ TURBO!",
      "NIE MAM KOSZULKI, BO MIĘŚNIE NIE POTRZEBUJĄ UBRANIA!",
      "KTO PRZESTAWIŁ MOJĄ PALETĘ?! TERAZ BĘDZIE TARAN!",
      "ODPALAM TRYB HULK B4! ODSUNĄĆ SIĘ OD ALEJKI!",
      "TO NIE SĄ OPARZENIA. TO ŚLADY PO MOIM WEJŚCIU!",
    ],
  };

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public container: HTMLElement;
  public threeRenderer: THREE.WebGLRenderer | null = null;

  private state: GameState = 'title';
  private timeScale: 1 | 2 = 1;
  private currentCharacterId: CharacterId = 'marcin';
  private charDef: CharacterDef;
  private characterMasteryBonuses: CharacterCombatBonuses = { ...NEUTRAL_CHARACTER_COMBAT_BONUSES };
  private coffeeMachines: { mesh: THREE.Group; x: number; y: number; z: number; cooldown: number }[] = [];

  public getGameState(): GameState {
    return this.state;
  }

  // Player state
  private playerPos = new THREE.Vector3(0, 1, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerRot = 0;
  private isGrounded = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private hp = 3;
  private maxHp = 3;
  private characterDamageRemainder = 0;
  private score = 0;
  private comboStreak = 0;
  private comboTimer = 0;
  private collectedVipCount = 0;
  private totalVipCount = 0;
  private invulnerableTimer = 0;
  private abilityCooldownState: AbilityCooldownState = createAbilityCooldown(0);
  private abilityCooldownUiTimer = 0;
  private abilityCooldownLastProgress = -1;
  private abilityCooldownLastReady: boolean | null = null;
  private attackCooldownTimer = 0;
  private attackSwingTimer = 0;
  private attackSwingDuration = 0.26;
  private characterFootstepTimer = 0;
  private walkCycle = 0;
  private speechBubbleTimer = 0;
  private levelStartTime = 0;
  private activeElapsedSeconds = 0;
  private cameraShake = 0;
  private screenShakeDuration = 0;
  private screenShakeIntensity = 0;
  private screenShakeTimer = 0;
  // Elevated tactical framing is the default so mobile players can read lanes and threats.
  private cameraMode: 'tpp' | 'close' | 'iso' = 'tpp';
  private camZoomFactor = 0.94;
  private oniricDreamRemainingSeconds = 0;
  private oniricDreamCameraActive = false;
  private hasManualCameraZoom = false;
  private maxUnlockedSector = (() => {
    try {
      const saved = Number(window.localStorage.getItem('maxFlizUnlockedSector') || '1');
      return Number.isFinite(saved) ? THREE.MathUtils.clamp(Math.floor(saved), 1, 3) : 1;
    } catch { return 1; }
  })();
  private sectorGates: Array<THREE.Group | null> = [null, null, null, null];
  private gateNoticeCooldown = 0;
  private finishGatePos = new THREE.Vector3(30, 0, 0);
  private smoothCamY = 0.5;
  // Tactical Elevated camera default (~45° isometric/tactical perspective like Hades/Brawl Stars)
  private currentCamOffset = new THREE.Vector3(-2.2, 10.8, 9.2);
  private currentLookAt = new THREE.Vector3(0, 1.2, 0);
  private pvpCameraDesiredPosition = new THREE.Vector3();
  private pvpCameraDesiredTarget = new THREE.Vector3();
  // Reused camera scratch vectors: avoid two Vector3 allocations on every frame.
  private readonly cameraTargetPosition = new THREE.Vector3();
  private readonly desiredLookAtPosition = new THREE.Vector3();
  private readonly cameraOcclusionWorldPosition = new THREE.Vector3();
  private readonly cameraOcclusionRaycaster = new THREE.Raycaster();
  private readonly cameraOcclusionHits: THREE.Intersection<THREE.Object3D>[] = [];
  private readonly cameraOcclusionHitSet = new Set<THREE.Object3D>();
  private cameraOcclusionCooldown = 0;
  private mobileShadowRefreshCooldown = 0;
  private adaptivePerformanceTier: 0 | 1 | 2 = 0;
  private readonly cameraOccluders: THREE.Mesh[] = [];
  private readonly cameraOccluderMaterials = new Map<THREE.Mesh, {
    original: THREE.Material | THREE.Material[];
    faded: THREE.Material | THREE.Material[];
    originals: THREE.Material[];
    fades: THREE.Material[];
    isFaded: boolean;
    currentFade: number;
    targetFade: number;
    fadeOpacity: number;
    fadeRadius: number;
  }>();
  private cameraBossCheckCooldown = 0;
  private cameraBossTargetZoom = 1.0;
  private bossHudRefreshCooldown = 0;
  private lastBossHudSignature = '';
  private viewportAspect =
    (window.visualViewport?.width || window.innerWidth) /
    Math.max(1, window.visualViewport?.height || window.innerHeight);
  private isHandheldViewport =
    (window.visualViewport?.width || window.innerWidth) < 900 ||
    ('ontouchstart' in window);
  private bossCamZoom = 1.0;
  private finishWarningTimer = 0;
  private dodgeCooldownTimer = 0;
  private hitStopTimer = 0;
  private targetRing!: THREE.Mesh;
  private bloomPulseTimer = 0;
  private bloomPulseDuration = 0.3;
  private levelBounds = { minX: -35, maxX: 35, minZ: -15, maxZ: 15 };
  private envMapInitialized = false;
  private attackComboStep = 0;
  private timedEventCooldown = 20.0;
  private timedEventIndex = 0;
  private doublePointsTimer = 0;
  private glueSlowTimer = 0;
  private cementSlowTimer = 0;
  private heroQuipTimer = 24;
  private marcinWoTPenaltyTimer = 0;
  private outlineMaterial: THREE.ShaderMaterial | null = null;
  private dofBlurPassMesh: THREE.Mesh | null = null;
  private dofBlurMaterial: THREE.ShaderMaterial | null = null;
  private bulldozerHitCooldowns = new Map<string, number>();
  private globalEnemyShoutCooldown = 0;
  // Re-evaluate the nearest enemies in short slices instead of allocating/sorting every rendered frame.
  private waveDirectorCooldown = 0;
  private activeChaserIds = new Set<string>();
  private threatTier = 0;

  // Survival is the default game mode, PvP Arena is the 1v1 multiplayer mode.
  private gameMode: 'campaign' | 'survival' | 'pvp' = 'survival';
  private pvpSession: IPvpSession | null = null;
  private pvpSlot: 'p1' | 'p2' = 'p1';
  private lastPvpState: PvpArenaState | null = null;
  private remotePlayerGroup: THREE.Group | null = null;
  private remotePlayerDef: CharacterDef | null = null;
  private remotePlayerMeshBuilt: any = null;
  private remotePlayerHpBar: any = null;
  private remotePlayerOutline: any = null;
  private prevPvpLocalHp = -1;
  private pvpObstacleMeshes: THREE.Object3D[] = [];
  private pvpMedkitMesh: THREE.Group | null = null;
  private pvpPerkMesh: THREE.Group | null = null;
  private pvpPerkGem: THREE.Mesh | null = null;
  private pvpPerkLabel: THREE.Sprite | null = null;
  private pvpPerkLabelContext: CanvasRenderingContext2D | null = null;
  private pvpPerkLabelLastType = '';
  private pvpPerkLastActive = false;
  private pvpAimGuide: THREE.Line | null = null;
  private pvpAimTarget: THREE.Mesh | null = null;
  private pvpAimArc: THREE.Line | null = null;
  private pvpAimSweepPointer: THREE.Mesh | null = null;
  private pvpAimSweepElapsed = 0;
  private pvpAimSweepRound = 0;
  private pvpAimSweepCenterAngle = Math.PI / 2;
  private pvpLocalMarker: THREE.Group | null = null;
  private pvpProjectileMeshes = new Map<string, THREE.Mesh>();
  private pvpArenaRoot: THREE.Group | null = null;
  private pvpWantFire = false;
  private pvpWantDash = false;
  private pvpWantAbility = false;
  private pvpInputSendAccumulator = 0;
  private pvpMatchEndHandled = false;
  private lastPvpHitEventId = 0;
  private pendingPvpHitEvents: PvpHitEvent[] = [];
  private survivalElapsed = 0;
  private survivalSpawnTimer = 0;
  private survivalSurgeTimeLeft = 0;
  private survivalSurgeSpawnQueue = 0;
  private survivalSurgeSpawnTimer = 0;
  private survivalSurgeDirection = 0;
  private survivalNextSurgeAt = 90;
  private survivalSurgeSpawned = 0;
  private survivalSurgeTargetCount = 0;
  private survivalSurgeCenterX = 0;
  private survivalSurgeCenterZ = 0;
  private survivalSurgeCurrentRadius = 13.4;
  private survivalSurgeRing: THREE.Group | null = null;
  private survivalMiniBossSpawned = false;
  private survivalPhaseTwoAnnounced = false;
  private survivalAuditorAuraCooldown = 0;
  private survivalCleanupTimer = 4;
  private survivalUiTimer = 0;
  private survivalWave = 1;
  private survivalKills = 0;
  private survivalContract: SurvivalContractState = createSurvivalContract(1);
  private survivalShiftEvent: SurvivalShiftEventState = createSurvivalShiftEventState();
  private survivalGoldenPalletFound = false;
  private survivalMapId: SurvivalMapId = 'warehouse_b4';
  private lastSurvivalMapId: SurvivalMapId | null = null;
  private survivalSecretsFound = 0;
  private survivalBossesDefeated = 0;
  private survivalSecrets: { id: string; name: string; mesh: THREE.Group; age: number; collected: boolean }[] = [];
  private survivalMapLandmarks: THREE.Group | null = null;
  private survivalCeilingFixtures: THREE.Mesh[] = [];
  private survivalSightlineMarker: THREE.Mesh | null = null;
  private survivalPerfectDodges = 0;
  private survivalCounterattackReady = false;
  private campaignCounterattackReady = false;
  private survivalWaveStartKills = 0;
  private survivalLevel = 1;
  private survivalRankUpPending = false;
  private survivalXp = 0;
  private survivalXpToNext = 6;
  private survivalXpStreak: SurvivalXpStreakState = createSurvivalXpStreakState();
  private survivalBossWave = 0;
  private survivalBossWarningTimer = 0;
  private survivalPendingBossWave = 0;
  private survivalBossRewardPending = false;
  private survivalUpgradeStacks: Record<string, number> = {};
  private survivalEvolutions = new Set<string>();
  private survivalWeapons: SurvivalWeaponState[] = [];
  private survivalMomentum: SurvivalMomentumState = createSurvivalMomentumState();
  // Serializes ready weapon shots so a full cooldown queue never empties in one frame.
  private survivalWeaponDispatchCooldown = 0;
  private survivalWeaponDispatchCursor = 0;
  private survivalDamageMultiplier = 1;
  private survivalDamageStats: SurvivalDamageStats = createSurvivalDamageStats();
  private survivalAbilityCooldownMultiplier = 1;
  private survivalAbilityKillRechargeMultiplier = 1;
  private survivalAbilityKillRechargeCapRatio = 0.22;
  private survivalAttackRateMultiplier = 1;
  private survivalWeaponReloadMultiplier = 1;
  private survivalCriticalChance = 0.05;
  private survivalCriticalDamageMultiplier = 1.75;
  private survivalRicochetStrength = 1;
  private survivalRadiationStrength = 1;
  private survivalShrapnelStrength = 1;
  private survivalRadiationTimer = 1.4;
  private survivalDashCooldownMultiplier = 1;
  private survivalDashCooldownRemaining = 0;
  private survivalDashCooldownDuration = 5.2;
  private survivalDashDurationRemaining = 0;
  private survivalDashDirection = new THREE.Vector3(0, 0, 1);
  private survivalDashUiTimer = 0;
  private survivalDashLastProgress = -1;
  private survivalDashLastReady: boolean | null = null;
  private survivalMoveMultiplier = 1;
  private survivalMagnetMultiplier = 1;
  private survivalRangeMultiplier = 1;
  private survivalXpMultiplier = 1;
  private survivalDropMultiplier = 1;
  private survivalRegenMultiplier = 0;
  private survivalRegenTimer = 60;
  private survivalEventTimer = 36;
  private survivalHazardTimer = 24;
  private survivalHazardSequence = 0;
  private survivalDroneCooldown = 1.2;
  private survivalRerolls = 1;
  private survivalSkips = 1;
  private survivalAdRerollGranted = false;
  private survivalSecretSpawned = false;
  private survivalPomazaniecSpawned = false;
  private survivalPomazaniecTriggered = false;
  private survivalPomazaniecCompleted = false;
  private survivalPomazaniecMarker: THREE.Group | null = null;
  private survivalPomazaniecMarkerPulse = 0;
  private armorBlockCooldown = 0;
  private survivalPendingOptions: SurvivalUpgradeOption[] = [];
  private survivalXpGems: { mesh: THREE.Mesh; value: number; life: number; phase: number }[] = [];
  // Every XP pickup shares these GPU resources instead of allocating a geometry/material per kill.
  private readonly survivalXpGemGeometry = new THREE.OctahedronGeometry(0.20, 0);
  // Shared lightweight shield ring for temporary coalition support pulses.
  private readonly survivalShieldRingGeometry = new THREE.TorusGeometry(0.60, 0.045, 6, 20);
  private readonly survivalShieldRingMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78, depthWrite: false });
  private readonly survivalXpGemMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.28,
  });

  public getPacingFactor(): number {
    if (this.state !== 'playing' || this.levelStartTime <= 0) return 0.32;
    const elapsedSec = (performance.now() - this.levelStartTime) / 1000;
    // Positioning and readable attack windows matter more than frantic movement.
    return Math.min(0.46, 0.32 + (elapsedSec / 900) * 0.14);
  }
  public getUnlockedSector(): number { return this.maxUnlockedSector; }
  private unlockCampaignSector(sector: 2 | 3) {
    if (this.gameMode !== 'campaign' || sector <= this.maxUnlockedSector) return;
    this.maxUnlockedSector = sector;
    try { window.localStorage.setItem('maxFlizUnlockedSector', String(sector)); } catch { /* session-only unlock */ }
    const gate = this.sectorGates[sector];
    if (gate) gate.visible = false;
    const title = sector === 2 ? 'SEKTOR B ODBLOKOWANY' : 'SEKTOR C ODBLOKOWANY';
    const detail = sector === 2
      ? 'Inspektor pokonany. Brama do showroomu SPA jest otwarta.'
      : 'Dyrektor Widmo pokonany. Terminal VIP jest dostępny.';
    this.emitFloatingToast(title, this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, 'combo');
    this.callbacks.onPerkDropBanner?.(title, sector === 2 ? '🚪' : '🏁', detail, '#f59e0b');
  }

  private getScaledSurvivalWeaponReloadSeconds(weaponId: SurvivalWeaponId, level: number, evolved: boolean): number {
    return getSurvivalWeaponReloadSeconds(
      SURVIVAL_WEAPON_DEFS[weaponId].cooldown,
      level,
      evolved,
    ) * this.survivalWeaponReloadMultiplier;
  }

  private scaleSurvivalDamage(baseDamage: number): number {
    // Rounded integer damage avoids fractional HP while allowing damage upgrades
    // to cross a meaningful breakpoint for one-damage weapons after several stacks.
    return this.gameMode === 'survival'
      ? Math.max(1, Math.round(baseDamage * this.survivalDamageMultiplier * getSurvivalMomentumDamageMultiplier(this.survivalMomentum.overdriveRemainingSeconds)))
      : baseDamage;
  }

  public triggerBloomPulse(durationSec = 0.3) {
    const duration = THREE.MathUtils.clamp(durationSec, 0.08, 1.4);
    this.bloomPulseTimer = Math.max(this.bloomPulseTimer, duration);
    this.bloomPulseDuration = this.bloomPulseTimer;
  }

  private syncCameraZoomControl() {
    const slider = document.getElementById('cam-zoom-slider') as HTMLInputElement | null;
    if (slider) slider.value = this.camZoomFactor.toFixed(2);
  }

  public zoomInCamera() {
    this.hasManualCameraZoom = true;
    this.camZoomFactor = Math.max(0.4, this.camZoomFactor - 0.15);
    this.syncCameraZoomControl();
  }

  public zoomOutCamera() {
    this.hasManualCameraZoom = true;
    this.camZoomFactor = Math.min(2.2, this.camZoomFactor + 0.15);
    this.syncCameraZoomControl();
  }

  public setCamZoomFactor(val: number) {
    if (!Number.isFinite(val)) return;
    this.hasManualCameraZoom = true;
    this.camZoomFactor = THREE.MathUtils.clamp(val, 0.4, 2.2);
    this.syncCameraZoomControl();
  }

  public getCamZoomFactor(): number {
    return this.camZoomFactor;
  }

  public toggleCameraMode(): 'tpp' | 'close' | 'iso' {
    // Three distinct, predictable views: follow -> close -> tactical -> follow.
    if (this.cameraMode === 'tpp') {
      this.cameraMode = 'close';
    } else if (this.cameraMode === 'close') {
      this.cameraMode = 'iso';
    } else {
      this.cameraMode = 'tpp';
    }
    if (this.cameraMode === 'close') {
      this.camZoomFactor = Math.min(this.camZoomFactor, 0.96);
    }
    this.hasManualCameraZoom = true;
    this.syncCameraZoomControl();
    return this.cameraMode;
  }

  public setLevelVisible(visible: boolean) {
    this.levelRoot.visible = visible;
    if (this.targetRing) this.targetRing.visible = visible;
  }

  public triggerScreenShake(intensity: number, durationSec: number = 0.5) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeDuration = durationSec;
    this.screenShakeTimer = durationSec;
    this.cameraShake = Math.max(this.cameraShake, intensity * 0.6);
  }

  public triggerHitStop(durationSec = 0.04) {
    this.hitStopTimer = Math.max(this.hitStopTimer, durationSec);
  }
  private marcinReclamationTimer = 0;
  private grzesiekCrushTimer = 0;
  private grzesiekCrushPulse = 0;
  private mateuszPassiveCount = 0;
  private mateuszLagTimer = 0;

  // Active Perks & Jump Modifiers
  private activePerks: ActivePerks = {
    doubleJump: 0,
    shield: false,
    magnet: 0,
    speedBoost: 0,
    kfcBerserk: 0,
    bulldozer: 0,
  };
  private hasDoubleJumped = false;

  // 3D Player Meshes
  private playerGroup: THREE.Group | null = null;
  private leftLeg: THREE.Mesh | null = null;
  private rightLeg: THREE.Mesh | null = null;
  private leftArm: THREE.Mesh | null = null;
  private rightArm: THREE.Mesh | null = null;
  private playerHead: THREE.Mesh | null = null;
  private playerBody: THREE.Mesh | null = null;
  private playerAccessory: THREE.Group | null = null;
  private playerAccessoryRestX = 0;
  private playerAccessoryRestZ = 0;

  // Level geometry & entities
  private currentLevelId = 1;
  private levelRoot = new THREE.Group();
  private platforms: PlatformBlock[] = [];
  private survivalObstacles: { x: number; z: number; halfWidth: number; halfDepth: number }[] = [];
  private campaignEnemyObstacles: { x: number; z: number; halfWidth: number; halfDepth: number }[] = [];
  private collectibles: CollectibleItem[] = [];
  private droppedPerks: DroppedPerkItem[] = [];
  private hazards: HazardItem[] = [];
  private explosiveBarrels: {
    id: string;
    x: number;
    y: number;
    z: number;
    mesh: THREE.Group;
    fuseTimer: number;
    exploded: boolean;
  }[] = [];
  private enemies: EnemyItem[] = [];
  private readonly enemySpatialIndex = new EnemySpatialIndex<EnemyItem>(4.0);
  private enemyProjectiles: {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    isDyscyplinarka?: boolean;
    kind?: 'pomazaniec_lollipop' | 'sebix_brick';
    disposeOnRemove?: boolean;
    gravity?: number;
    spin?: number;
  }[] = [];
  private readonly survivalArenaInstances: THREE.InstancedMesh[] = [];
  private readonly survivalArenaInstanceGeometries = new Set<THREE.BufferGeometry>();
  private readonly survivalArenaInstanceMaterials = new Set<THREE.Material>();
  private readonly survivalArenaInstanceTextures = new Set<THREE.Texture>();
  private readonly survivalArenaLabelMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private particles: {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
    gravity?: number;
    baseScale?: number;
    rotVel?: THREE.Vector3;
  }[] = [];
  // One bounded pool owns all short-lived combat-fragment geometry/materials.
  private readonly particlePool = new ParticleMeshPool(75);
  private particlePoolDisposed = false;

  /** Release pooled GPU resources when this engine is permanently torn down. */
  public dispose(): void {
    if (this.particlePoolDisposed) return;
    this.particlePoolDisposed = true;
    this.clearLevel();
    this.particlePool.dispose();
  }

  private projectiles: {
    mesh: THREE.Object3D;
    vel: THREE.Vector3;
    life: number;
    maxLife?: number;
    damage?: number;
    pierce?: number;
    ricochet?: boolean;
    boomerang?: boolean;
    returning?: boolean;
    homing?: boolean;
    weaponProjectile?: boolean;
    disposeOnRemove?: boolean;
    aoeRadius?: number;
    stunDuration?: number;
    slowOnHit?: boolean;
    igniteOnHit?: boolean;
    collectItems?: boolean;
    spinSpeed?: number;
    hitIds?: Set<string>;
    orbiting?: boolean;
    orbitAngle?: number;
    orbitRadius?: number;
    orbitSpeed?: number;
    chainable?: boolean;
    bouncesRemaining?: number;
    chainMaxDistance?: number;
    chainDamageRetention?: number;
    chainDamageMultiplier?: number;
    criticalBurstState?: { consumed: boolean };
    weaponId?: SurvivalDamageWeaponId;
    damageSource?: SurvivalDamageSource;
    trailTimer?: number;
  }[] = [];
  private specialEffects: {
    mesh: THREE.Mesh | THREE.Group;
    life: number;
    maxLife: number;
    grow: number;
    spin: number;
    update?: (dt: number, progress: number) => void;
    cleanup?: () => void;
    disposeOnRemove?: boolean;
  }[] = [];
  private marcinTank: {
    group: THREE.Group;
    turret: THREE.Group;
    tracks: THREE.Mesh[];
    life: number;
    maxLife: number;
    cooldown: number;
    dustTimer: number;
  } | null = null;
  private mateuszCats: {
    group: THREE.Group;
    tail: THREE.Group;
    life: number;
    maxLife: number;
    attackCooldown: number;
    orbitAngle: number;
    pounceTimer: number;
    pounceTarget: THREE.Vector3 | null;
  }[] = [];
  private mafiCapybaras: {
    group: THREE.Group;
    life: number;
    maxLife: number;
    age: number;
    attackCooldown: number;
    pounceTimer: number;
    pounceTarget: THREE.Vector3 | null;
    index: number;
  }[] = [];
  private bimberMolotovs: {
    mesh: THREE.Group;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
    flameLight?: THREE.PointLight;
    flameMesh?: THREE.Mesh;
  }[] = [];
  private bimberFirePuddles: {
    group: THREE.Group;
    x: number;
    y: number;
    z: number;
    radius: number;
    duration: number;
    maxDuration: number;
    tickTimer: number;
    flames: THREE.Mesh[];
    light: THREE.PointLight;
  }[] = [];
  private fallingTiles: {
    id: string;
    x: number;
    y: number;
    z: number;
    targetY: number;
    fallSpeed: number;
    state: 'warning' | 'falling' | 'shattered';
    warningTimer: number;
    mesh: THREE.Group;
    warningRing: THREE.Mesh;
  }[] = [];
  private lootCrates: { mesh: THREE.Group; x: number; y: number; z: number }[] = [];
  private fallingTileSpawnTimer = 0;
  private randomSpawnTimer = 0;

  // Input state
  private keys: Record<string, boolean> = {};
  private virtualJoystick = { x: 0, y: 0 };
  // Separate PvP aim state: movement input must never snap the attack direction.
  private manualAimEnabled = false;
  private manualAimDirection: PvpAimDirection = { x: 0, z: 1 };
  private callbacks: GameCallbacks;

  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private ambientLight!: THREE.AmbientLight;
  private rimLight!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, container: HTMLElement, callbacks: GameCallbacks) {
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.callbacks = callbacks;
    this.charDef = CHARACTERS[this.currentCharacterId];
    this.maxHp = this.charDef.maxHp;
    this.hp = this.maxHp;

    this.camera.far = 160;
    this.scene.background = new THREE.Color(0x07131d);
    this.scene.add(this.levelRoot);

    // Enhanced Hero Tactical Ground Ring (Podwyższony wskaźnik taktyczny pod stopami)
    const ringGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.82, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.35, 24),
      new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;

    // Directional chevron indicator pointing in hero's facing orientation
    const chevronGeo = new THREE.ConeGeometry(0.18, 0.36, 3);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const chevron = new THREE.Mesh(chevronGeo, chevronMat);
    chevron.rotation.x = Math.PI / 2;
    chevron.rotation.z = Math.PI;
    chevron.position.set(0, 0.01, 0.92);
    chevron.name = 'chevron';

    ringGroup.add(outerRing, innerRing, chevron);
    this.targetRing = ringGroup as any;
    this.scene.add(this.targetRing);

    this.setupLighting();
    this.setupInput();
    // loadLevel(1) removed from constructor to prevent blocking main thread on boot
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xddeeff, 1.05);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.45);
    this.scene.add(this.hemiLight);

    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    this.dirLight = new THREE.DirectionalLight(0xffedd5, 3.65);
    this.dirLight.position.set(16, 26, 14);
    this.dirLight.castShadow = true;
    // Mobile shadow maps are refreshed at a controlled cadence while the
    // operator and warehouse light follow each other, avoiding a full shadow
    // render at the display's 60–120 Hz rate during dense Survival waves.
    this.dirLight.shadow.autoUpdate = !isMobile;

    // Sharp contact shadows matter for character readability. Keep mobile at
    // 1024² (Poco F6 class hardware) and reserve 2048² for desktop.
    const shadowMapSize = isMobile ? 1024 : 2048;
    this.dirLight.shadow.mapSize.width = shadowMapSize;
    this.dirLight.shadow.mapSize.height = shadowMapSize;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = isMobile ? 50 : 65;
    const d = isMobile ? 16 : 22;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.updateProjectionMatrix();
    this.dirLight.shadow.bias = isMobile ? -0.00045 : -0.00025;
    this.dirLight.shadow.normalBias = isMobile ? 0.035 : 0.025;
    this.dirLight.shadow.radius = isMobile ? 1 : 2;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 2.15);
    this.rimLight.position.set(-16, 10, -14);
    this.scene.add(this.rimLight);

    this.scene.fog = new THREE.Fog(0x091827, 34, 125);

    // Subtle camera-space vignette. This is intentionally not called DOF:
    // a real depth-of-field blur needs a depth-aware post-processing pass.
    // The vignette is restrained so it never darkens the operator or combat HUD.
    const dofMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 centered = (vUv - 0.5) * vec2(1.0, 0.86);
          float edge = smoothstep(0.38, 0.78, length(centered));
          vec3 vignetteColor = vec3(0.012, 0.026, 0.040);
          float alpha = edge * 0.075;
          gl_FragColor = vec4(vignetteColor, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.dofBlurMaterial = dofMat;

    const dofPlaneGeo = new THREE.PlaneGeometry(2, 2);
    const dofMesh = new THREE.Mesh(dofPlaneGeo, dofMat);
    dofMesh.frustumCulled = false;
    dofMesh.renderOrder = 998;
    this.dofBlurPassMesh = dofMesh;
    this.camera.add(dofMesh);
  }

  /** Adjusts the global fill/rim balance when the player enters a new map zone. */
  private applySectorLighting(sector: number) {
    const profiles = {
      1: { ambient: 0xdeefff, hemi: 0xb6e4ff, ground: 0x36475d, rim: 0x7dd3fc, fog: 0x15283a, ambientPower: 0.98, hemiPower: 1.40, rimPower: 1.25 },
      2: { ambient: 0xfff0de, hemi: 0xffe3bd, ground: 0x514638, rim: 0xffd08a, fog: 0x302a26, ambientPower: 0.98, hemiPower: 1.36, rimPower: 1.35 },
      3: { ambient: 0xddf5ff, hemi: 0xa2daef, ground: 0x314858, rim: 0x56d5e2, fog: 0x132e3a, ambientPower: 0.96, hemiPower: 1.38, rimPower: 1.40 },
      4: { ambient: 0xdcebff, hemi: 0xa6cffd, ground: 0x2b3b54, rim: 0x7db7ff, fog: 0x15253c, ambientPower: 0.94, hemiPower: 1.32, rimPower: 1.35 },
    } as const;
    const profile = profiles[sector as keyof typeof profiles] || profiles[1];
    this.ambientLight.color.setHex(profile.ambient);
    this.ambientLight.intensity = profile.ambientPower;
    this.hemiLight.color.setHex(profile.hemi);
    this.hemiLight.groundColor.setHex(profile.ground);
    this.hemiLight.intensity = profile.hemiPower;
    this.rimLight.color.setHex(profile.rim);
    this.rimLight.intensity = profile.rimPower;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.setHex(profile.fog);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        this.jumpBufferTimer = 0.16;
        e.preventDefault();
      }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.triggerAbility();
      }
      if (e.code === 'KeyQ') {
        this.triggerDash();
      }
      if (e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'KeyX' || e.code === 'Numpad0') {
        if (this.gameMode === 'pvp') {
          if (!e.repeat) this.triggerPvpFire();
        } else {
          this.triggerAttack();
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.togglePause();
      }
      if (e.code === 'KeyC' || e.code === 'KeyV') {
        this.toggleCameraMode();
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        this.zoomInCamera();
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        this.zoomOutCamera();
      }
      if (e.code === 'KeyT') {
        if (this.state === 'playing') {
          this.triggerTimedWarehouseEvent();
        }
      }
    });

    this.container?.addEventListener('wheel', (e: WheelEvent) => {
      if (this.state === 'playing') {
        e.preventDefault();
        if (e.deltaY > 0) {
          this.zoomOutCamera();
        } else {
          this.zoomInCamera();
        }
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') {
        if (this.playerVel.y > 2.0) {
          this.playerVel.y *= 0.52;
        }
      }
    });

    const canvasContainer = document.getElementById('game-canvas-container');
    canvasContainer?.addEventListener('pointerdown', (e) => {
      if (this.state === 'playing' && e.button === 0) {
        const target = e.target as HTMLElement | null;
        if (target && (target.closest('.hud-layer') || target.closest('.touch-layer') || target.closest('.game-modal') || target.closest('.game-screen'))) {
          return;
        }
        if (this.gameMode === 'pvp') {
          this.triggerPvpFire();
        } else {
          this.triggerAttack();
        }
      }
    });

    // PvP aiming is the same timed directional sweep on desktop and touch.
    // Mouse click fires; pointer movement does not override the sweep.

    window.addEventListener('blur', () => {
      this.keys = {};
      this.virtualJoystick = { x: 0, y: 0 };
    });
  }

  public setVirtualInput(x: number, y: number) {
    this.virtualJoystick.x = x;
    this.virtualJoystick.y = y;
  }

  /** Dedicated PvP twin-stick path. The existing PvE Survival auto-aim is unaffected while disabled. */
  public setManualAimMode(enabled: boolean) {
    this.manualAimEnabled = enabled;
    this.pvpWantFire = false;
    this.pvpAimSweepElapsed = 0;
    this.pvpAimSweepRound = 0;
    this.pvpAimSweepCenterAngle = Number.isFinite(this.playerRot) ? this.playerRot : Math.PI / 2;
    if (enabled) this.manualAimDirection = pvpAimDirectionFromAngle(this.playerRot);
    document.getElementById('game-shell')?.classList.toggle('manual-aim-mode', enabled);
  }

  public selectCharacter(
    id: CharacterId,
    masteryBonuses: CharacterCombatBonuses = NEUTRAL_CHARACTER_COMBAT_BONUSES,
  ) {
    this.currentCharacterId = id;
    this.charDef = CHARACTERS[id];
    this.characterMasteryBonuses = {
      attackMultiplier: Number.isFinite(masteryBonuses.attackMultiplier) ? THREE.MathUtils.clamp(masteryBonuses.attackMultiplier, 1, 1.08) : 1,
      damageTakenMultiplier: Number.isFinite(masteryBonuses.damageTakenMultiplier) ? THREE.MathUtils.clamp(masteryBonuses.damageTakenMultiplier, 0.90, 1) : 1,
      speedMultiplier: Number.isFinite(masteryBonuses.speedMultiplier) ? THREE.MathUtils.clamp(masteryBonuses.speedMultiplier, 1, 1.08) : 1,
      jumpMultiplier: Number.isFinite(masteryBonuses.jumpMultiplier) ? THREE.MathUtils.clamp(masteryBonuses.jumpMultiplier, 1, 1.08) : 1,
      abilityCooldownMultiplier: Number.isFinite(masteryBonuses.abilityCooldownMultiplier) ? THREE.MathUtils.clamp(masteryBonuses.abilityCooldownMultiplier, 0.90, 1) : 1,
    };
    this.maxHp = this.charDef.maxHp;
    this.hp = this.maxHp;
    this.characterDamageRemainder = 0;
    this.rebuildPlayerMesh();
    this.callbacks.onHpUpdate(this.hp, this.maxHp);
    this.sayRandomVoiceLine();
  }

  public getCharacterDef(): CharacterDef {
    return this.charDef;
  }

  public getCameraMode(): 'tpp' | 'close' | 'iso' {
    return this.cameraMode;
  }

  public isPaused(): boolean {
    return this.state === 'paused';
  }

  public setCamera(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public setScene(scene: THREE.Scene) {
    this.scene = scene;
    if (!this.scene.children.includes(this.levelRoot)) {
      this.scene.add(this.levelRoot);
    }
    this.applySceneTextureQuality();
  }

  /**
   * Apply device-appropriate anisotropic filtering once after a world is built.
   * This improves oblique floor, wall and sign texture clarity without raising
   * the drawing-buffer resolution or adding per-frame CPU work.
   */
  private applySceneTextureQuality() {
    if (!this.threeRenderer) return;
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const maxAnisotropy = this.threeRenderer.capabilities.getMaxAnisotropy();
    const targetAnisotropy = Math.max(1, Math.min(maxAnisotropy, isMobile ? 10 : 16));
    const textureSlots = [
      'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
      'emissiveMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
    ];
    this.levelRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const slot of textureSlots) {
          const texture = (material as any)[slot];
          if (texture instanceof THREE.Texture && texture.anisotropy < targetAnisotropy) {
            texture.anisotropy = targetAnisotropy;
            texture.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Dispose the previous procedural operator rig when the selection changes.
   * Character meshes own their geometries/materials (including the generated
   * tablet canvas texture); the outline shell shares those geometries, so Sets
   * ensure each GPU resource is released exactly once.
   */
  private disposeCharacterModel(root: THREE.Group): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

    const collectMaterial = (material: THREE.Material): void => {
      if (materials.has(material)) return;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
        else if (Array.isArray(value)) {
          for (const entry of value) {
            if (entry instanceof THREE.Texture) textures.add(entry);
          }
        }
      }
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          const value = uniform?.value;
          if (value instanceof THREE.Texture) textures.add(value);
          else if (Array.isArray(value)) {
            for (const entry of value) {
              if (entry instanceof THREE.Texture) textures.add(entry);
            }
          }
        }
      }
    };

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.geometry) geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of meshMaterials) collectMaterial(material);
    });

    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  private rebuildPlayerMesh() {
    if (this.playerGroup) {
      const previousPlayerGroup = this.playerGroup;
      this.levelRoot.remove(previousPlayerGroup);
      this.disposeCharacterModel(previousPlayerGroup);
      this.playerGroup = null;
      this.outlineMaterial = null;
    }
    const built = createCharacterModel(this.charDef);
    this.playerGroup = built.group;
    this.leftLeg = built.leftLeg;
    this.rightLeg = built.rightLeg;
    this.leftArm = built.leftArm;
    this.rightArm = built.rightArm;
    this.playerHead = built.head;
    this.playerBody = built.body;
    this.playerAccessory = built.accessory;
    this.playerAccessoryRestX = built.accessory.rotation.x;
    this.playerAccessoryRestZ = built.accessory.rotation.z;

    // STENCIL BUFFER OUTLINE SHADER FOR HIGH VISIBILITY
    // 1. Configure stencil writing on player primary geometry
    this.playerGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      // createCharacterModel returns a fresh, privately-owned material set for
      // each rig. Configure it in place instead of cloning every material.
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.stencilWrite = true;
        material.stencilRef = 1;
        material.stencilFunc = THREE.AlwaysStencilFunc;
        material.stencilZPass = THREE.ReplaceStencilOp;
      }
    });

    // 2. Create inverted normal stencil outline material & shell
    const outlineMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(this.charDef.color) },
        uOutlineThickness: { value: 0.038 },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uOutlineThickness;
        void main() {
          vec3 extruded = position + normal * uOutlineThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(extruded, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        void main() {
          float pulse = 0.82 + 0.18 * sin(uTime * 6.0);
          gl_FragColor = vec4(uColor * pulse, 0.95);
        }
      `,
      side: THREE.BackSide,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
      transparent: true,
      depthWrite: false,
    });
    this.outlineMaterial = outlineMat;

    const outlineShell = new THREE.Group();
    outlineShell.name = 'characterOutlineShell';
    this.playerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const oMesh = new THREE.Mesh(child.geometry, outlineMat);
        oMesh.position.copy(child.position);
        oMesh.rotation.copy(child.rotation);
        oMesh.scale.copy(child.scale);
        outlineShell.add(oMesh);
      }
    });
    this.playerGroup.add(outlineShell);

    this.playerGroup.position.copy(this.playerPos);
    this.levelRoot.add(this.playerGroup);
  }

  public startTitle() {
    sound.stopMusic();
    this.oniricDreamRemainingSeconds = 0;
    if (this.oniricDreamCameraActive) {
      this.oniricDreamCameraActive = false;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
    }
    this.clearOperatorCompanions();
    this.gameMode = 'survival';
    this.maxHp = this.charDef.maxHp;
    this.state = 'title';
    this.hp = this.maxHp;
    this.characterDamageRemainder = 0;
    this.score = 0;
    this.collectedVipCount = 0;
    this.resetAbilityCooldown();
    this.activePerks = {
      doubleJump: 0,
      shield: false,
      magnet: 0,
      speedBoost: 0,
    };
    this.marcinReclamationTimer = 0;
    this.grzesiekCrushTimer = 0;
    this.grzesiekCrushPulse = 0;
    this.callbacks.onPerksUpdate?.(this.activePerks);
    this.callbacks.onHpUpdate(this.hp, this.maxHp);
    this.callbacks.onSpeechBubble('');
    this.rebuildPlayerMesh();
    this.playerPos.set(0, 0.5, 0);
    this.bossHudRefreshCooldown = 0;
    this.lastBossHudSignature = '';
    this.callbacks.onBossUpdate?.('', 0, 0, false);
    this.setLevelVisible(true);
    
    // The title screen uses its own UI backdrop. Do not construct a hidden campaign world at boot.
  }

  private resetSurvivalRun() {
    this.gameMode = 'survival';
    this.state = 'playing';
    sound.startMusic();
    this.maxHp = this.charDef.maxHp;
    this.hp = this.maxHp;
    this.characterDamageRemainder = 0;
    this.gateNoticeCooldown = 0;
    this.score = 0;
    this.comboStreak = 0;
    this.collectedVipCount = 0;
    this.resetAbilityCooldown();
    this.levelStartTime = performance.now();
    this.activeElapsedSeconds = 0;
    this.waveDirectorCooldown = 0;
    this.activeChaserIds.clear();
    this.threatTier = 0;
    this.survivalElapsed = 0;
    this.survivalSpawnTimer = 0;
    this.survivalSurgeTimeLeft = 0;
    this.survivalSurgeSpawnQueue = 0;
    this.survivalSurgeSpawnTimer = 0;
    this.survivalSurgeDirection = 0;
    this.survivalNextSurgeAt = 90;
    this.survivalSurgeSpawned = 0;
    this.survivalSurgeTargetCount = 0;
    this.survivalMiniBossSpawned = false;
    this.survivalPhaseTwoAnnounced = false;
    this.survivalAuditorAuraCooldown = 0;
    this.survivalCleanupTimer = 4;
    this.survivalUiTimer = 0;
    this.survivalWave = 1;
    this.survivalKills = 0;
    this.survivalContract = createSurvivalContract(1);
    this.survivalShiftEvent = createSurvivalShiftEventState();
    this.survivalGoldenPalletFound = false;
    this.survivalSecretsFound = 0;
    this.survivalBossesDefeated = 0;
    this.survivalPerfectDodges = 0;
    this.survivalCounterattackReady = false;
    this.campaignCounterattackReady = false;
    this.survivalMomentum = createSurvivalMomentumState();
    this.survivalWaveStartKills = 0;
    this.survivalLevel = 1;
    this.survivalRankUpPending = false;
    this.survivalXp = 0;
    this.survivalXpToNext = getSurvivalXpRequirement(1);
    this.survivalXpStreak = createSurvivalXpStreakState();
    this.survivalBossWave = 0;
    this.survivalBossWarningTimer = 0;
    this.survivalPendingBossWave = 0;
    this.survivalBossRewardPending = false;
    this.survivalDamageMultiplier = 1;
    this.survivalDamageStats = createSurvivalDamageStats();
    this.survivalAbilityCooldownMultiplier = 1;
    this.survivalAbilityKillRechargeMultiplier = 1;
    this.survivalAbilityKillRechargeCapRatio = 0.22;
    this.survivalAttackRateMultiplier = 1;
    this.survivalWeaponReloadMultiplier = 1;
    this.survivalCriticalChance = 0.05;
    this.survivalCriticalDamageMultiplier = 1.75;
    this.survivalShrapnelStrength = 1;
    this.survivalDashCooldownMultiplier = 1;
    this.survivalDashCooldownRemaining = 0;
    this.survivalDashCooldownDuration = 5.2;
    this.survivalDashDurationRemaining = 0;
    this.survivalDashDirection.set(0, 0, 1);
    this.survivalDashUiTimer = 0;
    this.survivalDashLastProgress = -1;
    this.survivalDashLastReady = null;
    this.updateSurvivalDashCooldown(0, true);
    this.survivalMoveMultiplier = 1;
    this.survivalMagnetMultiplier = 1;
    this.survivalRangeMultiplier = 1;
    this.survivalXpMultiplier = 1;
    this.survivalDropMultiplier = 1;
    this.survivalRegenMultiplier = 0;
    this.survivalRegenTimer = 60;
    this.survivalEventTimer = 36;
    this.survivalHazardTimer = 24;
    this.survivalHazardSequence = 0;
    this.survivalDroneCooldown = 1.2;
    this.survivalRerolls = 1;
    this.survivalSkips = 1;
    this.survivalAdRerollGranted = false;
    this.survivalSecretSpawned = false;
    this.survivalPomazaniecSpawned = false;
    this.survivalPomazaniecTriggered = false;
    this.survivalPomazaniecCompleted = false;
    this.survivalPomazaniecMarkerPulse = 0;
    this.armorBlockCooldown = 0;
    this.survivalPendingOptions = [];
    this.survivalBossRewardPending = false;
    this.marcinReclamationTimer = 0;
    this.grzesiekCrushTimer = 0;
    this.grzesiekCrushPulse = 0;
    this.playerVel.set(0, 0, 0);
    this.screenShakeTimer = 0;
    this.screenShakeIntensity = 0;
    this.cameraShake = 0;
    if (this.container) {
      this.container.style.transform = '';
    }
    this.invulnerableTimer = 0;
    this.hitStopTimer = 0;
    this.virtualJoystick = { x: 0, y: 0 };
    this.keys = {};
    this.activePerks = {
      doubleJump: 0,
      shield: false,
      magnet: 0,
      speedBoost: 0,
      kfcBerserk: 0,
      bulldozer: 0,
      attackHaste: 0,
      arcDrone: 0,
      xpSurge: 0,
      damageWard: 0,
    };
    this.timedEventCooldown = 16.0;
    this.doublePointsTimer = 0;
    this.glueSlowTimer = 0;
    this.cementSlowTimer = 0;
    this.heroQuipTimer = 24 + Math.random() * 8;
    this.attackComboStep = 0;
    this.bulldozerHitCooldowns.clear();
    this.cameraMode = 'iso';
    this.hasManualCameraZoom = false;
    this.applyAutoCameraScaleForViewport();

    this.callbacks.onPerksUpdate?.(this.activePerks);
    this.callbacks.onSpeechBubble('');
    this.clearLevel();
    this.callbacks.onHpUpdate(this.hp, this.maxHp);
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
    this.sayRandomVoiceLine();
  }

  public startSurvival(mapOverride: SurvivalMapId | null = null) {
    // Reset shared combat state without constructing a campaign level, then build the dedicated Survival arena.
    this.resetSurvivalRun();
    this.oniricDreamRemainingSeconds = 0;
    this.oniricDreamCameraActive = false;
    this.camera.up.set(0, 1, 0);
    this.camera.updateProjectionMatrix();
    this.setManualAimMode(false);
    this.gameMode = 'survival';
    this.updateAbilityCooldown(0, true);
    this.rebuildPlayerMesh();
    this.sectorGates = [null, null, null, null];
    this.survivalMapId = mapOverride || chooseRandomSurvivalMap(this.lastSurvivalMapId, Math.random());
    this.lastSurvivalMapId = this.survivalMapId;
    const survivalMap = getSurvivalMapDefinition(this.survivalMapId);
    this.levelBounds = { minX: -58, maxX: 58, minZ: -18.2, maxZ: 18.2 };
    this.sectorGates.forEach((gate) => { if (gate) gate.visible = false; });
    this.scene.background = new THREE.Color(survivalMap.backgroundColor);
    if (this.isHandheldViewport && this.threeRenderer) {
      // Dynamic horde combat benefits more from a stable frame budget than
      // from soft shadow maps on a phone-sized render target.
      this.threeRenderer.shadowMap.enabled = false;
    }
    this.applySectorLighting(4);
    this.buildSurvivalArenaExpansion(this.survivalMapId);
    this.applySceneTextureQuality();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setHex(survivalMap.fogColor);
      this.scene.fog.near = 42;
      this.scene.fog.far = 112;
    }
    this.survivalUpgradeStacks = {};
    this.survivalEvolutions.clear();
    this.survivalWeapons = [];
    this.survivalWeaponDispatchCooldown = 0;
    this.survivalWeaponDispatchCursor = 0;
    this.survivalDamageMultiplier = 1;
    this.survivalRicochetStrength = 1;
    this.survivalRadiationStrength = 1;
    this.survivalShrapnelStrength = 1;
    this.survivalRadiationTimer = 1.4;
    this.survivalAttackRateMultiplier = 1;
    this.survivalWeaponReloadMultiplier = 1;
    this.survivalMoveMultiplier = 1;
    this.survivalMagnetMultiplier = 1;
    this.survivalRangeMultiplier = 1;
    this.survivalXpMultiplier = 1;
    this.survivalDropMultiplier = 1;
    this.survivalRegenMultiplier = 0;
    this.survivalRegenTimer = 60;
    this.survivalDroneCooldown = 1.2;
    this.survivalSpawnTimer = 2.8;
    this.survivalEventTimer = 24;
    this.survivalHazardTimer = 12;
    this.currentActiveSector = 1;
    this.currentLevelId = 1;
    this.playerPos.set(0, 0.5, 0);
    this.playerVel.set(0, 0, 0);
    if (this.playerGroup) this.playerGroup.position.copy(this.playerPos);
    this.smoothCamY = this.playerPos.y;
    this.currentLookAt.set(this.playerPos.x, this.playerPos.y + 0.85, this.playerPos.z);

    for (const enemy of this.enemies) this.disposeEnemyModel(enemy);
    this.enemies = [];
    for (const hazard of this.hazards) {
      if (hazard.mesh) this.levelRoot.remove(hazard.mesh);
      if (hazard.warningMesh) this.levelRoot.remove(hazard.warningMesh);
    }
    this.hazards = [];
    for (const barrel of this.explosiveBarrels) {
      if (barrel.mesh) this.levelRoot.remove(barrel.mesh);
    }
    this.explosiveBarrels = [];
    for (const tile of this.fallingTiles) {
      this.levelRoot.remove(tile.mesh);
      this.levelRoot.remove(tile.warningRing);
    }
    this.fallingTiles = [];
    this.fallingTileSpawnTimer = 0;
    this.randomSpawnTimer = 6;

    this.bossHudRefreshCooldown = 0;
    this.lastBossHudSignature = '';
    this.callbacks.onBossUpdate?.('', 0, 0, false);
    this.callbacks.onSurvivalDashUpdate?.(1, true, 0);
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    const mapModifier = survivalMap.combatModifier;
    this.callbacks.onSurvivalAnnouncement?.(
      mapModifier.title,
      mapModifier.subtitle,
      mapModifier.description,
    );
    this.emitFloatingToast('LOSOWA MAPA: ' + survivalMap.name.toUpperCase() + ' • ' + mapModifier.title, this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z, 'combo');
  }

  public startPvp(session: IPvpSession, localOperatorId: CharacterId, remoteOperatorId: CharacterId) {
    this.clearLevel();
    this.gameMode = 'pvp';
    this.pvpSession = session;
    this.pvpSlot = session.slot;
    this.lastPvpState = null;
    this.pvpInputSendAccumulator = 0;
    this.pvpMatchEndHandled = false;
    this.lastPvpHitEventId = 0;
    this.pendingPvpHitEvents = [];
    this.pvpWantFire = false;
    this.pvpWantDash = false;
    this.pvpWantAbility = false;
    this.setManualAimMode(true);
    this.state = 'playing';

    this.currentCharacterId = localOperatorId;
    this.charDef = CHARACTERS[localOperatorId];
    this.maxHp = PVP_NORMALIZED_HP;
    this.hp = PVP_NORMALIZED_HP;
    this.prevPvpLocalHp = PVP_NORMALIZED_HP;

    this.rebuildPlayerMesh();
    this.buildPvpArena();
    this.buildPvpLocalMarker();
    this.buildRemotePlayer(remoteOperatorId);

    const spawn = this.pvpSlot === 'p1' ? PVP_SPAWN_P1 : PVP_SPAWN_P2;
    this.playerPos.set(spawn.x, spawn.y, spawn.z);
    this.playerRot = spawn.rot;
    this.manualAimDirection = pvpAimDirectionFromAngle(spawn.rot);
    if (this.playerGroup) {
      this.playerGroup.position.copy(this.playerPos);
      this.playerGroup.rotation.y = this.playerRot;
    }

    this.cameraMode = 'iso';
    this.hasManualCameraZoom = false;
    this.camera.up.set(0, 1, 0);
    this.applyPvpCameraFraming(0, 0, 1 / 60, true);

    this.callbacks.onHpUpdate(this.hp, this.maxHp);
    this.callbacks.onAbilityCooldown(1, true, 0, false);
    this.callbacks.onSurvivalDashUpdate?.(1, true, 0);
  }

  public setLastPvpState(state: PvpArenaState) {
    this.lastPvpState = state;
    const incomingEvents = state.hitEvents?.length
      ? state.hitEvents
      : (state.lastHitEvent ? [state.lastHitEvent] : []);
    for (const event of incomingEvents) {
      if (event.id <= this.lastPvpHitEventId) continue;
      if (this.pendingPvpHitEvents.some((pending) => pending.id === event.id)) continue;
      this.pendingPvpHitEvents.push(event);
    }
    // A stalled tab must not retain an unbounded list of cosmetic events.
    if (this.pendingPvpHitEvents.length > 32) {
      this.pendingPvpHitEvents.splice(0, this.pendingPvpHitEvents.length - 32);
    }
  }

  public triggerPvpDash() {
    this.pvpWantDash = true;
  }

  public triggerPvpAbility() {
    this.pvpWantAbility = true;
  }

  /** Queue exactly one primary shot; the room simulation enforces weapon recovery. */
  public triggerPvpFire(): boolean {
    if (
      this.gameMode !== 'pvp' ||
      !this.manualAimEnabled ||
      this.state !== 'playing' ||
      this.lastPvpState?.status !== 'in_round'
    ) return false;
    const localPvpPlayer = this.pvpSlot === 'p1' ? this.lastPvpState.p1 : this.lastPvpState.p2;
    if (localPvpPlayer.attackCooldownTimer > 0.08) return false;
    this.pvpWantFire = true;
    return true;
  }

  public exitPvp() {
    if (this.remotePlayerOutline) {
      if (this.remotePlayerOutline.material) this.remotePlayerOutline.material.dispose();
      if (this.remotePlayerOutline.groundRingMat) this.remotePlayerOutline.groundRingMat.dispose();
      if (this.remotePlayerOutline.badgeTex) this.remotePlayerOutline.badgeTex.dispose();
      if (this.remotePlayerOutline.badgeMesh) {
        this.remotePlayerOutline.badgeMesh.geometry.dispose();
        (this.remotePlayerOutline.badgeMesh.material as THREE.Material).dispose();
      }
      this.remotePlayerOutline = null;
    }
    if (this.pvpArenaRoot) {
      this.levelRoot.remove(this.pvpArenaRoot);
      disposePvpObjectTree(this.pvpArenaRoot);
      this.pvpArenaRoot = null;
    }
    if (this.remotePlayerGroup) {
      this.levelRoot.remove(this.remotePlayerGroup);
      this.remotePlayerGroup = null;
    }
    if (this.pvpLocalMarker && this.playerGroup) {
      this.playerGroup.remove(this.pvpLocalMarker);
      disposePvpObjectTree(this.pvpLocalMarker);
    }
    this.pvpLocalMarker = null;
    this.pvpObstacleMeshes = [];
    this.pvpMedkitMesh = null;
    this.pvpPerkMesh = null;
    this.pvpPerkGem = null;
    this.pvpPerkLabel = null;
    this.pvpPerkLabelContext = null;
    this.pvpPerkLabelLastType = '';
    this.pvpPerkLastActive = false;
    // These renderables are children of pvpArenaRoot and were disposed with it.
    this.pvpAimGuide = null;
    this.pvpAimTarget = null;
    this.pvpAimArc = null;
    this.pvpAimSweepPointer = null;
    this.pvpAimSweepElapsed = 0;
    this.pvpAimSweepRound = 0;
    this.pvpAimSweepCenterAngle = Number.isFinite(this.playerRot) ? this.playerRot : Math.PI / 2;
    this.pvpProjectileMeshes.forEach((mesh) => {
      this.levelRoot.remove(mesh);
      disposePvpObjectTree(mesh);
    });
    this.pvpProjectileMeshes.clear();
    if (this.pvpSession) {
      this.pvpSession.dispose();
      this.pvpSession = null;
    }
    this.lastPvpState = null;
    this.pvpInputSendAccumulator = 0;
    this.pvpMatchEndHandled = false;
    this.lastPvpHitEventId = 0;
    this.pendingPvpHitEvents = [];
    this.pvpWantFire = false;
    this.pvpWantDash = false;
    this.pvpWantAbility = false;
    this.prevPvpLocalHp = -1;
    this.gameMode = 'survival';
    this.setManualAimMode(false);
  }

  private buildRemotePlayer(remoteOperatorId: CharacterId) {
    if (this.remotePlayerOutline) {
      if (this.remotePlayerOutline.material) this.remotePlayerOutline.material.dispose();
      if (this.remotePlayerOutline.groundRingMat) this.remotePlayerOutline.groundRingMat.dispose();
      if (this.remotePlayerOutline.badgeTex) this.remotePlayerOutline.badgeTex.dispose();
      if (this.remotePlayerOutline.badgeMesh) {
        this.remotePlayerOutline.badgeMesh.geometry.dispose();
        (this.remotePlayerOutline.badgeMesh.material as THREE.Material).dispose();
      }
      this.remotePlayerOutline = null;
    }
    if (this.remotePlayerGroup) {
      this.levelRoot.remove(this.remotePlayerGroup);
      this.remotePlayerGroup = null;
    }

    const def = CHARACTERS[remoteOperatorId] || CHARACTERS.grzesiek;
    this.remotePlayerDef = def;
    const built = createCharacterModel(def);
    this.remotePlayerMeshBuilt = built;
    this.remotePlayerGroup = built.group;

    const markerGeo = new THREE.ConeGeometry(0.24, 0.48, 4);
    markerGeo.rotateX(Math.PI);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 2.3, 0);
    this.remotePlayerGroup.add(marker);

    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, 2.7, 0);
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x111827, side: THREE.DoubleSide })
    );
    const fillGeo = new THREE.PlaneGeometry(1.16, 0.12);
    fillGeo.translate(0.58, 0, 0);
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    fill.position.set(-0.58, 0, 0.01);
    hpBarGroup.add(bg, fill);

    this.remotePlayerHpBar = { group: hpBarGroup, fill };
    this.remotePlayerGroup.add(hpBarGroup);

    const outlineGroup = new THREE.Group();
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.remotePlayerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child !== marker && child.parent !== hpBarGroup) {
        const cloneGeo = child.geometry.clone();
        const outlineMesh = new THREE.Mesh(cloneGeo, outlineMat);
        outlineMesh.position.copy(child.position);
        outlineMesh.rotation.copy(child.rotation);
        outlineMesh.scale.copy(child.scale).multiplyScalar(1.12);
        outlineGroup.add(outlineMesh);
      }
    });

    const groundRingGeo = new THREE.RingGeometry(0.65, 0.88, 32);
    groundRingGeo.rotateX(-Math.PI / 2);
    const groundRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const groundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
    groundRing.position.set(0, 0.04, 0);
    outlineGroup.add(groundRing);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(canvas);
    const badgeGeo = new THREE.PlaneGeometry(1.4, 0.35);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: badgeTex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0, 3.1, 0);
    this.remotePlayerGroup.add(badgeMesh);

    this.remotePlayerGroup.add(outlineGroup);

    this.remotePlayerOutline = {
      group: outlineGroup,
      material: outlineMat,
      groundRingMat,
      badgeMesh,
      badgeTex,
      canvas,
      ctx,
      lastStatusText: '',
    };

    const remoteSpawn = this.pvpSlot === 'p1' ? PVP_SPAWN_P2 : PVP_SPAWN_P1;
    this.remotePlayerGroup.position.set(remoteSpawn.x, remoteSpawn.y, remoteSpawn.z);
    this.remotePlayerGroup.rotation.y = remoteSpawn.rot;

    this.levelRoot.add(this.remotePlayerGroup);
  }


  private buildPvpLocalMarker() {
    if (!this.playerGroup) return;
    const color = this.pvpSlot === 'p1' ? 0x38bdf8 : 0xf59e0b;
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.08, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.44; ring.renderOrder = 12;
    const center = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    center.rotation.x = -Math.PI / 2; center.position.y = -0.43;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.48, 4), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.98 }));
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 3.15, 0); arrow.renderOrder = 30;
    marker.add(ring, center, arrow);
    marker.traverse((object) => { if (object instanceof THREE.Mesh) { object.frustumCulled = false; object.material.depthWrite = false; } });
    this.playerGroup.add(marker); this.pvpLocalMarker = marker;
  }

  private applyPvpCameraFraming(
    midX: number,
    midZ: number,
    dt = 1 / 60,
    immediate = false,
    duel?: { first: { x: number; z: number }; second: { x: number; z: number } },
  ) {
    const width = Math.max(1, window.visualViewport?.width || window.innerWidth);
    const height = Math.max(1, window.visualViewport?.height || window.innerHeight);
    const portrait = isPvpPortraitViewport(width, height);
    const trackingBounds = duel
      ? calculatePvpCameraTrackingBounds(duel.first, duel.second, PVP_ARENA_BOUNDS, portrait)
      : PVP_ARENA_BOUNDS;
    const frame = calculatePvpCameraFrame(width, height, { x: midX, z: midZ }, trackingBounds);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const aspectChanged = Math.abs(this.camera.aspect - frame.aspect) > 0.001;
      const fovChanged = Math.abs(this.camera.fov - frame.fov) > 0.05;
      if (aspectChanged || fovChanged) {
        this.camera.aspect = frame.aspect;
        this.camera.fov = frame.fov;
        // Aspect-only changes matter after fullscreen and orientation switches too.
        this.camera.updateProjectionMatrix();
      }
    }
    this.pvpCameraDesiredPosition.set(frame.position.x, frame.position.y, frame.position.z);
    this.pvpCameraDesiredTarget.set(frame.target.x, frame.target.y, frame.target.z);
    const safeDt = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.1) : 1 / 60;
    const alpha = immediate ? 1 : 1 - Math.exp(-6.2 * safeDt);
    this.camera.position.lerp(this.pvpCameraDesiredPosition, alpha);
    this.currentLookAt.lerp(this.pvpCameraDesiredTarget, alpha);
    this.camera.lookAt(this.currentLookAt);
  }

  private buildPvpArena() {
    if (this.pvpArenaRoot) {
      this.levelRoot.remove(this.pvpArenaRoot);
      disposePvpObjectTree(this.pvpArenaRoot);
      this.pvpArenaRoot = null;
    }

    this.pvpArenaRoot = new THREE.Group();
    this.pvpObstacleMeshes = [];
    this.pvpProjectileMeshes.forEach((mesh) => {
      this.levelRoot.remove(mesh);
      disposePvpObjectTree(mesh);
    });
    this.pvpProjectileMeshes.clear();

    const bounds = PVP_ARENA_BOUNDS;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;

    const floorGeo = new THREE.BoxGeometry(width + 4, 1.0, depth + 4);
    const floorTexture = createPvpFloorTexture();
    floorTexture.repeat.set(5, 3);
    floorTexture.needsUpdate = true;
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTexture,
      roughness: 0.82,
      metalness: 0.12,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.5, 0);
    floor.receiveShadow = true;
    this.pvpArenaRoot.add(floor);

    const borderMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const borderThickness = 0.35;
    const bTop = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, borderThickness), borderMat);
    bTop.position.set(0, 0.02, bounds.minZ);
    const bBottom = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, borderThickness), borderMat);
    bBottom.position.set(0, 0.02, bounds.maxZ);
    const bLeft = new THREE.Mesh(new THREE.BoxGeometry(borderThickness, 0.05, depth), borderMat);
    bLeft.position.set(bounds.minX, 0.02, 0);
    const bRight = new THREE.Mesh(new THREE.BoxGeometry(borderThickness, 0.05, depth), borderMat);
    bRight.position.set(bounds.maxX, 0.02, 0);

    const centerLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.05, depth * 0.85),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
    );
    centerLine.position.set(0, 0.02, 0);

    this.pvpArenaRoot.add(bTop, bBottom, bLeft, bRight, centerLine);
    const laneMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.18, depthWrite: false });
    for (let x = -18; x <= 18; x += 6) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.018, depth - 2.2), laneMat);
      lane.position.set(x, 0.025, 0); this.pvpArenaRoot.add(lane);
    }
    for (let z = -9; z <= 9; z += 3) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(width - 2.2, 0.018, 0.055), laneMat);
      lane.position.set(0, 0.026, z); this.pvpArenaRoot.add(lane);
    }

    const ringGeo = new THREE.RingGeometry(1.6, 1.9, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const p1Ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide }));
    p1Ring.position.set(PVP_SPAWN_P1.x, 0.03, PVP_SPAWN_P1.z);
    const p2Ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide }));
    p2Ring.position.set(PVP_SPAWN_P2.x, 0.03, PVP_SPAWN_P2.z);
    this.pvpArenaRoot.add(p1Ring, p2Ring);

    const wallTexture = createPvpObstacleTexture('wall');
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallTexture, roughness: 0.72, metalness: 0.22 });
    const wN = new THREE.Mesh(new THREE.BoxGeometry(width + 4, 3.2, 1.2), wallMat);
    wN.position.set(0, 1.6, bounds.minZ - 1.2);
    const wS = new THREE.Mesh(new THREE.BoxGeometry(width + 4, 3.2, 1.2), wallMat);
    wS.position.set(0, 1.6, bounds.maxZ + 1.2);
    const wW = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, depth + 4), wallMat);
    wW.position.set(bounds.minX - 1.2, 1.6, 0);
    const wE = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, depth + 4), wallMat);
    wE.position.set(bounds.maxX + 1.2, 1.6, 0);
    this.pvpArenaRoot.add(wN, wS, wW, wE);

    const obstacles = createDefaultPvpObstacles();
    const palletMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: createPvpObstacleTexture('crate'), roughness: 0.82, metalness: 0.08,
    });
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: createPvpObstacleTexture('barrier'), roughness: 0.68, metalness: 0.28,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: wallTexture, roughness: 0.58, metalness: 0.38,
    });
    const palletBandMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const barrierStripeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    for (const obs of obstacles) {
      const group = new THREE.Group();
      group.position.set(obs.x, 0, obs.z);

      // Fine floor outline shows the actual cover footprint clearly on mobile.
      const footprintColor = obs.type === 'barrier' ? 0xf87171 : obs.type === 'pillar' ? 0x67e8f9 : 0xfacc15;
      group.add(createArenaObstacleFootprint(obs.width, obs.depth, footprintColor));

      if (obs.type === 'pallet') {
        const stackMesh = new THREE.Mesh(new THREE.BoxGeometry(obs.width, obs.height, obs.depth), palletMat);
        stackMesh.position.y = obs.height / 2;
        stackMesh.castShadow = true;
        group.add(stackMesh);

        const band = new THREE.Mesh(new THREE.BoxGeometry(obs.width + 0.04, 0.3, obs.depth + 0.04), palletBandMat);
        band.position.y = obs.height - 0.2;
        group.add(band);
      } else if (obs.type === 'barrier') {
        const barMesh = new THREE.Mesh(new THREE.BoxGeometry(obs.width, obs.height, obs.depth), barrierMat);
        barMesh.position.y = obs.height / 2;
        barMesh.castShadow = true;
        group.add(barMesh);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(obs.width + 0.05, 0.25, obs.depth * 0.7), barrierStripeMat);
        stripe.position.y = obs.height * 0.6;
        group.add(stripe);
      } else {
        const pilMesh = new THREE.Mesh(new THREE.BoxGeometry(obs.width, obs.height, obs.depth), pillarMat);
        pilMesh.position.y = obs.height / 2;
        pilMesh.castShadow = true;
        group.add(pilMesh);

        const light = new THREE.PointLight(0x38bdf8, 5, 8);
        light.position.set(0, obs.height - 0.5, 0);
        group.add(light);
      }

      this.pvpArenaRoot.add(group);
      this.pvpObstacleMeshes.push(group);
    }

    const medGroup = new THREE.Group();
    medGroup.position.set(0, 0, 0);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0x064e3b }));
    pad.position.y = 0.08;
    medGroup.add(pad);

    const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.y = 0.8;

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.82), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
    crossH.position.y = 0.8;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.82), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
    crossV.position.y = 0.8;

    const medBeacon = new THREE.PointLight(0x10b981, 6, 6);
    medBeacon.position.set(0, 1.2, 0);

    medGroup.add(crate, crossH, crossV, medBeacon);
    this.pvpMedkitMesh = medGroup;
    this.pvpArenaRoot.add(medGroup);

    const perkGroup = new THREE.Group();
    const perkBase = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.075, 8, 28), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.92, depthWrite: false }));
    perkBase.rotation.x = -Math.PI / 2; perkBase.position.y = 0.08;
    const perkGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x6b3f00, emissiveIntensity: 0.9, metalness: 0.25, roughness: 0.25 }));
    perkGem.position.y = 1.0;
    const perkBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.12, 1.9, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    perkBeacon.position.y = 1.55;
    const perkLight = new THREE.PointLight(0xfacc15, 4, 7); perkLight.position.y = 1.3;
    const labelCanvas = document.createElement('canvas'); labelCanvas.width = 320; labelCanvas.height = 72;
    this.pvpPerkLabelContext = labelCanvas.getContext('2d');
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false }));
    labelSprite.position.y = 2.45; labelSprite.scale.set(2.8, 0.63, 1); labelSprite.renderOrder = 8;
    perkGroup.add(perkBase, perkGem, perkBeacon, perkLight, labelSprite); perkGroup.visible = false;
    this.pvpPerkMesh = perkGroup; this.pvpPerkGem = perkGem; this.pvpPerkLabel = labelSprite; this.pvpArenaRoot.add(perkGroup);
    const aimGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.055, 7.5)]);
    const aimColor = this.pvpSlot === 'p1' ? 0x60a5fa : 0xfbbf24;
    this.pvpAimGuide = new THREE.Line(aimGeometry, new THREE.LineBasicMaterial({ color: aimColor, transparent: true, opacity: 0.82, depthWrite: false }));
    this.pvpAimGuide.renderOrder = 6; this.pvpArenaRoot.add(this.pvpAimGuide);
    const aimRingGeo = new THREE.RingGeometry(0.42, 0.57, 24); aimRingGeo.rotateX(-Math.PI / 2);
    this.pvpAimTarget = new THREE.Mesh(aimRingGeo, new THREE.MeshBasicMaterial({ color: aimColor, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false }));
    this.pvpAimTarget.position.y = 0.055; this.pvpAimTarget.renderOrder = 7; this.pvpArenaRoot.add(this.pvpAimTarget);

    // A floor arc beside the operator makes the timing window readable.
    const sweepArcGeometry = new THREE.BufferGeometry();
    sweepArcGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((PVP_AIM_SWEEP_SEGMENTS + 1) * 3), 3),
    );
    this.pvpAimArc = new THREE.Line(
      sweepArcGeometry,
      new THREE.LineBasicMaterial({
        color: aimColor, transparent: true, opacity: 0.62, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    this.pvpAimArc.renderOrder = 5;
    this.pvpArenaRoot.add(this.pvpAimArc);

    const sweepPointerGeometry = new THREE.ConeGeometry(0.19, 0.72, 6);
    sweepPointerGeometry.rotateX(Math.PI / 2);
    this.pvpAimSweepPointer = new THREE.Mesh(
      sweepPointerGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xffe7a3, transparent: true, opacity: 0.98, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    this.pvpAimSweepPointer.renderOrder = 8;
    this.pvpArenaRoot.add(this.pvpAimSweepPointer);

    this.levelRoot.add(this.pvpArenaRoot);
  }

  private pulsePvpFeedback(elementId: 'pvp-hit-vignette' | 'pvp-hit-confirm') {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.classList.remove('active');
    // Restart a short CSS animation even when hits arrive in consecutive frames.
    void (element as HTMLElement).offsetWidth;
    element.classList.add('active');
    element.addEventListener('animationend', () => element.classList.remove('active'), { once: true });
  }

  private updatePvpMode(dt: number) {
    if (!this.pvpSession) return;

    let screenX = 0;
    let screenY = 0;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) screenX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) screenX -= 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) screenY += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) screenY -= 1;

    if (Math.abs(this.virtualJoystick.x) > 0.08 || Math.abs(this.virtualJoystick.y) > 0.08) {
      screenX = this.virtualJoystick.x;
      screenY = -this.virtualJoystick.y;
    }

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const portrait = isPvpPortraitViewport(viewportWidth, viewportHeight);
    const worldMovement = pvpScreenMovementToWorld(screenX, screenY, portrait);
    const moveX = worldMovement.x;
    const moveZ = worldMovement.z;

    const currentState = this.lastPvpState;
    if (currentState && this.manualAimEnabled) {
      const localForAim = this.pvpSlot === 'p1' ? currentState.p1 : currentState.p2;
      const remoteForAim = this.pvpSlot === 'p1' ? currentState.p2 : currentState.p1;
      if (currentState.round !== this.pvpAimSweepRound) {
        this.pvpAimSweepRound = currentState.round;
        this.pvpAimSweepElapsed = 0;
        // The round spawn establishes the first facing direction. From then on
        // players turn the sweep by choosing a movement direction, not by
        // having the cursor chase the rival's position.
        this.pvpAimSweepCenterAngle = Number.isFinite(localForAim.rot)
          ? localForAim.rot
          : this.pvpAimSweepCenterAngle;
      }
      if (currentState.status === 'in_round' && localForAim.hp > 0 && remoteForAim.hp > 0) {
        this.pvpAimSweepCenterAngle = getPvpAimSweepCenterAngle(
          moveX, moveZ, this.pvpAimSweepCenterAngle,
        );
        this.pvpAimSweepElapsed += Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
        this.manualAimDirection = pvpAimDirectionFromAngle(getPvpSweepAimAngle(
          this.pvpAimSweepElapsed, this.pvpAimSweepCenterAngle,
          PVP_AIM_SWEEP_HALF_ARC, PVP_AIM_SWEEP_PERIOD_SECONDS,
        ));
      }
    }

    // The authoritative room simulates at 30 Hz. Throttle inputs to the same cadence
    // instead of flooding the socket at the device's render rate (60–120 Hz).
    this.pvpInputSendAccumulator += Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    const inputInterval = 1 / 30;
    if (this.pvpInputSendAccumulator >= inputInterval) {
      this.pvpInputSendAccumulator %= inputInterval;
      this.pvpSession.sendInput({
        moveX,
        moveZ,
        aimAngle: getPvpAimAngle(this.manualAimDirection),
        isFiring: false,
        wantFire: this.pvpWantFire,
        wantDash: this.pvpWantDash,
        wantAbility: this.pvpWantAbility,
      });
      this.pvpWantFire = false;
      this.pvpWantDash = false;
      this.pvpWantAbility = false;
    }

    if (!currentState) return;

    const state = currentState;
    const local = this.pvpSlot === 'p1' ? state.p1 : state.p2;
    const remote = this.pvpSlot === 'p1' ? state.p2 : state.p1;

    this.playerPos.x = THREE.MathUtils.lerp(this.playerPos.x, local.x, Math.min(1, dt * 18));
    this.playerPos.z = THREE.MathUtils.lerp(this.playerPos.z, local.z, Math.min(1, dt * 18));
    this.playerPos.y = local.y;
    this.playerRot = local.rot;

    if (this.playerGroup) {
      this.playerGroup.position.copy(this.playerPos);
      this.playerGroup.rotation.y = this.playerRot;

      const isMoving = Math.hypot(moveX, moveZ) > 0.1 || local.isDashing;
      if (isMoving && this.leftLeg && this.rightLeg) {
        const cycle = (performance.now() / 150) % (Math.PI * 2);
        this.leftLeg.rotation.x = Math.sin(cycle) * 0.45;
        this.rightLeg.rotation.x = -Math.sin(cycle) * 0.45;
      } else if (this.leftLeg && this.rightLeg) {
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
      }
    }

    this.hp = local.hp;
    this.maxHp = local.maxHp;
    this.callbacks.onHpUpdate(this.hp, this.maxHp);

    const abilityCdProgress = local.abilityCooldownTimer <= 0 ? 1 : 1 - (local.abilityCooldownTimer / 9.0);
    this.callbacks.onAbilityCooldown(
      abilityCdProgress,
      local.abilityCooldownTimer <= 0,
      Math.ceil(local.abilityCooldownTimer),
      false
    );

    const dashCdProgress = local.dashCooldownTimer <= 0 ? 1 : 1 - (local.dashCooldownTimer / PVP_DASH_COOLDOWN);
    this.callbacks.onSurvivalDashUpdate?.(
      dashCdProgress,
      local.dashCooldownTimer <= 0,
      Math.ceil(local.dashCooldownTimer)
    );

    if (this.remotePlayerGroup) {
      this.remotePlayerGroup.position.x = THREE.MathUtils.lerp(this.remotePlayerGroup.position.x, remote.x, Math.min(1, dt * 18));
      this.remotePlayerGroup.position.z = THREE.MathUtils.lerp(this.remotePlayerGroup.position.z, remote.z, Math.min(1, dt * 18));
      this.remotePlayerGroup.position.y = remote.y;
      this.remotePlayerGroup.rotation.y = remote.rot;

      if (this.remotePlayerHpBar) {
        const hpPct = Math.max(0, Math.min(1, remote.hp / remote.maxHp));
        this.remotePlayerHpBar.fill.scale.x = hpPct;
        this.remotePlayerHpBar.group.lookAt(this.camera.position);
      }

      if (this.remotePlayerOutline) {
        const isReady = remote.abilityCooldownTimer <= 0;
        const targetColor = isReady ? 0xfacc15 : 0xef4444;
        const pulse = isReady ? (0.75 + 0.25 * Math.sin(performance.now() * 0.008)) : 0.85;

        this.remotePlayerOutline.material.color.setHex(targetColor);
        this.remotePlayerOutline.material.opacity = pulse;
        this.remotePlayerOutline.groundRingMat.color.setHex(targetColor);
        this.remotePlayerOutline.groundRingMat.opacity = isReady ? pulse * 0.8 : 0.5;

        this.remotePlayerOutline.badgeMesh.lookAt(this.camera.position);

        const statusText = isReady
          ? '⚡ MOC GOTOWA!'
          : `⚡ MOC: ${Math.ceil(remote.abilityCooldownTimer)}s`;

        if (statusText !== this.remotePlayerOutline.lastStatusText && this.remotePlayerOutline.ctx) {
          this.remotePlayerOutline.lastStatusText = statusText;
          const ctx = this.remotePlayerOutline.ctx;
          ctx.clearRect(0, 0, 256, 64);

          ctx.fillStyle = isReady ? 'rgba(234, 179, 8, 0.88)' : 'rgba(239, 68, 68, 0.78)';
          ctx.beginPath();
          ctx.roundRect(8, 8, 240, 48, 12);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(statusText, 128, 32);

          this.remotePlayerOutline.badgeTex.needsUpdate = true;
        }
      }

      if (this.remotePlayerMeshBuilt?.leftLeg && this.remotePlayerMeshBuilt?.rightLeg) {
        if (remote.isFiring || Math.hypot(remote.x - this.remotePlayerGroup.position.x, remote.z - this.remotePlayerGroup.position.z) > 0.05) {
          const cycle = (performance.now() / 150) % (Math.PI * 2);
          this.remotePlayerMeshBuilt.leftLeg.rotation.x = Math.sin(cycle) * 0.45;
          this.remotePlayerMeshBuilt.rightLeg.rotation.x = -Math.sin(cycle) * 0.45;
        } else {
          this.remotePlayerMeshBuilt.leftLeg.rotation.x = 0;
          this.remotePlayerMeshBuilt.rightLeg.rotation.x = 0;
        }
      }
    }

    if (this.pvpAimGuide && this.pvpAimTarget) {
      const preview = calculatePvpAimPreview(
        { x: local.x, z: local.z },
        pvpAimDirectionFromAngle(local.rot),
        PVP_ARENA_BOUNDS,
        state.obstacles,
        { x: remote.x, z: remote.z },
      );
      const start = new THREE.Vector3(local.x, 0.055, local.z);
      const end = new THREE.Vector3(preview.x, 0.055, preview.z);
      const aimPositions = this.pvpAimGuide.geometry.getAttribute('position') as THREE.BufferAttribute;
      aimPositions.setXYZ(0, start.x, start.y, start.z);
      aimPositions.setXYZ(1, end.x, end.y, end.z);
      aimPositions.needsUpdate = true;
      this.pvpAimGuide.geometry.computeBoundingSphere();

      // Feedback only: direction remains fully controlled by the player.
      const previewColor = preview.onTarget ? 0x4ade80 : preview.blocked ? 0xef4444
        : (this.pvpSlot === 'p1' ? 0x60a5fa : 0xfbbf24);
      const guideMaterial = this.pvpAimGuide.material as THREE.LineBasicMaterial;
      const targetMaterial = this.pvpAimTarget.material as THREE.MeshBasicMaterial;
      guideMaterial.color.setHex(previewColor);
      targetMaterial.color.setHex(previewColor);
      guideMaterial.opacity = preview.blocked ? 0.96 : 0.78;
      targetMaterial.opacity = preview.blocked ? 0.98 : 0.88;
      this.pvpAimTarget.scale.setScalar(preview.onTarget ? 1.16 : 1);
      this.pvpAimTarget.position.set(end.x, 0.055, end.z);
      this.pvpAimGuide.visible = state.status === 'in_round';
      this.pvpAimTarget.visible = state.status === 'in_round';
    }

    if (this.pvpAimArc && this.pvpAimSweepPointer) {
      const opponentBearing = Math.atan2(remote.x - local.x, remote.z - local.z);
      const arcPositions = this.pvpAimArc.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arcSegments = arcPositions.count - 1;
      for (let segment = 0; segment <= arcSegments; segment++) {
        const progress = arcSegments > 0 ? segment / arcSegments : 0;
        const angle = this.pvpAimSweepCenterAngle - PVP_AIM_SWEEP_HALF_ARC + PVP_AIM_SWEEP_HALF_ARC * 2 * progress;
        arcPositions.setXYZ(segment,
          local.x + Math.sin(angle) * PVP_AIM_SWEEP_RADIUS,
          0.105,
          local.z + Math.cos(angle) * PVP_AIM_SWEEP_RADIUS,
        );
      }
      arcPositions.needsUpdate = true;
      this.pvpAimArc.geometry.computeBoundingSphere();

      const pointerDirection = pvpAimDirectionFromAngle(local.rot);
      this.pvpAimSweepPointer.position.set(
        local.x + pointerDirection.x * PVP_AIM_SWEEP_RADIUS,
        0.18,
        local.z + pointerDirection.z * PVP_AIM_SWEEP_RADIUS,
      );
      this.pvpAimSweepPointer.rotation.y = local.rot;

      const arcMaterial = this.pvpAimArc.material as THREE.LineBasicMaterial;
      const pointerMaterial = this.pvpAimSweepPointer.material as THREE.MeshBasicMaterial;
      const delta = Math.atan2(Math.sin(local.rot - opponentBearing), Math.cos(local.rot - opponentBearing));
      const guideMaterial = this.pvpAimGuide?.material as THREE.LineBasicMaterial | undefined;
      const blocked = guideMaterial?.color.getHex() === 0xef4444;
      const aligned = Math.abs(delta) <= 9 * Math.PI / 180;
      arcMaterial.color.setHex(this.pvpSlot === 'p1' ? 0x60a5fa : 0xfbbf24);
      pointerMaterial.color.setHex(blocked ? 0xef4444 : aligned ? 0x4ade80 : 0xffe7a3);
      const roundActive = state.status === 'in_round';
      this.pvpAimArc.visible = roundActive;
      this.pvpAimSweepPointer.visible = roundActive;
    }

    const activeIds = new Set<string>();
    for (const proj of state.projectiles) {
      activeIds.add(proj.id);
      let mesh = this.pvpProjectileMeshes.get(proj.id);
      if (!mesh) {
        const geo = new THREE.SphereGeometry(proj.radius, 14, 12);
        const mat = new THREE.MeshBasicMaterial({ color: proj.color, toneMapped: false });
        mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 4;

        // A tapered, color-matched streak makes incoming fire readable on
        // small phone screens without requiring expensive particle emitters.
        const speed = Math.hypot(proj.vx, proj.vz);
        const trailLength = THREE.MathUtils.clamp(speed * 0.035, 0.5, 1.15);
        const trailGeo = new THREE.CylinderGeometry(0.018, 0.075, trailLength, 7, 1, true);
        const trailMat = new THREE.MeshBasicMaterial({
          color: proj.color,
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -trailLength * 0.42;
        trail.renderOrder = 3;
        mesh.add(trail);

        this.levelRoot.add(mesh);
        this.pvpProjectileMeshes.set(proj.id, mesh);
      }
      mesh.position.set(proj.x, proj.y, proj.z);
      mesh.rotation.y = Math.atan2(proj.vx, proj.vz);
    }

    for (const [id, mesh] of this.pvpProjectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.levelRoot.remove(mesh);
        mesh.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        });
        this.pvpProjectileMeshes.delete(id);
      }
    }

    if (this.pvpPerkMesh) {
      const perk = state.perkDrop;
      if (this.pvpPerkMesh.visible && !perk.active && this.pvpPerkLastActive) { this.spawnParticleRing(perk.x, 0.5, perk.z, 0xfacc15); sound.playPickup(); }
      this.pvpPerkLastActive = perk.active;
      this.pvpPerkMesh.visible = perk.active;
      if (perk.active) {
        this.pvpPerkMesh.position.set(perk.x, 0, perk.z); this.pvpPerkMesh.rotation.y += dt * 1.45;
        const colors: Record<string, number> = { power: 0xef4444, sprint: 0x38bdf8, shield: 0x22c55e, rapid: 0xa78bfa };
        const color = colors[perk.type] || 0xfacc15;
        if (this.pvpPerkLabelContext && this.pvpPerkLabel && this.pvpPerkLabelLastType !== perk.type) {
          const ctx = this.pvpPerkLabelContext;
          ctx.clearRect(0, 0, 320, 72);
          ctx.fillStyle = 'rgba(2, 8, 20, 0.92)';
          ctx.beginPath(); ctx.roundRect(5, 5, 310, 62, 18); ctx.fill();
          ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0'); ctx.lineWidth = 4; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.font = '900 28px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const labels: Record<string, string> = { power: 'MOC +22%', sprint: 'SPRINT +18%', shield: 'TARCZA +165', rapid: 'RAPID -22%' };
          ctx.fillText(labels[perk.type] || 'LOSOWY PERK', 160, 37);
          const spriteMaterial = this.pvpPerkLabel.material as THREE.SpriteMaterial;
          if (spriteMaterial.map) spriteMaterial.map.needsUpdate = true;
          this.pvpPerkLabelLastType = perk.type;
        }
        if (this.pvpPerkGem?.material instanceof THREE.MeshStandardMaterial) { this.pvpPerkGem.material.color.setHex(color); this.pvpPerkGem.material.emissive.setHex(color); }
        const beacon = this.pvpPerkMesh.children[2] as THREE.Mesh | undefined;
        if (beacon?.material instanceof THREE.MeshBasicMaterial) beacon.material.color.setHex(color);
        const base = this.pvpPerkMesh.children[0] as THREE.Mesh | undefined;
        if (base?.material instanceof THREE.MeshBasicMaterial) base.material.color.setHex(color);
        if (this.pvpPerkGem) this.pvpPerkGem.position.y = 0.94 + Math.sin(performance.now() * 0.003) * 0.13;
      }
    }
    if (this.pvpMedkitMesh) {
      if (this.pvpMedkitMesh.visible && !state.pickup.active) {
        sound.playPickup();
        this.spawnParticleRing(state.pickup.x, 0.5, state.pickup.z, 0x10b981);
      }
      this.pvpMedkitMesh.visible = state.pickup.active;
      this.pvpMedkitMesh.rotation.y += dt * 1.8;
    }

    if (this.prevPvpLocalHp >= 0 && local.hp < this.prevPvpLocalHp) {
      this.triggerScreenShake(0.12, 0.16);
    }
    this.prevPvpLocalHp = local.hp;

    let playedHitSound = false;
    const hitEvents = this.pendingPvpHitEvents.splice(0);
    for (const hit of hitEvents) {
      if (hit.id <= this.lastPvpHitEventId) continue;
      this.lastPvpHitEventId = hit.id;
      const hitText = `-${Math.ceil(hit.damage)} HP`;
      this.callbacks.onFloatingText?.(hitText, hit.x, 1.8, hit.z, 'damage');
      if (!playedHitSound) {
        sound.playSmack();
        playedHitSound = true;
      }
      this.spawnParticleRing(hit.x, 1.2, hit.z, 0xef4444);

      if (hit.targetSlot === this.pvpSlot) {
        this.triggerScreenShake(0.16, 0.2);
        this.pulsePvpFeedback('pvp-hit-vignette');
      }
      if (hit.sourceSlot === this.pvpSlot) {
        this.pulsePvpFeedback('pvp-hit-confirm');
      }
    }

    const midX = (local.x + remote.x) * 0.5;
    const midZ = (local.z + remote.z) * 0.5;
    this.applyPvpCameraFraming(midX, midZ, dt, false, {
      first: { x: local.x, z: local.z },
      second: { x: remote.x, z: remote.z },
    });

    this.callbacks.onPvpUpdate?.(state, this.pvpSlot);

    if (state.status === 'match_end') {
      if (!this.pvpMatchEndHandled) {
        this.pvpMatchEndHandled = true;
        this.callbacks.onPvpMatchEnd?.(state, this.pvpSlot);
      }
    } else {
      this.pvpMatchEndHandled = false;
    }
  }


  private buildSurvivalArenaExpansion(mapId: SurvivalMapId) {
    const mapDefinition = getSurvivalMapDefinition(mapId);
    this.survivalObstacles = [];
    // Survival reuses the generated industrial floor and warehouse surface maps from PvP.
    // Map-specific colours tint the common assets without creating a second texture system.
    const floorTexture = createPvpFloorTexture();
    floorTexture.repeat.set(3, 4);
    const crateTexture = createPvpObstacleTexture('crate');
    const barrierTexture = createPvpObstacleTexture('barrier');
    const wallTexture = createPvpObstacleTexture('wall');
    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, color: mapDefinition.floorColor, roughness: mapId === 'cold_storage' ? 0.42 : mapId === 'night_sorting' ? 0.34 : 0.62, metalness: mapId === 'container_terminal' ? 0.24 : mapId === 'night_sorting' ? 0.36 : 0.12 });
    applyIndustrialPbr(floorMaterial, 0.018);
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture, color: mapDefinition.wallColor, roughness: 0.72, metalness: mapId === 'container_terminal' ? 0.42 : 0.32 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: mapDefinition.accentColor, roughness: 0.48, metalness: 0.24, emissive: mapDefinition.accentColor, emissiveIntensity: 0.10 });
    const palletMaterial = new THREE.MeshStandardMaterial({ map: crateTexture, color: 0x76513a, roughness: 0.88 });
    const crateMaterials = [
      new THREE.MeshStandardMaterial({ map: crateTexture, color: 0x475569, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ map: crateTexture, color: 0x854d0e, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ map: crateTexture, color: 0x334155, roughness: 0.72 }),
    ];
    const barrierMaterial = new THREE.MeshStandardMaterial({ map: barrierTexture, color: 0xffffff, roughness: 0.72, metalness: 0.12 });

    // Track map-owned GPU resources: all these textures/materials are shared by many map meshes.
    for (const material of [floorMaterial, wallMaterial, trimMaterial, palletMaterial, barrierMaterial, ...crateMaterials]) {
      this.survivalArenaInstanceMaterials.add(material);
    }
    for (const texture of [floorTexture, crateTexture, barrierTexture, wallTexture]) {
      this.survivalArenaInstanceTextures.add(texture);
    }

    const addSurvivalFootprint = (group: THREE.Group, width: number, depth: number) => {
      const footprint = createArenaObstacleFootprint(width, depth, mapDefinition.accentColor);
      this.survivalArenaInstanceGeometries.add(footprint.geometry);
      const footprintMaterials = Array.isArray(footprint.material) ? footprint.material : [footprint.material];
      footprintMaterials.forEach((material) => this.survivalArenaInstanceMaterials.add(material));
      group.add(footprint);
    };

    const floorGeometry = new THREE.PlaneGeometry(23.5, 40);
    this.survivalArenaInstanceGeometries.add(floorGeometry);
    const centerFloorGeometry = new THREE.PlaneGeometry(72, 40);
    this.survivalArenaInstanceGeometries.add(centerFloorGeometry);
    const centerFloor = new THREE.Mesh(centerFloorGeometry, floorMaterial);
    centerFloor.rotation.x = -Math.PI / 2;
    centerFloor.position.set(0, -0.015, 0);
    centerFloor.receiveShadow = true;
    this.levelRoot.add(centerFloor);
    this.platforms.push({ x: 0, y: 0, z: 0, width: 72, height: 0.2, depth: 40, type: 'floor' });

    // Low-contrast aisle guides make the large floor readable without filling it
    // with clutter. Instanced marks keep the mobile draw-call cost predictable.
    const aisleGuideMat = new THREE.MeshStandardMaterial({
      color: 0x3b8da6,
      emissive: 0x17475c,
      emissiveIntensity: 0.22,
      roughness: 0.58,
      metalness: 0.18,
    });
    for (const z of [-9.2, 9.2]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(112, 0.022, 0.055), aisleGuideMat);
      line.position.set(0, 0.012, z);
      line.receiveShadow = false;
      line.castShadow = false;
      this.levelRoot.add(line);
    }

    const dashMaterial = new THREE.MeshStandardMaterial({
      color: 0xd79a42,
      emissive: 0x5c3512,
      emissiveIntensity: 0.16,
      roughness: 0.62,
      metalness: 0.12,
    });
    const dashGeometry = new THREE.BoxGeometry(2.4, 0.024, 0.075);
    const aisleDashes = new THREE.InstancedMesh(dashGeometry, dashMaterial, 13);
    const dashTransform = new THREE.Object3D();
    for (let i = 0; i < 13; i++) {
      dashTransform.position.set(-52 + i * 8.65, 0.013, 0);
      dashTransform.updateMatrix();
      aisleDashes.setMatrixAt(i, dashTransform.matrix);
    }
    aisleDashes.instanceMatrix.needsUpdate = true;
    aisleDashes.castShadow = false;
    aisleDashes.receiveShadow = false;
    this.addSurvivalArenaInstance(aisleDashes);

    const dockGuideMaterial = new THREE.MeshStandardMaterial({
      color: 0x527f91,
      emissive: 0x153b4d,
      emissiveIntensity: 0.18,
      roughness: 0.66,
      metalness: 0.16,
    });
    const dockGuideGeometry = new THREE.BoxGeometry(1.45, 0.018, 0.075);
    const dockGuides = new THREE.InstancedMesh(dockGuideGeometry, dockGuideMaterial, 24);
    let dockGuideIndex = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        dashTransform.position.set(-51 + i * 9.25, 0.014, side * 14.4);
        dashTransform.rotation.set(0, 0, 0);
        dashTransform.scale.set(1, 1, 1);
        dashTransform.updateMatrix();
        dockGuides.setMatrixAt(dockGuideIndex++, dashTransform.matrix);
      }
    }
    dockGuides.instanceMatrix.needsUpdate = true;
    dockGuides.castShadow = false;
    dockGuides.receiveShadow = false;
    this.addSurvivalArenaInstance(dockGuides);

    // Individual ceiling lights can fade independently when the operator passes
    // directly below them or when a lamp crosses the camera-to-player sightline.
    // The small fixed count costs a few draw calls, but removes the biggest mobile occluder.
    for (let i = 0; i < 8; i++) {
      const fixtureMaterial = new THREE.MeshStandardMaterial({
        color: 0xc5d9e2,
        emissive: 0x4c91a9,
        emissiveIntensity: 0.48,
        roughness: 0.28,
        metalness: 0.42,
      });
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.38), fixtureMaterial);
      fixture.name = 'survival-ceiling-light-' + (i + 1);
      fixture.position.set(-49 + i * 14, 8.35, 0);
      fixture.castShadow = false;
      fixture.receiveShadow = false;
      this.registerCameraOccluder(fixture, 0.07, 3.15);
      this.survivalCeilingFixtures.push(fixture);
      this.levelRoot.add(fixture);
    }

    // Continuous side walls frame the complete 120 x 40 m arena.
    for (const zSide of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(119, 9.5, 0.48), wallMaterial);
      sideWall.position.set(0, 4.75, zSide * 19.65);
      this.registerCameraOccluder(sideWall);
      this.levelRoot.add(sideWall);
      const warningStripe = new THREE.Mesh(new THREE.BoxGeometry(119, 0.12, 0.52), trimMaterial);
      warningStripe.position.set(0, 0.09, zSide * 19.25);
      this.levelRoot.add(warningStripe);
    }

    for (const side of [-1, 1]) {
      const bayFloor = new THREE.Mesh(floorGeometry, floorMaterial);
      bayFloor.rotation.x = -Math.PI / 2;
      bayFloor.position.set(side * 47.75, -0.015, 0);
      bayFloor.receiveShadow = true;
      this.levelRoot.add(bayFloor);
      this.platforms.push({ x: side * 47.75, y: 0, z: 0, width: 23.5, height: 0.2, depth: 40, type: 'floor' });

      const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 9.5, 40), wallMaterial);
      endWall.position.set(side * 59.35, 4.75, 0);
      this.registerCameraOccluder(endWall);
      this.levelRoot.add(endWall);

      // Structural columns and compact high-bay lighting make the new wings read as real warehouse space.
      for (const localX of [39.5, 48.0, 56.0]) {
        for (const z of [-17.0, 17.0]) {
          const column = new THREE.Mesh(new THREE.BoxGeometry(0.42, 8.3, 0.42), wallMaterial);
          column.position.set(side * localX, 4.15, z);
          this.registerCameraOccluder(column, 0.13);
          this.levelRoot.add(column);
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.22, 0.82), trimMaterial);
          foot.position.set(side * localX, 0.12, z);
          this.levelRoot.add(foot);
        }
      }

      const coverPoints = [
        { x: side * 42.5, z: -11.0, variant: 0 },
        { x: side * 48.0, z: 10.5, variant: 1 },
        { x: side * 54.0, z: -7.0, variant: 2 },
        { x: side * 55.0, z: 12.0, variant: 0 },
      ];
      for (const point of coverPoints) {
        const group = new THREE.Group();
        addSurvivalFootprint(group, 2.9, 1.95);
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.24, 1.95), palletMaterial);
        base.position.y = 0.12;
        group.add(base);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(1.28, 1.02, 1.58), crateMaterials[point.variant]);
        lower.position.set(-0.28, 0.75, 0);
        lower.castShadow = false;
        this.registerCameraOccluder(lower, 0.13);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.78, 1.2), crateMaterials[(point.variant + 1) % crateMaterials.length]);
        upper.position.set(0.62, 1.62, 0.08);
        upper.castShadow = false;
        this.registerCameraOccluder(upper, 0.13);
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.075, 1.62), trimMaterial);
        band.position.set(-0.28, 1.06, 0);
        group.add(lower, upper, band);
        group.position.set(point.x, 0, point.z);
        this.levelRoot.add(group);
        this.survivalObstacles.push({ x: point.x, z: point.z, halfWidth: 1.55, halfDepth: 1.08 });
      }

      // A low staging rack on the outer side gives ranged enemies and the player cover to navigate around.
      const rack = new THREE.Group();
      const rackPostGeometry = new THREE.BoxGeometry(0.12, 3.4, 0.12);
      for (const xOffset of [-1.75, 1.75]) {
        for (const zOffset of [-0.9, 0.9]) {
          const post = new THREE.Mesh(rackPostGeometry, trimMaterial);
          post.position.set(xOffset, 1.7, zOffset);
          this.registerCameraOccluder(post, 0.13);
          rack.add(post);
        }
      }
      for (const y of [0.45, 1.6, 2.75]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.13, 2.0), wallMaterial);
        shelf.position.y = y;
        this.registerCameraOccluder(shelf, 0.13);
        rack.add(shelf);
      }
      rack.position.set(side * 51.5, 0, 0);
      this.levelRoot.add(rack);
      this.survivalObstacles.push({ x: side * 51.5, z: 0, halfWidth: 1.95, halfDepth: 1.15 });

      const beacon = new THREE.PointLight(side < 0 ? 0x38bdf8 : 0xf59e0b, 2.0, 16);
      beacon.position.set(side * 48.0, 6.8, 0);
      this.levelRoot.add(beacon);
      const overhead = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 0.22), trimMaterial);
      overhead.position.set(side * 48.0, 8.5, 0);
      this.registerCameraOccluder(overhead, 0.10);
      this.levelRoot.add(overhead);
    }

    // A few low barricades in the original bay break long sight lines without sealing the centre lane.
    for (const point of [
      { x: -22, z: 12 }, { x: 22, z: -12 }, { x: -8, z: -14 }, { x: 9, z: 14 },
    ]) {
      const barricade = new THREE.Group();
      addSurvivalFootprint(barricade, 2.45, 1.25);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.22, 1.25), palletMaterial);
      base.position.y = 0.11;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.88, 1.05), barrierMaterial);
      crate.position.y = 0.66;
      this.registerCameraOccluder(crate, 0.13);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.09, 1.08), trimMaterial);
      stripe.position.y = 0.9;
      barricade.add(base, crate, stripe);
      barricade.position.set(point.x, 0, point.z);
      this.levelRoot.add(barricade);
      this.survivalObstacles.push({ x: point.x, z: point.z, halfWidth: 1.32, halfDepth: 0.72 });
    }
    this.buildSurvivalArenaDressing(mapId);
    this.buildSurvivalMapLandmarks(mapId);
    this.buildSurvivalMapRouteFeatures(mapId);
    this.registerSurvivalArenaOccluders();
    this.createSurvivalSightlineMarker();
    this.spawnSurvivalSecrets(mapId);
  }


  /** Build map-specific cover and traversal landmarks; these change routes, not just colors. */
  private buildSurvivalMapRouteFeatures(mapId: SurvivalMapId) {
    const features = getSurvivalMapRouteFeatures(mapId);
    const sharedMetal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.62, roughness: 0.48 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b6545, roughness: 0.86 });
    const dummy = new THREE.Object3D();

    for (const feature of features) {
      const accent = new THREE.MeshStandardMaterial({
        color: feature.accent,
        emissive: feature.accent,
        emissiveIntensity: mapId === 'night_sorting' ? 0.48 : mapId === 'cold_storage' ? 0.24 : 0.12,
        metalness: 0.42,
        roughness: 0.4,
      });
      const root = new THREE.Group();
      root.name = 'survival-route-feature-' + feature.id;
      const baseMaterial = feature.kind === 'pallet_stack' ? wood : sharedMetal;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(feature.width, feature.height, feature.depth),
        baseMaterial
      );
      body.position.y = feature.height / 2;
      body.castShadow = false;
      body.receiveShadow = true;
      root.add(body);

      if (feature.kind === 'pallet_stack') {
        // Realistic palletised cargo: deck runners, separated boards, tension
        // straps and a front shipping label. The original collision footprint
        // is deliberately unchanged.
        const darkWood = new THREE.MeshStandardMaterial({ color: 0x4b3829, roughness: 0.92 });
        const paleWood = new THREE.MeshStandardMaterial({ color: 0xb38a5d, roughness: 0.86 });
        const palletBase = new THREE.Mesh(
          new THREE.BoxGeometry(feature.width + 0.16, 0.13, feature.depth + 0.14),
          darkWood,
        );
        palletBase.position.y = 0.075;
        root.add(palletBase);

        const runner = new THREE.Mesh(new THREE.BoxGeometry(feature.width + 0.08, 0.11, 0.13), wood);
        for (const z of [-feature.depth * 0.34, 0, feature.depth * 0.34]) {
          const support = runner.clone();
          support.position.set(0, 0.16, z);
          root.add(support);
        }

        const boardCount = Math.max(5, Math.min(9, Math.round(feature.width * 1.5)));
        const deckBoards = new THREE.InstancedMesh(
          new THREE.BoxGeometry(feature.width * 0.96 / boardCount, 0.045, feature.depth * 0.88),
          paleWood,
          boardCount,
        );
        for (let i = 0; i < boardCount; i++) {
          dummy.position.set(
            -feature.width * 0.46 + (i + 0.5) * feature.width * 0.92 / boardCount,
            0.235,
            0,
          );
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          deckBoards.setMatrixAt(i, dummy.matrix);
        }
        deckBoards.instanceMatrix.needsUpdate = true;
        root.add(deckBoards);

        const strapMaterial = new THREE.MeshStandardMaterial({
          color: 0x172b3b,
          roughness: 0.52,
          metalness: 0.22,
        });
        const cargoStraps = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.065, feature.height + 0.08, feature.depth + 0.07),
          strapMaterial,
          2,
        );
        for (let i = 0; i < 2; i++) {
          dummy.position.set((i === 0 ? -1 : 1) * feature.width * 0.24, feature.height * 0.5 + 0.11, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          cargoStraps.setMatrixAt(i, dummy.matrix);
        }
        cargoStraps.instanceMatrix.needsUpdate = true;
        root.add(cargoStraps);

        const labelPlate = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.62, feature.width * 0.34), 0.26, 0.025),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 }),
        );
        labelPlate.position.set(0, feature.height * 0.62, feature.depth * 0.5 + 0.018);
        root.add(labelPlate);
        const labelCode = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.40, feature.width * 0.22), 0.035, 0.012),
          new THREE.MeshBasicMaterial({ color: feature.accent }),
        );
        labelCode.position.set(0, feature.height * 0.62 + 0.045, feature.depth * 0.5 + 0.034);
        root.add(labelCode);
      } else if (feature.kind === 'sorter_belt') {
        const belt = new THREE.Mesh(
          new THREE.BoxGeometry(feature.width * 0.92, 0.09, feature.depth * 0.82),
          new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.35, roughness: 0.72 })
        );
        belt.position.y = feature.height + 0.05;
        root.add(belt);
        const rollers = new THREE.InstancedMesh(
          new THREE.CylinderGeometry(0.10, 0.10, feature.depth * 0.78, 8),
          accent,
          5
        );
        for (let i = 0; i < 5; i++) {
          dummy.position.set(-feature.width * 0.38 + i * feature.width * 0.19, feature.height + 0.11, 0);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          rollers.setMatrixAt(i, dummy.matrix);
        }
        rollers.instanceMatrix.needsUpdate = true;
        root.add(rollers);

        const railMaterial = new THREE.MeshStandardMaterial({ color: 0x7c8797, metalness: 0.72, roughness: 0.34 });
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(feature.width * 0.96, 0.16, 0.075),
            railMaterial,
          );
          rail.position.set(0, feature.height + 0.18, side * feature.depth * 0.43);
          root.add(rail);
        }
        const sensor = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.22, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x17212e, metalness: 0.46, roughness: 0.38 }),
        );
        sensor.position.set(feature.width * 0.34, feature.height + 0.24, feature.depth * 0.48);
        root.add(sensor);
        const statusLamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
        );
        statusLamp.position.set(feature.width * 0.34, feature.height + 0.37, feature.depth * 0.48);
        root.add(statusLamp);
      } else if (feature.kind === 'cold_compressor') {
        const fanHousing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16),
          accent
        );
        fanHousing.rotation.z = Math.PI / 2;
        fanHousing.position.set(feature.width / 2 + 0.07, feature.height * 0.62, 0);
        root.add(fanHousing);
        const fanRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.33, 0.035, 6, 20),
          sharedMetal,
        );
        fanRing.rotation.y = Math.PI / 2;
        fanRing.position.set(feature.width / 2 + 0.145, feature.height * 0.62, 0);
        root.add(fanRing);
        const fanHub = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.76, roughness: 0.25 }),
        );
        fanHub.position.set(feature.width / 2 + 0.155, feature.height * 0.62, 0);
        root.add(fanHub);
        for (let blade = 0; blade < 4; blade++) {
          const vane = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.25, 0.065),
            sharedMetal,
          );
          const angle = blade * Math.PI / 2;
          vane.position.set(
            feature.width / 2 + 0.16,
            feature.height * 0.62 + Math.cos(angle) * 0.17,
            Math.sin(angle) * 0.17,
          );
          vane.rotation.x = angle;
          root.add(vane);
        }
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.12, feature.height * 0.62, feature.depth * 0.64), accent);
        vent.position.set(feature.width / 2 + 0.08, feature.height * 0.3, 0);
        root.add(vent);
        const ventSlats = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.04, 0.035, feature.depth * 0.58),
          sharedMetal,
          5,
        );
        for (let i = 0; i < 5; i++) {
          dummy.position.set(feature.width / 2 + 0.15, 0.20 + i * feature.height * 0.105, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          ventSlats.setMatrixAt(i, dummy.matrix);
        }
        ventSlats.instanceMatrix.needsUpdate = true;
        root.add(ventSlats);
      } else if (feature.kind === 'container_stack') {
        const corner = new THREE.Mesh(new THREE.BoxGeometry(0.12, feature.height * 0.92, 0.12), accent);
        for (const x of [-1, 1]) for (const z of [-1, 1]) {
          const post = corner.clone();
          post.position.set(x * (feature.width / 2 - 0.12), feature.height / 2, z * (feature.depth / 2 - 0.12));
          root.add(post);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(feature.width + 0.12, 0.10, feature.depth + 0.12), accent);
        top.position.y = feature.height + 0.05;
        root.add(top);

        // Corrugated container sides: repeated narrow ribs read as steel panels
        // from the normal top-down camera, without changing the obstacle bounds.
        const ribCount = Math.max(6, Math.min(12, Math.round(feature.width * 2)));
        const ribs = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.045, feature.height * 0.78, 0.045),
          sharedMetal,
          ribCount * 2,
        );
        for (let i = 0; i < ribCount; i++) {
          const x = -feature.width * 0.43 + i * (feature.width * 0.86 / Math.max(1, ribCount - 1));
          for (const side of [-1, 1]) {
            dummy.position.set(x, feature.height * 0.5, side * (feature.depth * 0.5 + 0.025));
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            ribs.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
          }
        }
        ribs.instanceMatrix.needsUpdate = true;
        root.add(ribs);
        const doorBars = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.065, feature.height * 0.74, 0.07),
          accent,
          2,
        );
        for (let i = 0; i < 2; i++) {
          dummy.position.set(feature.width * 0.5 + 0.04, feature.height * 0.5, (i === 0 ? -1 : 1) * feature.depth * 0.21);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          doorBars.setMatrixAt(i, dummy.matrix);
        }
        doorBars.instanceMatrix.needsUpdate = true;
        root.add(doorBars);
      }

      root.position.set(feature.x, 0, feature.z);
      this.levelRoot.add(root);
      this.survivalObstacles.push({
        x: feature.x,
        z: feature.z,
        halfWidth: feature.width * 0.56,
        halfDepth: feature.depth * 0.56,
      });
      this.registerCameraOccludersInGroup(root, 0.18);
    }
  }

  private buildSurvivalMapLandmarks(mapId: SurvivalMapId) {
    const root = new THREE.Group();
    root.name = 'survival-map-landmarks-' + mapId;
    this.survivalMapLandmarks = root;
    this.levelRoot.add(root);

    if (mapId === 'container_terminal') {
      const containerColors = [0xb4533f, 0x256b89, 0x9b6b28, 0x355b4e];
      const positions = [
        { x: -36, z: -6.2 }, { x: -18, z: 6.2 },
        { x: 18, z: -6.2 }, { x: 36, z: 6.2 },
      ];
      const ribGeometry = new THREE.BoxGeometry(0.055, 2.82, 4.18);
      positions.forEach((position, index) => {
        const color = containerColors[index % containerColors.length];
        const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.42, roughness: 0.62 });
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xd5dde4, metalness: 0.8, roughness: 0.32 });
        const group = new THREE.Group();
        group.name = 'port-container-' + index;
        const body = new THREE.Mesh(new THREE.BoxGeometry(8.15, 3.0, 4.15), bodyMaterial);
        body.position.y = 1.52;
        body.castShadow = false;
        body.receiveShadow = true;
        group.add(body);
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(8.32, 0.12, 4.3), frameMaterial);
        topRail.position.y = 3.06;
        group.add(topRail);
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.55, 3.65), frameMaterial);
        door.position.set(4.12, 1.52, 0);
        group.add(door);
        const ribs = new THREE.InstancedMesh(ribGeometry, frameMaterial, 9);
        const transform = new THREE.Object3D();
        for (let rib = 0; rib < 9; rib++) {
          transform.position.set(-3.75 + rib * 0.92, 1.52, 0);
          transform.rotation.set(0, 0, 0);
          transform.scale.set(1, 1, 1);
          transform.updateMatrix();
          ribs.setMatrixAt(rib, transform.matrix);
        }
        ribs.instanceMatrix.needsUpdate = true;
        ribs.castShadow = false;
        ribs.receiveShadow = false;
        group.add(ribs);
        group.position.set(position.x, 0, position.z);
        root.add(group);
        this.survivalObstacles.push({ x: position.x, z: position.z, halfWidth: 4.25, halfDepth: 2.28 });
      });

      // The suspended gantry gives the yard a distinct port silhouette without closing the fighting lane.
      const craneMaterial = new THREE.MeshStandardMaterial({ color: 0xe38b32, metalness: 0.66, roughness: 0.42 });
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 34), craneMaterial);
      rail.position.set(0, 7.15, 0);
      root.add(rail);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.42, 3.8), new THREE.MeshStandardMaterial({ color: 0x263b50, metalness: 0.72, roughness: 0.34 }));
      trolley.position.set(0, 6.72, 0);
      root.add(trolley);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0xd5dde4, metalness: 0.8, roughness: 0.32 }));
      cable.position.set(0, 5.25, 0);
      root.add(cable);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.075, 6, 12, Math.PI * 1.5), craneMaterial);
      hook.position.set(0, 3.85, 0);
      hook.rotation.x = Math.PI / 2;
      root.add(hook);
      const beacon = new THREE.PointLight(0xfb923c, 3.2, 25);
      beacon.position.set(0, 6.5, 0);
      root.add(beacon);

      // Two portal frames, dock bumpers and high-contrast lane chevrons make
      // the port unmistakable from the tactical camera without blocking routes.
      const gantryLegMaterial = new THREE.MeshStandardMaterial({ color: 0xf2a23b, metalness: 0.64, roughness: 0.38 });
      for (const side of [-1, 1]) {
        for (const z of [-16.2, 16.2]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 6.7, 0.48), gantryLegMaterial);
          leg.position.set(side * 53.6, 3.35, z);
          leg.castShadow = false;
          root.add(leg);
          const shoe = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 1.05), craneMaterial);
          shoe.position.set(side * 53.6, 0.12, z);
          root.add(shoe);
        }
      }
      const lanePaint = new THREE.MeshBasicMaterial({ color: 0xf59e0b, toneMapped: false });
      const portChevronGeometry = new THREE.BoxGeometry(3.2, 0.025, 0.13);
      const portChevrons = new THREE.InstancedMesh(portChevronGeometry, lanePaint, 16);
      const chevronTransform = new THREE.Object3D();
      let chevronIndex = 0;
      for (const side of [-1, 1]) {
        for (let mark = 0; mark < 8; mark++) {
          chevronTransform.position.set(side * (47.0 + (mark % 2) * 2.2), 0.026, -12.5 + mark * 3.55);
          chevronTransform.rotation.set(0, side * 0.35, 0);
          chevronTransform.scale.set(1, 1, 1);
          chevronTransform.updateMatrix();
          portChevrons.setMatrixAt(chevronIndex++, chevronTransform.matrix);
        }
      }
      portChevrons.instanceMatrix.needsUpdate = true;
      portChevrons.castShadow = false;
      portChevrons.receiveShadow = false;
      root.add(portChevrons);
    } else if (mapId === 'cold_storage') {
      const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x8bb6c8, metalness: 0.38, roughness: 0.34 });
      const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xd9f5ff, metalness: 0.28, roughness: 0.3, emissive: 0x1c596f, emissiveIntensity: 0.16 });
      const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x1f4355, metalness: 0.72, roughness: 0.35 });
      const fanMaterial = new THREE.MeshStandardMaterial({ color: 0x67e8f9, metalness: 0.62, roughness: 0.28, emissive: 0x0891b2, emissiveIntensity: 0.5 });
      const freezerPositions = [
        { x: -39, z: -7.2 }, { x: -21, z: 7.2 },
        { x: 21, z: -7.2 }, { x: 39, z: 7.2 },
      ];
      freezerPositions.forEach((position, index) => {
        const group = new THREE.Group();
        group.name = 'cold-storage-unit-' + index;
        const shell = new THREE.Mesh(new THREE.BoxGeometry(6.2, 4.7, 4.2), shellMaterial);
        shell.position.y = 2.36;
        shell.castShadow = false;
        group.add(shell);
        const front = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.95, 3.55), panelMaterial);
        front.position.set(3.16, 2.36, 0);
        group.add(front);
        const fanHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.20, 12), darkMaterial);
        fanHousing.rotation.z = Math.PI / 2;
        fanHousing.position.set(3.30, 3.05, 0);
        group.add(fanHousing);
        const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.25, 8), fanMaterial);
        fanHub.rotation.z = Math.PI / 2;
        fanHub.position.set(3.45, 3.05, 0);
        group.add(fanHub);
        for (let slat = 0; slat < 4; slat++) {
          const vent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 1.5), darkMaterial);
          vent.position.set(3.30, 1.55 + slat * 0.27, 0);
          group.add(vent);
        }
        group.position.set(position.x, 0, position.z);
        root.add(group);
        this.survivalObstacles.push({ x: position.x, z: position.z, halfWidth: 3.22, halfDepth: 2.2 });
      });

      // Refrigerant mains are instanced to keep their draw-call cost low on phones.
      const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x5fd7e8, metalness: 0.72, roughness: 0.26, emissive: 0x0e7490, emissiveIntensity: 0.22 });
      const pipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.105, 0.105, 108, 8), pipeMaterial, 3);
      const pipeTransform = new THREE.Object3D();
      for (let index = 0; index < 3; index++) {
        pipeTransform.position.set(0, 7.15, -12 + index * 12);
        pipeTransform.rotation.set(0, 0, Math.PI / 2);
        pipeTransform.scale.set(1, 1, 1);
        pipeTransform.updateMatrix();
        pipes.setMatrixAt(index, pipeTransform.matrix);
      }
      pipes.instanceMatrix.needsUpdate = true;
      pipes.castShadow = false;
      pipes.receiveShadow = false;
      root.add(pipes);

      const frostMaterial = new THREE.MeshBasicMaterial({ color: 0x73d9ed, transparent: true, opacity: 0.16, depthWrite: false });
      for (const laneX of [-30, -10, 10, 30]) {
        const frostStrip = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.018, 8.5), frostMaterial);
        frostStrip.position.set(laneX, 0.018, 0);
        root.add(frostStrip);
      }
      for (const x of [-34, 0, 34]) {
        const coldLight = new THREE.PointLight(0x67e8f9, 2.2, 24);
        coldLight.position.set(x, 6.3, 0);
        root.add(coldLight);
      }

      // Condenser panels and frost stacks use instancing so map identity costs
      // only three static draw calls instead of dozens of separate meshes.
      const statusMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9, toneMapped: false });
      const darkPanelMaterial = new THREE.MeshStandardMaterial({ color: 0x123447, metalness: 0.62, roughness: 0.34 });
      const panelPositions: Array<{ x: number; side: number }> = [];
      for (const side of [-1, 1]) {
        for (const x of [-50, -17, 17, 50]) panelPositions.push({ x, side });
      }
      const panelHousing = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 1.15, 0.22), darkPanelMaterial, panelPositions.length);
      const panelScreens = new THREE.InstancedMesh(new THREE.BoxGeometry(1.52, 0.62, 0.035), statusMaterial, panelPositions.length);
      const panelTransform = new THREE.Object3D();
      panelPositions.forEach((position, index) => {
        panelTransform.position.set(position.x, 3.65, position.side * 18.7);
        panelTransform.rotation.set(0, 0, 0);
        panelTransform.scale.set(1, 1, 1);
        panelTransform.updateMatrix();
        panelHousing.setMatrixAt(index, panelTransform.matrix);
        panelTransform.position.set(position.x, 3.7, position.side * 18.835);
        panelTransform.updateMatrix();
        panelScreens.setMatrixAt(index, panelTransform.matrix);
      });
      panelHousing.instanceMatrix.needsUpdate = true;
      panelScreens.instanceMatrix.needsUpdate = true;
      panelHousing.castShadow = false;
      panelScreens.castShadow = false;
      root.add(panelHousing, panelScreens);

      const iceMaterial = new THREE.MeshStandardMaterial({ color: 0xa5efff, metalness: 0.12, roughness: 0.22, transparent: true, opacity: 0.66, depthWrite: false, emissive: 0x2b9cb8, emissiveIntensity: 0.12 });
      const frostPositions = [
        { x: -54, z: -11 }, { x: -54, z: 11 },
        { x: 54, z: -11 }, { x: 54, z: 11 },
      ];
      const frostCrystals = new THREE.InstancedMesh(new THREE.ConeGeometry(0.38, 1.0, 5), iceMaterial, frostPositions.length * 3);
      const frostTransform = new THREE.Object3D();
      let frostIndex = 0;
      for (const position of frostPositions) {
        for (let shard = 0; shard < 3; shard++) {
          frostTransform.position.set(
            position.x + (shard - 1) * 0.42,
            0.62 + shard * 0.09,
            position.z + (shard % 2) * 0.25,
          );
          frostTransform.rotation.set(0, 0, (shard - 1) * 0.16);
          frostTransform.scale.set(0.9 + shard * 0.13, 1.25 + shard * 0.18, 0.9 + shard * 0.1);
          frostTransform.updateMatrix();
          frostCrystals.setMatrixAt(frostIndex++, frostTransform.matrix);
        }
      }
      frostCrystals.instanceMatrix.needsUpdate = true;
      frostCrystals.castShadow = false;
      frostCrystals.receiveShadow = false;
      root.add(frostCrystals);
    } else if (mapId === 'night_sorting') {
      // Night sorting facility: four neon scanner gates, illuminated routing strips
      // and a suspended status sign create a silhouette unlike the warehouse, port or chiller.
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x50315f, metalness: 0.62, roughness: 0.34, emissive: 0x3d1757, emissiveIntensity: 0.24 });
      const pinkNeon = new THREE.MeshBasicMaterial({ color: 0xf472b6, toneMapped: false });
      const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x67e8f9, toneMapped: false });
      const gatePositions = [-36, -12, 12, 36];
      for (let gateIndex = 0; gateIndex < gatePositions.length; gateIndex++) {
        const x = gatePositions[gateIndex];
        const gate = new THREE.Group();
        gate.name = 'night-sorter-scan-gate-' + (gateIndex + 1);
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 4.15, 0.48), frameMaterial);
        const postR = postL.clone();
        postL.position.set(0, 2.05, -5.1);
        postR.position.set(0, 2.05, 5.1);
        const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.48, 10.55), frameMaterial);
        crossbar.position.y = 4.1;
        const scanBar = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 9.9), gateIndex % 2 === 0 ? pinkNeon : cyanNeon);
        scanBar.position.set(0.29, 3.83, 0);
        const footL = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.18, 0.95), gateIndex % 2 === 0 ? pinkNeon : cyanNeon);
        const footR = footL.clone();
        footL.position.set(0, 0.11, -5.1);
        footR.position.set(0, 0.11, 5.1);
        gate.add(postL, postR, crossbar, scanBar, footL, footR);
        gate.position.x = x;
        root.add(gate);
        const scanGlow = new THREE.PointLight(gateIndex % 2 === 0 ? 0xf472b6 : 0x67e8f9, 2.0, 18);
        scanGlow.position.set(x, 3.1, 0);
        root.add(scanGlow);
      }

      const routingMaterial = new THREE.MeshBasicMaterial({ color: 0xf0abfc, toneMapped: false });
      const routingMarks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.65, 0.025, 0.15), routingMaterial, 24);
      const routingTransform = new THREE.Object3D();
      let routingIndex = 0;
      for (const side of [-1, 1]) {
        for (let mark = 0; mark < 12; mark++) {
          routingTransform.position.set(-51 + mark * 9.25, 0.028, side * 12.9);
          routingTransform.rotation.set(0, side * 0.12, 0);
          routingTransform.scale.set(1, 1, 1);
          routingTransform.updateMatrix();
          routingMarks.setMatrixAt(routingIndex++, routingTransform.matrix);
        }
      }
      routingMarks.instanceMatrix.needsUpdate = true;
      routingMarks.castShadow = false;
      routingMarks.receiveShadow = false;
      root.add(routingMarks);

      const statusSign = new THREE.Mesh(
        new THREE.PlaneGeometry(8.6, 1.55),
        this.getSurvivalArenaLabelMaterial('SORTOWNIA WIDMOWA  //  ZMIANA 03', '#f0abfc'),
      );
      statusSign.position.set(0, 6.3, -19.36);
      statusSign.castShadow = false;
      statusSign.receiveShadow = false;
      root.add(statusSign);
      for (const x of [-42, -14, 14, 42]) {
        const beacon = new THREE.PointLight(0xa855f7, 1.15, 15);
        beacon.position.set(x, 6.0, 16.8);
        root.add(beacon);
      }
    } else {
      // Warehouse B4: numbered dock shutters, pallet staging lights and yellow
      // pedestrian rails distinguish the original hall from the port/chiller.
      const dockSteel = new THREE.MeshStandardMaterial({ color: 0x354b5d, metalness: 0.68, roughness: 0.42 });
      const shutterMaterial = new THREE.MeshStandardMaterial({ color: 0x718292, metalness: 0.52, roughness: 0.56 });
      const amber = new THREE.MeshStandardMaterial({ color: 0xf4b544, metalness: 0.34, roughness: 0.48, emissive: 0x8a4c13, emissiveIntensity: 0.18 });
      const dockPositions: Array<{ x: number; side: number }> = [];
      for (const side of [-1, 1]) for (let dock = 0; dock < 3; dock++) {
        dockPositions.push({ x: -34 + dock * 34, side });
      }
      const shutterPanels = new THREE.InstancedMesh(new THREE.BoxGeometry(8.6, 4.4, 0.18), shutterMaterial, dockPositions.length);
      const shutterSlats = new THREE.InstancedMesh(new THREE.BoxGeometry(8.3, 0.055, 0.22), dockSteel, dockPositions.length * 7);
      const shutterHeaders = new THREE.InstancedMesh(new THREE.BoxGeometry(8.9, 0.22, 0.25), amber, dockPositions.length);
      const dockTransform = new THREE.Object3D();
      let slatIndex = 0;
      dockPositions.forEach((position, index) => {
        dockTransform.position.set(position.x, 2.45, position.side * 19.05);
        dockTransform.rotation.set(0, 0, 0);
        dockTransform.scale.set(1, 1, 1);
        dockTransform.updateMatrix();
        shutterPanels.setMatrixAt(index, dockTransform.matrix);
        dockTransform.position.set(position.x, 4.75, position.side * 19.01);
        dockTransform.updateMatrix();
        shutterHeaders.setMatrixAt(index, dockTransform.matrix);
        for (let slat = 0; slat < 7; slat++) {
          dockTransform.position.set(position.x, 0.65 + slat * 0.56, position.side * 18.92);
          dockTransform.updateMatrix();
          shutterSlats.setMatrixAt(slatIndex++, dockTransform.matrix);
        }
        const dockLamp = new THREE.PointLight(0xf59e0b, 0.85, 10);
        dockLamp.position.set(position.x, 5.4, position.side * 16.8);
        root.add(dockLamp);
      });
      shutterPanels.instanceMatrix.needsUpdate = true;
      shutterSlats.instanceMatrix.needsUpdate = true;
      shutterHeaders.instanceMatrix.needsUpdate = true;
      shutterPanels.castShadow = false;
      shutterSlats.castShadow = false;
      shutterHeaders.castShadow = false;
      root.add(shutterPanels, shutterSlats, shutterHeaders);
      root.name += '-loading-docks';
      root.userData.loadingDockLandmarks = true;
      const safetyLineMaterial = new THREE.MeshBasicMaterial({ color: 0xfbbf24, toneMapped: false });
      const safetyLineGeometry = new THREE.BoxGeometry(2.0, 0.025, 0.12);
      const safetyLines = new THREE.InstancedMesh(safetyLineGeometry, safetyLineMaterial, 18);
      const lineTransform = new THREE.Object3D();
      let lineIndex = 0;
      for (const side of [-1, 1]) {
        for (let index = 0; index < 9; index++) {
          lineTransform.position.set(-38 + index * 9.5, 0.025, side * 11.6);
          lineTransform.rotation.set(0, 0, 0);
          lineTransform.scale.set(1, 1, 1);
          lineTransform.updateMatrix();
          safetyLines.setMatrixAt(lineIndex++, lineTransform.matrix);
        }
      }
      safetyLines.instanceMatrix.needsUpdate = true;
      safetyLines.castShadow = false;
      safetyLines.receiveShadow = false;
      root.add(safetyLines);
    }

    // Containers, cold-room shells, gantry beams and loading shutters are
    // discovered by their real bounds; decorative floor strips stay untouched.
    this.registerCameraOccludersInGroup(root, 0.14);
  }

  private registerCameraOccludersInGroup(root: THREE.Object3D, fadeOpacity = 0.14) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || this.cameraOccluderMaterials.has(object)) return;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.length === 0 || materials.every((material) => material.transparent && material.opacity <= 0.72)) return;

      let bounds: THREE.Box3 | null;
      if (object instanceof THREE.InstancedMesh) {
        if (!object.boundingBox) object.computeBoundingBox();
        bounds = object.boundingBox;
      } else {
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        bounds = object.geometry.boundingBox;
      }
      if (!bounds) return;

      const dimensions = bounds.getSize(new THREE.Vector3());
      const localCenter = bounds.getCenter(new THREE.Vector3());
      const worldCenter = object.localToWorld(localCenter);
      const worldScale = object.getWorldScale(new THREE.Vector3());
      const height = dimensions.y * Math.abs(worldScale.y);
      const horizontalSpan = Math.max(dimensions.x * Math.abs(worldScale.x), dimensions.z * Math.abs(worldScale.z));
      const blocksSightline = height >= 1.05 || (worldCenter.y >= 2.55 && horizontalSpan >= 1.2);
      if (blocksSightline) this.registerCameraOccluder(object, fadeOpacity);
    });
  }

  private registerSurvivalArenaOccluders() {
    for (const instance of this.survivalArenaInstances) {
      if (!instance.boundingBox) instance.computeBoundingBox();
      const bounds = instance.boundingBox;
      if (!bounds) continue;
      const dimensions = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const height = dimensions.y * Math.abs(instance.scale.y);
      const horizontalSpan = Math.max(dimensions.x * Math.abs(instance.scale.x), dimensions.z * Math.abs(instance.scale.z));
      const blocksSightline = height >= 1.05 || (center.y + instance.position.y >= 2.55 && horizontalSpan >= 1.2);
      if (blocksSightline) this.registerCameraOccluder(instance, 0.14);
    }
  }

  private createSurvivalSightlineMarker() {
    if (this.survivalSightlineMarker) {
      this.levelRoot.remove(this.survivalSightlineMarker);
      this.disposeTemporaryObject(this.survivalSightlineMarker);
    }
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.74, 0.026, 5, 32),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.46, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    marker.name = 'survival-sightline-player-marker';
    marker.rotation.x = Math.PI / 2;
    marker.position.set(this.playerPos.x, 0.055, this.playerPos.z);
    marker.renderOrder = 40;
    marker.frustumCulled = false;
    marker.visible = false;
    this.survivalSightlineMarker = marker;
    this.levelRoot.add(marker);
  }

  private spawnSurvivalSecrets(mapId: SurvivalMapId) {
    const definition = getSurvivalMapDefinition(mapId);
    this.survivalSecretsFound = 0;
    for (const [index, secret] of definition.secretLocations.entries()) {
      const group = new THREE.Group();
      group.name = 'survival-secret-' + secret.id;
      const gold = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.78, roughness: 0.22, emissive: 0x854d0e, emissiveIntensity: 0.58 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x27384b, metalness: 0.65, roughness: 0.34 });
      const glow = new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.48, depthWrite: false });

      if (secret.style === 'rabbit_hole') {
        // An absurdly inviting rabbit, a real dark burrow and a sign that points
        // straight into trouble. This is one compact prop cluster, not a new scene.
        const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x080514, toneMapped: false });
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), holeMaterial);
        hole.rotation.x = -Math.PI / 2;
        hole.position.set(0, 0.045, 0.18);
        group.add(hole);
        const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xf0abfc, metalness: 0.36, roughness: 0.28, emissive: 0xa21caf, emissiveIntensity: 0.52 });
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.095, 8, 28), rimMaterial);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, 0.10, 0.18);
        group.add(rim);
        const innerRim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.025, 5, 24), glow);
        innerRim.rotation.x = Math.PI / 2;
        innerRim.position.set(0, 0.075, 0.18);
        group.add(innerRim);

        const rabbit = new THREE.Group();
        rabbit.name = 'white-rabbit-guide';
        rabbit.position.set(-0.88, 0.07, 0.46);
        const fur = new THREE.MeshStandardMaterial({ color: 0xf7f3ff, roughness: 0.9 });
        const earInner = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.84 });
        const eye = new THREE.MeshBasicMaterial({ color: 0x20142f });
        const nose = new THREE.MeshBasicMaterial({ color: 0xff6fae });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), fur);
        body.position.set(0, 0.34, 0);
        body.scale.set(1.05, 1.0, 1.18);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), fur);
        head.position.set(0, 0.64, 0.055);
        const leftEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 3, 7), fur);
        const rightEar = leftEar.clone();
        leftEar.position.set(-0.095, 0.91, 0.015);
        rightEar.position.set(0.095, 0.93, -0.005);
        leftEar.rotation.z = -0.16;
        rightEar.rotation.z = 0.13;
        const leftInner = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.17, 3, 6), earInner);
        const rightInner = leftInner.clone();
        leftInner.position.set(-0.095, 0.92, 0.064);
        rightInner.position.set(0.095, 0.94, 0.044);
        leftInner.rotation.z = -0.16;
        rightInner.rotation.z = 0.13;
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eye);
        const eyeR = eyeL.clone();
        eyeL.position.set(-0.075, 0.67, 0.205);
        eyeR.position.set(0.075, 0.67, 0.205);
        const rabbitNose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), nose);
        rabbitNose.position.set(0, 0.60, 0.225);
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fur);
        tail.position.set(-0.23, 0.38, -0.12);
        rabbit.add(body, head, leftEar, rightEar, leftInner, rightInner, eyeL, eyeR, rabbitNose, tail);
        group.add(rabbit);

        const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.92, 6), dark);
        signPost.position.set(1.02, 0.49, -0.18);
        group.add(signPost);
        const signBoard = new THREE.Mesh(
          new THREE.BoxGeometry(1.55, 0.62, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x20112f, metalness: 0.28, roughness: 0.46, emissive: 0x581c87, emissiveIntensity: 0.22 }),
        );
        signBoard.position.set(1.02, 1.15, -0.18);
        group.add(signBoard);
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 320;
        signCanvas.height = 128;
        const signContext = signCanvas.getContext('2d');
        if (signContext) {
          signContext.fillStyle = '#20112f';
          signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
          signContext.strokeStyle = '#f0abfc';
          signContext.lineWidth = 5;
          signContext.strokeRect(4, 4, signCanvas.width - 8, signCanvas.height - 8);
          signContext.textAlign = 'center';
          signContext.fillStyle = '#fff7ff';
          signContext.font = 'bold 27px sans-serif';
          signContext.fillText('ZA KRÓLIKIEM', 160, 52);
          signContext.fillStyle = '#f9a8d4';
          signContext.font = 'bold 21px sans-serif';
          signContext.fillText('WEJDŹ DO NORKI', 160, 91);
        }
        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.colorSpace = THREE.SRGBColorSpace;
        signTexture.anisotropy = 2;
        group.userData.dynamicTextures = [signTexture];
        const signFace = new THREE.Mesh(
          new THREE.PlaneGeometry(1.42, 0.54),
          new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false, side: THREE.DoubleSide }),
        );
        signFace.position.set(1.02, 1.15, -0.125);
        group.add(signFace);

        const arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.075, 0.10), new THREE.MeshBasicMaterial({ color: 0xfbbf24, toneMapped: false }));
        arrowShaft.position.set(0.52, 1.15, -0.11);
        const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 4), new THREE.MeshBasicMaterial({ color: 0xfbbf24, toneMapped: false }));
        arrowHead.rotation.z = Math.PI / 2;
        arrowHead.position.set(0.29, 1.15, -0.11);
        group.add(arrowShaft, arrowHead);
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.35, 5), glow);
        beacon.position.set(0, 0.78, 0.18);
        group.add(beacon);
      } else {
        const coreGeometry = secret.style === 'wz'
          ? new THREE.BoxGeometry(0.48, 0.34, 0.12)
          : secret.style === 'cassette'
            ? new THREE.BoxGeometry(0.38, 0.26, 0.22)
            : new THREE.IcosahedronGeometry(0.29, 1);
        const core = new THREE.Mesh(coreGeometry, gold);
        core.position.y = 0.76;
        group.add(core);
        if (secret.style === 'wz') {
          const folded = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.15), dark);
          folded.position.set(0.12, 0.78, 0.02);
          group.add(folded);
        } else if (secret.style === 'cassette') {
          const reelA = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 5, 10), dark);
          const reelB = reelA.clone();
          reelA.position.set(-0.09, 0.76, 0.12);
          reelB.position.set(0.09, 0.76, 0.12);
          group.add(reelA, reelB);
        } else {
          const earA = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.20, 5), gold);
          const earB = earA.clone();
          earA.position.set(-0.16, 1.02, 0);
          earB.position.set(0.16, 1.02, 0);
          group.add(earA, earB);
        }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 18), glow);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.12;
        group.add(ring);
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 5), glow);
        beacon.position.y = 1.22;
        group.add(beacon);
      }

      group.position.set(secret.x, 0.08, secret.z);
      group.scale.setScalar(secret.style === 'rabbit_hole' ? 1.12 : index === 2 ? 0.94 : 1);
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      });
      this.levelRoot.add(group);
      this.survivalSecrets.push({ id: secret.id, name: secret.name, mesh: group, age: 0, collected: false });
    }
  }

  private beginOniricDream() {
    // The collected landmark now opens a real side-scrolling 2D platformer.
    // The main Survival simulation is paused by the UI callback until the
    // player returns from the rabbit-hole stage.
    this.oniricDreamRemainingSeconds = 0;
    this.oniricDreamCameraActive = false;
    this.callbacks.onSurvivalAnnouncement?.(
      'ONIRYCZNY SEN',
      'NORKA KRÓLIKA • PLATFORMÓWKA 2D',
      'Królik zostawił trzy kieszonkowe zegarki po drugiej stronie lustra. Zbierz je, omiń filiżanki i dotrzyj do portalu, zanim skończy się czas.',
    );
    this.emitFloatingToast('🐇 KRÓLIK OTWIERA NORKĘ — ZA NIM!', this.playerPos.x, this.playerPos.y + 1.85, this.playerPos.z, 'easter-egg');
    this.triggerBloomPulse(0.42);
    this.triggerScreenShake(0.22, 0.16);
    sound.playEasterEgg();
  }

  private updateSurvivalSecrets(dt: number) {
    if (this.gameMode !== 'survival' || this.survivalSecrets.length === 0) return;
    for (const secret of this.survivalSecrets) {
      if (secret.collected) continue;
      secret.age += dt;
      secret.mesh.rotation.y += dt * (secret.id === 'oniric_dream' ? 0.16 : 0.65 + (secret.id.length % 3) * 0.12);
      secret.mesh.position.y = 0.08 + Math.sin(secret.age * 2.1) * 0.10;
      const distance = Math.hypot(secret.mesh.position.x - this.playerPos.x, secret.mesh.position.z - this.playerPos.z);
      if (distance > 1.35 || Math.abs(secret.mesh.position.y + 0.65 - this.playerPos.y) > 1.45) continue;

      secret.collected = true;
      this.levelRoot.remove(secret.mesh);
      this.disposeObjectResources(secret.mesh);
      secret.mesh.clear();
      this.survivalSecretsFound++;
      if (secret.id === 'oniric_dream') this.beginOniricDream();
      this.score += 750;
      this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
      this.callbacks.onSurvivalSecretFound?.(this.survivalMapId, secret.id, secret.name);
      this.emitFloatingToast('✦ SEKRET ODKRYTY: ' + secret.name.toUpperCase() + ' • +750 PKT', this.playerPos.x, this.playerPos.y + 1.65, this.playerPos.z, 'easter-egg');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.25, this.playerPos.z, 0xfbbf24);
      this.triggerBloomPulse(0.28);
      sound.playEasterEgg();
      this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    }
  }


  private addSurvivalArenaInstance(instance: THREE.InstancedMesh) {
    instance.castShadow = false;
    instance.receiveShadow = false;
    instance.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instance.computeBoundingBox();
    instance.computeBoundingSphere();
    this.survivalArenaInstances.push(instance);
    this.survivalArenaInstanceGeometries.add(instance.geometry);
    const materials = Array.isArray(instance.material) ? instance.material : [instance.material];
    for (const material of materials) {
      this.survivalArenaInstanceMaterials.add(material);
      const mapped = material as THREE.Material & { map?: THREE.Texture | null };
      if (mapped.map) this.survivalArenaInstanceTextures.add(mapped.map);
    }
    this.levelRoot.add(instance);
  }

  private disposeSurvivalArenaInstances() {
    for (const instance of this.survivalArenaInstances) {
      instance.removeFromParent();
      instance.dispose();
    }
    this.survivalArenaInstances.length = 0;
    for (const geometry of this.survivalArenaInstanceGeometries) geometry.dispose();
    this.survivalArenaInstanceGeometries.clear();
    for (const material of this.survivalArenaInstanceMaterials) material.dispose();
    this.survivalArenaInstanceMaterials.clear();
    for (const texture of this.survivalArenaInstanceTextures) texture.dispose();
    this.survivalArenaInstanceTextures.clear();
    this.survivalArenaLabelMaterials.clear();
  }

  private getSurvivalArenaLabelMaterial(label: string, accent: string) {
    const key = label + ':' + accent;
    const existing = this.survivalArenaLabelMaterials.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    if (!context) {
      const fallback = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false, side: THREE.DoubleSide });
      this.survivalArenaLabelMaterials.set(key, fallback);
      return fallback;
    }
    context.fillStyle = '#081521';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = accent;
    context.lineWidth = 10;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    context.fillStyle = accent;
    context.fillRect(18, 18, 12, canvas.height - 36);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#f8fafc';
    context.font = '800 56px Arial, sans-serif';
    context.fillText(label, 276, 65, 420);
    context.fillStyle = '#a9bdce';
    context.font = '700 17px Arial, sans-serif';
    context.fillText('CENTRUM B4  •  LOGISTYKA', 276, 112, 420);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
    this.survivalArenaLabelMaterials.set(key, material);
    return material;
  }

  private buildSurvivalArenaDressing(mapId: SurvivalMapId = this.survivalMapId) {
    const mapDefinition = getSurvivalMapDefinition(mapId);
    const steel = new THREE.MeshStandardMaterial({ color: mapId === 'cold_storage' ? 0x8bb9c9 : mapId === 'night_sorting' ? 0x54365e : 0x3b4f60, metalness: 0.72, roughness: 0.42 });
    const orange = new THREE.MeshStandardMaterial({
      color: mapDefinition.accentColor, metalness: 0.38, roughness: 0.54,
      emissive: mapDefinition.accentColor, emissiveIntensity: 0.12,
    });
    const deck = new THREE.MeshStandardMaterial({ color: 0x647383, metalness: 0.58, roughness: 0.58 });
    const cargoMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.06 });
    const dummy = new THREE.Object3D();

    // Roof trusses, service pipes and longitudinal rails form a coherent high-bay ceiling.
    const trusses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.25, 36.5), steel, 5);
    for (let i = 0; i < 5; i++) {
      dummy.position.set(-48 + i * 24, 8.78, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trusses.setMatrixAt(i, dummy.matrix);
    }
    trusses.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(trusses);

    const roofRails = new THREE.InstancedMesh(new THREE.BoxGeometry(112, 0.16, 0.2), orange, 2);
    for (let i = 0; i < 2; i++) {
      dummy.position.set(0, 8.68, i === 0 ? -18.0 : 18.0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      roofRails.setMatrixAt(i, dummy.matrix);
    }
    roofRails.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(roofRails);

    const servicePipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 112, 8), steel, 3);
    for (let i = 0; i < 3; i++) {
      dummy.position.set(0, 7.92, -6 + i * 6);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      servicePipes.setMatrixAt(i, dummy.matrix);
    }
    servicePipes.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(servicePipes);

    // Perimeter pallet racks add vertical scale while leaving the main combat lane open.
    const centers = [-45, -30, -15, 0, 15, 30, 45];
    const sides = [-1, 1];
    const rackCount = centers.length * sides.length;
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 4.15, 0.17), orange, rackCount * 4);
    let index = 0;
    for (const side of sides) for (const x of centers) {
      for (const dx of [-4.25, 4.25]) for (const dz of [-0.98, 0.98]) {
        dummy.position.set(x + dx, 2.08, side * 16.15 + dz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        posts.setMatrixAt(index++, dummy.matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(posts);

    // The visible rack footprint remains a real movement and collision obstacle.
    // Gaps between the 15 m rack centres remain open as deliberate navigation routes.
    for (const side of sides) {
      for (const x of centers) {
        this.survivalObstacles.push({ x, z: side * 16.15, halfWidth: 4.42, halfDepth: 1.16 });
      }
    }

    const shelves = new THREE.InstancedMesh(new THREE.BoxGeometry(8.72, 0.15, 2.12), deck, rackCount * 3);
    index = 0;
    for (const side of sides) for (const x of centers) for (const y of [0.48, 1.82, 3.16]) {
      dummy.position.set(x, y, side * 16.15);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shelves.setMatrixAt(index++, dummy.matrix);
    }
    shelves.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(shelves);

    const cargo = new THREE.InstancedMesh(new THREE.BoxGeometry(2.0, 0.88, 1.38), cargoMaterial, rackCount * 6);
    const palette = [0x566b7c, 0x8b6845, 0x394c5e, 0xa36b35, 0x6a7480];
    index = 0;
    for (const side of sides) for (let row = 0; row < centers.length; row++) for (let level = 0; level < 3; level++) {
      for (let slot = 0; slot < 2; slot++) {
        dummy.position.set(centers[row] + (slot === 0 ? -2.2 : 2.2), 0.98 + level * 1.34, side * 16.15);
        dummy.rotation.set(0, (row + level + slot) % 2 === 0 ? 0 : Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cargo.setMatrixAt(index, dummy.matrix);
        cargo.setColorAt(index, new THREE.Color(palette[(row + level * 2 + slot) % palette.length]));
        index++;
      }
    }
    cargo.instanceMatrix.needsUpdate = true;
    if (cargo.instanceColor) cargo.instanceColor.needsUpdate = true;
    this.addSurvivalArenaInstance(cargo);

    // Loading-bay shutters, safety frames and approach markings clarify both end wings.
    const dockZ = [-11, 0, 11];
    const shutters = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 6.35, 7.1), deck, 6);
    index = 0;
    for (const side of sides) for (const z of dockZ) {
      dummy.position.set(side * 58.78, 3.3, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shutters.setMatrixAt(index++, dummy.matrix);
    }
    shutters.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(shutters);

    const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.07, 7.0), steel, 60);
    index = 0;
    for (const side of sides) for (const z of dockZ) for (let rib = 0; rib < 10; rib++) {
      dummy.position.set(side * 58.64, 0.5 + rib * 0.61, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ribs.setMatrixAt(index++, dummy.matrix);
    }
    ribs.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(ribs);

    const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 6.8, 0.16), orange, 12);
    index = 0;
    for (const side of sides) for (const z of dockZ) for (const edge of [-3.62, 3.62]) {
      dummy.position.set(side * 58.54, 3.4, z + edge);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      frames.setMatrixAt(index++, dummy.matrix);
    }
    frames.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(frames);

    const tops = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.18, 7.35), orange, 6);
    index = 0;
    for (const side of sides) for (const z of dockZ) {
      dummy.position.set(side * 58.54, 6.9, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tops.setMatrixAt(index++, dummy.matrix);
    }
    tops.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(tops);

    const stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(4.7, 0.024, 0.13), orange, 24);
    index = 0;
    for (const side of sides) for (const z of dockZ) for (let stripe = 0; stripe < 4; stripe++) {
      dummy.position.set(side * (51.0 + stripe * 1.15), 0.022, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stripes.setMatrixAt(index++, dummy.matrix);
    }
    stripes.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(stripes);

    // Small, repeated aisle identifiers are visible as landmarks rather than HUD clutter.
    const signs = [
      { label: 'STREFA 01', accent: '#38bdf8', x: -30, y: 6.4, z: -19.39, rotation: 0 },
      { label: 'STREFA 02', accent: '#f59e0b', x: 0, y: 6.4, z: -19.39, rotation: 0 },
      { label: 'STREFA 03', accent: '#34d399', x: 30, y: 6.4, z: -19.39, rotation: 0 },
      { label: 'STREFA 01', accent: '#38bdf8', x: -30, y: 6.4, z: 19.39, rotation: Math.PI },
      { label: 'STREFA 02', accent: '#f59e0b', x: 0, y: 6.4, z: 19.39, rotation: Math.PI },
      { label: 'STREFA 03', accent: '#34d399', x: 30, y: 6.4, z: 19.39, rotation: Math.PI },
      { label: 'DOK 01', accent: '#f59e0b', x: -58.94, y: 7.55, z: 0, rotation: Math.PI / 2 },
      { label: 'DOK 02', accent: '#f59e0b', x: 58.94, y: 7.55, z: 0, rotation: -Math.PI / 2 },
    ];
    const backboards = new THREE.InstancedMesh(new THREE.BoxGeometry(3.7, 1.38, 0.16), steel, signs.length);
    const signFaces = new THREE.Group();
    index = 0;
    for (const sign of signs) {
      const signY = sign.y ?? 6.4;
      dummy.position.set(sign.x, signY, sign.z);
      dummy.rotation.set(0, sign.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      backboards.setMatrixAt(index++, dummy.matrix);

      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(3.38, 1.12),
        this.getSurvivalArenaLabelMaterial(sign.label, sign.accent)
      );
      const offsetX = sign.rotation === Math.PI / 2 ? 0.09 : sign.rotation === -Math.PI / 2 ? -0.09 : 0;
      const offsetZ = sign.rotation === 0 ? 0.09 : sign.rotation === Math.PI ? -0.09 : 0;
      face.position.set(sign.x + offsetX, signY, sign.z + offsetZ);
      face.rotation.y = sign.rotation;
      face.castShadow = false;
      face.receiveShadow = false;
      signFaces.add(face);
    }
    backboards.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(backboards);
    signFaces.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.Material & { map?: THREE.Texture | null };
        this.survivalArenaInstanceGeometries.add(child.geometry);
        this.survivalArenaInstanceMaterials.add(child.material as THREE.Material);
        if (material.map) this.survivalArenaInstanceTextures.add(material.map);
      }
    });
    this.registerCameraOccludersInGroup(signFaces, 0.12);
    this.levelRoot.add(signFaces);
  }


  public getGameMode(): 'campaign' | 'survival' | 'pvp' {
    return this.gameMode;
  }

  /** Game simulation speed; rendering remains controlled by the display refresh rate. */
  public getTimeScale(): 1 | 2 {
    return this.timeScale;
  }

  public setTimeScale(scale: number): 1 | 2 {
    this.timeScale = scale >= 1.5 ? 2 : 1;
    return this.timeScale;
  }

  /** Mobile-only CPU fallback tier controlled by the measured renderer FPS. */
  public setAdaptivePerformanceTier(tier: number): 0 | 1 | 2 {
    this.adaptivePerformanceTier = tier >= 2 ? 2 : tier >= 1 ? 1 : 0;
    return this.adaptivePerformanceTier;
  }


  private registerSurvivalShiftEventAction(action: SurvivalShiftEventAction, amount = 1): void {
    if (this.gameMode !== 'survival' || !this.survivalShiftEvent.active) return;
    const previousProgress = this.survivalShiftEvent.active.progress;
    const result = registerSurvivalShiftEventAction(this.survivalShiftEvent, action, amount, this.survivalElapsed);
    this.survivalShiftEvent = result.state;
    if (result.state.active && result.state.active.progress !== previousProgress) {
      this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    }
    if (!result.completed) return;

    const payout = 420 + this.survivalWave * 35;
    const bonusXp = Math.min(10, 5 + Math.floor(this.survivalWave / 4));
    this.score += payout;
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
    this.spawnSurvivalXpGem(this.playerPos.x + 1.25, this.playerPos.y, this.playerPos.z + 0.8, bonusXp);
    this.emitFloatingToast('EVENT ZALICZONY • +' + payout + ' PKT • +' + bonusXp + ' XP', this.playerPos.x, this.playerPos.y + 1.9, this.playerPos.z, 'combo');
    this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.45, this.playerPos.z, 0x38bdf8);
    this.triggerHitStop(0.10);
    this.triggerScreenShake(0.18, 0.12);
    this.triggerBloomPulse(0.34);
    sound.playPickup(3);
    this.callbacks.onSurvivalAnnouncement?.('EVENT ZALICZONY', result.completed.title + ' • +' + payout + ' PKT', 'Dodatkowy kryształ doświadczenia pojawił się obok operatora.');

    if (this.survivalShiftEvent.successStreak >= 3 && !this.survivalGoldenPalletFound) {
      this.survivalGoldenPalletFound = true;
      this.score += 1200;
      this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
      this.spawnSurvivalXpGem(this.playerPos.x - 1.4, this.playerPos.y, this.playerPos.z - 0.9, 12);
      this.emitFloatingToast('✦ SEKRET: ZŁOTA PALETA LEGENDY • +1200 PKT', this.playerPos.x, this.playerPos.y + 2.2, this.playerPos.z, 'easter-egg');
      this.callbacks.onSurvivalAnnouncement?.('ZŁOTA PALETA LEGENDY', 'TRZY EVENTY Z RZĘDU • SEKRET ODKRYTY', 'Stara paleta z pierwszej zmiany wróciła do magazynu. Zgarnij legendarny ładunek XP.');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.6, this.playerPos.z, 0xfbbf24);
      this.triggerBloomPulse(0.55);
      sound.playEasterEgg();
    }
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
  }

  private registerSurvivalContractAction(action: SurvivalContractAction, amount = 1): void {
    if (this.gameMode !== 'survival' || this.survivalContract.completed || this.survivalContract.expired) return;
    const result = registerSurvivalContractAction(this.survivalContract, action, amount);
    this.survivalContract = result.state;
    if (!result.completedNow) return;

    const payout = 220 + this.survivalWave * 45;
    const bonusXp = Math.min(8, 3 + Math.floor((this.survivalWave - 1) / 3));
    this.score += payout;
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
    this.spawnSurvivalXpGem(
      this.playerPos.x + 1.15,
      this.playerPos.y,
      this.playerPos.z + 0.7,
      bonusXp
    );
    this.emitFloatingToast(
      'KONTRAKT ZALICZONY • +' + payout + ' PKT • +' + bonusXp + ' XP',
      this.playerPos.x, this.playerPos.y + 1.85, this.playerPos.z, 'combo'
    );
    this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.42, this.playerPos.z, 0x34d399);
    this.triggerHitStop(0.09);
    this.triggerScreenShake(0.16, 0.12);
    this.triggerBloomPulse(0.28);
    sound.playPickup(2);
    this.callbacks.onSurvivalAnnouncement?.(
      'KONTRAKT ZALICZONY',
      this.survivalContract.title + ' • PREMIA ' + payout + ' PKT',
      'Premia doświadczenia (' + bonusXp + ' XP) pojawiła się obok operatora. Następny cel pojawi się wraz z kolejną falą.'
    );
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
  }

  public getSurvivalSnapshot(): SurvivalSnapshot {
    const progression = getSurvivalProgressionInfo(this.survivalLevel);
    return {
      elapsedSeconds: Math.floor(this.survivalElapsed),
      wave: this.survivalWave,
      kills: this.survivalKills,
      perfectDodges: this.survivalPerfectDodges,
      counterattackReady: this.survivalCounterattackReady,
      killStreak: this.survivalMomentum.killStreak,
      overdriveRemainingSeconds: this.survivalMomentum.overdriveRemainingSeconds,
      mapId: this.survivalMapId,
      mapName: getSurvivalMapDefinition(this.survivalMapId).name,
      mapSubtitle: getSurvivalMapDefinition(this.survivalMapId).subtitle,
      secretsFound: this.survivalSecretsFound,
      totalSecrets: getSurvivalMapDefinition(this.survivalMapId).secretLocations.length,
      bossesDefeated: this.survivalBossesDefeated,
      contract: { ...this.survivalContract },
      event: this.survivalShiftEvent.active ? { ...this.survivalShiftEvent.active } : null,
      level: this.survivalLevel,
      rankName: progression.rankName,
      nextRankName: progression.nextRankName,
      nextRankLevel: progression.nextRankLevel,
      xp: this.survivalXp,
      xpToNext: this.survivalXpToNext,
      xpStreak: this.survivalXpStreak.count,
      aliveEnemies: this.enemies.reduce((count, enemy) => count + (enemy.state === 'defeated' ? 0 : 1), 0),
      rerolls: this.survivalRerolls,
      skips: this.survivalSkips,
      activeHazards: this.hazards.filter((hazard) => hazard.active).length,
      weapons: this.survivalWeapons.map((weapon) => ({
        id: weapon.id,
        name: weapon.evolved ? SURVIVAL_WEAPON_DEFS[weapon.id].evolvedName : SURVIVAL_WEAPON_DEFS[weapon.id].name,
        icon: SURVIVAL_WEAPON_DEFS[weapon.id].icon,
        level: weapon.level,
        evolved: Boolean(weapon.evolved),
      })),
    };
  }

  /** Final per-source HP contribution shown on the post-run screen. */
  public getSurvivalDamageReport(): SurvivalDamageReport {
    return buildSurvivalDamageReport(this.survivalDamageStats);
  }

  public chooseSurvivalUpgrade(id: string): boolean {
    if (this.gameMode !== 'survival' || this.state !== 'levelup') return false;
    const choice = this.survivalPendingOptions.find((option) => option.id === id);
    if (!choice) return false;

    if (choice.id.startsWith('weapon_unlock:')) {
      const weaponId = choice.id.slice('weapon_unlock:'.length) as SurvivalWeaponId;
      if (!this.survivalWeapons.some((weapon) => weapon.id === weaponId)) {
        const initialLevel = getSurvivalWeaponInitialLevel(choice.rarity);
        this.survivalWeapons.push({
          id: weaponId,
          level: initialLevel,
          // Preserve a readable first reload while rewarding higher-rarity unlocks with a head start.
          cooldown: this.getScaledSurvivalWeaponReloadSeconds(weaponId, initialLevel, false) * SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR,
        });
        sound.playAbility(this.currentCharacterId);
      }
    } else if (choice.id.startsWith('weapon_upgrade:')) {
      const weaponId = choice.id.slice('weapon_upgrade:'.length) as SurvivalWeaponId;
      const weapon = this.survivalWeapons.find((entry) => entry.id === weaponId);
      if (weapon && weapon.level < 5) {
        weapon.level = Math.min(5, weapon.level + getSurvivalWeaponUpgradeSteps(choice.rarity));
        const upgradedCooldown = this.getScaledSurvivalWeaponReloadSeconds(
          weaponId, weapon.level, !!weapon.evolved
        );
        // Keep the current reload; if it was already ready, add a short recovery
        // instead of firing immediately as a side effect of the level-up.
        weapon.cooldown = getWeaponRecoveryAfterUpgrade(weapon.cooldown, upgradedCooldown);
      }
    } else if (choice.id.startsWith('weapon_evolve:')) {
      const weaponId = choice.id.slice('weapon_evolve:'.length) as SurvivalWeaponId;
      const weapon = this.survivalWeapons.find((entry) => entry.id === weaponId);
      const definition = SURVIVAL_WEAPON_DEFS[weaponId];
      const hasPassivePair = (this.survivalUpgradeStacks[definition.evolutionPassive] || 0) > 0;
      if (weapon && weapon.level >= 5 && !weapon.evolved && this.survivalElapsed >= 210 && hasPassivePair) {
        weapon.evolved = true;
        const evolvedCooldown = this.getScaledSurvivalWeaponReloadSeconds(weaponId, weapon.level, true);
        // Evolution changes impact and grants only a modest reload improvement.
        weapon.cooldown = getWeaponRecoveryAfterUpgrade(weapon.cooldown, evolvedCooldown);
        this.triggerBloomPulse(0.7);
        this.triggerScreenShake(0.24, 0.2);
        this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.6, this.playerPos.z, definition.color);
        this.callbacks.onPerkDropBanner?.(
          definition.evolvedName,
          '✦',
          definition.name + ' osiągnęła pełną ewolucję. Jej zachowanie i siła ataku zostały ulepszone.',
          '#fbbf24'
        );
        sound.playAbility(this.currentCharacterId);
      }
    } else if (choice.id === 'boss_damage_core') {
      this.survivalDamageMultiplier = Math.min(2.05, this.survivalDamageMultiplier * 1.24);
    } else if (choice.id === 'boss_weapon_overdrive') {
      this.survivalAttackRateMultiplier = Math.max(0.78, this.survivalAttackRateMultiplier * 0.92);
      this.survivalWeaponReloadMultiplier = Math.max(0.72, this.survivalWeaponReloadMultiplier * 0.92);
    } else if (choice.id === 'boss_bulwark') {
      this.maxHp += 2;
      this.hp = Math.min(this.maxHp, this.hp + 2);
      this.activePerks.shield = true;
      this.callbacks.onHpUpdate(this.hp, this.maxHp);
      this.callbacks.onPerksUpdate?.(this.activePerks);
    } else {
      const strength = choice.strengthMultiplier;
      this.survivalUpgradeStacks[choice.id] = (this.survivalUpgradeStacks[choice.id] || 0) + 1;
      switch (choice.id) {
      case 'damage':
        this.survivalDamageMultiplier = Math.min(2.05, this.survivalDamageMultiplier * (1 + 0.12 * strength));
        break;
      case 'rapid':
        // Attack-speed upgrades remain useful without turning the run into a screen-filling machine gun.
        this.survivalAttackRateMultiplier = Math.max(0.78, this.survivalAttackRateMultiplier * (1 - 0.03 * strength));
        break;
      case 'critical':
        this.survivalCriticalChance = Math.min(0.30, this.survivalCriticalChance + 0.04 * strength);
        break;
      case 'critical_damage':
        this.survivalCriticalDamageMultiplier = Math.min(2.85, this.survivalCriticalDamageMultiplier + 0.20 * strength);
        break;
      case 'dash':
        this.survivalDashCooldownMultiplier = Math.max(0.48, this.survivalDashCooldownMultiplier * (1 - 0.12 * strength));
        break;
      case 'ability': {
        const previousMultiplier = this.survivalAbilityCooldownMultiplier;
        this.survivalAbilityCooldownMultiplier = Math.max(0.68, previousMultiplier * (1 - 0.08 * strength));
        const efficiencyFactor = this.survivalAbilityCooldownMultiplier / previousMultiplier;
        this.abilityCooldownState = scaleAbilityCooldown(this.abilityCooldownState, efficiencyFactor);
        this.updateAbilityCooldown(0, true);
        break;
      }
      case 'boots':
        this.survivalMoveMultiplier = Math.min(1.38, this.survivalMoveMultiplier * (1 + 0.06 * strength));
        break;
      case 'magnet':
        this.survivalMagnetMultiplier = Math.min(4.2, this.survivalMagnetMultiplier * (1 + 0.65 * strength));
        break;
      case 'reinforced': {
        const bonusHp = Math.max(1, Math.round(strength));
        this.maxHp += bonusHp;
        this.hp = Math.min(this.maxHp, this.hp + bonusHp);
        this.callbacks.onHpUpdate(this.hp, this.maxHp);
        break;
      }
      case 'medkit': {
        const healedHp = Math.max(1, Math.round(strength));
        this.hp = Math.min(this.maxHp, this.hp + healedHp);
        this.activePerks.shield = true;
        this.callbacks.onHpUpdate(this.hp, this.maxHp);
        this.callbacks.onPerksUpdate?.(this.activePerks);
        break;
      }
      case 'range':
        this.survivalRangeMultiplier = Math.min(1.75, this.survivalRangeMultiplier * (1 + 0.08 * strength));
        break;
      case 'growth':
        this.survivalXpMultiplier = Math.min(3.2, this.survivalXpMultiplier * (1 + 0.18 * strength));
        break;
      case 'scavenger':
        this.survivalDropMultiplier = Math.min(3.2, this.survivalDropMultiplier * (1 + 0.25 * strength));
        break;
      case 'regen':
        this.survivalRegenMultiplier = Math.min(2.8, this.survivalRegenMultiplier + 0.35 * strength);
        break;
      case 'drone':
        this.activePerks.arcDrone = Math.max(this.activePerks.arcDrone || 0, Math.round(32 * strength));
        this.callbacks.onPerksUpdate?.(this.activePerks);
        break;
      case 'armor':
        this.activePerks.damageWard = Math.max(this.activePerks.damageWard || 0, Math.round(24 * strength));
        this.callbacks.onPerksUpdate?.(this.activePerks);
        break;
      case 'ricochet':
        this.survivalRicochetStrength = Math.min(1.55, this.survivalRicochetStrength * (1 + 0.08 * strength));
        break;
      case 'radiation':
        this.survivalRadiationStrength = Math.min(1.75, this.survivalRadiationStrength * (1 + 0.12 * strength));
        this.survivalRadiationTimer = Math.min(this.survivalRadiationTimer, 0.35);
        break;
      case 'shrapnel':
        this.survivalShrapnelStrength = Math.min(1.65, this.survivalShrapnelStrength * (1 + 0.10 * strength));
        break;
      }
    }

    this.checkSurvivalEvolutions();
    this.survivalPendingOptions = [];
    this.survivalBossRewardPending = false;
    this.survivalRankUpPending = false;
    this.state = 'playing';
    sound.startMusic();
    this.emitFloatingToast(choice.rarityLabel + ' MODUŁ: ' + choice.title, this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'perk');
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());

    if (this.survivalXp >= this.survivalXpToNext) {
      this.beginSurvivalLevelUp();
    }
    return true;
  }

  private checkSurvivalEvolutions() {
    const stacks = this.survivalUpgradeStacks;
    const unlock = (id: string, title: string, description: string, apply: () => void) => {
      if (this.survivalEvolutions.has(id)) return;
      this.survivalEvolutions.add(id);
      apply();
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xfbbf24);
      this.triggerBloomPulse(0.65);
      this.triggerScreenShake(0.22, 0.18);
      this.emitFloatingToast('EWOLUCJA: ' + title, this.playerPos.x, this.playerPos.y + 2.0, this.playerPos.z, 'combo');
      this.callbacks.onPerkDropBanner?.(title, '✨', description, '#fbbf24');
      sound.playAbility(this.currentCharacterId);
    };
    if ((stacks.ability || 0) >= 3 && (stacks.rapid || 0) >= 2) {
      unlock('ultimate_charge_chain', 'ŁAŃCUCH MOCY', 'Eliminacje ładują superumiejętność o 25% szybciej, a łączny bonus z eliminacji może skrócić jej ładowanie maksymalnie o 30%.', () => {
        this.survivalAbilityKillRechargeMultiplier = 1.25;
        this.survivalAbilityKillRechargeCapRatio = 0.30;
      });
    }
    if ((stacks.critical || 0) >= 3 && (stacks.critical_damage || 0) >= 2) {
      unlock('critical_protocol', 'PROTOKÓŁ KRYTYCZNY', 'Precyzyjny operator: dodatkowe +5 punktów procentowych szansy na trafienie krytyczne i mnożnik obrażeń krytycznych ×2,5.', () => {
        this.survivalCriticalChance = Math.min(0.30, this.survivalCriticalChance + 0.05);
        this.survivalCriticalDamageMultiplier = Math.max(this.survivalCriticalDamageMultiplier, 2.5);
      });
    }
    if ((stacks.dash || 0) >= 3 && (stacks.boots || 0) >= 2) {
      unlock('ghost_protocol', 'KROK WIDMA', 'Połączony trening mobilności: unik odnawia się szybciej, a operator zyskuje dodatkową prędkość ruchu.', () => {
        this.survivalDashCooldownMultiplier = Math.max(0.50, this.survivalDashCooldownMultiplier * 0.88);
        this.survivalMoveMultiplier = Math.min(1.30, this.survivalMoveMultiplier * 1.08);
      });
    }
    if ((stacks.damage || 0) >= 3 && (stacks.rapid || 0) >= 2) {
      unlock('overdrive', 'OVERDRIVE: LINIA OGNIA', '+22% obrażeń i umiarkowane przyspieszenie ataku.', () => {
        this.survivalDamageMultiplier *= 1.22; this.survivalAttackRateMultiplier *= 0.94;
      });
    }
    if ((stacks.drone || 0) >= 2 && (stacks.range || 0) >= 2) {
      unlock('piorun_mk2', 'PIORUN MK II', 'Dron atakuje częściej i namierza cele z większej odległości.', () => {
        this.activePerks.arcDrone = Math.max(this.activePerks.arcDrone || 0, 45);
        this.survivalDroneCooldown = 0.72;
        this.survivalRangeMultiplier = Math.min(2.2, this.survivalRangeMultiplier * 1.18);
        this.callbacks.onPerksUpdate?.(this.activePerks);
      });
    }
    if ((stacks.growth || 0) >= 2 && (stacks.scavenger || 0) >= 2) {
      unlock('premium_logistics', 'PREMIUM LOGISTICS', 'Stałe +25% XP i +20% szansy na dodatkowe zrzuty.', () => {
        this.survivalXpMultiplier = Math.min(3.2, this.survivalXpMultiplier * 1.25);
        this.survivalDropMultiplier = Math.min(3.2, this.survivalDropMultiplier * 1.20);
      });
    }
    if ((stacks.regen || 0) >= 2 && (stacks.armor || 0) >= 2) {
      unlock('bhp_fortress', 'FORT BHP', 'Regeneracja działa szybciej, a osłona dłużej chroni przed trafieniami.', () => {
        this.survivalRegenMultiplier = Math.min(2.8, this.survivalRegenMultiplier + 0.8);
        this.activePerks.damageWard = Math.max(this.activePerks.damageWard || 0, 36);
        this.callbacks.onPerksUpdate?.(this.activePerks);
      });
    }
    if ((stacks.ricochet || 0) >= 2 && (stacks.radiation || 0) >= 2) {
      unlock('chain_reactor', 'REAKTOR ŁAŃCUCHOWY', 'Rykoszety zachowują więcej mocy, a pole radiacyjne pulsuje szybciej, szerzej i mocniej.', () => {
        this.survivalRicochetStrength = Math.min(1.7, this.survivalRicochetStrength * 1.18);
        this.survivalRadiationStrength = Math.min(1.9, this.survivalRadiationStrength * 1.18);
        this.survivalRadiationTimer = Math.min(this.survivalRadiationTimer, 0.4);
      });
    }
    if ((stacks.shrapnel || 0) >= 2 && (stacks.ricochet || 0) >= 2) {
      unlock('crystal_cascade', 'KRYSZTAŁOWA KASKADA', 'Krytyczne trafienie rozrzuca większy wachlarz odłamków. Wybucha przy celu, może trafić do trzech pobliskich przeciwników i nadal aktywuje się tylko raz na salwę.', () => {
        this.survivalShrapnelStrength = Math.min(1.65, this.survivalShrapnelStrength * 1.12);
      });
    }
  }

  private rollSurvivalUpgradeOptions(excluded: string[] = []): SurvivalUpgradeOption[] {
    type BaseOption = Omit<SurvivalUpgradeOption, 'rarity' | 'rarityLabel' | 'strengthMultiplier'>;
    const pool: BaseOption[] = [
      { id: 'damage', icon: '🎯', title: 'WZMOCNIONA AMUNICJA', description: '+12% obrażeń wszystkich ataków operatora.' },
      { id: 'rapid', icon: '⚡', title: 'RYTM ATAKU', description: 'Skrócenie czasu między atakami o 3%.' },
      { id: 'critical', icon: '🎯', title: 'PRECYZYJNE TRAFIENIE', description: '+4 punkty procentowe szansy na trafienie krytyczne. Maksymalnie 5 poziomów.' },
      { id: 'critical_damage', icon: '✦', title: 'MOC KRYTYCZNA', description: '+0,20× do mnożnika obrażeń krytycznych. Maksymalnie 3 poziomy.' },
      { id: 'dash', icon: '↗', title: 'TRENING UNIKU', description: 'Skraca czas odnowienia uniku taktycznego o 12%. Maksymalnie 4 poziomy.' },
      { id: 'ability', icon: '✦', title: 'AKUMULATOR MOCY', description: 'Superumiejętność ładuje się o 8% szybciej. Maksymalnie 3 poziomy.' },
      { id: 'boots', icon: '👟', title: 'BUTY SPRINTU', description: '+6% prędkości poruszania się.' },
      { id: 'magnet', icon: '🧲', title: 'MAGNES XP', description: 'Znacznie większy zasięg przyciągania kryształów XP.' },
      { id: 'reinforced', icon: '⛑️', title: 'WZMOCNIONY KASK', description: '+1 maksymalny punkt zdrowia i natychmiastowe uzupełnienie.' },
      { id: 'medkit', icon: '☕', title: 'ZESTAW RATUNKOWY', description: 'Odzyskaj 1 punkt zdrowia i aktywuj tarczę na jedno trafienie.' },
      { id: 'range', icon: '🎯', title: 'ZASIĘG AUDYTU', description: '+12% zasięgu automatycznego namierzania przeciwników.' },
      { id: 'growth', icon: '📈', title: 'PREMIA ZA NORMĘ', description: '+18% doświadczenia z kryształów XP.' },
      { id: 'scavenger', icon: '📦', title: 'ŁOWCA OKAZJI', description: 'Częstsze zrzuty dodatkowych perków od zwykłych przeciwników.' },
      { id: 'regen', icon: '🩹', title: 'PRZERWA REGENERACYJNA', description: 'Co pewien czas odzyskujesz 1 punkt zdrowia.' },
      { id: 'drone', icon: '🤖', title: 'DRON ASYSTUJĄCY', description: 'Dron przez 32 sekundy razi najbliższego wroga impulsem.' },
      { id: 'armor', icon: '🪵', title: 'PALETA OCHRONNA', description: 'Otrzymujesz 24 sekundy okresowej osłony.' },
      { id: 'ricochet', icon: '↗', title: 'RYKOSZET B4 • POZIOM ' + ((this.survivalUpgradeStacks.ricochet || 0) + 1) + '/3', description: '+1 odbicie pocisku operatora do kolejnego nie trafionego wroga. Kolejne odbicia zadają stopniowo mniej obrażeń. Maksymalnie 3 poziomy.' },
      { id: 'radiation', icon: '☢️', title: 'POLE RADIACYJNE B4 • POZIOM ' + ((this.survivalUpgradeStacks.radiation || 0) + 1) + '/3', description: 'Co kilka sekund emituje impuls wokół operatora i rani pobliskich wrogów. Zasięg, siła i liczba celów rosną z poziomem. Maksymalnie 3 poziomy.' },
      { id: 'shrapnel', icon: '✹', title: 'AMUNICJA ODŁAMKOWA • POZIOM ' + ((this.survivalUpgradeStacks.shrapnel || 0) + 1) + '/3', description: 'Krytyczne trafienie pociskiem rozrzuca odłamki, które ranią najbliższego dodatkowego wroga przy celu. Jeden wybuch na salwę; do 3 poziomów.' },
    ].filter((option) => !excluded.includes(option.id) &&
      (option.id !== 'ability' || (this.survivalUpgradeStacks.ability || 0) < 3) &&
      (option.id !== 'critical' || (this.survivalUpgradeStacks.critical || 0) < 5) &&
      (option.id !== 'critical_damage' || (this.survivalUpgradeStacks.critical_damage || 0) < 3) &&
      (option.id !== 'dash' || (this.survivalUpgradeStacks.dash || 0) < 4) &&
      (option.id !== 'ricochet' || (this.survivalUpgradeStacks.ricochet || 0) < 3) &&
      (option.id !== 'radiation' || (this.survivalUpgradeStacks.radiation || 0) < 3) &&
      (option.id !== 'shrapnel' || (this.survivalUpgradeStacks.shrapnel || 0) < 3));
    for (const [weaponId, definition] of Object.entries(SURVIVAL_WEAPON_DEFS) as Array<[SurvivalWeaponId, typeof SURVIVAL_WEAPON_DEFS[SurvivalWeaponId]]>) {
      const owned = this.survivalWeapons.find((weapon) => weapon.id === weaponId);
      if (!owned) {
        if (this.survivalElapsed >= definition.unlockAfter) {
          const unlockMinute = Math.ceil(definition.unlockAfter / 60);
          pool.push({ id: 'weapon_unlock:' + weaponId, icon: definition.icon,
            title: 'NOWA BROŃ: ' + definition.name.toUpperCase(),
            description: definition.description + ' Dostępna od około ' + unlockMinute + '. minuty. Odstęp: ' + definition.cooldown.toFixed(1) + ' s.' });
        }
      } else if (owned.level < 5) {
        pool.push({ id: 'weapon_upgrade:' + weaponId, icon: definition.icon,
          title: definition.name.toUpperCase() + ' • POZIOM ' + (owned.level + 1),
          description: 'Nieznacznie zwiększ obrażenia i skróć przeładowanie. Poziom ' + (owned.level + 1) + '/5.' });
      } else if (
        !owned.evolved &&
        owned.level >= 5 &&
        this.survivalElapsed >= 210 &&
        (this.survivalUpgradeStacks[definition.evolutionPassive] || 0) > 0
      ) {
        pool.push({ id: 'weapon_evolve:' + weaponId, icon: '✦',
          title: 'EWOLUCJA: ' + definition.evolvedName,
          description: 'Wymagania: broń poziom 5, 3,5 minuty Survival i moduł „' + definition.evolutionPassiveLabel + '”. Otrzymasz unikalną wersję tej broni.' });
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const promotionRarityFloor = getSurvivalPromotionRarityFloor(this.survivalLevel);
    let promotionCardAssigned = false;
    const withRarity = (options: BaseOption[]): SurvivalUpgradeOption[] => options.map((option) => {
      // Weapon evolutions are always Legendary; at promotions one card is
      // guaranteed to meet the rank's rarity floor even after a reroll.
      const isEvolution = option.id.startsWith('weapon_evolve:');
      let rarity: SurvivalUpgradeRarity = isEvolution
        ? 'legendary'
        : rollSurvivalUpgradeRarity(Math.random(), this.survivalLevel);
      if (promotionRarityFloor && !promotionCardAssigned) {
        rarity = isEvolution
          ? 'legendary'
          : promoteSurvivalUpgradeRarity(rarity, promotionRarityFloor);
        promotionCardAssigned = true;
      }
      const meta = getSurvivalUpgradeRarityMeta(rarity);

      if (option.id.startsWith('weapon_unlock:')) {
        const weaponId = option.id.slice('weapon_unlock:'.length) as SurvivalWeaponId;
        const definition = SURVIVAL_WEAPON_DEFS[weaponId];
        const initialLevel = getSurvivalWeaponInitialLevel(rarity);
        return {
          ...option,
          description: definition.description + ' Poziom startowy tej karty: ' + initialLevel + '/5.',
          ...meta,
        };
      }

      if (option.id.startsWith('weapon_upgrade:')) {
        const weaponId = option.id.slice('weapon_upgrade:'.length) as SurvivalWeaponId;
        const definition = SURVIVAL_WEAPON_DEFS[weaponId];
        const weapon = this.survivalWeapons.find((entry) => entry.id === weaponId);
        const currentLevel = weapon?.level || 1;
        const targetLevel = Math.min(5, currentLevel + getSurvivalWeaponUpgradeSteps(rarity));
        return {
          ...option,
          title: definition.name.toUpperCase() + ' • POZIOM ' + targetLevel,
          description: 'Rozwijasz broń z poziomu ' + currentLevel + ' do ' + targetLevel + '/5.' +
            (rarity === 'legendary' ? ' Legendarna karta podnosi poziom o dwa stopnie.' : ''),
          ...meta,
        };
      }

      if (option.id.startsWith('weapon_evolve:')) {
        return {
          ...option,
          description: option.description + ' Rzadkość ewolucji: LEGENDARNA.',
          ...meta,
        };
      }

      return {
        ...option,
        description: option.description + ' Siła modułu: ×' + meta.strengthMultiplier.toFixed(2).replace('.', ',') + '.',
        ...meta,
      };
    });
    // Guaranteed new-weapon offer while the arsenal is still incomplete.
    // This avoids a long string of stat-only level-ups before the player gets a build identity.
    const newWeaponOffer = pool.find((option) => option.id.startsWith('weapon_unlock:'));
    if (newWeaponOffer) {
      // Never show two new weapons in one level-up. Unchosen, time-unlocked weapons
      // stay eligible for later level-ups instead of blocking the rest of the arsenal.
      const remaining = pool.filter((option) =>
        option.id !== newWeaponOffer.id && !option.id.startsWith('weapon_unlock:')
      );
      return withRarity([newWeaponOffer, ...remaining.slice(0, 2)]);
    }
    const weaponProgressOffer = pool.find((option) => option.id.startsWith('weapon_'));
    if (weaponProgressOffer) {
      // Offer at most one weapon upgrade/evolution at a time to keep choices readable.
      const remaining = pool.filter((option) =>
        option.id !== weaponProgressOffer.id && !option.id.startsWith('weapon_')
      );
      return withRarity([weaponProgressOffer, ...remaining.slice(0, 2)]);
    }
    return withRarity(pool.slice(0, 3));
  }

  public rerollSurvivalUpgrades(): boolean {
    if (this.gameMode !== 'survival' || this.state !== 'levelup' || this.survivalBossRewardPending || this.survivalRerolls <= 0) return false;
    this.survivalRerolls--;
    this.survivalPendingOptions = this.rollSurvivalUpgradeOptions(this.survivalPendingOptions.map((option) => option.id));
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    this.callbacks.onSurvivalLevelUp?.(
      [...this.survivalPendingOptions],
      this.survivalRankUpPending ? 'rank-up' : 'levelup',
    );
    sound.playPickup();
    return true;
  }

  /** Adds one reroll only after the native AdMob SDK confirms a completed reward. */
  public grantSurvivalRerollFromAd(): boolean {
    if (
      this.gameMode !== 'survival' ||
      this.state !== 'levelup' ||
      this.survivalBossRewardPending ||
      this.survivalAdRerollGranted
    ) return false;

    this.survivalAdRerollGranted = true;
    this.survivalRerolls++;
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    this.emitFloatingToast('REKLAMA ZAKOŃCZONA — +1 PRZERZUT', this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z, 'perk');
    sound.playPickup();
    return true;
  }

  public skipSurvivalUpgrade(): boolean {
    if (this.gameMode !== 'survival' || this.state !== 'levelup' || this.survivalBossRewardPending || this.survivalSkips <= 0) return false;
    this.survivalSkips--;
    this.survivalRankUpPending = false;
    this.state = 'playing';
    sound.startMusic();
    this.emitFloatingToast('POMINIĘTO WYBÓR — ZACHOWANO TEMPO ZMIANY', this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z, 'perk');
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    // A high-value crystal or reward may have crossed more than one threshold.
    // Skipping a draft must not strand banked XP that is already sufficient.
    if (this.survivalXp >= this.survivalXpToNext) this.beginSurvivalLevelUp();
    return true;
  }

  public grantOniricDreamReward(points = 1500) {
    if (this.gameMode !== 'survival') return;
    const bonus = THREE.MathUtils.clamp(Math.round(Number.isFinite(points) ? points : 0), 0, 5000);
    this.score += bonus;
    this.hp = Math.min(this.maxHp, this.hp + 1);
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
    this.callbacks.onHpUpdate(this.hp, this.maxHp);
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    this.emitFloatingToast('⌚ NAGRODA Z NORKI: +' + bonus + ' PKT • +1 ŻYCIE', this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'easter-egg');
    sound.playEasterEgg();
  }

  public togglePause() {
    if (this.gameMode === 'survival' && this.state === 'levelup') return;
    if (this.state === 'playing') {
      this.state = 'paused';
      sound.stopMusic();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      sound.startMusic();
    }
  }

  private disposeEnemyModel(enemy: EnemyItem) {
    const mesh = enemy.mesh as THREE.Object3D | undefined;
    if (!mesh) return;
    this.levelRoot.remove(mesh);

    // Release per-enemy GPU geometry/material resources after the entity is gone.
    // Textures are intentionally not disposed here because asset textures may be shared.
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    mesh.traverse((object) => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry) geometries.add(renderable.geometry);
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach((item) => materials.add(item));
      else if (material) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private clearOperatorCompanions() {
    if (this.marcinTank) {
      this.levelRoot.remove(this.marcinTank.group);
      this.disposeTemporaryObject(this.marcinTank.group);
      this.marcinTank = null;
    }
    for (const cat of this.mateuszCats) {
      this.levelRoot.remove(cat.group);
      this.disposeTemporaryObject(cat.group);
    }
    this.mateuszCats = [];
  }

  private registerCameraOccluder(mesh: THREE.Mesh, fadeOpacity = 0.18, fadeRadius = 0) {
    if (this.cameraOccluderMaterials.has(mesh)) return;
    const original = mesh.material;
    const originals = Array.isArray(original) ? original : [original];
    const fades = originals.map((material) => material.clone());
    const faded = Array.isArray(original) ? fades : fades[0];
    mesh.material = faded;
    mesh.userData.cameraOccluder = true;
    this.cameraOccluders.push(mesh);
    this.cameraOccluderMaterials.set(mesh, {
      original,
      faded,
      originals,
      fades,
      isFaded: false,
      currentFade: 0,
      targetFade: 0,
      fadeOpacity: THREE.MathUtils.clamp(Number.isFinite(fadeOpacity) ? fadeOpacity : 0.18, 0.04, 1),
      fadeRadius: THREE.MathUtils.clamp(Number.isFinite(fadeRadius) ? fadeRadius : 0, 0, 8),
    });
  }

  private updateCameraOcclusionFade(dt: number) {
    const frameDt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    let showPlayerMarker = false;

    for (const state of this.cameraOccluderMaterials.values()) {
      state.currentFade = THREE.MathUtils.damp(state.currentFade, state.targetFade, 16, frameDt);
      if (Math.abs(state.currentFade - state.targetFade) < 0.004) state.currentFade = state.targetFade;
      if (state.currentFade > 0.07 || state.targetFade > 0.01) showPlayerMarker = true;

      for (let index = 0; index < state.fades.length; index++) {
        const material = state.fades[index];
        const original = state.originals[index];
        const opacity = THREE.MathUtils.lerp(
          original.opacity,
          Math.min(original.opacity, state.fadeOpacity),
          state.currentFade,
        );
        const transparent = original.transparent || state.currentFade > 0.006;
        const depthWrite = state.currentFade > 0.006 ? false : original.depthWrite;

        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        if (Math.abs(material.opacity - opacity) > 0.002) material.opacity = opacity;
        if (material.depthWrite !== depthWrite) material.depthWrite = depthWrite;
      }
    }

    if (this.survivalSightlineMarker) {
      this.survivalSightlineMarker.position.set(this.playerPos.x, 0.055, this.playerPos.z);
      this.survivalSightlineMarker.visible = showPlayerMarker;
    }
  }

  private updateCameraOcclusion(dt: number) {
    // The visual interpolation runs at render cadence; raycasts remain capped at ~13 Hz.
    this.updateCameraOcclusionFade(dt);
    this.cameraOcclusionCooldown -= dt;
    if (this.cameraOcclusionCooldown > 0) return;
    this.cameraOcclusionCooldown = 0.075;
    if (this.cameraOccluders.length === 0) return;

    const target = this.desiredLookAtPosition.set(
      this.playerPos.x,
      this.playerPos.y + 0.92,
      this.playerPos.z
    );
    const direction = target.sub(this.camera.position);
    const distance = direction.length();
    if (distance <= 0.5) return;
    direction.multiplyScalar(1 / distance);
    this.cameraOcclusionRaycaster.set(this.camera.position, direction);
    this.cameraOcclusionRaycaster.near = 0.05;
    this.cameraOcclusionRaycaster.far = Math.max(0.05, distance - 0.42);
    const hits = this.cameraOcclusionHits;
    hits.length = 0;
    this.cameraOcclusionRaycaster.intersectObjects(this.cameraOccluders, false, hits);
    this.cameraOcclusionHitSet.clear();
    for (const hit of hits) this.cameraOcclusionHitSet.add(hit.object);

    for (const [mesh, state] of this.cameraOccluderMaterials) {
      const rayBlocked = this.cameraOcclusionHitSet.has(mesh);
      let operatorUnderFixture = false;
      if (state.fadeRadius > 0) {
        mesh.getWorldPosition(this.cameraOcclusionWorldPosition);
        const dx = this.cameraOcclusionWorldPosition.x - this.playerPos.x;
        const dz = this.cameraOcclusionWorldPosition.z - this.playerPos.z;
        const overhead = this.cameraOcclusionWorldPosition.y > this.playerPos.y + 1.6;
        operatorUnderFixture = overhead && dx * dx + dz * dz <= state.fadeRadius * state.fadeRadius;
      }
      const shouldFade = rayBlocked || operatorUnderFixture;
      if (shouldFade !== state.isFaded) {
        state.isFaded = shouldFade;
        state.targetFade = shouldFade ? 1 : 0;
      }
    }
    hits.length = 0;
    this.cameraOcclusionHitSet.clear();
  }

  private restoreCameraOccluders() {
    for (const [mesh, state] of this.cameraOccluderMaterials) {
      mesh.material = state.original;
      state.fades.forEach((material) => material.dispose());
      delete mesh.userData.cameraOccluder;
    }
    this.cameraOccluderMaterials.clear();
    this.cameraOccluders.length = 0;
    this.cameraOcclusionHits.length = 0;
    this.cameraOcclusionHitSet.clear();
    this.cameraOcclusionCooldown = 0;
    if (this.survivalSightlineMarker) this.survivalSightlineMarker.visible = false;
  }

  private clearLevel() {
    this.restoreCameraOccluders();
    if (this.survivalSightlineMarker) {
      this.levelRoot.remove(this.survivalSightlineMarker);
      this.disposeTemporaryObject(this.survivalSightlineMarker);
      this.survivalSightlineMarker = null;
    }
    for (const enemy of this.enemies) this.disposeEnemyModel(enemy);
    this.clearOperatorCompanions();
    // Lollipop meshes own their geometry/materials; release them before the scene is reset.
    for (const projectile of this.enemyProjectiles) {
      if (projectile.kind === 'pomazaniec_lollipop' || projectile.kind === 'sebix_brick' || projectile.disposeOnRemove) this.disposeTemporaryObject(projectile.mesh);
    }
    if (this.survivalPomazaniecMarker) {
      this.levelRoot.remove(this.survivalPomazaniecMarker);
      this.disposePomazaniecObject(this.survivalPomazaniecMarker);
      this.survivalPomazaniecMarker = null;
    }
    // Every hazard mesh is a per-level instance produced by its own model
    // factory. Dispose all of them before clearing the map; shared textures
    // remain owned by the asset layer and are not released here.
    for (const hazard of this.hazards) {
      if (hazard.mesh) this.disposeTemporaryObject(hazard.mesh);
    }
    this.clearSurvivalSurgeRing();
    this.survivalSurgeTargetCount = 0;
    // Camera fade clones were restored above; now release each lamp's own
    // geometry/material before the scene graph is cleared for the next arena.
    for (const fixture of this.survivalCeilingFixtures) {
      this.levelRoot.remove(fixture);
      this.disposeTemporaryObject(fixture);
    }
    this.survivalCeilingFixtures = [];
    this.disposeSurvivalArenaInstances();
    for (const secret of this.survivalSecrets) {
      this.levelRoot.remove(secret.mesh);
      this.disposeObjectResources(secret.mesh);
    }
    this.survivalSecrets = [];
    if (this.survivalMapLandmarks) {
      this.levelRoot.remove(this.survivalMapLandmarks);
      this.disposeTemporaryObject(this.survivalMapLandmarks);
      this.survivalMapLandmarks = null;
    }
    // Release pickup-owned GPU resources before clearing the level graph.
    // These models have per-instance geometries/materials; only explicitly
    // marked dynamic textures are disposed, never shared asset textures.
    for (const collectible of this.collectibles) {
      if (collectible.mesh) this.disposeObjectResources(collectible.mesh);
    }
    for (const perk of this.droppedPerks) {
      if (perk.mesh) this.disposeObjectResources(perk.mesh);
    }
    for (const crate of this.lootCrates) {
      if (crate.mesh) this.disposeObjectResources(crate.mesh);
    }
    // These environmental models are built per event/instance and are not
    // shared map assets. Release them before the scene graph is cleared.
    for (const tile of this.fallingTiles) {
      this.disposeTemporaryObject(tile.mesh);
      this.disposeTemporaryObject(tile.warningRing);
    }
    for (const molotov of this.bimberMolotovs) this.disposeTemporaryObject(molotov.mesh);
    for (const puddle of this.bimberFirePuddles) this.disposeTemporaryObject(puddle.group);
    for (const capybara of this.mafiCapybaras) {
      this.levelRoot.remove(capybara.group);
      this.disposeTemporaryObject(capybara.group);
    }
    this.mafiCapybaras = [];
    for (const barrel of this.explosiveBarrels) this.disposeTemporaryObject(barrel.mesh);
    while (this.levelRoot.children.length > 0) {
      this.levelRoot.remove(this.levelRoot.children[0]);
    }
    this.platforms = [];
    this.survivalObstacles = [];
    this.campaignEnemyObstacles = [];
    this.collectibles = [];
    this.droppedPerks = [];
    this.lootCrates = [];
    this.coffeeMachines = [];
    this.fallingTiles = [];
    this.fallingTileSpawnTimer = 0;
    this.randomSpawnTimer = 0;
    this.bulldozerHitCooldowns.clear();
    for (const gem of this.survivalXpGems) {
      // Shared XP geometry/material remain alive for the next Survival run.
      this.levelRoot.remove(gem.mesh);
    }
    this.survivalXpGems = [];
    this.hazards = [];
    this.explosiveBarrels = [];
    for (const particle of this.particles) this.particlePool.release(particle.mesh);
    this.particles = [];
    this.enemies = [];
    this.activeChaserIds.clear();
    this.waveDirectorCooldown = 0;
    this.threatTier = 0;
    this.enemyProjectiles = [];
    for (const projectile of this.projectiles) {
      if (projectile.weaponProjectile || projectile.disposeOnRemove) this.disposeTemporaryObject(projectile.mesh);
    }
    this.projectiles = [];
    for (const effect of this.specialEffects) {
      if (effect.cleanup) effect.cleanup();
      else if (effect.disposeOnRemove) this.disposeTemporaryObject(effect.mesh);
    }
    this.specialEffects = [];
    this.bimberMolotovs = [];
    this.bimberFirePuddles = [];
    this.totalVipCount = 0;
    this.collectedVipCount = 0;
    this.marcinReclamationTimer = 0;
    this.grzesiekCrushTimer = 0;
    this.grzesiekCrushPulse = 0;
  }

  private currentActiveSector = 1;


  private applyEnemyVisualPolish(enemy: EnemyItem) {
    const root = enemy.mesh as THREE.Group | undefined;
    if (!root || root.userData.enemyVisualPolishApplied) return;
    root.userData.enemyVisualPolishApplied = true;

    const palette: Record<string, number> = {
      customer: 0xef4444, architect: 0xa78bfa, inspector: 0x38bdf8,
      handlowiec: 0xf59e0b, monter: 0x22c55e, kurier: 0xf97316,
      przedstawiciel_włoski: 0xdc2626, sztaplar_szalony: 0xfacc15,
      pan_roman: 0x92400e, serwisant: 0x06b6d4, zombie_pracownik: 0x84cc16,
      elite_walczak_guard: 0xf43f5e, walczak: 0xf59e0b, krol_leto: 0xa855f7,
      bosman_krakow: 0x0ea5e9, agv_robot: 0x38bdf8, piorun_dron: 0x22d3ee,
    };
    const accent = palette[enemy.type] || 0x38bdf8;
    const isBoss = isMajorSurvivalBossType(enemy.type);
    const canCastShadow = (isBoss || enemy.type === 'sebix_m') && !this.isHandheldViewport;
    // A horde of shadow-casting skinned/part-based models is expensive on mobile.
    // Keep boss silhouettes elevated on desktop; handhelds use the operator and
    // warehouse lighting for depth rather than hundreds of moving shadow casters.
    const applyShadowBudget = () => root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = canCastShadow;
      child.receiveShadow = false;
    });
    const scale = isBoss ? 1.35 : 1;
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x26384b, roughness: 0.68, metalness: 0.42 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.48, metalness: 0.22, emissive: accent, emissiveIntensity: 0.10 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.82, metalness: 0.16 });

    if (enemy.type === 'agv_robot' || enemy.type === 'piorun_dron') {
      // Wheeled AGV and quadcopter keep machine silhouettes instead of receiving humanoid armour.
      if (enemy.type === 'agv_robot') {
        const sensorRail = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.075, 0.12), accentMat);
        sensorRail.position.set(0, 0.56, 0);
        const frontScanner = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.055), darkMat);
        frontScanner.position.set(0, 0.48, 0.37);
        const statusBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), accentMat);
        statusBeacon.position.set(-0.31, 0.42, -0.2);
        root.add(sensorRail, frontScanner, statusBeacon);
      } else {
        const sidePods = [-1, 1].map((side) => {
          const pod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), armorMat);
          pod.position.set(side * 0.31, 0.52, -0.04);
          pod.rotation.z = side * 0.16;
          return pod;
        });
        const topFin = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 5), accentMat);
        topFin.position.set(0, 0.78, -0.03);
        const sensorEye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), accentMat);
        sensorEye.position.set(0, 0.51, 0.29);
        root.add(...sidePods, topFin, sensorEye);
      }
      applyShadowBudget();
      return;
    }

    // Refined curved accents stay on the existing meshes: smoother close-up silhouettes
    // without adding extra objects or draw calls to a crowded Survival wave.
    // Rounded shoulder guards and a sculpted chest badge add depth without changing hitboxes.
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 14, 10), armorMat);
      shoulder.scale.set(1.42, 0.74, 1.0);
      shoulder.position.set(side * 0.235 * scale, 0.73 * scale, 0.015);
      shoulder.rotation.z = side * -0.12;
      shoulder.castShadow = false;
      root.add(shoulder);
    }
    const chestPlate = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 18, 12), accentMat);
    chestPlate.scale.set(1.28, 0.76, 0.34);
    chestPlate.position.set(0, 0.59 * scale, 0.155 * scale);
    chestPlate.castShadow = false;
    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.19 * scale, 0.025 * scale, 0.018 * scale), darkMat);
    chestStripe.position.set(0, 0.60 * scale, 0.199 * scale);
    chestStripe.castShadow = false;
    root.add(chestPlate, chestStripe);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.075 * scale, 0.26 * scale), darkMat);
    belt.position.set(0, 0.34 * scale, 0);
    belt.castShadow = false;
    root.add(belt);
    const backModule = new THREE.Mesh(new THREE.BoxGeometry(0.20 * scale, 0.25 * scale, 0.12 * scale), armorMat);
    backModule.position.set(0, 0.57 * scale, -0.15 * scale);
    backModule.castShadow = false;
    root.add(backModule);
    const insignia = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 10, 8), accentMat);
    insignia.position.set(0, 0.61 * scale, 0.19 * scale);
    insignia.castShadow = false;
    root.add(insignia);

    // Role-specific silhouettes: readable at a distance without enlarging collision bodies.
    if (isBoss) {
      const crest = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 16, 12), accentMat);
      crest.scale.set(1.65, 0.58, 0.72);
      crest.position.set(0, 1.16 * scale, 0.015);
      crest.castShadow = false;
      root.add(crest);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075 * scale, 0.24 * scale, 5), accentMat);
        horn.position.set(side * 0.19 * scale, 1.22 * scale, 0);
        horn.rotation.z = side * -0.34;
        horn.castShadow = false;
        root.add(horn);
      }
    } else if (enemy.type === 'kurier' || enemy.type === 'pan_roman') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.34, 0.20), accentMat);
      pack.position.set(0, 0.66, -0.22);
      pack.castShadow = false;
      const packBand = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.055, 0.215), armorMat);
      packBand.position.set(0, 0.69, -0.22);
      root.add(pack, packBand);
    } else if (enemy.type === 'inspector') {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.13), accentMat);
      visor.position.set(0, 1.04, 0.025);
      visor.castShadow = false;
      root.add(visor);
    } else if (enemy.type === 'zombie_pracownik') {
      const tornBib = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.17, 0.055), accentMat);
      tornBib.position.set(-0.045, 0.69, 0.16);
      tornBib.rotation.z = -0.18;
      const exposedPatch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 0), darkMat);
      exposedPatch.position.set(0.16, 0.56, 0.12);
      root.add(tornBib, exposedPatch);
    } else if (enemy.type === 'sztaplar_szalony' || enemy.type === 'elite_walczak_guard') {
      const hazardBar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.045, 0.075), accentMat);
      hazardBar.position.set(0, 0.88, 0.13);
      hazardBar.castShadow = false;
      root.add(hazardBar);
    } else if (enemy.type === 'handlowiec' || enemy.type === 'przedstawiciel_włoski' || enemy.type === 'serwisant') {
      const shoulderBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.075, 9, 8), accentMat);
      shoulderBeacon.position.set(0.25, 0.82, -0.04);
      shoulderBeacon.castShadow = false;
      root.add(shoulderBeacon);
    }
    applyShadowBudget();
  }

  // Retain a low-poly industrial look on hard edges, but do not facet the
  // rounded faces, heads, limbs and equipment that define character silhouettes.
  private applyStorybookStyle(root: THREE.Object3D) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry;
      const isCurvedSurface =
        geometry instanceof THREE.SphereGeometry ||
        geometry instanceof THREE.CapsuleGeometry ||
        geometry instanceof THREE.CylinderGeometry ||
        geometry instanceof THREE.ConeGeometry ||
        geometry instanceof THREE.TorusGeometry ||
        geometry instanceof THREE.TorusKnotGeometry;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
          if (isCurvedSurface) material.userData.preserveSmoothShading = true;
          material.flatShading = material.userData.preserveSmoothShading !== true;
          material.roughness = Math.max(material.roughness, 0.58);
          material.metalness = Math.min(material.metalness, 0.42);
          if (material.color) material.color.offsetHSL(0, 0.10, 0.015);
          material.needsUpdate = true;
        }
      }
      object.castShadow = object.castShadow && object.geometry !== undefined;
    });
  }

  public loadLevel(levelId: number) {
    this.currentLevelId = levelId;
    this.currentActiveSector = levelId;
    this.clearLevel();
    this.rebuildPlayerMesh();

    // Unified Mega-Map Layout: Sektor A (-36..+36) -> Sektor B (+36..+116) -> Sektor C (+116..+206)
    this.scene.background = new THREE.Color(0x07131d);
    this.applySectorLighting(levelId);
    this.levelBounds = { minX: -36, maxX: 206, minZ: -16, maxZ: 16 };
    
    this.buildLevel1();
    this.buildLevel2(76);
    this.buildLevel3(161);
    this.buildCampaignHighBayDressing();
    this.campaignEnemyObstacles = this.platforms
      .filter((platform) =>
        (platform.type === 'shelf' || platform.type === 'pallet' || platform.type === 'bathtub' || platform.type === 'conveyor') &&
        platform.y <= 1.65
      )
      .map((platform) => ({
        x: platform.x,
        z: platform.z,
        halfWidth: Math.max(0.45, platform.width * 0.5),
        halfDepth: Math.max(0.45, platform.depth * 0.5),
      }));
    for (const enemy of this.enemies) this.applyEnemyVisualPolish(enemy);
    this.applyStorybookStyle(this.levelRoot);
    this.sectorGates = [null, null, null, null];
    this.buildSectorGate(36, 2);
    this.buildSectorGate(116, 3);
    if (this.scene.fog instanceof THREE.Fog) { this.scene.fog.near = 42; this.scene.fog.far = 148; }
    this.applySceneTextureQuality();

    // Spawn player at chosen starting sector checkpoint on the unified map
    if (levelId === 2) {
      this.playerPos.set(41, 0.5, 0);
    } else if (levelId === 3) {
      this.playerPos.set(121, 0.5, 0);
    } else {
      this.playerPos.set(-32, 0.5, 0);
    }
    this.playerVel.set(0, 0, 0);
    if (this.playerGroup) {
      this.playerGroup.position.copy(this.playerPos);
    }

    this.smoothCamY = this.playerPos.y;
    this.currentLookAt.set(this.playerPos.x, this.playerPos.y + 0.85, this.playerPos.z);
    this.finishWarningTimer = 0;

    this.bossHudRefreshCooldown = 0;
    this.lastBossHudSignature = '';
    this.callbacks.onBossUpdate?.('', 0, 0, false);
    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
  }

  /**
   * Shared high-bay roof, pipework and lighting details for the campaign mega-map.
   * Instanced geometry keeps extra architecture within a small draw-call budget.
   */
  private buildCampaignHighBayDressing() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x3b5061, metalness: 0.68, roughness: 0.48 });
    const safetyOrange = new THREE.MeshStandardMaterial({ color: 0xe99a32, metalness: 0.32, roughness: 0.52, emissive: 0x693a0d, emissiveIntensity: 0.12 });
    const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x738392, metalness: 0.76, roughness: 0.3 });
    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.38, emissive: 0x91c9e8, emissiveIntensity: 0.42 });
    const dummy = new THREE.Object3D();
    const bayXs: number[] = [];
    for (let x = -24; x <= 192; x += 24) bayXs.push(x);

    const crossTrusses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.24, 34.5), steel, bayXs.length);
    bayXs.forEach((x, index) => {
      dummy.position.set(x, 8.62, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      crossTrusses.setMatrixAt(index, dummy.matrix);
    });
    crossTrusses.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(crossTrusses);

    const roofRails = new THREE.InstancedMesh(new THREE.BoxGeometry(236, 0.15, 0.18), safetyOrange, 2);
    [-16.8, 16.8].forEach((z, index) => {
      dummy.position.set(85, 8.52, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      roofRails.setMatrixAt(index, dummy.matrix);
    });
    roofRails.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(roofRails);

    const servicePipes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 236, 8), pipeMaterial, 3);
    [-10, 0, 10].forEach((z, index) => {
      dummy.position.set(85, 7.9, z); dummy.rotation.set(0, 0, Math.PI / 2); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      servicePipes.setMatrixAt(index, dummy.matrix);
    });
    servicePipes.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(servicePipes);

    const fixtures = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6, 0.12, 0.56), lampMaterial, bayXs.length * 2);
    let index = 0;
    for (const x of bayXs) for (const z of [-7.2, 7.2]) {
      dummy.position.set(x + 8, 8.0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      fixtures.setMatrixAt(index++, dummy.matrix);
    }
    fixtures.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(fixtures);

    const perimeterPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 7.9, 0.26), steel, bayXs.length * 2);
    index = 0;
    for (const x of bayXs) for (const z of [-17.3, 17.3]) {
      dummy.position.set(x, 3.95, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      perimeterPosts.setMatrixAt(index++, dummy.matrix);
    }
    perimeterPosts.instanceMatrix.needsUpdate = true;
    this.addSurvivalArenaInstance(perimeterPosts);

    // Colour-coded floor lane ticks make the full Campaign mega-map easier to
    // read at the higher camera angle. One instanced batch avoids decal draw calls.
    const floorGuideMaterial = new THREE.MeshStandardMaterial({
      color: 0xc48b3e,
      emissive: 0x4a2d12,
      emissiveIntensity: 0.12,
      roughness: 0.76,
      metalness: 0.08,
    });
    const floorGuides = new THREE.InstancedMesh(
      new THREE.BoxGeometry(3.8, 0.02, 0.07),
      floorGuideMaterial,
      bayXs.length * 2,
    );
    index = 0;
    for (const x of bayXs) for (const z of [-12.6, 12.6]) {
      dummy.position.set(x + 8, 0.012, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      floorGuides.setMatrixAt(index++, dummy.matrix);
    }
    floorGuides.instanceMatrix.needsUpdate = true;
    floorGuides.castShadow = false;
    floorGuides.receiveShadow = false;
    this.addSurvivalArenaInstance(floorGuides);
  }

  private buildSectorGate(x: number, targetSector: 2 | 3) {
    const group = new THREE.Group();
    const accent = targetSector === 2 ? 0x38bdf8 : 0xf59e0b;
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x17283a, metalness: 0.72, roughness: 0.28, emissive: accent, emissiveIntensity: 0.18 });
    const fieldMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.85, transparent: true, opacity: 0.23, roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide });
    const postGeometry = new THREE.BoxGeometry(0.72, 5.2, 0.8);
    for (const z of [-15.3, 15.3]) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(0, 2.6, z);
      group.add(post);
      const beacon = new THREE.PointLight(accent, 2.2, 9);
      beacon.position.set(0, 4.5, z);
      group.add(beacon);
    }
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.20, 4.4, 30.6), fieldMaterial);
    barrier.position.set(0, 2.2, 0);
    group.add(barrier);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 31.6), postMaterial);
    lintel.position.set(0, 5.1, 0);
    group.add(lintel);
    group.position.x = x;
    group.visible = this.gameMode === 'campaign' && this.maxUnlockedSector < targetSector;
    group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = false; });
    this.levelRoot.add(group);
    this.sectorGates[targetSector] = group;
  }

  private addJumpPad(x: number, y: number, z: number, launchForce = 17.5) {
    const padGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.18, 16), baseMat);
    
    const ringGeo = new THREE.RingGeometry(0.4, 0.8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.095;

    const springMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
    );
    springMesh.position.y = 0.12;

    const arrowMesh = createAisleArrow(1.2);
    arrowMesh.position.y = 0.105;
    arrowMesh.rotation.y = Math.PI;

    padGroup.add(baseMesh, ringMesh, springMesh, arrowMesh);
    padGroup.position.set(x, y, z);
    this.levelRoot.add(padGroup);

    this.platforms.push({
      x,
      y: y + 0.1,
      z,
      width: 1.7,
      height: 0.2,
      depth: 1.7,
      type: 'jump_pad',
      bounce: launchForce,
      mesh: padGroup,
    });
  }

  private addSpeedPad(x: number, y: number, z: number) {
    const padGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.3 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 3.2), baseMat);

    const stripeMat = new THREE.MeshBasicMaterial({ map: getHazardStripeTexture(), transparent: true, opacity: 0.95 });
    const stripeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.0), stripeMat);
    stripeMesh.rotation.x = -Math.PI / 2;
    stripeMesh.position.y = 0.045;

    padGroup.add(baseMesh, stripeMesh);
    padGroup.position.set(x, y, z);
    this.levelRoot.add(padGroup);

    this.platforms.push({
      x,
      y: y + 0.04,
      z,
      width: 1.6,
      height: 0.08,
      depth: 3.2,
      type: 'speed_pad',
      mesh: padGroup,
    });
  }

  private addExplosiveBarrel(id: string, x: number, y: number, z: number) {
    const mesh = createExplosiveBarrelModel();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);

    this.explosiveBarrels.push({
      id,
      x,
      y,
      z,
      mesh,
      fuseTimer: -1,
      exploded: false,
    });

    this.platforms.push({
      x,
      y: y + 0.55,
      z,
      width: 0.85,
      height: 1.1,
      depth: 0.85,
      type: 'shelf',
      mesh,
    });
  }

  private addGroutItem(id: string, x: number, y: number, z: number, points = 50) {
    const mesh = createGroutCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'grout',
      name: 'Puszka Fugi Kompleks B4',
      x,
      y,
      z,
      mesh,
      collected: false,
      points,
      life: id.startsWith('rand_') ? 90 : undefined,
    });
  }

  private addVipItem(id: string, x: number, y: number, z: number, name: string, points = 300) {
    const mesh = createCarraraCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.totalVipCount++;
    this.collectibles.push({
      id,
      type: 'vip_item',
      name,
      x,
      y,
      z,
      mesh,
      collected: false,
      points,
    });
  }

  private addEspressoItem(id: string, x: number, y: number, z: number) {
    const mesh = createEspressoCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'espresso',
      name: 'Espresso z Showroomu (+Prędkość)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 100,
      // Static showroom espresso stays until collected; roaming drops expire
      // so unattended rewards cannot accumulate indefinitely.
      life: id.startsWith('rand_esp_') ? 90 : undefined,
    });
  }

  private addMagnetItem(id: string, x: number, y: number, z: number) {
    const mesh = createMagnetCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'magnet',
      name: 'Skaner Radiowy (+Magnes)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 120,
      life: id.startsWith('rand_') ? 90 : undefined,
    });
  }

  public applyAutoCameraScaleForViewport() {
    const w = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth || 1280));
    const h = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || 720));
    const aspect = w / h;
    this.viewportAspect = aspect;
    this.isHandheldViewport = w < 900 || ('ontouchstart' in window);

    const targetFov = aspect < 0.65 ? 60 : aspect < 1.0 ? 54 : aspect < 1.35 ? 48 : 45;
    if (this.camera instanceof THREE.PerspectiveCamera && Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
    if (this.oniricDreamRemainingSeconds > 0) this.applyOniricDreamProjection();

    // Portrait FOV is already wider vertically. Apply the device default only
    // until the player changes zoom; rotation/resizing must not erase that choice.
    if (!this.hasManualCameraZoom) {
      if (aspect < 0.65) {
        this.camZoomFactor = 1.12;
      } else if (aspect < 1.0) {
        this.camZoomFactor = 1.07;
      } else if (w < 920) {
        this.camZoomFactor = 1.0;
      } else {
        this.camZoomFactor = 0.98;
      }
    }
    if (this.gameMode === 'pvp') {
      const state = this.lastPvpState;
      const local = state ? (this.pvpSlot === 'p1' ? state.p1 : state.p2) : null;
      const remote = state ? (this.pvpSlot === 'p1' ? state.p2 : state.p1) : null;
      const centerX = local && remote ? (local.x + remote.x) * 0.5 : this.playerPos.x;
      const centerZ = local && remote ? (local.z + remote.z) * 0.5 : this.playerPos.z;
      this.applyPvpCameraFraming(centerX, centerZ, 0, true);
    }
    this.syncCameraZoomControl();
  }

  private addGoldenCutterItem(id: string, x: number, y: number, z: number) {
    const mesh = createGoldenCutterCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'golden_cutter',
      name: 'Złota Gilotyna do Gresu (+Podwójny Skok)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 150,
    });
  }

  private addKfcBucketItem(id: string, x: number, y: number, z: number) {
    const mesh = createKfcBucketCollectible();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    this.collectibles.push({
      id,
      type: 'kfc_bucket',
      name: 'Kubełek Mocy (+2 HP & Furia Energetyczna!)',
      x,
      y,
      z,
      mesh,
      collected: false,
      points: 220,
      life: id.startsWith('rand_') ? 90 : undefined,
    });
  }

  private addZombieWorkerEnemy(id: string, x: number, minZ: number, maxZ: number, name = 'Głodny Magazynier-Zombie (Węszy Kubełek Mocy)') {
    const built = createZombieWorkerEnemyModel();
    built.group.position.set(x, 0.4, minZ);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'zombie_pracownik',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minZ,
      startX: minZ,
      endX: maxZ,
      speed: 4.1,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0.5,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: Math.random() * 6,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addCementSpillTrap(id: string, x: number, z: number, radius = 2.35) {
    const mesh = createCementSpillTrapModel(radius);
    mesh.position.set(x, 0, z);
    this.levelRoot.add(mesh);
    this.hazards.push({
      id,
      type: 'cement_spill',
      mesh,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed: 0,
      width: radius * 2,
      length: radius * 2,
      dir: 1,
      active: true,
    });
  }

  private addStretchFilmBarrierTrap(id: string, x: number, z: number, width = 5.2) {
    const mesh = createStretchFilmBarrierModel(width);
    mesh.position.set(x, 0, z);
    this.levelRoot.add(mesh);
    this.hazards.push({ id, type: 'stretch_barrier', mesh, startX: x, startZ: z, x, y: 0, z,
      speed: 0, width, length: 1.0, dir: 1, active: true, cooldown: 0 });
  }

  private addRollerGateTrap(id: string, x: number, z: number, speed = 2.2, width = 4.8) {
    const built = createRollerGateTrapModel(width);
    const halfTravel = 2.35;
    const startZ = THREE.MathUtils.clamp(z - halfTravel, this.levelBounds.minZ + 1.5, this.levelBounds.maxZ - 1.5);
    const endZ = THREE.MathUtils.clamp(z + halfTravel, this.levelBounds.minZ + 1.5, this.levelBounds.maxZ - 1.5);
    built.group.position.set(x, 0, startZ);
    this.levelRoot.add(built.group);
    this.hazards.push({ id, type: 'roller_gate', mesh: built.group, movingPart: built.rollers,
      startX: x, startZ, endX: x, endZ, x, y: 0, z: startZ, speed, width, length: 1.25,
      dir: 1, active: true, cooldown: 0 });
  }

  private addLaserCutterTrap(id: string, x: number, z: number, width = 3.8, speed = 2.6) {
    const built = createLaserCutterTrapModel(width);
    built.group.position.set(x, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'laser_cutter',
      mesh: built.group,
      movingPart: built.bladeCarriage,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed,
      width: 0.85,
      length: width,
      dir: 1,
      active: true,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private addSteamGeyserTrap(id: string, x: number, z: number, period = 4.2) {
    const built = createSteamGeyserTrapModel();
    built.group.position.set(x, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'steam_geyser',
      mesh: built.group,
      movingPart: built.steamColumn,
      warningMesh: built.warningRing,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed: period,
      width: 1.8,
      length: 1.8,
      dir: 1,
      active: true,
      timer: Math.random() * period,
    });
  }

  private addHydraulicPressTrap(id: string, x: number, z: number, speed = 3.2) {
    const built = createHydraulicPressTrapModel();
    built.group.position.set(x, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'hydraulic_press',
      mesh: built.group,
      movingPart: built.stamper,
      startX: x,
      startZ: z,
      x,
      y: 0,
      z,
      speed,
      width: 2.2,
      length: 2.2,
      dir: 1,
      active: true,
      timer: Math.random() * 3.0,
    });
  }

  private addEasterEgg(id: string, x: number, y: number, z: number, name: string, eggType: 'throne' | 'coffee' | 'folder', points = 500) {
    let group: THREE.Group;
    if (eggType === 'throne') {
      group = createGoldenThroneEasterEgg();
    } else if (eggType === 'coffee') {
      group = createVintageCoffeeCornerEasterEgg();
    } else {
      group = createSecretFolderEasterEgg();
    }
    group.position.set(x, y, z);
    this.levelRoot.add(group);

    this.collectibles.push({
      id,
      type: 'easter_egg',
      name,
      x,
      y,
      z,
      mesh: group,
      collected: false,
      points,
    });
  }

  private addForkliftHazard(id: string, startX: number, endX: number, z: number, speed: number, color = 0xf59e0b) {
    const built = createForkliftModel(color);
    built.group.position.set(startX, 0, z);
    this.levelRoot.add(built.group);
    this.hazards.push({
      id,
      type: 'forklift',
      mesh: built.group,
      startX,
      startZ: z,
      endX,
      endZ: z,
      x: startX,
      y: 0,
      z,
      speed,
      width: 1.8,
      length: 2.8,
      dir: 1,
      active: true,
    });
  }

  private addCustomerEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createCustomerEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'customer',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 1.8,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addArchitectEnemy(id: string, x: number, maxX: number, z: number, name: string) {
    const built = createArchitectEnemyModel();
    built.group.position.set(x, 0.4, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'architect',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z,
      startX: x,
      endX: maxX,
      speed: 2.2,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addAgvRobotEnemy(id: string, minX: number, maxX: number, z: number, name: string) {
    const built = createAgvRobotModel();
    built.group.position.set(minX, 0.2, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'agv_robot',
      name,
      mesh: built.group,
      x: minX,
      y: 0.2,
      z,
      startX: minX,
      endX: maxX,
      speed: 2.6,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
    });
  }

  private addWalczakBossEnemy(id: string, x: number, z: number) {
    const built = createWalczakBossModel();
    built.group.position.set(x, 0.6, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'walczak',
      name: 'Nadzorca Zero',
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.6,
      z,
      startX: x - 14,
      endX: x + 14,
      speed: 3.2,
      dir: -1,
      hp: 10,
      maxHp: 10,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.5,
      bossPhase: 1,
    });
  }

  private addKrolLetoBossEnemy(id: string, x: number, z: number) {
    const built = createKrolLetoBossModel();
    built.group.position.set(x, 0.6, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'krol_leto',
      name: 'Dyrektor Widmo (Dyrektor Generalny)',
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.6,
      z,
      startX: x - 12,
      endX: x + 12,
      speed: 3.8,
      dir: -1,
      hp: 12,
      maxHp: 12,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.2,
      bossPhase: 1,
    });
  }

  private addInspectorEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createInspectorEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'inspector',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.0,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.5,
    });
  }

  private addHandlowiecEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createHandlowiecEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'handlowiec',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.8,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 3.0,
    });
  }

  private addMonterEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createMonterEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'monter',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.2,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.8,
    });
  }

  private addPanRomanEnemy(id: string, x: number, minX: number, maxX: number, name = 'Dostawca Sanitarny z Dostawą') {
    const built = createPanRomanEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'pan_roman',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 3.2,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.0,
    });
  }

  private addSerwisanciEnemy(id: string, x: number, minX: number, maxX: number, name = 'Serwisant Operacja B4u') {
    const built = createSerwisanciEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'serwisant',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.6,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.4,
    });
  }

  private addBosmanKrakowBossEnemy(id: string, x: number, z: number) {
    const built = createBosmanKrakowBossModel();
    built.group.position.set(x, 0.6, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'bosman_krakow',
      name: 'Bosman Kraków (Mini-Boss)',
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.6,
      z,
      startX: x - 10,
      endX: x + 10,
      speed: 2.4,
      dir: -1,
      hp: 8,
      maxHp: 8,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.8,
    });
  }

  private addPiorunDronEnemy(id: string, startX: number, endX: number, z: number, y = 1.9, name = 'Piorun Dron Magazynowy AI') {
    const built = createPiorunDronModel();
    built.group.position.set(startX, y, z);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'piorun_dron',
      name,
      mesh: built.group,
      x: startX,
      y,
      z,
      startX,
      endX,
      speed: 3.5,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.rotors[0],
      legR: built.rotors[1],
      armL: built.rotors[2],
      armR: built.rotors[3],
    });
  }

  private addEliteGuardEnemy(id: string, x: number, minX: number, maxX: number, name: string) {
    const built = createEliteGuardEnemyModel();
    built.group.position.set(x, 0.5, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'elite_walczak_guard',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.5,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.4,
      dir: 1,
      hp: 5,
      maxHp: 5,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      shieldActive: true,
    });
  }

  private addKurierEnemy(id: string, x: number, minX: number, maxX: number, name = 'Kurier Ekspresowy') {
    const built = createKurierEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'kurier',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 4.5,
      dir: 1,
      hp: 2,
      maxHp: 2,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addItalianVendorEnemy(id: string, x: number, minX: number, maxX: number, name = 'Włoski Dostawca Armatury z Mediolanu') {
    const built = createItalianVendorEnemyModel();
    built.group.position.set(x, 0.4, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'przedstawiciel_włoski',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 2.6,
      dir: 1,
      hp: 3,
      maxHp: 3,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      specialActionTimer: 2.5,
    });
  }

  private createSebixEnemyModel(): {
    group: THREE.Group;
    legL: THREE.Group;
    legR: THREE.Group;
    armL: THREE.Group;
    armR: THREE.Group;
  } {
    const group = new THREE.Group();
    group.name = 'enemy_sebix_m';

    const skin = new THREE.MeshStandardMaterial({ color: 0xc58b68, roughness: 0.76 });
    const skinLight = new THREE.MeshStandardMaterial({ color: 0xd6a07c, roughness: 0.72 });
    const shorts = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.9 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.86 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x171717 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x451a1a });
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed });
    const addSphere = (parent: THREE.Object3D, material: THREE.Material, position: [number,number,number], scale: [number,number,number]) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      parent.add(mesh);
      mesh.castShadow = true;
      return mesh;
    };
    const addLimb = (parent: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material) => {
      const delta = end.clone().sub(start);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, delta.length(), 9), material);
      limb.position.copy(start).add(end).multiplyScalar(0.5);
      limb.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
      parent.add(limb);
      limb.castShadow = true;
      return limb;
    };

    const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.32, 0.38), shorts);
    shortsMesh.position.set(0, 0.88, 0);
    group.add(shortsMesh);

    // Shirtless, broad-chested silhouette. The deliberately overbuilt pecs and shoulders
    // read clearly at the game's normal camera distance without excessive polygon cost.
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.40, 0.88, 12), skin);
    torso.position.set(0, 1.42, 0);
    group.add(torso);
    addSphere(group, skinLight, [-0.18, 1.56, 0.13], [0.26, 0.20, 0.18]);
    addSphere(group, skinLight, [0.18, 1.56, 0.13], [0.26, 0.20, 0.18]);
    addSphere(group, skin, [0, 1.22, 0.29], [0.17, 0.22, 0.12]);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.14,0.20,10), skin);
    neck.position.set(0,1.92,0);
    group.add(neck);

    // Bald head and unmistakable crooked grin.
    addSphere(group, skinLight, [0,2.18,0.04], [0.245,0.285,0.235]);
    addSphere(group, skin, [0,2.405,0.055], [0.20,0.08,0.205]);
    for(const side of [-1,1]){
      addSphere(group, eyeMat, [side*0.085,2.22,0.245], [0.028,0.043,0.018]);
      addSphere(group, skin, [side*0.092,2.30,0.235], [0.075,0.035,0.04]);
    }
    addSphere(group, mouthMat, [0.015,2.075,0.247], [0.13,0.053,0.018]);
    const grin = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.027,0.018),toothMat);
    grin.position.set(0.015,2.092,0.263);
    grin.rotation.z=-0.12;
    group.add(grin);

    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.36,1.69,0);
    armR.position.set(0.36,1.69,0);
    group.add(armL,armR);
    for(const [pivot,side] of [[armL,-1],[armR,1]] as Array<[THREE.Group,number]>){
      addSphere(pivot,skin,[side*0.07,-0.03,0],[0.20,0.20,0.21]);
      addLimb(pivot,new THREE.Vector3(side*0.07,-0.08,0),new THREE.Vector3(side*0.13,-0.38,0.05),0.115,skin);
      addSphere(pivot,skinLight,[side*0.13,-0.40,0.06],[0.14,0.13,0.14]);
      addLimb(pivot,new THREE.Vector3(side*0.13,-0.41,0.05),new THREE.Vector3(side*0.17,-0.64,0.13),0.095,skinLight);
      addSphere(pivot,skin,[side*0.17,-0.69,0.15],[0.13,0.12,0.13]);
    }

    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.19,0.78,0);
    legR.position.set(0.19,0.78,0);
    group.add(legL,legR);
    for(const [pivot,side] of [[legL,-1],[legR,1]] as Array<[THREE.Group,number]>){
      addLimb(pivot,new THREE.Vector3(0,0,0),new THREE.Vector3(0,-0.38,0.02),0.115,skin);
      addLimb(pivot,new THREE.Vector3(0,-0.36,0.02),new THREE.Vector3(0,-0.68,0.06),0.09,skinLight);
      const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.11,0.28),shoeMat);
      shoe.position.set(0,-0.72,0.13);
      pivot.add(shoe);
    }
    group.traverse((object)=>{
      const mesh=object as THREE.Mesh;
      if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=false;}
    });
    // Bring his silhouette in line with the normal human-sized warehouse enemies.
    group.scale.setScalar(0.88);
    return {group,legL,legR,armL,armR};
  }

  private addSebixEnemy(id: string, x: number, minZ: number, maxZ: number) {
    const built=this.createSebixEnemyModel();
    built.group.position.set(x,0.08,minZ);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type:'sebix_m',
      name:'Operator Turbo • Niezatrzymany Taranujący',
      mesh:built.group,
      speechMesh:null,
      x,y:0.08,z:minZ,
      startX:minZ,
      endX:maxZ,
      speed:1.65,
      dir:1,
      hp:14,
      maxHp:14,
      state:'patrol',
      stunTimer:0,
      shoutTimer:1.5,
      shoutText:'',
      attackCooldown:0,
      walkCycle:0,
      legL:built.legL,
      legR:built.legR,
      armL:built.armL,
      armR:built.armR,
      specialActionTimer:2.4,
      rageTime:0,
      trailTimer:0,
      dashTimer:0,
    });
  }

  private addSztaplarEnemy(id: string, x: number, minX: number, maxX: number, name = 'Szalony Operator Paleciaka B4') {
    const built = createSztaplarEnemyModel();
    built.group.position.set(x, 0.5, minX);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'sztaplar_szalony',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.5,
      z: minX,
      startX: minX,
      endX: maxX,
      speed: 3.5,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
    });
  }

  private addMutantGammaForkliftEnemy(id: string, x: number, minZ: number, maxZ: number, name = 'Mutant Gamma-Sztaplarka — radioaktywny taran') {
    const built = createMutantGammaForkliftModel();
    built.group.position.set(x, 0.45, minZ);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'mutant_gamma_forklift',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.45,
      z: minZ,
      startX: minZ,
      endX: maxZ,
      speed: 3.6,
      dir: 1,
      hp: 7,
      maxHp: 7,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      head: built.head,
      specialActionTimer: 2.5,
    });
  }

  private addRadioactivePipEnemy(id: string, x: number, minZ: number, maxZ: number, name = 'Radioaktywny Inspektor PIP — protokół skażenia') {
    const built = createRadioactivePipModel();
    built.group.position.set(x, 0.4, minZ);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'radioactive_pip',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minZ,
      startX: minZ,
      endX: maxZ,
      speed: 3.2,
      dir: 1,
      hp: 6,
      maxHp: 6,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      head: built.head,
      specialActionTimer: 3.2,
    });
  }

  private addCyberSalesmanEnemy(id: string, x: number, minZ: number, maxZ: number, name = 'Cyber-Handlowiec 3.0 — oferta hologramowa') {
    const built = createCyberSalesmanModel();
    built.group.position.set(x, 0.4, minZ);
    this.levelRoot.add(built.group);
    this.enemies.push({
      id,
      type: 'cyber_salesman',
      name,
      mesh: built.group,
      speechMesh: null,
      x,
      y: 0.4,
      z: minZ,
      startX: minZ,
      endX: maxZ,
      speed: 4.5,
      dir: 1,
      hp: 5,
      maxHp: 5,
      state: 'patrol',
      stunTimer: 0,
      shoutTimer: 0,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: 0,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      head: built.head,
      specialActionTimer: 2.2,
    });
  }

  private spawnLootCrate(x: number, y: number, z: number) {
    const mesh = createLootCrateModel();
    mesh.position.set(x, y + 0.25, z);
    this.levelRoot.add(mesh);
    this.lootCrates.push({ mesh, x, y: y + 0.25, z });
    this.platforms.push({ x, y: y + 0.5, z, width: 0.5, height: 0.5, depth: 0.5, type: 'pallet', mesh });
  }

  private updateLootCrates(dt: number) {
    for (let i = this.lootCrates.length - 1; i >= 0; i--) {
      const crate = this.lootCrates[i];
      crate.mesh.rotation.y += dt * 1.5;

      const dist = Math.hypot(crate.x - this.playerPos.x, crate.z - this.playerPos.z);
      if (dist < 1.0) {
        this.spawnDroppedPerk(crate.x, crate.y, crate.z);
        this.levelRoot.remove(crate.mesh);
        this.disposeObjectResources(crate.mesh);
        this.platforms = this.platforms.filter((platform) => platform.mesh !== crate.mesh);
        this.lootCrates.splice(i, 1);
        this.spawnParticleRing(crate.x, crate.y + 0.4, crate.z, 0xfacc15);
        sound.playPickup(3);
      }
    }
  }
  public spawnDroppedPerk(x: number, y: number, z: number, forcedPerkId?: PerkType) {
    const perkDef = forcedPerkId
      ? AVAILABLE_PERKS.find((p) => p.id === forcedPerkId)!
      : AVAILABLE_PERKS[Math.floor(Math.random() * AVAILABLE_PERKS.length)];

    const id = `drop_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const mesh = createDroppedPerkCrate(perkDef.id, perkDef.color);
    mesh.position.set(x, y + 0.1, z);
    this.levelRoot.add(mesh);

    const dropped: DroppedPerkItem = {
      id,
      perkId: perkDef.id,
      name: perkDef.name,
      icon: perkDef.icon,
      color: perkDef.color,
      x,
      y: y + 0.1,
      z,
      initialY: y + 0.1,
      mesh,
      collected: false,
      life: 55,
      duration: perkDef.duration || 20,
    };

    this.droppedPerks.push(dropped);
    this.spawnParticleRing(x, y + 0.6, z, perkDef.color);
    this.emitFloatingToast(`📦 ZRZUT: ${perkDef.name}!`, x, y + 1.2, z, 'perk');
    sound.playPickup(1);
  }

  private updateDroppedPerks(dt: number) {
    const time = performance.now() * 0.003;

    for (let i = this.droppedPerks.length - 1; i >= 0; i--) {
      const perk = this.droppedPerks[i];
      if (perk.collected || !perk.mesh) {
        if (perk.mesh) {
          this.levelRoot.remove(perk.mesh);
          this.disposeObjectResources(perk.mesh);
        }
        this.droppedPerks.splice(i, 1);
        continue;
      }

      perk.life -= dt;
      if (perk.life <= 0) {
        this.levelRoot.remove(perk.mesh);
        this.disposeObjectResources(perk.mesh);
        this.droppedPerks.splice(i, 1);
        continue;
      }

      // Floating bob and spin
      perk.mesh.rotation.y += dt * 2.2;
      perk.mesh.position.y = perk.initialY + Math.sin(time + i * 1.5) * 0.18;

      // Magnetic pull to player
      const dist = Math.hypot(perk.x - this.playerPos.x, perk.z - this.playerPos.z);
      const dy = Math.abs(perk.y - (this.playerPos.y + 0.5));

      const magnetActive = this.activePerks.magnet > 0 || this.charDef.id === 'marcin';
      const magnetRadius = magnetActive ? 9.5 : 2.5;

      if (dist < magnetRadius) {
        const pullSpeed = (magnetActive ? 10.5 : 4.5) * dt;
        perk.x += ((this.playerPos.x - perk.x) / Math.max(0.1, dist)) * pullSpeed;
        perk.z += ((this.playerPos.z - perk.z) / Math.max(0.1, dist)) * pullSpeed;
        perk.y += ((this.playerPos.y + 0.6 - perk.y) / Math.max(0.1, dist)) * pullSpeed;
        perk.mesh.position.set(perk.x, perk.y, perk.z);
      }

      // Collect condition
      if (dist < 1.15 && dy < 1.4) {
        perk.collected = true;
        this.levelRoot.remove(perk.mesh);
        this.disposeObjectResources(perk.mesh);
        this.droppedPerks.splice(i, 1);

        this.activatePerk(perk.perkId, perk.duration);
        sound.playPickup(3);
        this.spawnParticleRing(perk.x, perk.y + 0.6, perk.z, perk.color);
        this.score += 250;
        this.emitFloatingToast(`⚡ ODBIÓR: ${perk.name}!`, perk.x, perk.y + 1.2, perk.z, 'perk');

        const def = AVAILABLE_PERKS.find((p) => p.id === perk.perkId);
        const hexColor = `#${perk.color.toString(16).padStart(6, '0')}`;
        this.callbacks.onPerkDropBanner?.(perk.name, perk.icon, def?.description || 'Aktywowano ulepszenie!', hexColor);
        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
      }
    }
  }
  private emitFloatingToast(
    text: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    type: 'points' | 'vip' | 'easter-egg' | 'damage' | 'perk' | 'combo' | 'enemy_shout' = 'points',
    metadata?: any
  ) {
    this.callbacks.onFloatingText?.(text, worldX, worldY, worldZ, type, metadata);
  }


  private addSectorFloorGuides(centerX: number, halfWidth: number, sector: 1 | 2 | 3) {
    const transforms: Array<{ x: number; z: number; rotationY: number }> = [];

    // Two broken longitudinal safety lines frame the combat lanes without
    // cluttering the central route or adding physical collision geometry.
    for (const z of [-6.2, 6.2]) {
      for (let x = centerX - halfWidth + 3.2; x <= centerX + halfWidth - 3.2; x += 2.55) {
        transforms.push({ x, z, rotationY: 0 });
      }
    }

    // Short transverse aisle markings make sector entrances and transitions
    // visible from the elevated camera angle.
    for (const x of [centerX - halfWidth + 4.8, centerX + halfWidth - 4.8]) {
      for (let z = -4.5; z <= 4.5; z += 1.5) {
        transforms.push({ x, z, rotationY: Math.PI / 2 });
      }
    }

    const guides = new THREE.InstancedMesh(
      SECTOR_FLOOR_GUIDE_GEOMETRY,
      SECTOR_FLOOR_GUIDE_MATERIALS[sector],
      transforms.length
    );
    const dummy = new THREE.Object3D();
    transforms.forEach((entry, index) => {
      dummy.position.set(entry.x, 0.022, entry.z);
      dummy.rotation.set(0, entry.rotationY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      guides.setMatrixAt(index, dummy.matrix);
    });
    guides.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    guides.instanceMatrix.needsUpdate = true;
    guides.castShadow = false;
    guides.receiveShadow = false;
    guides.frustumCulled = false;
    guides.renderOrder = 1;
    guides.name = `sector_${sector}_floor_guides`;
    this.levelRoot.add(guides);
  }

  private buildLevel1() {
    // 1. Expanded Warehouse Floor (72x40, x: -36 to +36, z: -20 to +20)
    const floorTex1 = getFloorTexture().clone();
    floorTex1.needsUpdate = true;
    floorTex1.wrapS = THREE.RepeatWrapping;
    floorTex1.wrapT = THREE.RepeatWrapping;
    floorTex1.repeat.set(8, 4);
    const floorGeo = new THREE.PlaneGeometry(72, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex1,
      roughness: 0.24,
      metalness: 0.14,
    });
    applyIndustrialPbr(floorMat, 0.012);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.levelRoot.add(floor);
    this.addSectorFloorGuides(0, 36, 1);
    this.platforms.push({ x: 0, y: 0, z: 0, width: 72, height: 0.2, depth: 40, type: 'floor' });

    // Back Wall pushed to z = -19.5 with industrial corrugated siding
    const wallTex1 = getWallTexture().clone();
    wallTex1.needsUpdate = true;
    wallTex1.wrapS = THREE.RepeatWrapping;
    wallTex1.wrapT = THREE.RepeatWrapping;
    wallTex1.repeat.set(9, 2);
    const wallGeo = new THREE.BoxGeometry(72, 9.5, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex1, roughness: 0.62, metalness: 0.18 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 4.75, -19.5);
    this.registerCameraOccluder(backWall);
    this.levelRoot.add(backWall);

    // Glowing Neon Showroom & Logistics Overhead Banner
    const neonSign = createNeonShowroomSign('CENTRUM B4 • SEKTOR A: LOGISTYKA B4', '#38bdf8');
    neonSign.position.set(0, 6.8, -19.2);
    this.levelRoot.add(neonSign);

    // Overhead Digital Industrial LED Scoreboard
    const scoreboard1 = createBhpDigitalScoreboard('SEKTOR A: DNI BEZ POTŁUCZONEJ PŁYTKI: 0');
    scoreboard1.position.set(0, 6.8, -10.0);
    this.levelRoot.add(scoreboard1);

    // Volumetric Overhead High-Bay Lamps & Light Beams
    [-28, -14, 0, 14, 28].forEach((lx) => {
      const lamp = createHighBayLamp();
      lamp.position.set(lx, 7.2, 0);
      const beam = createVolumetricLightBeam();
      beam.position.set(lx, 7.2, 0);
      this.levelRoot.add(lamp, beam);
    });
    applyIndustrialPbr(wallMat, 0.022);

    // Floor Pedestrian & Navigation Safety Arrows along main runway and south wing
    [-24, -16, -8, 0, 8, 16, 24, 32].forEach((ax) => {
      const arrow = createAisleArrow(1.5);
      arrow.position.set(ax, 0.015, -2.0);
      this.levelRoot.add(arrow);

      const arrowSouth = createAisleArrow(1.2);
      arrowSouth.position.set(ax, 0.015, 8.0);
      this.levelRoot.add(arrowSouth);
    });

    // Steam vents along the back wall
    [-26, -10, 8, 24].forEach((vx) => {
      const vent = createIndustrialSteamVent();
      vent.position.set(vx, 0, -18.8);
      this.levelRoot.add(vent);
    });

    // High Warehouse Racks — MOVED STRICTLY TO BACKGROUND (z = -12.5 and -8.5)
    // NEVER obscuring the foreground or the camera's sightline!
    const rack1 = createWarehouseRack(6.0, 4.2, 1.5);
    rack1.position.set(-18, 0, -12.5);
    const rack2 = createWarehouseRack(6.0, 4.2, 1.5);
    rack2.position.set(0, 0, -12.5);
    const rack3 = createWarehouseRack(6.0, 4.2, 1.5);
    rack3.position.set(18, 0, -12.5);
    const rackBack4 = createWarehouseRack(6.0, 4.2, 1.5);
    rackBack4.position.set(-8, 0, -8.0);
    const rackBack5 = createWarehouseRack(6.0, 4.2, 1.5);
    rackBack5.position.set(10, 0, -8.0);
    this.levelRoot.add(rack1, rack2, rack3, rackBack4, rackBack5);

    this.platforms.push({ x: -18, y: 1.4, z: -12.5, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: 0, y: 1.4, z: -12.5, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: 18, y: 1.4, z: -12.5, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: -8, y: 1.4, z: -8.0, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });
    this.platforms.push({ x: 10, y: 1.4, z: -8.0, width: 6.0, height: 0.15, depth: 1.5, type: 'shelf' });

    // Elevated Steel Catwalk Connecting Background Racks at y=3.4
    const catwalk1 = createHighBayCatwalk(12.0, 1.6);
    catwalk1.position.set(-9, 3.4, -12.5);
    const catwalk2 = createHighBayCatwalk(12.0, 1.6);
    catwalk2.position.set(9, 3.4, -12.5);
    this.levelRoot.add(catwalk1, catwalk2);
    this.platforms.push({ x: -9, y: 3.4, z: -12.5, width: 12.0, height: 0.15, depth: 1.6, type: 'scaffold' });
    this.platforms.push({ x: 9, y: 3.4, z: -12.5, width: 12.0, height: 0.15, depth: 1.6, type: 'scaffold' });

    // Multi-tier Pallet Platforms — Center & South Wing
    // Low profile in the foreground so the runway is 100% visible!
    const palletPositions = [
      { x: -30, z: -2.5, tier: 1 },
      { x: -26, z: 2.5, tier: 2 },
      { x: -22, z: -2.5, tier: 1 },
      { x: -18, z: 2.5, tier: 2 },
      { x: -14, z: -2.2, tier: 1 },
      { x: -10, z: 2.5, tier: 2 },
      { x: -6, z: -2.5, tier: 1 },
      { x: -2, z: 2.2, tier: 2 },
      { x: 2, z: -2.5, tier: 1 },
      { x: 6, z: 2.5, tier: 2 },
      { x: 10, z: -2.2, tier: 1 },
      { x: 14, z: 2.5, tier: 2 },
      { x: 18, z: -2.5, tier: 1 },
      { x: 22, z: 2.2, tier: 2 },
      { x: 26, z: -2.5, tier: 1 },
      // LATERAL SOUTH WING (z: 8 to 16)
      { x: -28, z: 12.0, tier: 1 },
      { x: -20, z: 9.5, tier: 2 },
      { x: -12, z: 13.5, tier: 1 },
      { x: -4, z: 10.0, tier: 2 },
      { x: 4, z: 14.0, tier: 1 },
      { x: 12, z: 10.5, tier: 2 },
      { x: 20, z: 13.0, tier: 1 },
      { x: 28, z: 9.5, tier: 2 },
    ];
    palletPositions.forEach((p, idx) => {
      const pallet = createTilePallet(p.tier);
      pallet.position.set(p.x, 0, p.z);
      this.levelRoot.add(pallet);
      const h = p.tier === 1 ? 0.6 : 0.95;
      this.platforms.push({ x: p.x, y: h / 2, z: p.z, width: 1.25, height: h, depth: 1.05, type: 'pallet' });
      this.addGroutItem(`grout_l1_${idx}`, p.x, h + 0.35, p.z, 50);
    });

    // Interactive Coffee Vending Machine in South Wing ("KAWIARKA B4 EXPRESS")
    const coffee1 = createCoffeeVendingMachineModel();
    coffee1.position.set(-16, 0, 15.5);
    this.levelRoot.add(coffee1);
    this.coffeeMachines.push({ mesh: coffee1, x: -16, y: 0, z: 15.5, cooldown: 0 });
    this.platforms.push({ x: -16, y: 0.9, z: 15.5, width: 0.85, height: 1.8, depth: 0.65, type: 'shelf' });

    // Interactive Jump Pads & Speed Boost Pads
    this.addJumpPad(-21, 0, -4.5, 17.5);
    this.addJumpPad(5, 0, 4.5, 17.0);
    this.addJumpPad(-8, 0, 14.0, 18.0); // Jump pad from south wing to catwalk!
    this.addSpeedPad(-12, 0, 0);
    this.addSpeedPad(12, 0, 0);
    this.addSpeedPad(0, 0, 11.0); // South corridor speed boost!
    this.addSpeedPad(34, 0, 0); // Boost pad right through the Sector A -> B transition gate!

    // Explosive Chemical Barrels (Beczki Kleju Pro Flex)
    this.addExplosiveBarrel('barrel_l1_1', -15, 0, -3.5);
    this.addExplosiveBarrel('barrel_l1_2', 15, 0, 3.5);
    this.addExplosiveBarrel('barrel_l1_3', -2, 0, 15.0);

    // VIP Collectibles
    this.addVipItem('vip_tile1', -18, 1.8, -12.5, 'Gres Hiszpański Biały Marmur 120x60');
    this.addVipItem('vip_tile2', 0, 1.8, -12.5, 'Złota Mozaika Ceramiczna Kompleks B4');
    this.addVipItem('vip_tile3', 18, 1.8, -12.5, 'Klej do Wielkiego Formatu Pro Flex');
    this.addVipItem('vip_tile4', -9, 3.8, -12.5, 'Specyfikacja Projektowa dla Hotelu 5*');
    this.addVipItem('vip_tile5', 20, 1.4, 13.0, 'Złota Próbka Spieku z Mediolanu (Bok B4)');

    // Pre-placed World-Drop Perks & Extra Power-Ups in Sector A
    this.spawnDroppedPerk(-9, 3.8, -12.5, 'vibram_boots');
    this.spawnDroppedPerk(9, 3.8, -12.5, 'hardhat');
    this.spawnDroppedPerk(-20, 1.4, 9.5, 'order_magnet');
    this.spawnDroppedPerk(14, 0.5, 3.5, 'espresso_boost');
    this.spawnDroppedPerk(-2, 0.5, -5.5, 'kfc_bucket');
    this.spawnDroppedPerk(22, 0.5, 6.0, 'golden_paleciak');
    this.spawnDroppedPerk(-28, 0.5, 5.5, 'stretch_armor');

    // Bonus Collectibles, Energy Packs & Espresso
    this.addEspressoItem('esp_l1_1', -20, 0.4, 3.5);
    this.addEspressoItem('esp_l1_2', 8, 0.4, -3.5);
    this.addKfcBucketItem('kfc_l1_1', -12, 0.45, 0);
    this.addKfcBucketItem('kfc_l1_2', 16, 0.45, 9.5);
    this.addGoldenCutterItem('cutter_l1_1', 14, 1.8, -12.5);
    this.addGoldenCutterItem('cutter_l1_2', -12, 1.2, 13.5);
    this.addMagnetItem('mag_l1_1', -6, 1.0, 2.5);

    // Easter Eggs
    this.addEasterEgg('egg_coffee_1', -24, 0.05, -15.5, 'Ukryta Strefa Kawowa', 'coffee', 400);
    this.addEasterEgg('egg_wz_1', 12, 1.85, 10.5, 'Zaginiona WZ-tka z 2012 Roku', 'folder', 450);
    
    // Loot Crates
    this.spawnLootCrate(-20, 0, 5);
    this.spawnLootCrate(15, 0, -5);
    this.spawnLootCrate(0, 3.4, -12.5);
    this.spawnLootCrate(16, 0, 14.5);
    this.spawnLootCrate(-24, 0, 12.0);

    // Forklift Hazards & New Interactive Warehouse Traps in Sector A
    this.addForkliftHazard('forklift_1', -24, 20, 0, 4.4, 0xf59e0b);
    this.addForkliftHazard('forklift_1_south', -20, 18, 11.5, 3.8, 0x0284c7);
    this.addStretchFilmBarrierTrap('stretch_l1_1', -16, -1.2, 5.0);
    this.addStretchFilmBarrierTrap('stretch_l1_2', 6, 4.5, 4.6);
    this.addRollerGateTrap('roller_l1_1', 18, -5.5, 2.0, 4.6);
    this.addLaserCutterTrap('laser_l1_1', -3, 0, 4.0, 2.6);
    this.addSteamGeyserTrap('steam_l1_1', 11, -1.5, 4.0);
    this.addHydraulicPressTrap('press_l1_1', 24, 0, 3.0);
    this.addZombieWorkerEnemy('zombie_l1_1', -11, -5, 5);
    this.addZombieWorkerEnemy('zombie_l1_2', 15, -5, 5);

    // Spray Graffiti & Crime Scene Chalk Outline Decals
    const arkadiusz1 = createSprayGraffitiDecal();
    arkadiusz1.position.set(-14, 0.035, -3.5);
    arkadiusz1.rotation.x = -Math.PI / 2;
    arkadiusz1.scale.set(1.4, 1.4, 1);
    this.levelRoot.add(arkadiusz1);

    const crime1 = createCrimeSceneBodyOutlineDecal('RUDY ŚMIERDZIUCH');
    crime1.position.set(-26, 0.035, 8.5);
    crime1.rotation.y = Math.PI / 4;
    crime1.scale.setScalar(3.2); 
    this.levelRoot.add(crime1);

    // Enemies in Sector A
    this.addCustomerEnemy('cust_1', -16, -6, 6, 'Klient z Reklamacją na Fugi');
    this.addCustomerEnemy('cust_2', 4, -6, 6, 'Pan Janusz (Gdzie moja faktura?!)');
    this.addCustomerEnemy('cust_3', -8, -6, 6, 'Awanturujący się Klient po Rabaty');
    this.addPanRomanEnemy('pan_roman_l1', -8, -6, 6, 'Dostawca Sanitarny z Dostawą Sanitariatów');
    this.addSerwisanciEnemy('serwisant_l1', -15, -6, 6, 'Serwisant Operacja B4u');
    this.addBosmanKrakowBossEnemy('bosman_l1', 0, 0);
    this.addKurierEnemy('kurier_l1_1', -10, -6, 6, 'Kurier Ekspresowy');
    this.addItalianVendorEnemy('ital_l1_1', 8, -5, 5, 'Włoski Dostawca Armatury z Mediolanu');
    this.addSztaplarEnemy('sztaplar_l1_1', -2, -6, 6, 'Szalony Operator Paleciaka B4');
    this.addEliteGuardEnemy('guard_l1_1', -22, -4, 4, 'Strażnik Sektora A');
    this.addInspectorEnemy('insp_l1_1', 14, -5, 5, 'Audytor Terenowy');
    this.addHandlowiecEnemy('handl_l1_1', -4, -6, 6, 'Przedstawiciel z Teczką');
    this.addMonterEnemy('monter_l1_1', 18, -4, 4, 'Glazurnik Wiesław (Poziomica!)');
    this.addAgvRobotEnemy('agv_1', -4, 12, 2.8, 'Autonomiczny AGV ze zlewami');
    this.addAgvRobotEnemy('agv_2', 8, -12, -2.8, 'Szalony Sztaplar AGV B4');
    this.addPiorunDronEnemy('dron_1', -18, 16, 0, 2.2, 'Piorun Dron Skaner Kodów B4');
    this.addEliteGuardEnemy('guard_l1_2', 20, -5, 5, 'Warta Honorowa Marmur B4');
    this.addHandlowiecEnemy('handl_l1_2', -12, -4, 4, 'Dyrektor Handlowy (Rabat 5%!)');

    // Enemies in South Wing
    this.addCustomerEnemy('cust_l1_south', -6, 8, 16, 'Klient z Projektantem (Bok B4)');
    this.addMonterEnemy('monter_l1_south', 10, 8, 16, 'Majster Kafelkarz');
    this.addAgvRobotEnemy('agv_l1_south', -18, 6, 12.0, 'AGV Paletowy Południe');

    // Overhead warehouse light rails break up the long roofline and give the aisles readable pools of light.
    [-24, 0, 24].forEach((tx, index) => {
      const rail = createTrackSpotlights(7.8);
      rail.position.set(tx, 7.35, -3.5);
      rail.rotation.y = index === 1 ? Math.PI / 2 : 0;
      this.levelRoot.add(rail);
    });

    // Accent Lighting
    const l1 = new THREE.PointLight(0x38bdf8, 18, 28);
    l1.position.set(-18, 5, 8);
    this.levelRoot.add(l1);
    const l2 = new THREE.PointLight(0xf59e0b, 15, 25);
    l2.position.set(12, 4, -8);
    this.levelRoot.add(l2);
    const l3 = new THREE.PointLight(0x10b981, 14, 24);
    l3.position.set(-4, 4, 14);
    this.levelRoot.add(l3);

    this.addPiorunDronEnemy('dron_2', -10, 22, -4, 2.4, 'Dron Inspekcyjny Sektora B');

    // Perimeter product islands: adds visual landmarks and colour without narrowing the central movement lanes.
    [-1, 1].forEach((side, index) => {
      const displayX = side * 31.8;
      const displayZ = -15.6;
      const podium = createDisplayPodium(2.4, 1.6, 0.24);
      podium.position.set(displayX,0,displayZ);
      this.levelRoot.add(podium);
      const tile = createLargeTileModel();
      tile.position.set(displayX,0.29,displayZ);
      tile.rotation.y = side * 0.10;
      this.levelRoot.add(tile);
      const marker = createNeonShowroomSign(index === 0 ? 'MARMUR B4 • 120×280' : 'CENTRUM B4 • PREMIUM GRES', index === 0 ? '#67e8f9' : '#fbbf24');
      marker.position.set(displayX,2.6,displayZ-0.7);
      marker.scale.setScalar(0.30);
      this.levelRoot.add(marker);
      const accent = new THREE.PointLight(index === 0 ? 0x38bdf8 : 0xf59e0b, 5.5, 9);
      accent.position.set(displayX,2.4,displayZ);
      this.levelRoot.add(accent);
    });

    const plantA = createShowroomPlant();
    plantA.position.set(-33.4,0,11.2);
    const plantB = createShowroomPlant();
    plantB.position.set(33.4,0,11.2);
    this.levelRoot.add(plantA,plantB);

    // Open Sector A -> Sector B Transition Archway
    const sectorGateAB = createFinishGate();
    sectorGateAB.position.set(35.5, 0, 0);
    this.levelRoot.add(sectorGateAB);
    const gateSignAB = createNeonShowroomSign('PRZEJŚCIE • SEKTOR B: SHOWROOM & SPA ➔', '#f59e0b');
    gateSignAB.position.set(35.5, 5.2, 0);
    gateSignAB.scale.setScalar(0.55);
    this.levelRoot.add(gateSignAB);
  }

  private buildLevel2(offsetX = 76) {
    // 1. High-Contrast Luxury Italian Nero Marquina & Gold Marble Floor (80x42, x: +36 to +116, z: -21 to +21)
    const floorTex2 = getShowroomMarbleFloorTexture().clone();
    floorTex2.needsUpdate = true;
    floorTex2.wrapS = THREE.RepeatWrapping;
    floorTex2.wrapT = THREE.RepeatWrapping;
    floorTex2.repeat.set(8, 4);
    const floorGeo = new THREE.PlaneGeometry(80, 42);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex2,
      roughness: 0.18,
      metalness: 0.22,
      color: 0xffffff,
    });
    applyIndustrialPbr(floorMat, 0.008);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(offsetX, 0, 0);
    floor.receiveShadow = true;
    this.levelRoot.add(floor);
    this.addSectorFloorGuides(offsetX, 40, 2);
    this.platforms.push({ x: offsetX, y: 0, z: 0, width: 80, height: 0.2, depth: 42, type: 'floor' });

    // Architectural Natural Oak Slat Showroom Wall with LED Cove Lighting (Pushed back to z = -20.5)
    const wallTex2 = getShowroomWallTexture().clone();
    wallTex2.needsUpdate = true;
    wallTex2.wrapS = THREE.RepeatWrapping;
    wallTex2.wrapT = THREE.RepeatWrapping;
    wallTex2.repeat.set(8, 2);
    const wallGeo = new THREE.BoxGeometry(80, 9.5, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex2,
      roughness: 0.32,
      metalness: 0.14,
      color: 0xffffff,
    });
    applyIndustrialPbr(wallMat, 0.022);
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(offsetX, 4.75, -20.5);
    this.registerCameraOccluder(backWall);
    this.levelRoot.add(backWall);

    // Showroom Neon Sign
    const neonSign = createNeonShowroomSign('CENTRUM B4 SHOWROOM • SEKTOR B: WANNY & SPA', '#ec4899');
    neonSign.position.set(offsetX, 6.8, -20.2);
    this.levelRoot.add(neonSign);

    // Overhead Digital Scoreboard in Showroom
    const scoreboard2 = createBhpDigitalScoreboard('SHOWROOM: ZAKAZ KĄPIELI W EKSPOZYCJI VIP!');
    scoreboard2.position.set(offsetX, 7.0, -10.0);
    this.levelRoot.add(scoreboard2);

    // Ceiling Track Spotlights
    [-24, -8, 8, 24].forEach((tx) => {
      const track = createTrackSpotlights(8.0);
      track.position.set(offsetX + tx, 7.2, 0);
      this.levelRoot.add(track);
    });

    // Glass Partitions — PLACED EXCLUSIVELY ON NORTH SIDE (z = -9.5) so foreground is 100% open!
    [-26, -14, -2, 10, 22].forEach((px) => {
      const glassNorth = createGlassPartition(2.8, 2.4);
      glassNorth.position.set(offsetX + px, 0, -9.5);
      this.levelRoot.add(glassNorth);
    });

    // Ceramic Planters with Greenery along perimeter
    [-34, -26, -16, -6, 4, 14, 24, 32].forEach((px, idx) => {
      const plant = createShowroomPlant();
      plant.position.set(offsetX + px, 0, idx % 2 === 0 ? -16.5 : 17.5);
      this.levelRoot.add(plant);
    });

    // Super Bouncy Bathtubs placed on Luxury Podiums
    // Staggered open diagonal layout — NO FOREGROUND OBSTRUCTIONS!
    const tubPositions = [
      { x: -30, z: -6.0 },
      { x: -22, z: 3.5 },
      { x: -14, z: -5.5 },
      { x: -4, z: 4.0 },
      { x: 6, z: -6.0 },
      { x: 16, z: 3.5 },
      { x: 26, z: -5.5 },
      // LATERAL SOUTH VIP SPA & JACUZZI LOUNGE (z: 11 to 16)
      { x: -26, z: 13.0 },
      { x: -10, z: 14.5 },
      { x: 8, z: 12.5 },
      { x: 22, z: 14.0 },
    ];
    tubPositions.forEach((tp, idx) => {
      const worldX = offsetX + tp.x;
      const podium = createDisplayPodium(3.2, 2.0, 0.22);
      podium.position.set(worldX, 0, tp.z);
      this.levelRoot.add(podium);

      const tub = createBathtubModel();
      // Place bathtub cleanly atop the 0.234m podium top pad to eliminate any Z-fighting
      tub.position.set(worldX, 0.235, tp.z);
      this.levelRoot.add(tub);
      this.platforms.push({
        x: worldX,
        y: 0.74,
        z: tp.z,
        width: 2.4,
        height: 1.0,
        depth: 1.4,
        type: 'bathtub',
        bounce: 17.5,
      });
      // Avoid overlapping collectibles on South VIP bathtubs (indices 7, 8, 9 already have cutter_l2_1, vibram_boots, vip_bath4)
      if (idx !== 7 && idx !== 8 && idx !== 9) {
        this.addGroutItem(`grout_l2_${idx}`, worldX, 1.65, tp.z, 60);
      }
    });

    // Elevated Luxury Catwalks — STRICTLY ON NORTH SIDE (z = -12.5 to -8.0)
    // Never blocking the bathtubs, enemies, or player runway!
    const catwalks = [
      { x: -28, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: -14, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: 0, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: 14, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
      { x: 28, y: 3.5, z: -8.0, w: 5.5, d: 2.4 },
    ];
    catwalks.forEach((cw, idx) => {
      const worldX = offsetX + cw.x;
      const cwGroup = createHighBayCatwalk(cw.w, cw.d);
      cwGroup.position.set(worldX, cw.y, cw.z);
      this.levelRoot.add(cwGroup);
      this.platforms.push({ x: worldX, y: cw.y, z: cw.z, width: cw.w, height: 0.2, depth: cw.d, type: 'shelf' });
      this.addGroutItem(`grout_cw_${idx}`, worldX, cw.y + 0.4, cw.z, 80);
    });

    // Interactive Coffee Vending Machine in Showroom Lounge
    const coffee2 = createCoffeeVendingMachineModel();
    coffee2.position.set(offsetX - 18, 0, 16.5);
    this.levelRoot.add(coffee2);
    this.coffeeMachines.push({ mesh: coffee2, x: offsetX - 18, y: 0, z: 16.5, cooldown: 0 });
    this.platforms.push({ x: offsetX - 18, y: 0.9, z: 16.5, width: 0.85, height: 1.8, depth: 0.65, type: 'shelf' });

    // Interactive Jump Pads & Speed Pads in Showroom
    this.addJumpPad(offsetX - 14, 0, -3.5, 17.5);
    this.addJumpPad(offsetX + 8, 0, 3.5, 17.0);
    this.addJumpPad(offsetX - 2, 0, 12.0, 18.0); // South spa launchpad!
    this.addSpeedPad(offsetX - 4, 0, 0);
    this.addSpeedPad(offsetX + 14, 0, 0);
    this.addSpeedPad(offsetX, 0, 8.5); // South spa runner speedpad!
    this.addSpeedPad(offsetX + 38, 0, 0); // Boost pad through Sector B -> C transition gate!

    // Explosive Chemical Barrels
    this.addExplosiveBarrel('barrel_l2_1', offsetX - 10, 0, -4.0);
    this.addExplosiveBarrel('barrel_l2_2', offsetX + 10, 0, 4.0);
    this.addExplosiveBarrel('barrel_l2_3', offsetX + 18, 0, 15.0);

    // VIP Showroom Items
    this.addVipItem('vip_bath1', offsetX - 28, 3.9, -8.0, 'Złota Bateria Wolnostojąca Villeroy & Boch');
    this.addVipItem('vip_bath2', offsetX, 3.9, -8.0, 'Wanna Wolnostojąca z Hydromasażem Marmur Carrara');
    this.addVipItem('vip_bath3', offsetX + 28, 3.9, -8.0, 'Umywalka Nablatowa z Naturalnego Onyksu');
    this.addVipItem('vip_bath4', offsetX + 8, 1.6, 12.5, 'Kolekcja Armatury Złotej z Mediolanu (VIP SPA)');

    // Dropped Perks & Collectibles in World (Sector B)
    this.spawnDroppedPerk(offsetX - 14, 3.9, -8.0, 'espresso_boost');
    this.spawnDroppedPerk(offsetX + 14, 3.9, -8.0, 'order_magnet');
    this.spawnDroppedPerk(offsetX + 22, 0.5, -6, 'hardhat');
    this.spawnDroppedPerk(offsetX - 28, 3.9, -8.0, 'vibram_boots');
    this.spawnDroppedPerk(offsetX - 10, 1.65, 14.5, 'vibram_boots');
    this.spawnDroppedPerk(offsetX - 2, 0.5, -2.5, 'kfc_bucket');
    this.spawnDroppedPerk(offsetX + 12, 0.5, 6.5, 'golden_paleciak');
    this.spawnDroppedPerk(offsetX - 20, 0.5, 8.5, 'stretch_armor');

    this.addEspressoItem('esp_l2_1', offsetX - 22, 0.4, -2.0);
    this.addEspressoItem('esp_l2_2', offsetX + 18, 0.4, 2.0);
    this.addKfcBucketItem('kfc_l2_1', offsetX + 4, 0.45, -1.5);
    this.addKfcBucketItem('kfc_l2_2', offsetX - 14, 0.45, 9.5);
    this.addGoldenCutterItem('cutter_l2_1', offsetX - 26, 1.65, 13.0);
    this.addMagnetItem('mag_l2_1', offsetX + 12, 3.9, -8.0);

    // Showroom Hazards & Interactive Traps (Steam Geysers, Laser Cutters, Glue Spills)
    this.addSteamGeyserTrap('steam_l2_1', offsetX - 18, 0, 4.0);
    this.addSteamGeyserTrap('steam_l2_2', offsetX + 2, -1.5, 3.8);
    this.addSteamGeyserTrap('steam_l2_3', offsetX + 14, 9.0, 4.2);
    this.addLaserCutterTrap('laser_l2_1', offsetX - 8, 0, 4.2, 2.8);
    this.addStretchFilmBarrierTrap('stretch_l2_1', offsetX + 10, 1.5, 5.0);
    this.addRollerGateTrap('roller_l2_1', offsetX - 24, 5.5, 2.3, 5.0);
    this.addHydraulicPressTrap('press_l2_1', offsetX + 20, -2.0, 3.2);
    this.addZombieWorkerEnemy('zombie_l2_1', offsetX - 6, -5, 5);
    this.addZombieWorkerEnemy('zombie_l2_2', offsetX + 16, -5, 5);

    // Easter Eggs
    this.addEasterEgg('egg_throne_1', offsetX + 30, 0.05, -14.5, 'Złoty Tron Prezesa z 24k Złotem', 'throne', 600);
    this.addEasterEgg('egg_l2_coffee', offsetX - 32, 0.05, 15.5, 'Tajemna Kawiarka Ciśnieniowa z Mediolanu (Zapas Espresso)', 'coffee', 500);
    this.addEasterEgg('egg_l2_wz', offsetX + 6, 0.05, 16.0, 'Zagubiona Umowa z Włoską Fabryką Gresu na Wyłączność', 'folder', 550);

    // Decals - Visible against the dark marble!
    const spray2 = createSprayGraffitiDecal();
    spray2.position.set(offsetX, 0.035, -4.0);
    spray2.rotation.x = -Math.PI / 2;
    spray2.scale.setScalar(2.5);
    this.levelRoot.add(spray2);

    const crime2 = createCrimeSceneBodyOutlineDecal('RUDY ŚMIERDZIUCH');
    crime2.position.set(offsetX - 28, 0.035, 9.0);
    crime2.scale.setScalar(3.0);
    this.levelRoot.add(crime2);

    // Dense Enemies in Showroom
    this.addCustomerEnemy('cust_l2_1', offsetX - 22, -6, 6, 'Zdezorientowany Klient Szukający Syfonu');
    this.addCustomerEnemy('cust_l2_2', offsetX + 10, -6, 6, 'Klient z Projektantką Wnętrz');
    this.addPanRomanEnemy('pan_roman_l2', offsetX, -6, 6, 'Dostawca Sanitarny z Dostawą Sanitariatów');
    this.addSerwisanciEnemy('serwisant_l2', offsetX + 5, -6, 6, 'Serwisant Operacja B4u');
    this.addBosmanKrakowBossEnemy('bosman_l2', offsetX + 20, 0);
    this.addKurierEnemy('kurier_l2_1', offsetX - 16, -6, 6, 'Kurier Ekspresowy');
    this.addItalianVendorEnemy('ital_l2_1', offsetX + 2, -6, 6, 'Przedstawiciel Fabryki z Bolonii');
    this.addSztaplarEnemy('sztaplar_l2_1', offsetX + 18, -6, 6, 'Kierowca Sztaplarki Showroomu');
    this.addArchitectEnemy('arch_l2_1', offsetX - 12, offsetX - 2, -4, 'Główny Projektant Wnętrz z Warszawy');
    this.addArchitectEnemy('arch_l2_2', offsetX + 6, offsetX + 16, 4, 'Krytyk Mieszanek Tynkarskich i Beżu');
    this.addInspectorEnemy('insp_l2_1', offsetX - 4, -6, 6, 'Inspektor BHP z PIP-u');
    this.addHandlowiecEnemy('handl_l2_1', offsetX + 14, -6, 6, 'Kierownik Sprzedaży Salonu');
    this.addMonterEnemy('monter_l2_1', offsetX - 14, -6, 6, 'Hydraulik z Kluczem Nastawnym');
    this.addPiorunDronEnemy('dron_l2_1', offsetX - 20, offsetX + 20, 0, 2.4, 'Dron Multimedialny Showroomu');
    this.addEliteGuardEnemy('guard_l2_1', offsetX - 30, -5, 5, 'Strażnik Biały Marmur');
    this.addAgvRobotEnemy('agv_l2_1', offsetX, offsetX + 15, -8.0, 'AGV Salonowy (Lustra)');

    // South Spa Lounge Enemies
    this.addArchitectEnemy('arch_l2_south', offsetX - 16, offsetX - 4, 13.0, 'Architekt Luksusu Spa');
    this.addCustomerEnemy('cust_l2_south', offsetX + 12, 8, 17, 'Klientka VIP po Jacuzzi');

    // BOSS LEVEL 2: Król-Leto
    this.addKrolLetoBossEnemy('boss_krol_leto_l2', offsetX + 24, 0);

    // Loot Crates on Level 2
    this.spawnLootCrate(offsetX - 25, 0, 0);
    this.spawnLootCrate(offsetX + 15, 3.5, -8.0);
    this.spawnLootCrate(offsetX, 0, 8);
    this.spawnLootCrate(offsetX + 30, 0, -8);
    this.spawnLootCrate(offsetX - 15, 0, 14);
    this.spawnLootCrate(offsetX + 16, 0, 15);

    // Open Sector B -> Sector C Transition Archway
    const sectorGateBC = createFinishGate();
    sectorGateBC.position.set(offsetX + 39.5, 0, 0);
    this.levelRoot.add(sectorGateBC);
    const gateSignBC = createNeonShowroomSign('PRZEJŚCIE • SEKTOR C: TERMINAL PRZEŁADUNKOWY ➔', '#ef4444');
    gateSignBC.position.set(offsetX + 39.5, 5.2, 0);
    gateSignBC.scale.setScalar(0.55);
    this.levelRoot.add(gateSignBC);
  }

  private buildLevel3(offsetX = 161) {
    // 1. High-Bay Terminal Arena Floor (90x44, x: +116 to +206, z: -22 to +22)
    const floorTex3 = getTerminalGraniteFloorTexture().clone();
    floorTex3.needsUpdate = true;
    floorTex3.wrapS = THREE.RepeatWrapping;
    floorTex3.wrapT = THREE.RepeatWrapping;
    floorTex3.repeat.set(9, 4);
    const floorGeo = new THREE.PlaneGeometry(90, 44);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex3, roughness: 0.24, metalness: 0.22 });
    applyIndustrialPbr(floorMat, 0.012);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(offsetX, 0, 0);
    floor.receiveShadow = true;
    this.levelRoot.add(floor);
    this.addSectorFloorGuides(offsetX, 45, 3);
    this.platforms.push({ x: offsetX, y: 0, z: 0, width: 90, height: 0.2, depth: 44, type: 'floor' });

    // Terminal Back Wall (Pushed back to z = -21.5)
    const wallTex3 = getWallTexture().clone();
    wallTex3.needsUpdate = true;
    wallTex3.wrapS = THREE.RepeatWrapping;
    wallTex3.wrapT = THREE.RepeatWrapping;
    wallTex3.repeat.set(10, 2);
    const wallGeo = new THREE.BoxGeometry(90, 10.0, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex3, roughness: 0.58, metalness: 0.2 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(offsetX, 5.0, -21.5);
    this.registerCameraOccluder(backWall);
    this.levelRoot.add(backWall);

    const neonSign = createNeonShowroomSign('CENTRUM B4 TERMINAL • SEKTOR C: STREFA ZAŁADUNKU VIP', '#f59e0b');
    neonSign.position.set(offsetX, 7.2, -21.2);
    this.levelRoot.add(neonSign);

    // Overhead Digital Scoreboard in Terminal
    const scoreboard3 = createBhpDigitalScoreboard('TERMINAL VIP: ODPRAWA KURIERÓW • BRAK TARYFY ULGOWEJ!');
    scoreboard3.position.set(offsetX + 10, 7.2, -10.0);
    this.levelRoot.add(scoreboard3);

    // Brighter terminal-side visual anchors: illuminated slab kiosks, plant silhouettes and loading signage.
    [-1,1].forEach((side,index)=>{
      const displayX=offsetX+side*39;
      const displayZ=14.4;
      const podium=createDisplayPodium(2.5,1.75,0.24);
      podium.position.set(displayX,0,displayZ);
      this.levelRoot.add(podium);
      const slab=createLargeTileModel();
      slab.position.set(displayX,0.29,displayZ);
      slab.rotation.y=side*0.14;
      this.levelRoot.add(slab);
      const sign=createNeonShowroomSign(index===0?'WZ / WYDANIE TOWARU':'RAMPY • TERMINAL C',index===0?'#67e8f9':'#fb7185');
      sign.position.set(displayX,2.55,displayZ-0.8);
      sign.scale.setScalar(0.30);
      this.levelRoot.add(sign);
      const light=new THREE.PointLight(index===0?0x38bdf8:0xef4444,6.5,10);
      light.position.set(displayX,2.2,displayZ);
      this.levelRoot.add(light);
      const plant=createShowroomPlant();
      plant.position.set(displayX-side*2.1,0,displayZ-1.1);
      this.levelRoot.add(plant);
    });

    // Roof-mounted high-bay rails create a visible terminal ceiling rhythm and light the loading lanes.
    [-30, -10, 12, 32].forEach((tx, index) => {
      const rail = createTrackSpotlights(8.6);
      rail.position.set(offsetX + tx, 7.75, -2.0);
      rail.rotation.y = index % 2 === 0 ? 0 : Math.PI / 2;
      this.levelRoot.add(rail);
    });

    // High-Bay Terminal Racks — MOVED STRICTLY TO BACKGROUND (z = -14.0 and -10.5)
    // NEVER blocking the central arena or the delivery dock from the camera!
    [-26, -6, 14, 34].forEach((rx, idx) => {
      const worldX = offsetX + rx;
      const rackBack = createWarehouseRack(6.5, 4.4, 1.6);
      rackBack.position.set(worldX, 0, -14.0);
      this.levelRoot.add(rackBack);
      this.platforms.push({ x: worldX, y: 1.4, z: -14.0, width: 6.5, height: 0.15, depth: 1.6, type: 'shelf' });

      const cw = createHighBayCatwalk(8.0, 1.8);
      cw.position.set(worldX, 3.6, -14.0);
      this.levelRoot.add(cw);
      this.platforms.push({ x: worldX, y: 3.6, z: -14.0, width: 8.0, height: 0.18, depth: 1.8, type: 'scaffold' });
    });
    applyIndustrialPbr(wallMat, 0.022);

    // Pallet stepping stones in central corridor and south loading wing (z: -4 to +16)
    [-32, -18, -4, 10, 24].forEach((px, idx) => {
      const worldX = offsetX + px;
      const pz = idx % 2 === 0 ? -3.2 : 3.2;
      const pallet = createTilePallet(idx % 2 === 0 ? 2 : 1);
      pallet.position.set(worldX, 0, pz);
      this.levelRoot.add(pallet);
      const h = idx % 2 === 0 ? 0.95 : 0.6;
      this.platforms.push({ x: worldX, y: h / 2, z: pz, width: 1.25, height: h, depth: 1.05, type: 'pallet' });
      this.addGroutItem(`grout_l3_${idx}`, worldX, h + 0.35, pz, 75);
    });

    // South Wing (Terminal C-Bis: z = 8 to 17) Pallet Staging Area
    [-24, -10, 4, 18, 32].forEach((px, idx) => {
      const worldX = offsetX + px;
      const pallet = createTilePallet(1, 'nero');
      pallet.position.set(worldX, 0, 12.5);
      this.levelRoot.add(pallet);
      this.platforms.push({ x: worldX, y: 0.3, z: 12.5, width: 1.25, height: 0.6, depth: 1.05, type: 'pallet' });
      this.addGroutItem(`grout_l3_south_${idx}`, worldX, 0.95, 12.5, 80);
    });

    // Interactive Coffee Vending Machine in Terminal
    const coffee3 = createCoffeeVendingMachineModel();
    coffee3.position.set(offsetX - 6, 0, 16.5);
    this.levelRoot.add(coffee3);
    this.coffeeMachines.push({ mesh: coffee3, x: offsetX - 6, y: 0, z: 16.5, cooldown: 0 });
    this.platforms.push({ x: offsetX - 6, y: 0.9, z: 16.5, width: 0.85, height: 1.8, depth: 0.65, type: 'shelf' });

    this.addJumpPad(offsetX - 28, 0, -5.0, 18.0);
    this.addJumpPad(offsetX + 4, 0, 5.0, 18.0);
    this.addJumpPad(offsetX - 14, 0, 13.0, 18.5); // South terminal shortcut launchpad!
    this.addSpeedPad(offsetX - 14, 0, 0);
    this.addSpeedPad(offsetX + 18, 0, 0);
    this.addSpeedPad(offsetX + 2, 0, 10.0); // South corridor speedpad!

    this.addExplosiveBarrel('barrel_l3_1', offsetX - 12, 0, -4.5);
    this.addExplosiveBarrel('barrel_l3_2', offsetX + 16, 0, 4.5);
    this.addExplosiveBarrel('barrel_l3_3', offsetX - 2, 0, 14.5);

    // VIP Collectibles in Sector C
    this.addVipItem('vip_term1', offsetX - 26, 4.0, -14.0, 'Paleta Eksportowa Spieków Kwarcowych 300x100');
    this.addVipItem('vip_term2', offsetX - 6, 4.0, -14.0, 'Złoty Zestaw Podtynkowy Penthouse VIP');
    this.addVipItem('vip_term3', offsetX + 14, 4.0, -14.0, 'Główny List Przewozowy Konwoju Kompleks B4');
    this.addVipItem('vip_term4', offsetX + 28, 1.2, 0, 'Kluczyki do Floty Dostawczej Prezesa');
    this.addVipItem('vip_term5', offsetX + 18, 1.2, 12.5, 'Pieczęć Notarialna Odbioru Towaru');

    // Strategic Perks & Extra Power-ups in Sector C
    this.spawnDroppedPerk(offsetX - 20, 0.5, 0, 'vibram_boots');
    this.spawnDroppedPerk(offsetX + 20, 0.5, 0, 'hardhat');
    this.spawnDroppedPerk(offsetX - 6, 4.0, -14.0, 'espresso_boost');
    this.spawnDroppedPerk(offsetX + 4, 0.5, 12.5, 'order_magnet');
    this.spawnDroppedPerk(offsetX - 10, 0.5, -2.5, 'kfc_bucket');
    this.spawnDroppedPerk(offsetX + 8, 0.5, -3.5, 'golden_paleciak');
    this.spawnDroppedPerk(offsetX + 22, 0.5, 7.0, 'stretch_armor');
    this.addKfcBucketItem('kfc_l3_1', offsetX - 2, 0.45, 0);
    this.addKfcBucketItem('kfc_l3_2', offsetX + 16, 0.45, -6.0);

    // Forklift Hazards & Heavy Industrial Traps in Sector C
    this.addForkliftHazard('forklift_3', offsetX - 34, offsetX + 26, 0, 5.2, 0xef4444);
    this.addForkliftHazard('forklift_3_south', offsetX - 24, offsetX + 20, 11.0, 4.0, 0xf59e0b);
    this.addHydraulicPressTrap('press_l3_1', offsetX - 22, 0, 3.4);
    this.addHydraulicPressTrap('press_l3_2', offsetX + 12, 0, 3.6);
    this.addLaserCutterTrap('laser_l3_1', offsetX - 8, 0, 4.4, 3.2);
    this.addSteamGeyserTrap('steam_l3_1', offsetX + 2, 2.5, 3.6);
    this.addStretchFilmBarrierTrap('stretch_l3_1', offsetX + 20, -2.0, 5.2);
    this.addRollerGateTrap('roller_l3_1', offsetX - 34, 4.5, 2.5, 5.2);
    this.addZombieWorkerEnemy('zombie_l3_1', offsetX - 16, -6, 6);
    this.addZombieWorkerEnemy('zombie_l3_2', offsetX + 6, -6, 6);

    // Bosses & Enemies in Sector C
    this.addWalczakBossEnemy('boss_walczak', offsetX + 30, -5);
    this.addKrolLetoBossEnemy('boss_krol_leto_l3', offsetX + 30, 5);
    this.addBosmanKrakowBossEnemy('bosman_l3', offsetX + 15, 0);
    
    this.addEliteGuardEnemy('guard_l3_1', offsetX, -8, 8, 'Elitarna Straż');
    this.addKurierEnemy('kurier_l3_1', offsetX - 25, -6, 6, 'Kurier Ekspresowy');
    this.addItalianVendorEnemy('ital_l3_1', offsetX - 15, -6, 6, 'Włoski Delegat');
    this.addSztaplarEnemy('sztaplar_l3_1', offsetX + 5, -6, 6, 'Operator Agresywny');
    this.addArchitectEnemy('arch_l3_1', offsetX - 10, offsetX + 10, 0, 'Główny Architekt');
    this.addCustomerEnemy('cust_l3_1', offsetX - 20, -5, 5, 'Klient VIP');
    this.addHandlowiecEnemy('handl_l3_1', offsetX + 10, -5, 5, 'Dyrektor Handlowy');
    this.addInspectorEnemy('insp_l3_1', offsetX - 30, -5, 5, 'Główny Inspektor');
    this.addMonterEnemy('monter_l3_1', offsetX + 20, -6, 6, 'Majster Budowy');
    this.addPiorunDronEnemy('dron_l3_1', offsetX - 20, offsetX + 20, 0, 2.5, 'Dron Bitewny');

    // South Wing Enemies
    this.addPanRomanEnemy('pan_roman_l3_south', offsetX - 12, 8, 17, 'Dostawca Sanitarny na Rampie C');
    this.addKurierEnemy('kurier_l3_south', offsetX + 8, 8, 17, 'Kurier z Płytkami (Kurier Express)');

    // Loot Crates
    this.spawnLootCrate(offsetX - 30, 0, 5);
    this.spawnLootCrate(offsetX, 0, 10);
    this.spawnLootCrate(offsetX + 30, 0, -10);
    this.spawnLootCrate(offsetX - 14, 0, 15);
    this.spawnLootCrate(offsetX + 12, 0, 14);

    // Final Finish Gate & Delivery Van at the end of Sector C (x = 201)
    const finishGate = createFinishGate();
    finishGate.position.set(offsetX + 40, 0, 0);
    this.finishGatePos.set(offsetX + 40, 0, 0);
    this.levelRoot.add(finishGate);

    const van = createDeliveryVan();
    van.position.set(offsetX + 41.8, 0, 0);
    van.rotation.y = -Math.PI / 2;
    this.levelRoot.add(van);
    this.platforms.push({ x: offsetX + 41.8, y: 0.8, z: 0, width: 3.5, height: 1.6, depth: 2.6, type: 'finish_truck' });
    
    // Lighting
    const l = new THREE.PointLight(0xef4444, 20, 40);
    l.position.set(offsetX + 25, 5, 0);
    this.levelRoot.add(l);
  }

  public update(dt: number) {
    if (this.state !== 'playing' && this.state !== 'title') return;

    const frameDt = Number.isFinite(dt) ? Math.max(0, dt) : 0.016;
    dt = Math.min(0.12, frameDt * (this.state === 'playing' ? this.timeScale : 1));
    let effectiveDt = dt;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      effectiveDt = dt * 0.2;
    }
    const simDt = effectiveDt;

    this.updatePerkTimers(simDt);

    if (this.state === 'playing') {
      if (this.gameMode === 'pvp') {
        this.updatePvpMode(simDt);
        return;
      }
      this.activeElapsedSeconds += simDt;
      this.updateAbilityCooldown(simDt);
      this.updateSurvivalDashCooldown(simDt);
      this.updateLootCrates(simDt);
      if (this.invulnerableTimer > 0) this.invulnerableTimer -= simDt;
      if (this.marcinReclamationTimer > 0) this.marcinReclamationTimer = Math.max(0, this.marcinReclamationTimer - simDt);
      if (this.grzesiekCrushTimer > 0) this.grzesiekCrushTimer = Math.max(0, this.grzesiekCrushTimer - simDt);
      if (this.grzesiekCrushPulse > 0) this.grzesiekCrushPulse = Math.max(0, this.grzesiekCrushPulse - simDt);
      if (this.mateuszLagTimer > 0) this.mateuszLagTimer = Math.max(0, this.mateuszLagTimer - simDt);
      if (this.finishWarningTimer > 0) this.finishWarningTimer = Math.max(0, this.finishWarningTimer - simDt);

      if (this.speechBubbleTimer > 0) {
        this.speechBubbleTimer -= simDt;
        if (this.speechBubbleTimer <= 0) {
          this.callbacks.onSpeechBubble('');
        }
      }
      this.heroQuipTimer -= simDt;
      if (this.heroQuipTimer <= 0 && this.speechBubbleTimer <= 0) {
        this.sayRandomVoiceLine();
        this.heroQuipTimer = 31 + Math.random() * 22;
      }

      if (this.comboTimer > 0) {
        this.comboTimer -= simDt;
        if (this.comboTimer <= 0) {
          this.comboStreak = 0;
        }
      }
      if (this.gameMode === 'survival') {
        this.survivalMomentum = advanceSurvivalMomentum(this.survivalMomentum, simDt);
      }

      this.updatePlayerMovement(simDt);
      if (this.gameMode === 'survival') {
        this.updateSurvivalDirector(simDt);
      } else {
        this.updateSectorProgression(simDt);
      }
      this.updateCoffeeMachines(simDt);
      this.updateCollectibles(simDt);
      if (this.gameMode === 'survival') this.updateSurvivalSecrets(simDt);
      this.updateDroppedPerks(simDt);
      this.updateHazards(simDt);
      if (this.gameMode !== 'survival') {
        this.updateExplosiveBarrels(simDt);
        this.updateFallingTiles(simDt);
        this.updateTimedEvents(simDt);
      }
      this.updateRandomSpawners(simDt);
      this.updateEnemies(simDt);
      this.updateMarcinTank(simDt);
      this.updateMateuszCats(simDt);
      this.updateMafiCapybaras(simDt);
      if (this.manualAimEnabled) {
        // PvP shots are spawned by the authoritative room after one explicit tap.
      } else if (this.gameMode === 'survival') {
        this.updateSurvivalAutoCombat(simDt);
      }
      this.updateProjectiles(simDt);
      if (this.gameMode === 'survival') this.updateSurvivalXpGems(simDt);
      this.updateSpecialEffects(simDt);
      this.updateParticles(simDt);
    }

    if (!this.envMapInitialized && this.threeRenderer && this.scene) {
      try {
        const pmrem = new THREE.PMREMGenerator(this.threeRenderer);
        pmrem.compileEquirectangularShader();
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environment = envTex;
        (this.scene as any).environmentIntensity = 0.55;
        pmrem.dispose();
        this.envMapInitialized = true;
      } catch (_e) {
        this.envMapInitialized = true;
      }
    }

    if (this.bloomPulseTimer > 0) {
      this.bloomPulseTimer = Math.max(0, this.bloomPulseTimer - dt);
      // A frame-rate independent highlight envelope: rise, peak, and fade.
      // This is deliberately restrained so gold, skin and pale tile surfaces keep detail.
      if (this.threeRenderer) {
        const progress = THREE.MathUtils.clamp(
          1 - this.bloomPulseTimer / Math.max(0.08, this.bloomPulseDuration),
          0,
          1
        );
        const pulse = Math.sin(Math.PI * progress);
        this.threeRenderer.toneMappingExposure = 1.08 + pulse * 0.075;
      }
    } else if (this.threeRenderer) {
      this.threeRenderer.toneMappingExposure = 1.08;
      this.bloomPulseDuration = 0.3;
    }

    this.updateCamera(dt);
  }

  private updateSurvivalAutoCombat(dt: number) {
    if (this.state !== 'playing' || this.gameMode !== 'survival' || this.manualAimEnabled) return;

    const momentumRate = getSurvivalMomentumRateMultiplier(this.survivalMomentum.overdriveRemainingSeconds);
    const oniricRate = this.oniricDreamRemainingSeconds > 0 ? 1.30 : 1;
    this.survivalWeaponDispatchCooldown = Math.max(0, this.survivalWeaponDispatchCooldown - dt * momentumRate * oniricRate);

    // Tactical aim: a nearby elite, boss or committed charging threat can be
    // more valuable than the closest low-risk grunt. A distant boss never
    // overrides a threat already in the operator's face.
    const selection = selectSurvivalAutoTarget(
      this.enemies,
      this.playerPos.x,
      this.playerPos.z,
      SURVIVAL_AUTO_AIM_RANGE_METERS * this.survivalRangeMultiplier * (this.oniricDreamRemainingSeconds > 0 ? 1.22 : 1)
    );
    const target = selection?.target ?? null;

    if (target) {
      this.playerRot = Math.atan2(target.x - this.playerPos.x, target.z - this.playerPos.z);
      if (this.playerGroup) this.playerGroup.rotation.y = this.playerRot;
      if (this.attackCooldownTimer <= 0) this.triggerAttack();
    }

    // All reloads progress independently, even while no target is in range.
    // Overdrive raises reload tempo without bypassing the one-volley dispatch gate.
    for (const weapon of this.survivalWeapons) {
      weapon.cooldown = Math.max(0, weapon.cooldown - dt * momentumRate * oniricRate);
    }

    // Fire at most one weapon per dispatch window. If several reloads finish together,
    // their shots are spaced out instead of landing as one screen-filling burst.
    if (!target || this.survivalWeaponDispatchCooldown > 0) return;
    const readyWeaponIndex = findNextReadyWeaponIndex(
      this.survivalWeapons.map((weapon) => weapon.cooldown),
      this.survivalWeaponDispatchCursor,
    );
    if (readyWeaponIndex < 0) return;
    const readyWeapon = this.survivalWeapons[readyWeaponIndex];

    this.fireSurvivalWeapon(readyWeapon, target);
    readyWeapon.cooldown = this.getScaledSurvivalWeaponReloadSeconds(
      readyWeapon.id, readyWeapon.level, !!readyWeapon.evolved
    );
    this.survivalWeaponDispatchCursor = getNextWeaponDispatchCursor(readyWeaponIndex, this.survivalWeapons.length);
    this.survivalWeaponDispatchCooldown = SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS / oniricRate;
  }

  private spawnSurvivalWeaponMuzzleFx(weapon: SurvivalWeaponState, target: EnemyItem): void {
    const weaponId = weapon.id as SurvivalDamageWeaponId;
    const meta = SURVIVAL_DAMAGE_WEAPONS[weaponId];
    const pattern: Record<SurvivalDamageWeaponId, { shape: ParticleShape; count: number; size: number; speed: number; spread: number }> = {
      pallet_cannon: { shape: 'flat-box', count: 5, size: 0.115, speed: 4.8, spread: 0.22 },
      diamond_saw: { shape: 'octahedron', count: 4, size: 0.095, speed: 5.8, spread: 0.62 },
      glue_mine: { shape: 'sphere', count: 3, size: 0.14, speed: 2.6, spread: 0.34 },
      kfc_bomber: { shape: 'tetrahedron', count: 4, size: 0.12, speed: 5.0, spread: 0.46 },
      piorun_drone: { shape: 'octahedron', count: 3, size: 0.10, speed: 4.7, spread: 0.18 },
      forklift_bolter: { shape: 'flat-box', count: 3, size: 0.075, speed: 8.0, spread: 0.16 },
      scanner_pulse: { shape: 'box', count: 3, size: 0.075, speed: 7.2, spread: 0.24 },
      orbit_blades: { shape: 'tetrahedron', count: 4, size: 0.085, speed: 3.0, spread: 0.95 },
      calacatta_shards: { shape: 'tetrahedron', count: 5, size: 0.105, speed: 6.0, spread: 0.82 },
      steam_bomb: { shape: 'sphere', count: 4, size: 0.13, speed: 3.4, spread: 0.38 },
      forklift_horn: { shape: 'flat-box', count: 6, size: 0.095, speed: 3.6, spread: Math.PI * 2 },
      wz_boomerang: { shape: 'octahedron', count: 4, size: 0.105, speed: 5.5, spread: 0.7 },
    };
    const visual = pattern[weaponId];
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const count = Math.min(visual.count, isMobile ? (this.adaptivePerformanceTier >= 2 ? 2 : this.adaptivePerformanceTier === 1 ? 3 : visual.count) : visual.count);
    const forward = new THREE.Vector3(target.x - this.playerPos.x, 0, target.z - this.playerPos.z);
    if (forward.lengthSq() < 0.001) forward.set(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let index = 0; index < count; index++) {
      const lane = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
      const mesh = this.particlePool.acquire(visual.shape, meta.color, visual.size, 0.92);
      if (!mesh) break;
      mesh.position.set(this.playerPos.x, this.playerPos.y + 0.88, this.playerPos.z);
      mesh.rotation.set(index * 0.55, index * 0.8, index * 0.35);
      this.levelRoot.add(mesh);

      let velocity: THREE.Vector3;
      if (weaponId === 'forklift_horn') {
        const angle = (index / count) * Math.PI * 2;
        velocity = new THREE.Vector3(Math.cos(angle) * visual.speed, 0.75, Math.sin(angle) * visual.speed);
      } else {
        velocity = forward.clone().multiplyScalar(visual.speed)
          .addScaledVector(right, lane * visual.spread)
          .add(new THREE.Vector3(0, 0.75 + (index % 2) * 0.45, 0));
      }
      this.particles.push({
        mesh,
        vel: velocity,
        life: weapon.evolved ? 0.48 : 0.38,
        maxLife: weapon.evolved ? 0.48 : 0.38,
        gravity: 1.2,
        baseScale: visual.size,
        rotVel: new THREE.Vector3(4 + index, 5 + index * 0.6, 3 + index * 0.4),
      });
    }
  }

  private spawnSurvivalWeaponTrail(projectile: { mesh: THREE.Object3D; vel: THREE.Vector3; weaponId?: SurvivalDamageWeaponId }): void {
    if (!projectile.weaponId) return;
    const meta = SURVIVAL_DAMAGE_WEAPONS[projectile.weaponId];
    const shape: ParticleShape = projectile.weaponId === 'pallet_cannon' || projectile.weaponId === 'forklift_bolter' || projectile.weaponId === 'scanner_pulse'
      ? 'flat-box'
      : projectile.weaponId === 'glue_mine' || projectile.weaponId === 'steam_bomb'
        ? 'sphere'
        : 'octahedron';
    const size = projectile.weaponId === 'forklift_bolter' || projectile.weaponId === 'scanner_pulse' ? 0.052 : 0.068;
    const mesh = this.particlePool.acquire(shape, meta.color, size, 0.76);
    if (!mesh) return;
    mesh.position.copy(projectile.mesh.position);
    mesh.rotation.set(0.25, 0.5, 0.15);
    this.levelRoot.add(mesh);
    const velocity = projectile.vel.lengthSq() > 0.01
      ? projectile.vel.clone().normalize().multiplyScalar(-0.48)
      : new THREE.Vector3(0, 0.18, 0);
    this.particles.push({ mesh, vel: velocity, life: 0.22, maxLife: 0.22, baseScale: size });
  }

  private fireSurvivalWeapon(weapon: SurvivalWeaponState, target: EnemyItem) {
    const definition = SURVIVAL_WEAPON_DEFS[weapon.id];
    const baseWeaponDamage = weapon.id === 'orbit_blades'
      ? 1 + (weapon.level >= 3 ? 1 : 0) + (weapon.evolved ? 1 : 0)
      : 1 + Math.floor((weapon.level - 1) / 3) + (weapon.evolved ? 1 : 0);
    const counterattackReady = this.survivalCounterattackReady;
    this.survivalCounterattackReady = false;
    const volleyBaseDamage = applyPerfectDodgeCounterattack(baseWeaponDamage, counterattackReady);
    const criticalRoll = rollSurvivalCriticalDamage(volleyBaseDamage, this.survivalCriticalChance, this.survivalCriticalDamageMultiplier, Math.random());
    const weaponDamage = criticalRoll.damage;
    const weaponDamageSource = getSurvivalWeaponDamageSource(weapon.id);
    this.spawnSurvivalWeaponMuzzleFx(weapon, target);
    // All pellets/blades from this single critical volley share one token, so the
    // fragment burst can only fire once even when the volley has several projectiles.
    const criticalBurstState = criticalRoll.critical && (this.survivalUpgradeStacks.shrapnel || 0) > 0
      ? { consumed: false }
      : undefined;
    if (counterattackReady) {
      this.emitFloatingToast('✦ KONTRATAK! SALWA +1', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'combo');
      this.triggerBloomPulse(0.20);
    }
    if (criticalRoll.critical) {
      this.emitFloatingToast('✦ TRAFIENIE KRYTYCZNE!', this.playerPos.x, this.playerPos.y + 1.35, this.playerPos.z, 'combo');
      this.triggerHitStop(0.035);
    }

    if (weapon.id === 'forklift_horn') {
      const radius = weapon.evolved ? 10 : 7;
      let hitCount = 0;
      for (const enemy of this.enemies) {
        if (enemy.state === 'defeated' || Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z) > radius) continue;
        this.damageEnemy(enemy, weaponDamage, this.playerPos.x, this.playerPos.z, weaponDamageSource);
        enemy.stunTimer = Math.max(enemy.stunTimer, weapon.evolved ? 1.8 : 1.1);
        enemy.state = 'stunned';
        hitCount++;
        this.spawnParticleRing(enemy.x, enemy.y + 0.55, enemy.z, definition.color);
        if (enemy.hp <= 0) this.defeatEnemy(enemy, 260, true);
      }
      this.spawnParticleRing(this.playerPos.x, 0.18, this.playerPos.z, definition.color);
      this.triggerScreenShake(weapon.evolved ? 0.46 : 0.28, 0.22);
      this.triggerBloomPulse(0.32);
      sound.playBossWarning();
      this.emitFloatingToast('📣 ALARM CAŁEJ HALI! ' + hitCount + ' CELÓW', this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z, 'combo');
      return;
    }

    if (weapon.id === 'calacatta_shards') {
      const base = new THREE.Vector3(target.x - this.playerPos.x, 0, target.z - this.playerPos.z);
      if (base.lengthSq() < 0.001) return;
      base.normalize();
      const spread = weapon.evolved ? [-0.44, -0.22, 0, 0.22, 0.44] : [-0.20, 0, 0.20];
      for (const angle of spread) {
        const direction = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        const shardMaterial = new THREE.MeshStandardMaterial({
          color: definition.color, emissive: definition.color, emissiveIntensity: weapon.evolved ? 1.2 : 0.55,
          roughness: 0.22, metalness: 0.18,
        });
        const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22, 0), shardMaterial);
        shard.position.set(this.playerPos.x, this.playerPos.y + 0.88, this.playerPos.z).addScaledVector(direction, 0.9);
        shard.rotation.set(0.25, angle * 2, 0.45);
        shard.castShadow = false;
        this.levelRoot.add(shard);
        this.projectiles.push({
          mesh: shard,
          vel: direction.multiplyScalar(weapon.evolved ? 15.8 : 13.4),
          life: weapon.evolved ? 2.6 : 2.2,
          maxLife: weapon.evolved ? 2.6 : 2.2,
          damage: weaponDamage,
          pierce: weapon.evolved ? 3 : 1,
          weaponProjectile: true,
          weaponId: weapon.id,
          damageSource: weaponDamageSource,
          hitIds: new Set<string>(),
          criticalBurstState,
          spinSpeed: weapon.evolved ? 8.5 : 5.5,
        });
      }
      sound.playAttackWhoosh();
      this.emitFloatingToast(weapon.evolved ? '💎 BURZA CALACATTY!' : '💎 ODPADY WIELKIEGO FORMATU!', this.playerPos.x, this.playerPos.y + 1.35, this.playerPos.z, 'perk');
      return;
    }

    if (weapon.id === 'orbit_blades') {
      const count = weapon.evolved ? 5 : weapon.level >= 4 ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const bladeMaterial = new THREE.MeshStandardMaterial({
          color: SURVIVAL_WEAPON_DEFS[weapon.id].color,
          emissive: SURVIVAL_WEAPON_DEFS[weapon.id].color,
          emissiveIntensity: weapon.evolved ? 0.55 : 0.28,
          roughness: 0.42,
          metalness: 0.38,
        });
        const blade = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 5, 10), bladeMaterial);
        blade.rotation.x = Math.PI / 2;
        blade.castShadow = false;
        this.levelRoot.add(blade);
        this.projectiles.push({
          mesh: blade,
          vel: new THREE.Vector3(),
          life: weapon.evolved ? 5.8 : 4.8,
          maxLife: weapon.evolved ? 5.8 : 4.8,
          damage: weaponDamage,
          pierce: 40,
          weaponProjectile: true,
          weaponId: weapon.id,
          damageSource: weaponDamageSource,
          hitIds: new Set<string>(),
          criticalBurstState,
          orbiting: true,
          orbitAngle: (i / count) * Math.PI * 2,
          orbitRadius: weapon.evolved ? 1.9 : 1.55,
          orbitSpeed: (weapon.evolved ? 3.0 : 2.55) * (i % 2 === 0 ? 1 : -1),
          spinSpeed: 7.0,
        });
      }
      return;
    }

    const direction = new THREE.Vector3(target.x - this.playerPos.x, 0, target.z - this.playerPos.z);
    if (direction.lengthSq() < 0.001) return;
    direction.normalize();
    const damage = weaponDamage;
    const start = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.9, this.playerPos.z).addScaledVector(direction, 0.9);
    const material = new THREE.MeshStandardMaterial({
      color: definition.color, emissive: definition.color, emissiveIntensity: weapon.evolved ? 1.8 : 0.9,
      metalness: 0.28, roughness: 0.26,
    });
    const projectile: {
      mesh: THREE.Object3D; vel: THREE.Vector3; life: number; maxLife: number; damage: number;
      pierce?: number; homing?: boolean; weaponProjectile?: boolean; weaponId?: SurvivalDamageWeaponId; damageSource?: SurvivalDamageSource; aoeRadius?: number; slowOnHit?: boolean;
      igniteOnHit?: boolean; spinSpeed?: number; ricochet?: boolean; boomerang?: boolean; hitIds: Set<string>;
      criticalBurstState?: { consumed: boolean };
    } = {
      mesh: new THREE.Group(),
      vel: direction.clone().multiplyScalar(10.5), life: 2.8, maxLife: 2.8, damage, hitIds: new Set<string>(),
      weaponProjectile: true,
      weaponId: weapon.id,
      damageSource: weaponDamageSource,
      criticalBurstState,
    };
    switch (weapon.id) {
      case 'pallet_cannon':
        projectile.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.13, 0.20), material);
        projectile.vel = direction.clone().multiplyScalar(weapon.evolved ? 11.2 : 10);
        projectile.aoeRadius = weapon.evolved ? 2.15 : weapon.level >= 3 ? 1.45 : 1.05;
        projectile.pierce = weapon.evolved ? 2 : weapon.level >= 5 ? 1 : 0;
        break;
      case 'diamond_saw':
        projectile.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.075, 12), material);
        (projectile.mesh as THREE.Mesh).rotation.x = Math.PI / 2;
        projectile.vel = direction.clone().multiplyScalar(weapon.evolved ? 14.8 : 13.2);
        projectile.life = projectile.maxLife = weapon.evolved ? 2.8 : 2.2;
        projectile.pierce = 1 + (weapon.level >= 4 ? 1 : 0) + (weapon.evolved ? 3 : 0);
        projectile.ricochet = Boolean(weapon.evolved);
        projectile.spinSpeed = weapon.evolved ? 15 : 12;
        break;
      case 'glue_mine':
        projectile.mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.20, 0), material);
        projectile.vel = direction.clone().multiplyScalar(7.2);
        projectile.life = projectile.maxLife = 3.4;
        projectile.aoeRadius = weapon.evolved ? 2.85 : weapon.level >= 4 ? 2.1 : 1.65;
        projectile.slowOnHit = true;
        projectile.pierce = weapon.evolved ? 2 : 0;
        break;
      case 'kfc_bomber':
        projectile.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), material);
        projectile.vel = direction.clone().multiplyScalar(8.4);
        projectile.life = projectile.maxLife = 3.1;
        projectile.aoeRadius = weapon.evolved ? 3.35 : weapon.level >= 4 ? 2.65 : 2.05;
        projectile.igniteOnHit = weapon.level >= 3 || Boolean(weapon.evolved);
        projectile.pierce = weapon.evolved ? 1 : 0;
        projectile.spinSpeed = weapon.evolved ? 11 : 8;
        break;
      case 'piorun_drone':
        projectile.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), material);
        projectile.vel = direction.clone().multiplyScalar(8.8);
        projectile.life = projectile.maxLife = weapon.evolved ? 4.8 : 4.2;
        projectile.homing = true;
        projectile.pierce = weapon.evolved ? 3 : 0;
        break;
      case 'forklift_bolter': {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.28, 6), material);
        bolt.rotation.x = Math.PI / 2;
        bolt.rotation.y = Math.atan2(direction.x, direction.z);
        projectile.mesh = bolt;
        projectile.vel = direction.clone().multiplyScalar(weapon.evolved ? 21.5 : 18.5);
        projectile.life = projectile.maxLife = 1.75;
        projectile.pierce = weapon.evolved ? 4 : weapon.level >= 3 ? 2 : 1;
        projectile.spinSpeed = weapon.evolved ? 3.2 : 2.2;
        break;
      }
      case 'scanner_pulse': {
        const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.42), material);
        pulse.rotation.y = Math.atan2(direction.x, direction.z);
        projectile.mesh = pulse;
        projectile.vel = direction.clone().multiplyScalar(weapon.evolved ? 16.8 : 14.8);
        projectile.life = projectile.maxLife = 2.0;
        projectile.homing = true;
        projectile.pierce = weapon.evolved ? 5 : weapon.level >= 4 ? 3 : 2;
        break;
      }
      case 'steam_bomb':
        projectile.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), material);
        projectile.vel = direction.clone().multiplyScalar(weapon.evolved ? 8.6 : 7.0);
        projectile.life = projectile.maxLife = 3.3;
        projectile.aoeRadius = weapon.evolved ? 3.8 : 2.5;
        projectile.slowOnHit = true;
        projectile.pierce = weapon.evolved ? 1 : 0;
        projectile.spinSpeed = 5.2;
        break;
      case 'wz_boomerang':
        projectile.mesh = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 16), material);
        (projectile.mesh as THREE.Mesh).rotation.x = Math.PI / 2;
        projectile.vel = direction.clone().multiplyScalar(weapon.evolved ? 13.8 : 11.0);
        projectile.life = projectile.maxLife = weapon.evolved ? 4.2 : 3.2;
        projectile.boomerang = true;
        projectile.pierce = weapon.evolved ? 3 : 1;
        projectile.spinSpeed = weapon.evolved ? 15 : 10;
        break;
    }
    projectile.mesh.position.copy(start);
    (projectile.mesh as THREE.Mesh).castShadow = false;
    this.levelRoot.add(projectile.mesh);
    this.projectiles.push(projectile);
    sound.playAttackWhoosh();
  }

  private updateSurvivalDirector(dt: number) {
    this.survivalElapsed += dt;
    const contractClock = advanceSurvivalContract(this.survivalContract, dt);
    this.survivalContract = contractClock.state;
    const eventClock = advanceSurvivalShiftEvent(this.survivalShiftEvent, this.survivalElapsed, dt);
    this.survivalShiftEvent = eventClock.state;
    if (eventClock.started) {
      this.callbacks.onSurvivalAnnouncement?.('EVENT MAGAZYNOWY', eventClock.started.title, eventClock.started.description + ' Masz 34 sekundy.');
      this.emitFloatingToast('EVENT: ' + eventClock.started.title, this.playerPos.x, this.playerPos.y + 1.85, this.playerPos.z, 'combo');
      sound.playAlert();
    }
    if (eventClock.expired) this.emitFloatingToast('EVENT NIEZALICZONY • KOLEJNA SZANSA ZA CHWILĘ', this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'damage');
    if (contractClock.expiredNow) {
      this.emitFloatingToast('KONTRAKT NIEZALICZONY • NASTĘPNA ZMIANA', this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'damage');
    }
    // Director dt is simulation-scaled (the player may select 2x speed).
    // The Easter egg is advertised as 15 real seconds, so keep its lifetime
    // aligned with the visual overlay regardless of the selected game speed.
    this.oniricDreamRemainingSeconds = Math.max(0, this.oniricDreamRemainingSeconds - dt / this.timeScale);
    if (!this.survivalPomazaniecSpawned && this.survivalElapsed >= 135) {
      this.spawnSurvivalPomazaniecMarker();
    }
    this.updateSurvivalPomazaniecMarker(dt);
    if (!this.survivalPhaseTwoAnnounced && this.survivalElapsed >= 90) {
      this.survivalPhaseTwoAnnounced = true;
      this.callbacks.onSurvivalAnnouncement?.(
        'DOSTAWA Z MEDIOLANU',
        'Druga zmiana weszła na halę',
        'Włoscy dostawcy armatury i ciężkie paleciaki dołączają do natarcia. Zmień pozycję i pilnuj wolnych alejek.'
      );
      this.emitFloatingToast('🇮🇹 DOSTAWA Z MEDIOLANU — NOWE JEDNOSTKI!', this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z, 'combo');
      sound.playAlert();
    }
    if (this.survivalElapsed >= this.survivalNextSurgeAt) this.beginSurvivalHordeSurge();
    if (this.survivalElapsed >= 180 && !this.survivalMiniBossSpawned) {
      this.survivalMiniBossSpawned = true;
      this.spawnSurvivalAuditor();
    }
    this.updateSurvivalAuditorAura(dt);
    const nextWave = 1 + Math.floor(this.survivalElapsed / 60);
    if (nextWave > this.survivalWave) {
      const previousWaveKills = Math.max(0, this.survivalKills - this.survivalWaveStartKills);
      const waveClearBonus = getSurvivalWaveClearBonus(this.survivalWave, previousWaveKills);
      if (waveClearBonus > 0) {
        this.score += waveClearBonus;
        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
        this.emitFloatingToast(
          'ZMIANA ZALICZONA: +' + waveClearBonus + ' PKT • ' + previousWaveKills + ' ELIMINACJE',
          this.playerPos.x,
          this.playerPos.y + 1.55,
          this.playerPos.z,
          'combo'
        );
      }
      this.survivalWave = nextWave;
      this.survivalWaveStartKills = this.survivalKills;
      this.survivalContract = createSurvivalContract(this.survivalWave);
      this.emitFloatingToast(
        'FALA ' + this.survivalWave + ' • KONTRAKT: ' + this.survivalContract.title,
        this.playerPos.x, this.playerPos.y + 1.75, this.playerPos.z, 'combo'
      );
      sound.playAlert();

      // A rotating shift rule changes the tactical shape of every third wave.
      // It is announced once at the transition and never interrupts gameplay.
      const waveMutator = getSurvivalWaveMutator(this.survivalWave);
      if (waveMutator.id !== 'standard') {
        this.callbacks.onSurvivalAnnouncement?.(
          waveMutator.title,
          waveMutator.label,
          waveMutator.description
        );
      }

      // Secret objects are deliberately placed away from the centre line.
      if (!this.survivalSecretSpawned && this.survivalWave >= 3 && Math.random() < 0.68) {
        this.survivalSecretSpawned = true;
        const side = Math.random() < 0.5 ? -1 : 1;
        const secretX = THREE.MathUtils.clamp(this.playerPos.x + side * 22, this.levelBounds.minX + 3, this.levelBounds.maxX - 3);
        const secretZ = THREE.MathUtils.clamp(this.playerPos.z + (Math.random() - 0.5) * 18, this.levelBounds.minZ + 2, this.levelBounds.maxZ - 2);
        const secretRoll = Math.random();
        const secretType = secretRoll < 0.34 ? 'folder' : secretRoll < 0.67 ? 'coffee' : 'throne';
        const secretName = secretType === 'folder' ? 'Teczka z premią Nadzorcy Zero' : secretType === 'coffee' ? 'Zapomniany automat z 1998 roku' : 'Złoty tron kierownika';
        this.addEasterEgg('survival_secret_' + this.survivalWave, secretX, 0.2, secretZ, secretName, secretType, 1800);
        this.callbacks.onPerkDropBanner?.('TAJNY ŁADUNEK NAMIERZONY', '🔎', 'Radar wykrył nietypowy obiekt poza głównym korytarzem. Sprawdź obrzeża hali.', '#a78bfa');
      }
    }

    // First major boss at 05:00; later boss cycles recur every five minutes.
    const majorBossWave = Math.floor(this.survivalElapsed / 300) * 5;
    const activeSurvivalBoss = this.enemies.some((enemy) =>
      (enemy.type === 'walczak' || enemy.type === 'krol_leto' ||
        enemy.type === 'bosman_krakow' || enemy.type === 'sebix_m') &&
      enemy.state !== 'defeated'
    );
    const upcomingBossVariant = getSurvivalBossVariant(majorBossWave);
    if (
      this.survivalElapsed >= 300 &&
      this.survivalBossWave !== majorBossWave &&
      this.survivalPendingBossWave !== majorBossWave &&
      !activeSurvivalBoss
    ) {
      this.survivalPendingBossWave = majorBossWave;
      this.survivalBossWarningTimer = 6.0;
      this.emitFloatingToast(
        majorBossWave === 5 ? 'INWENTARYZACJA GIGANT — ZA 6 SEKUND!' :
          upcomingBossVariant === 'bosman_krakow' ? 'BOSMAN KRAKÓW — ZA 6 SEKUND!' :
          upcomingBossVariant === 'krol_leto' ? 'DYREKTOR WIDMO — ZA 6 SEKUND!' : 'NADZORCA ZERO — ZA 6 SEKUND!',
        this.playerPos.x, this.playerPos.y + 2.0, this.playerPos.z, 'damage'
      );
      this.callbacks.onPerkDropBanner?.(
        majorBossWave === 5 ? 'INWENTARYZACJA GIGANT • 6 SEKUND' :
          upcomingBossVariant === 'bosman_krakow' ? 'BOSMAN KRAKÓW • 6 SEKUND' :
          upcomingBossVariant === 'krol_leto' ? 'DYREKTOR WIDMO • 6 SEKUND' : 'NADZORCA ZERO • 6 SEKUND',
        upcomingBossVariant === 'bosman_krakow' ? '⚓' : upcomingBossVariant === 'krol_leto' ? '👑' : '👔',
        majorBossWave === 5
          ? 'Nadchodzi Inwentaryzacja Gigant. Przygotuj się na szarżę i szeroką falę uderzeniową.'
          : upcomingBossVariant === 'bosman_krakow'
            ? 'Dowódca rampy używa falowych odpraw i ostrzału z dystansu. Wykorzystaj przerwy między salwami.'
            : upcomingBossVariant === 'krol_leto'
              ? 'Dyrektor Widmo miesza ataki obszarowe z presją dystansową. Nie stój w czerwonych polach.'
              : 'Nadzorca Zero naciska z bliska i przyspiesza po utracie połowy zdrowia. Zbieraj XP i przygotuj unik.',
        '#ef4444'
      );
      sound.playBossWarning();
      this.triggerScreenShake(0.24, 0.12);
    }
    if (this.survivalBossWarningTimer > 0) {
      this.survivalBossWarningTimer = Math.max(0, this.survivalBossWarningTimer - dt);
      if (this.survivalBossWarningTimer <= 0 && this.survivalPendingBossWave > 0) {
        const bossWave = this.survivalPendingBossWave;
        this.survivalPendingBossWave = 0;
        this.survivalBossWave = bossWave;
        this.spawnSurvivalBoss(bossWave);
      }
    }

    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const hordeSettings = getSurvivalHordeSettings(isMobile);
    const difficultyProfile = getSurvivalDifficultyProfile(this.survivalWave);
    const pomazaniecRaidActive = this.survivalPomazaniecTriggered && !this.survivalPomazaniecCompleted;
    const surgeActive = this.survivalSurgeTimeLeft > 0;
    const mobileEnemyCap = this.adaptivePerformanceTier >= 2 ? 13 : this.adaptivePerformanceTier === 1 ? 16 : 18;
    const enemyCap = (isMobile ? mobileEnemyCap : 34) +
      (pomazaniecRaidActive ? (isMobile ? 3 : 5) : 0) +
      (surgeActive ? (isMobile ? (this.adaptivePerformanceTier >= 2 ? 2 : this.adaptivePerformanceTier === 1 ? 3 : 4) : 6) : 0);
    const aliveCount = this.enemies.reduce((count, enemy) => count + (enemy.state === 'defeated' ? 0 : 1), 0);
    if (surgeActive) {
      this.survivalSurgeTimeLeft = Math.max(0, this.survivalSurgeTimeLeft - dt);
      this.survivalSurgeSpawnTimer -= dt;
      const progress = 1 - this.survivalSurgeTimeLeft / hordeSettings.durationSeconds;
      this.updateSurvivalHordeRing(progress, hordeSettings.initialRadius, hordeSettings.finalRadius);
      if (this.survivalSurgeTimeLeft > 0 && this.survivalSurgeSpawnQueue > 0 && this.survivalSurgeSpawnTimer <= 0 && aliveCount < enemyCap) {
        this.spawnSurvivalSurgeEnemy();
        this.survivalSurgeSpawnQueue--;
        this.survivalSurgeSpawned++;
        this.survivalSurgeSpawnTimer = hordeSettings.spawnIntervalSeconds;
      } else if (this.survivalSurgeTimeLeft > 0 && this.survivalSurgeSpawnQueue > 0 && aliveCount >= enemyCap) {
        this.survivalSurgeSpawnTimer = 0.10;
      }
      if (this.survivalSurgeTimeLeft <= 0) {
        this.survivalSurgeSpawnQueue = 0;
        this.clearSurvivalSurgeRing();
        for (const enemy of this.enemies) {
          if (enemy.surgeRunner) {
            enemy.surgeRunner = false;
            enemy.aiFlankAngle = undefined;
            enemy.aiOrbitSign = undefined;
          }
        }
        this.survivalSpawnTimer = Math.max(this.survivalSpawnTimer, 1.8);
        this.callbacks.onSurvivalAnnouncement?.(
          'FALOWA SZARŻA ODPARTA',
          'Pierścień przełamany',
          'W ringowej szarży pojawiło się ' + this.survivalSurgeSpawned + ' z ' + this.survivalSurgeTargetCount + ' przeciwników. Standardowe dostawy wracają.',
        );
        this.emitFloatingToast('FALOWA SZARŻA ODPARTA!', this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z, 'combo');
      }
    } else {
      this.survivalSpawnTimer -= dt;
      if (this.survivalSpawnTimer <= 0 && aliveCount < enemyCap) {
        const groupLimit = isMobile ? (this.adaptivePerformanceTier >= 2 ? 3 : this.adaptivePerformanceTier === 1 ? 4 : 5) : 7;
        const groupSize = Math.min(groupLimit, 3 + Math.floor(this.survivalWave * 0.34) + difficultyProfile.extraGroupSize, enemyCap - aliveCount);
        for (let i = 0; i < groupSize; i++) this.spawnSurvivalEnemy(this.survivalWave);
        this.survivalSpawnTimer = difficultyProfile.spawnIntervalSeconds;
      }
    }

    this.updateSurvivalEvents(dt);
    this.updateSurvivalDrone(dt);
    this.updateSurvivalRadiation(dt);

    if (this.survivalRegenMultiplier > 0) {
      this.survivalRegenTimer -= dt;
      if (this.survivalRegenTimer <= 0) {
        if (this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 1);
          this.callbacks.onHpUpdate(this.hp, this.maxHp);
          this.emitFloatingToast('🩹 REGENERACJA BHP: +1 KAWA', this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z, 'perk');
        }
        this.survivalRegenTimer = Math.max(24, 60 / this.survivalRegenMultiplier);
      }
    }

    this.survivalCleanupTimer -= dt;
    if (this.survivalCleanupTimer <= 0) {
      this.survivalCleanupTimer = 4.0;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (enemy.state === 'defeated') {
          this.disposeEnemyModel(enemy);
          this.enemies.splice(i, 1);
        }
      }
    }

    this.survivalUiTimer -= dt;
    if (this.survivalUiTimer <= 0) {
      this.survivalUiTimer = 0.25;
      this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    }
  }


  private clearSurvivalSurgeRing() {
    if (!this.survivalSurgeRing) return;
    this.levelRoot.remove(this.survivalSurgeRing);
    this.disposeTemporaryObject(this.survivalSurgeRing);
    this.survivalSurgeRing = null;
  }

  private updateSurvivalHordeRing(progress: number, initialRadius: number, finalRadius: number) {
    const ringGroup = this.survivalSurgeRing;
    if (!ringGroup) return;
    const radius = getHordeRingRadius(progress, initialRadius, finalRadius);
    this.survivalSurgeCurrentRadius = radius;

    // Keep the perimeter centred on the operator while respecting the narrower
    // north/south bounds of the arena. This is the same centre used by enemy AI.
    const verticalScale = 0.62;
    this.survivalSurgeCenterX = THREE.MathUtils.clamp(
      this.playerPos.x,
      this.levelBounds.minX + initialRadius,
      this.levelBounds.maxX - initialRadius,
    );
    this.survivalSurgeCenterZ = THREE.MathUtils.clamp(
      this.playerPos.z,
      this.levelBounds.minZ + initialRadius * verticalScale,
      this.levelBounds.maxZ - initialRadius * verticalScale,
    );
    ringGroup.position.set(this.survivalSurgeCenterX, 0.065, this.survivalSurgeCenterZ);

    const outer = ringGroup.children[0] as THREE.Mesh | undefined;
    const inner = ringGroup.children[1] as THREE.Mesh | undefined;
    if (outer) outer.scale.set(radius, radius * verticalScale, 1);
    if (inner) inner.scale.set(radius * 0.82, radius * verticalScale * 0.82, 1);
    const outerMaterial = outer?.material as THREE.MeshBasicMaterial | undefined;
    const innerMaterial = inner?.material as THREE.MeshBasicMaterial | undefined;
    if (outerMaterial) outerMaterial.opacity = 0.24 + (1 - progress) * 0.34;
    if (innerMaterial) innerMaterial.opacity = 0.16 + (1 - progress) * 0.22;
  }

  private beginSurvivalHordeSurge() {
    if (this.survivalSurgeTimeLeft > 0 || this.gameMode !== 'survival') return;
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const settings = getSurvivalHordeSettings(isMobile);
    this.clearSurvivalSurgeRing();

    this.survivalSurgeTimeLeft = settings.durationSeconds;
    this.survivalSurgeTargetCount = settings.enemyCount;
    this.survivalSurgeCurrentRadius = settings.initialRadius;
    this.survivalSurgeSpawnQueue = settings.enemyCount;
    this.survivalSurgeSpawnTimer = 0.12;
    this.survivalSurgeSpawned = 0;
    this.survivalNextSurgeAt += 90;

    // Keep every point inside the arena. Near a wall, move the centre inward
    // just enough for the player to remain inside the perimeter.
    const ringVerticalScale = 0.62;
    const safeInsetX = settings.initialRadius;
    const safeInsetZ = settings.initialRadius * ringVerticalScale;
    this.survivalSurgeCenterX = THREE.MathUtils.clamp(
      this.playerPos.x,
      this.levelBounds.minX + safeInsetX,
      this.levelBounds.maxX - safeInsetX,
    );
    this.survivalSurgeCenterZ = THREE.MathUtils.clamp(
      this.playerPos.z,
      this.levelBounds.minZ + safeInsetZ,
      this.levelBounds.maxZ - safeInsetZ,
    );

    const ringGroup = new THREE.Group();
    ringGroup.name = 'survival_horde_closing_ring';
    ringGroup.position.set(this.survivalSurgeCenterX, 0.065, this.survivalSurgeCenterZ);
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 96), outerMaterial);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.scale.set(settings.initialRadius, settings.initialRadius, 1);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 72), innerMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.scale.set(settings.initialRadius * 0.82, settings.initialRadius * 0.82, 1);
    ringGroup.add(outerRing, innerRing);
    this.levelRoot.add(ringGroup);
    this.survivalSurgeRing = ringGroup;

    // Reuse ordinary enemies as the first ring members. This creates a full
    // perimeter immediately without a sudden 12–16 model allocation spike.
    const reusableEnemies = this.enemies
      .filter((enemy) =>
        enemy.state !== 'defeated' &&
        !!enemy.mesh &&
        enemy.mesh.visible &&
        !enemy.surgeRunner &&
        !enemy.survivalAuditor &&
        enemy.type !== 'walczak' &&
        enemy.type !== 'krol_leto' &&
        enemy.type !== 'bosman_krakow' &&
        enemy.type !== 'pomazaniec' &&
        enemy.type !== 'piorun_dron' &&
        enemy.type !== 'sebix_m'
      )
      .sort((a, b) => {
        const aDistance = Math.hypot(a.x - this.survivalSurgeCenterX, a.z - this.survivalSurgeCenterZ);
        const bDistance = Math.hypot(b.x - this.survivalSurgeCenterX, b.z - this.survivalSurgeCenterZ);
        return aDistance - bDistance;
      })
      .slice(0, settings.enemyCount);

    reusableEnemies.forEach((enemy, index) => {
      const point = getHordeRingPoint(
        index, settings.enemyCount,
        this.survivalSurgeCenterX, this.survivalSurgeCenterZ,
        settings.initialRadius, -Math.PI / 2, 0.62,
      );
      enemy.x = THREE.MathUtils.clamp(point.x, this.levelBounds.minX + 1.2, this.levelBounds.maxX - 1.2);
      enemy.z = THREE.MathUtils.clamp(point.z, this.levelBounds.minZ + 1.0, this.levelBounds.maxZ - 1.0);
      enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
      enemy.mesh.rotation.y = point.angle + Math.PI;
      enemy.surgeRunner = true;
      enemy.aiSlot = index;
      enemy.aiFlankAngle = Math.PI / 2 - point.angle;
      enemy.aiOrbitSign = index % 2 === 0 ? 1 : -1;
      enemy.speed = THREE.MathUtils.clamp(enemy.speed * 1.04, 2.4, 3.9);
      enemy.state = 'chase';
      enemy.alerted = true;
      enemy.shoutTimer = Math.min(enemy.shoutTimer || 1.2, 1.4);
    });

    this.survivalSurgeSpawned = reusableEnemies.length;
    this.survivalSurgeSpawnQueue = settings.enemyCount - reusableEnemies.length;
    this.survivalSurgeSpawnTimer = this.survivalSurgeSpawnQueue > 0 ? 0.18 : settings.spawnIntervalSeconds;
    this.survivalSurgeDirection = 0;

    this.callbacks.onSurvivalAnnouncement?.(
      'FALOWA SZARŻA',
      settings.enemyCount + ' przeciwników • zamykający się pierścień',
      'Pilne na Już otacza Cię ze wszystkich stron. Przebij się przez luki w szyku, zanim pierścień zamknie się przy Twojej pozycji.',
    );
    this.emitFloatingToast('🚨 FALOWA SZARŻA — PIERŚCIEŃ SIĘ ZACISKA!', this.playerPos.x, this.playerPos.y + 1.9, this.playerPos.z, 'damage');
    this.spawnParticleRing(this.playerPos.x, 0.16, this.playerPos.z, 0xf59e0b);
    this.triggerScreenShake(0.26, 0.24);
    sound.playBossWarning();
  }

  private spawnSurvivalSurgeEnemy() {
    const settings = getSurvivalHordeSettings(window.innerWidth < 900 || ('ontouchstart' in window));
    const slot = this.survivalSurgeSpawned;
    const point = getHordeRingPoint(
      slot,
      Math.max(1, this.survivalSurgeTargetCount),
      this.survivalSurgeCenterX,
      this.survivalSurgeCenterZ,
      settings.initialRadius,
      -Math.PI / 2,
      0.62,
    );
    const x = THREE.MathUtils.clamp(point.x, this.levelBounds.minX + 1.2, this.levelBounds.maxX - 1.2);
    const z = THREE.MathUtils.clamp(point.z, this.levelBounds.minZ + 1.0, this.levelBounds.maxZ - 1.0);
    const minZ = THREE.MathUtils.clamp(z - 0.35, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    const maxZ = THREE.MathUtils.clamp(z + 0.35, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    const id = 'survival_surge_' + Math.floor(performance.now()) + '_' + Math.floor(Math.random() * 100000);
    this.addKurierEnemy(id, x, minZ, maxZ, 'Pilne na Już! • Kurier Express B4');
    const runner = this.enemies[this.enemies.length - 1];
    if (!runner?.mesh) return;

    runner.surgeRunner = true;
    runner.maxHp = 2;
    runner.hp = 2;
    runner.speed = 3.4;
    runner.state = 'chase';
    runner.alerted = true;
    runner.aiSlot = slot;
    runner.aiFlankAngle = Math.PI / 2 - point.angle;
    runner.aiOrbitSign = slot % 2 === 0 ? 1 : -1;
    runner.shoutTimer = 1.4 + Math.random() * 1.2;
    runner.z = z;
    runner.mesh.position.set(x, runner.y, z);
  }

  private spawnSurvivalAuditor() {
    const { x, z } = this.getSurvivalSpawnPoint();
    const id = 'survival_auditor_' + Math.floor(performance.now());
    const minZ = THREE.MathUtils.clamp(z - 2.6, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    const maxZ = THREE.MathUtils.clamp(z + 2.6, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    this.addInspectorEnemy(id, x, minZ, maxZ, 'Audytor Niezapowiedziany');
    const auditor = this.enemies[this.enemies.length - 1];
    if (!auditor?.mesh) return;
    auditor.type = 'walczak';
    auditor.name = 'Audytor Niezapowiedziany';
    auditor.maxHp = 42;
    auditor.hp = auditor.maxHp;
    auditor.speed *= 0.84;
    auditor.startX = this.levelBounds.minX + 3;
    auditor.endX = this.levelBounds.maxX - 3;
    auditor.specialActionTimer = 2.6;
    auditor.bossPhase = 1;
    auditor.survivalAuditor = true;
    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(8.2, 8.48, 64),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.055;
    auditor.mesh.add(auraRing);
    auditor.auraRing = auraRing;
    this.callbacks.onBossUpdate?.(auditor.name, auditor.hp, auditor.maxHp, true, 1);
    this.callbacks.onSurvivalAnnouncement?.(
      'AUDYTOR NIEZAPOWIEDZIANY',
      'Kontrola bez awizacji',
      'Czerwona strefa wzmacnia pobliskich przeciwników. Zlikwiduj Audytora albo wyciągnij hordę poza jego aurę.'
    );
    this.emitFloatingToast('📋 AUDYT BEZ ZAPOWIEDZI!', x, 2.15, z, 'damage');
    this.spawnParticleRing(x, 0.18, z, 0xef4444);
    this.triggerScreenShake(0.48, 0.42);
    this.triggerBloomPulse(0.38);
    sound.playBossWarning();
  }

  private updateSurvivalAuditorAura(dt: number) {
    this.survivalAuditorAuraCooldown -= dt;
    if (this.survivalAuditorAuraCooldown > 0) return;
    this.survivalAuditorAuraCooldown = 0.28;
    const auditor = this.enemies.find((enemy) => enemy.survivalAuditor && enemy.state !== 'defeated');
    for (const enemy of this.enemies) {
      if (enemy.state === 'defeated' || enemy.survivalAuditor) continue;
      const insideAura = Boolean(auditor && Math.hypot(enemy.x - auditor.x, enemy.z - auditor.z) <= 8.2);
      if (insideAura && !enemy.auraBuffed) {
        enemy.speed *= 1.18;
        enemy.auraBuffed = true;
      } else if (!insideAura && enemy.auraBuffed) {
        enemy.speed /= 1.18;
        enemy.auraBuffed = false;
      }
    }
  }

  private updateSurvivalEvents(dt: number) {
    // Temporary Survival traps expire and release their mesh resources.
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i];
      if (hazard.life === undefined) continue;
      hazard.life -= dt;
      if (hazard.life > 0) continue;
      hazard.active = false;
      if (hazard.mesh) {
        this.levelRoot.remove(hazard.mesh);
        this.disposeTemporaryObject(hazard.mesh);
      }
      if (hazard.warningMesh) {
        this.levelRoot.remove(hazard.warningMesh);
        this.disposeTemporaryObject(hazard.warningMesh);
      }
      this.hazards.splice(i, 1);
    }

    this.survivalHazardTimer -= dt;
    if (this.survivalHazardTimer <= 0) {
      this.spawnSurvivalHazard();
      this.survivalHazardTimer = 23 + Math.random() * 9;
    }
    this.survivalEventTimer -= dt;
    if (this.survivalEventTimer <= 0) {
      this.triggerSurvivalWarehouseEvent();
      this.survivalEventTimer = 43 + Math.random() * 14;
    }
  }

  private spawnSurvivalHazard() {
    if (this.hazards.filter((hazard) => hazard.active).length >= 3) return;
    const point = this.getSurvivalSpawnPoint();
    const x = THREE.MathUtils.clamp(point.x, this.levelBounds.minX + 3, this.levelBounds.maxX - 3);
    const z = THREE.MathUtils.clamp(point.z, this.levelBounds.minZ + 3, this.levelBounds.maxZ - 3);
    const id = 'survival_trap_' + (++this.survivalHazardSequence) + '_' + Math.floor(performance.now());
    switch (this.survivalHazardSequence % 6) {
      case 1:
        this.addCementSpillTrap(id, x, z, 2.35);
        this.emitFloatingToast('🧱 ŚWIEŻY BETON! ZMIEŃ ALEJKĘ!', x, 1.4, z, 'damage');
        break;
      case 2:
        this.addStretchFilmBarrierTrap(id, x, z, 5.0);
        this.emitFloatingToast('🧻 ROZPIĘTA FOLIA STRETCH! PRZESKOCZ LUB PRZEBIJ SIĘ!', x, 1.4, z, 'damage');
        break;
      case 3:
        this.addLaserCutterTrap(id, x, z, 5.2, 1.8);
        this.emitFloatingToast('⚠️ LASER CNC URUCHOMIONY — SKOK NAD WIĄZKĄ!', x, 1.5, z, 'damage');
        break;
      case 4:
        this.addSteamGeyserTrap(id, x, z, 5.5);
        this.emitFloatingToast('💨 GEJZER PARY: STREFA POD CIŚNIENIEM!', x, 1.5, z, 'damage');
        break;
      case 5:
        this.addHydraulicPressTrap(id, x, z, 4.4);
        this.emitFloatingToast('🔨 PRASA HYDRAULICZNA — NIE PODKŁADAJ RĘKI!', x, 1.6, z, 'damage');
        break;
      default:
        this.addRollerGateTrap(id, x, z, 2.5, 5.0);
        this.emitFloatingToast('⚙️ RUCHOMA BRAMA ROLEK! NIE DAJ SIĘ PRZYGNIEŚĆ!', x, 1.6, z, 'damage');
        break;
    }
    const spawnedTrap = this.hazards[this.hazards.length - 1];
    if (spawnedTrap) spawnedTrap.life = 36;
    this.spawnParticleRing(x, 0.25, z, 0xf59e0b);
  }

  private disposeTemporaryObject(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
      else if (material) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private createPomazaniecRiderModel(variant: number, withSign = false): {
    group: THREE.Group;
    wheels: THREE.Mesh[];
    propeller: THREE.Group;
  } {
    const group = new THREE.Group();
    group.name = withSign ? 'POMAZANIEC_SECRET_MARKER' : 'POMAZANIEC_RIDER';
    const shirtColors = [0x2563eb, 0xf97316, 0x16a34a, 0xa855f7, 0xdc2626];
    const shirtColor = shirtColors[variant % shirtColors.length];
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.62, roughness: 0.34 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2c6a5, roughness: 0.82 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x182536, roughness: 0.86 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.92 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.45, roughness: 0.35 });
    const hatMat = new THREE.MeshStandardMaterial({ color: variant % 2 === 0 ? 0xfacc15 : 0xf472b6, roughness: 0.62 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const addBeam = (start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material) => {
      const direction = new THREE.Vector3().subVectors(end, start);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 7), material);
      beam.position.copy(start).add(end).multiplyScalar(0.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      group.add(beam);
      return beam;
    };

    // Tiny, low-slung bicycle: two visible wheels, a compact frame, pedals and handlebars.
    const rearHub = new THREE.Vector3(0, 0.34, -0.56);
    const frontHub = new THREE.Vector3(0, 0.34, 0.56);
    const crank = new THREE.Vector3(0, 0.43, -0.02);
    const wheelGeometry = new THREE.TorusGeometry(0.285, 0.047, 7, 18);
    const wheels: THREE.Mesh[] = [];
    for (const hub of [rearHub, frontHub]) {
      const wheel = new THREE.Mesh(wheelGeometry, tireMat);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.copy(hub);
      wheel.castShadow = false;
      wheel.receiveShadow = false;
      group.add(wheel);
      wheels.push(wheel);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 8), accentMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.copy(hub);
      group.add(axle);
    }
    addBeam(rearHub, crank, 0.035, frameMat);
    addBeam(crank, frontHub, 0.035, frameMat);
    addBeam(rearHub, new THREE.Vector3(0, 0.73, -0.16), 0.034, frameMat);
    addBeam(new THREE.Vector3(0, 0.73, -0.16), crank, 0.03, frameMat);
    addBeam(frontHub, new THREE.Vector3(0, 0.72, 0.34), 0.036, frameMat);
    addBeam(new THREE.Vector3(0, 0.72, 0.34), new THREE.Vector3(0, 0.43, -0.02), 0.028, frameMat);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.075, 0.18), darkMat);
    seat.position.set(0, 0.77, -0.18);
    seat.rotation.x = -0.08;
    group.add(seat);
    const handlebarStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.27, 7), frameMat);
    handlebarStem.position.set(0, 0.77, 0.45);
    handlebarStem.rotation.x = -0.25;
    group.add(handlebarStem);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.48, 7), darkMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.84, 0.50);
    group.add(handlebar);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 7), accentMat);
    bell.position.set(0.17, 0.88, 0.5);
    group.add(bell);

    // The rider is deliberately hunched low over the bars, with bent knees and tiny shoes.
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.23, 4, 8), shirtMat);
    torso.position.set(0, 0.79, -0.01);
    torso.rotation.x = -0.40;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 10), skinMat);
    head.position.set(0, 1.075, 0.12);
    group.add(head);
    for (const eyeX of [-0.068, 0.068]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), darkMat);
      eye.position.set(eyeX, 1.095, 0.305);
      group.add(eye);
    }
    const grin = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 4, 10, Math.PI), darkMat);
    grin.position.set(0, 1.02, 0.31);
    group.add(grin);

    const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.045, 12), hatMat);
    capBrim.position.set(0, 1.27, 0.11);
    group.add(capBrim);
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), hatMat);
    capTop.scale.set(1, 0.55, 1);
    capTop.position.set(0, 1.32, 0.06);
    group.add(capTop);
    const propeller = new THREE.Group();
    propeller.position.set(0, 1.43, 0.06);
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.035, 0.11), whiteMat);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.68), hatMat);
    propeller.add(bladeA, bladeB);
    const propellerHub = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), accentMat);
    propeller.add(propellerHub);
    group.add(propeller);

    // Bent elbows reach forward to the tiny handlebars.
    addBeam(new THREE.Vector3(-0.14, 0.91, 0.01), new THREE.Vector3(-0.19, 0.79, 0.34), 0.052, skinMat);
    addBeam(new THREE.Vector3(0.14, 0.91, 0.01), new THREE.Vector3(0.19, 0.79, 0.34), 0.052, skinMat);
    for (const side of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6), skinMat);
      hand.position.set(side * 0.19, 0.79, 0.43);
      group.add(hand);
      addBeam(new THREE.Vector3(side * 0.10, 0.65, -0.12), new THREE.Vector3(side * 0.20, 0.49, 0.16), 0.065, darkMat);
      addBeam(new THREE.Vector3(side * 0.20, 0.49, 0.16), new THREE.Vector3(side * 0.18, 0.29, 0.36), 0.06, darkMat);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.22), accentMat);
      shoe.position.set(side * 0.18, 0.24, 0.40);
      group.add(shoe);
    }
    const crankBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6), accentMat);
    crankBar.rotation.z = Math.PI / 2;
    crankBar.position.copy(crank);
    group.add(crankBar);
    for (const side of [-1, 1]) {
      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.035, 0.07), darkMat);
      pedal.position.set(side * 0.22, 0.43, -0.02);
      group.add(pedal);
    }

    const dynamicTextures: THREE.Texture[] = [];
    if (withSign) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.48, 7), accentMat);
      post.position.set(0, 1.08, 0.78);
      post.rotation.x = -0.15;
      group.add(post);
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 196;
      const context = signCanvas.getContext('2d');
      if (context) {
        context.fillStyle = '#111827';
        context.fillRect(0, 0, signCanvas.width, signCanvas.height);
        context.strokeStyle = '#facc15';
        context.lineWidth = 12;
        context.strokeRect(7, 7, signCanvas.width - 14, signCanvas.height - 14);
        context.fillStyle = '#fdf2f8';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '900 58px Arial, sans-serif';
        context.fillText('POMAZANIEC', 256, 101, 470);
      }
      const signTexture = new THREE.CanvasTexture(signCanvas);
      signTexture.colorSpace = THREE.SRGBColorSpace;
      dynamicTextures.push(signTexture);
      const signBacking = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.48, 0.055),
        new THREE.MeshStandardMaterial({ color: 0x172033, metalness: 0.24, roughness: 0.58 })
      );
      signBacking.position.set(0, 1.34, 0.88);
      group.add(signBacking);
      const signFace = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 0.40),
        new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide, toneMapped: false })
      );
      signFace.position.set(0, 1.34, 0.914);
      group.add(signFace);
      group.userData.dynamicTextures = dynamicTextures;
    }

    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    return { group, wheels, propeller };
  }

  private disposeObjectResources(object: THREE.Object3D) {
    const dynamicTextures = new Set<THREE.Texture>();
    object.traverse((child) => {
      const textures = child.userData.dynamicTextures as THREE.Texture[] | undefined;
      if (Array.isArray(textures)) textures.forEach((texture) => dynamicTextures.add(texture));
    });
    this.disposeTemporaryObject(object);
    dynamicTextures.forEach((texture) => texture.dispose());
  }

  private disposePomazaniecObject(object: THREE.Object3D) {
    this.disposeObjectResources(object);
  }

  private spawnSurvivalPomazaniecMarker() {
    if (this.survivalPomazaniecSpawned || this.gameMode !== 'survival') return;
    this.survivalPomazaniecSpawned = true;
    const point = this.getSurvivalSpawnPoint();
    const rider = this.createPomazaniecRiderModel(0, true);
    const marker = rider.group;
    marker.position.set(point.x, 0, point.z);
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.98, 32),
      new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
    );
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.y = 0.035;
    marker.add(pulseRing);
    marker.userData.pulseRing = pulseRing;
    marker.userData.wheels = rider.wheels;
    marker.userData.propeller = rider.propeller;
    this.levelRoot.add(marker);
    this.survivalPomazaniecMarker = marker;
    this.survivalPomazaniecMarkerPulse = 0;
    this.callbacks.onSurvivalAnnouncement?.(
      'OBIEKT NIEZIDENTYFIKOWANY',
      'Na obrzeżu hali stoi mały rowerzysta w czapce z wiatraczkiem.',
      'Na kierownicy ma tabliczkę „POMAZANIEC”. Podejdź bliżej.'
    );
    this.emitFloatingToast('🚲 POMAZANIEC — PODEJDŹ DO TABLICZKI!', point.x, 1.8, point.z, 'perk');
  }

  private updateSurvivalPomazaniecMarker(dt: number) {
    const marker = this.survivalPomazaniecMarker;
    if (!marker || this.survivalPomazaniecTriggered) return;
    this.survivalPomazaniecMarkerPulse += dt;
    const dx = this.playerPos.x - marker.position.x;
    const dz = this.playerPos.z - marker.position.z;
    marker.rotation.y = Math.atan2(dx, dz);
    marker.position.y = Math.sin(this.survivalPomazaniecMarkerPulse * 2.2) * 0.018;
    const propeller = marker.userData.propeller as THREE.Group | undefined;
    if (propeller) propeller.rotation.y += dt * 22;
    const wheels = marker.userData.wheels as THREE.Mesh[] | undefined;
    if (wheels) wheels.forEach((wheel) => wheel.rotateX(dt * 2.1));
    const ring = marker.userData.pulseRing as THREE.Mesh | undefined;
    if (ring) {
      const pulse = 0.94 + Math.sin(this.survivalPomazaniecMarkerPulse * 3.3) * 0.12;
      ring.scale.setScalar(pulse);
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = 0.48 + (Math.sin(this.survivalPomazaniecMarkerPulse * 3.3) + 1) * 0.18;
    }
    if (Math.hypot(dx, dz) < 3.6) this.triggerPomazaniecSecretEvent();
  }

  private getPomazaniecSpawnPoint(index: number): { x: number; z: number } {
    const baseAngle = this.playerRot + (index / 5) * Math.PI * 2;
    const safePoint = chooseSurvivalEventSpawnPoint(
      { x: this.playerPos.x, z: this.playerPos.z },
      baseAngle,
      this.levelBounds,
      this.survivalObstacles,
      this.enemies,
      { minimumPlayerDistance: 7.8, minimumEnemyDistance: 2.2, obstaclePadding: 0.85 },
    );
    if (safePoint) return safePoint;

    // Only reachable if the arena is fully constrained; keep the fallback bounded.
    return {
      x: THREE.MathUtils.clamp(this.playerPos.x + Math.sin(baseAngle) * 9, this.levelBounds.minX + 2.8, this.levelBounds.maxX - 2.8),
      z: THREE.MathUtils.clamp(this.playerPos.z + Math.cos(baseAngle) * 9, this.levelBounds.minZ + 1.8, this.levelBounds.maxZ - 1.8),
    };
  }

  private addPomazaniecEnemy(id: string, x: number, z: number, index: number) {
    const rider = this.createPomazaniecRiderModel(index + 1, false);
    rider.group.position.set(x, 0, z);
    rider.group.rotation.y = Math.atan2(this.playerPos.x - x, this.playerPos.z - z);
    this.levelRoot.add(rider.group);
    this.enemies.push({
      id,
      type: 'pomazaniec',
      name: 'Pomazaniec #' + (index + 1) + ' • rajd na rowerkach',
      mesh: rider.group,
      x,
      y: 0.08,
      z,
      startX: x - 2.2,
      endX: x + 2.2,
      speed: 3.5 + (index % 2) * 0.16,
      dir: 1,
      hp: 4,
      maxHp: 4,
      state: 'chase',
      stunTimer: 0,
      shoutTimer: 1.4 + index * 0.42,
      shoutText: '',
      attackCooldown: 0,
      walkCycle: index * 0.8,
      specialActionTimer: 2.2 + index * 0.46,
      bikeWheels: rider.wheels,
      propeller: rider.propeller,
      aiSlot: 20 + index,
      aiFlankAngle: Math.atan2(x - this.playerPos.x, z - this.playerPos.z),
      aiOrbitSign: index % 2 === 0 ? 1 : -1,
    });
  }

  private triggerPomazaniecSecretEvent() {
    if (this.survivalPomazaniecTriggered || this.gameMode !== 'survival') return;
    this.survivalPomazaniecTriggered = true;
    const marker = this.survivalPomazaniecMarker;
    if (marker) {
      this.levelRoot.remove(marker);
      this.disposePomazaniecObject(marker);
      this.survivalPomazaniecMarker = null;
    }

    this.callbacks.onSurvivalAnnouncement?.(
      'Pomazańceeee, razem ruszamy na rowerowy rajd!',
      'RAJD NA ROWERKACH • PIĘCIU POMAZAŃCÓW',
      'Pięciu maluchów rusza do szturmu. Uważaj na salwy lizaków i nie daj się dogonić kolumnie rowerków!'
    );
    this.emitFloatingToast('🍭 LIZAKI W DŁOŃ! ROWEROWY BOSS CZEKA!', this.playerPos.x, this.playerPos.y + 1.9, this.playerPos.z, 'combo');
    sound.playPomazaniecEntrance();
    this.triggerScreenShake(0.36, 0.28);
    this.triggerHitStop(0.07);
    this.triggerBloomPulse(0.34);

    for (let index = 0; index < 5; index++) {
      const point = this.getPomazaniecSpawnPoint(index);
      this.addPomazaniecEnemy('survival_pomazaniec_' + index + '_' + Math.floor(performance.now()), point.x, point.z, index);
      this.spawnParticleRing(point.x, 0.12, point.z, index % 2 === 0 ? 0xf472b6 : 0xfacc15);
    }
  }

  private spawnPomazaniecLollipop(x: number, y: number, z: number, targetX: number, targetZ: number, variant: number) {
    const colors = [0xf43f5e, 0xf472b6, 0x8b5cf6, 0x22c55e, 0xf59e0b];
    const color = colors[variant % colors.length];
    const candy = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 12, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, roughness: 0.26, metalness: 0.08 })
    );
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.42, 7),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 })
    );
    stick.position.y = -0.24;
    candy.add(stick);
    const spiral = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.014, 5, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    spiral.position.z = 0.115;
    candy.add(spiral);

    candy.position.set(x, y, z);
    this.levelRoot.add(candy);
    const direction = new THREE.Vector3(targetX - x, 0.10, targetZ - z).normalize();
    this.enemyProjectiles.push({
      mesh: candy,
      vel: direction.multiplyScalar(7.6),
      life: 3.1,
      kind: 'pomazaniec_lollipop',
      gravity: 1.35,
      spin: 8.5,
    });
    sound.playLollipopThrow();
  }

  private spawnSebixBrick(x: number, y: number, z: number, targetX: number, targetZ: number) {
    const group = new THREE.Group();
    const brickMaterial = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.86 });
    const mortarMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d0a4, roughness: 0.95 });
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.19, 0.22), brickMaterial);
    group.add(brick);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.025, 0.225), mortarMaterial);
    stripe.position.y = 0.045;
    group.add(stripe);
    group.position.set(x,y,z);
    this.levelRoot.add(group);
    const direction = new THREE.Vector3(targetX-x,0.22,targetZ-z).normalize();
    this.enemyProjectiles.push({
      mesh: group as unknown as THREE.Mesh,
      vel: direction.multiplyScalar(7.2),
      life: 3.0,
      kind: 'sebix_brick',
      gravity: 2.15,
      spin: 5.2,
    });
    sound.playWhistle();
    this.emitFloatingToast('🧱 OPERATOR TURBO RZUCA CEGŁĄ!', x, y+0.45, z, 'damage');
  }

  private spawnSebixFireTrail(x: number, z: number, direction: number) {
    // A short-lived ground scorch with three rising tongues of orange/red flame.
    // Geometry and materials are unique to this patch and disposed at the end of its life.
    const group = new THREE.Group();
    group.position.set(x, 0.035, z);
    group.rotation.y = direction;

    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.5), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.005;
    group.add(ground);

    const flameColors = [0xf97316, 0xef4444, 0xfacc15];
    flameColors.forEach((color, index) => {
      const flameMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.76 - index * 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.12 + index * 0.025, 0.42 + index * 0.08, 6), flameMaterial);
      tongue.position.set((index - 1) * 0.19, 0.19 + index * 0.025, (index - 1) * 0.27);
      tongue.rotation.z = (index - 1) * 0.3;
      tongue.rotation.x = (index - 1) * 0.12;
      group.add(tongue);
    });

    this.levelRoot.add(group);
    this.specialEffects.push({
      mesh: group,
      life: 0.58,
      maxLife: 0.58,
      disposeOnRemove: true,
      grow: 0,
      spin: 0,
      update: (_dt, progress) => {
        const fade = Math.max(0, 1 - progress);
        group.scale.set(0.86 + progress * 0.24, 0.75 + progress * 0.2, 0.86 + progress * 0.24);
        group.children.forEach((child) => {
          const mesh = child as THREE.Mesh;
          const material = mesh.material as THREE.MeshBasicMaterial;
          material.opacity = fade * (mesh === ground ? 0.62 : 0.76);
        });
      },
      cleanup: () => {
        group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        });
      },
    });
  }

  /**
   * A short-lived floor lane gives a readable dodge window before a directional
   * boss projectile. One InstancedMesh keeps the signal to a single draw call.
   */
  private spawnBossLaneTelegraph(
    x: number,
    z: number,
    direction: number,
    length: number,
    width: number,
    color: number,
    duration: number,
    owner?: EnemyItem
  ) {
    const safeLength = Math.max(1, Number.isFinite(length) ? length : 1);
    const safeWidth = Math.max(0.5, Number.isFinite(width) ? width : 0.5);
    if (owner) {
      owner.chargeLaneLength = safeLength;
      owner.chargeLaneWidth = safeWidth;
    }
    const life = THREE.MathUtils.clamp(Number.isFinite(duration) ? duration : 0.6, 0.2, 1.5);
    const group = new THREE.Group();
    group.position.set(x, 0.065, z);
    group.rotation.y = Number.isFinite(direction) ? direction : 0;

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const barGeometry = new THREE.BoxGeometry(1, 0.025, 1);
    const bars = new THREE.InstancedMesh(barGeometry, material, 6);
    const dummy = new THREE.Object3D();
    const placements = [
      { x: 0, z: safeLength * 0.5, sx: safeWidth, sz: safeLength },
      { x: -safeWidth * 0.5, z: safeLength * 0.5, sx: 0.075, sz: safeLength },
      { x: safeWidth * 0.5, z: safeLength * 0.5, sx: 0.075, sz: safeLength },
      { x: 0, z: safeLength * 0.25, sx: safeWidth * 0.82, sz: 0.065 },
      { x: 0, z: safeLength * 0.5, sx: safeWidth * 0.82, sz: 0.065 },
      { x: 0, z: safeLength * 0.75, sx: safeWidth * 0.82, sz: 0.065 },
    ];
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, 0, placement.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(placement.sx, 1, placement.sz);
      dummy.updateMatrix();
      bars.setMatrixAt(index, dummy.matrix);
    });
    bars.instanceMatrix.needsUpdate = true;
    group.add(bars);
    this.levelRoot.add(group);
    this.specialEffects.push({
      mesh: group,
      life,
      maxLife: life,
      grow: 0,
      spin: 0,
      update: (_dt, progress) => {
        const fade = 1 - progress;
        material.opacity = 0.13 + fade * (0.12 + Math.sin(progress * Math.PI * 8) * 0.07);
        group.scale.x = 1 + Math.sin(progress * Math.PI * 6) * 0.035;
      },
      cleanup: () => this.disposeTemporaryObject(group),
    });
  }

  /** Red expanding floor ring marking a boss's fixed-position area attack. */
  private spawnBossImpactTelegraph(x: number, z: number, radius: number, color: number, duration: number) {
    const safeRadius = Math.max(0.5, Number.isFinite(radius) ? radius : 0.5);
    const life = THREE.MathUtils.clamp(Number.isFinite(duration) ? duration : 0.6, 0.2, 1.5);
    const group = new THREE.Group();
    group.position.set(x, 0.075, z);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, safeRadius - 0.18), safeRadius, 64),
      material
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    this.levelRoot.add(group);
    this.specialEffects.push({
      mesh: group,
      life,
      maxLife: life,
      grow: 0,
      spin: 0,
      update: (_dt, progress) => {
        const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.018;
        group.scale.set(pulse, 1, pulse);
        material.opacity = 0.24 + (1 - progress) * 0.52;
      },
      cleanup: () => this.disposeTemporaryObject(group),
    });
  }

  private updateSebixBehaviour(enemy: EnemyItem, dt: number, distance: number, dx: number, dz: number) {
    enemy.rageTime = (enemy.rageTime || 0) + dt;
    if (enemy.rageTime >= 10 && (enemy.bossPhase || 1) < 2) {
      enemy.bossPhase = 2;
      enemy.speed *= 1.34;
      enemy.maxHp = Math.ceil(enemy.maxHp * 1.12);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 2);
      this.callbacks.onPerkDropBanner?.(
        'OPERATOR TURBO • ZACZYNA SIĘ ROZGRZEWKA',
        '💪',
        'Cegły lecą szybciej. Operator Turbo przyspiesza i zaczyna zamykać dystans.',
        '#f97316'
      );
      this.triggerScreenShake(0.22,0.14);
      sound.playBossWarning();
    }
    if (enemy.rageTime >= 24 && (enemy.bossPhase || 1) < 3) {
      enemy.bossPhase = 3;
      enemy.speed *= 1.42;
      enemy.specialActionTimer = Math.min(enemy.specialActionTimer || 0, 1.2);
      this.callbacks.onPerkDropBanner?.(
        'OPERATOR TURBO • TRYB TARANU HULK B4',
        '🔥',
        'Podłoże zaczyna płonąć. Uważaj na czerwono-pomarańczowe ostrzeżenie przed szarżą.',
        '#ef4444'
      );
      sound.playSirens();
      this.triggerScreenShake(0.48,0.28);
      this.triggerBloomPulse(0.38);
    }

    const facePlayer = () => { enemy.mesh.rotation.y = Math.atan2(dx,dz); };
    if ((enemy.dashTimer || 0) > 0) {
      enemy.dashTimer = Math.max(0,(enemy.dashTimer || 0)-dt);
      const dir = enemy.chargeDir ?? Math.atan2(dx,dz);
      enemy.x += Math.sin(dir) * enemy.speed * 2.45 * dt;
      enemy.z += Math.cos(dir) * enemy.speed * 2.45 * dt;
      enemy.mesh.rotation.y = dir;
      enemy.mesh.position.set(enemy.x,enemy.y,enemy.z);
      enemy.trailTimer = (enemy.trailTimer || 0)-dt;
      if ((enemy.trailTimer || 0) <= 0) {
        enemy.trailTimer = 0.105;
        this.spawnSebixFireTrail(enemy.x, enemy.z, dir);
      }
      if (enemy.dashTimer <= 0) {
        enemy.state = 'chase';
        enemy.specialActionTimer = 4.2;
        enemy.chargeDir = undefined;
        this.triggerScreenShake(0.32,0.2);
      }
      return;
    }

    if (enemy.chargeTimer !== undefined) {
      enemy.chargeTimer = Math.max(0,enemy.chargeTimer-dt);
      enemy.state = 'charging';
      enemy.mesh.rotation.y = enemy.chargeDir ?? Math.atan2(dx,dz);
      if (enemy.chargeTimer <= 0) {
        enemy.chargeTimer = undefined;
        enemy.dashTimer = 0.78;
        enemy.state = 'chase';
        sound.playBossWarning();
        this.triggerScreenShake(0.26,0.17);
      }
      return;
    }

    const phase = enemy.bossPhase || 1;
    if (phase >= 3) {
      enemy.specialActionTimer = (enemy.specialActionTimer ?? 0)-dt;
      if (distance < 13 && (enemy.specialActionTimer || 0) <= 0) {
        enemy.chargeTimer = 0.72;
        enemy.chargeDir = Math.atan2(dx,dz);
        enemy.state = 'charging';
        this.spawnBossLaneTelegraph(enemy.x, enemy.z, enemy.chargeDir, 12.5, 2.6, 0xef4444, 0.72, enemy);
        this.spawnParticleRing(enemy.x,0.12,enemy.z,0xef4444);
        this.emitFloatingToast('🔥 OPERATOR TURBO ŁADUJE TARAN — ZEJDŹ Z LINII!',enemy.x,enemy.y+2.2,enemy.z,'damage');
        sound.playBossWarning();
        return;
      }
      enemy.trailTimer = (enemy.trailTimer || 0)-dt;
      if ((enemy.trailTimer || 0) <= 0) {
        enemy.trailTimer = 0.24;
        this.spawnSebixFireTrail(enemy.x, enemy.z, enemy.mesh.rotation.y);
      }
    } else {
      enemy.specialActionTimer = (enemy.specialActionTimer ?? 0)-dt;
      if (distance < 16 && (enemy.specialActionTimer || 0) <= 0) {
        enemy.specialActionTimer = phase >= 2 ? 3.1 : 4.5;
        facePlayer();
        this.spawnSebixBrick(enemy.x,enemy.y+1.35,enemy.z,this.playerPos.x,this.playerPos.z);
      }
    }

    if (distance > 1.7) {
      const pace = phase === 1 ? 0.78 : 1.0;
      enemy.x += (dx/Math.max(0.1,distance))*enemy.speed*pace*dt;
      enemy.z += (dz/Math.max(0.1,distance))*enemy.speed*pace*dt;
    }
    facePlayer();
    enemy.mesh.position.set(enemy.x,enemy.y+Math.sin(enemy.walkCycle*1.7)*0.018,enemy.z);
  }

  private updateSurvivalDrone(dt: number) {
    if (this.gameMode !== 'survival' || (this.activePerks.arcDrone || 0) <= 0) return;
    this.survivalDroneCooldown -= dt;
    if (this.survivalDroneCooldown > 0) return;
    this.survivalDroneCooldown = 1.65;
    let target: EnemyItem | null = null;
    let nearest = 12;
    for (const enemy of this.enemies) {
      if (enemy.state === 'defeated' || !enemy.mesh) continue;
      const distance = Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z);
      if (distance < nearest) { nearest = distance; target = enemy; }
    }
    if (!target) return;
    this.damageEnemy(target, 1);
    this.spawnParticleRing(target.x, target.y + 0.6, target.z, 0x22d3ee);
    this.emitFloatingToast('⚡ DRON PIORUN: IMPULS!', target.x, target.y + 1.25, target.z, 'perk');
    sound.playElectricalSparks();
    if (target.hp <= 0) this.defeatEnemy(target, 180, true);
  }



  private applySurvivalCriticalShrapnel(primaryTarget: EnemyItem, directDamage: number, damageSource: SurvivalDamageSource = 'ability') {
    const rank = this.survivalUpgradeStacks.shrapnel || 0;
    if (this.gameMode !== 'survival' || rank <= 0 || primaryTarget.state === 'defeated') return;

    const profile = getSurvivalShrapnelProfile(
      rank,
      this.survivalEvolutions.has('crystal_cascade'),
      this.survivalShrapnelStrength,
    );
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const targetBudget = isMobile
      ? Math.min(profile.maxTargets, this.adaptivePerformanceTier >= 2 ? 1 : 2)
      : profile.maxTargets;
    const targets = this.enemies
      .filter((enemy) => enemy.id !== primaryTarget.id && enemy.state !== 'defeated' && enemy.mesh?.visible &&
        Math.hypot(enemy.x - primaryTarget.x, enemy.z - primaryTarget.z) <= profile.radius)
      .sort((a, b) =>
        Math.hypot(a.x - primaryTarget.x, a.z - primaryTarget.z) -
        Math.hypot(b.x - primaryTarget.x, b.z - primaryTarget.z)
      )
      .slice(0, targetBudget);

    this.spawnParticleRing(primaryTarget.x, primaryTarget.y + 0.42, primaryTarget.z, 0xfbbf24);
    if (targets.length === 0) return;

    const fragmentDamage = Math.max(1, Math.round(Math.max(1, directDamage) * profile.damageMultiplier));
    let damagedTargets = 0;
    for (const enemy of targets) {
      const previousHp = enemy.hp;
      this.damageEnemy(enemy, fragmentDamage, primaryTarget.x, primaryTarget.z, damageSource);
      if (enemy.hp < previousHp) {
        damagedTargets++;
        this.spawnCompactImpact(enemy.x, enemy.y + 0.52, enemy.z, 0xfbbf24);
        if (enemy.hp <= 0) this.defeatEnemy(enemy, 150, false);
      }
    }

    if (damagedTargets > 0) {
      this.triggerBloomPulse(0.12);
      this.emitFloatingToast(
        '✹ ODŁAMKI KRYTYCZNE • ' + damagedTargets + ' DODATKOWE CELE',
        primaryTarget.x,
        primaryTarget.y + 1.35,
        primaryTarget.z,
        'combo',
      );
    }
  }

  private updateSurvivalRadiation(dt: number) {
    if (this.gameMode !== 'survival') return;
    const rank = this.survivalUpgradeStacks.radiation || 0;
    if (rank <= 0) return;
    const evolved = this.survivalEvolutions.has('chain_reactor');
    const profile = getSurvivalRadiationProfile(rank, evolved);
    this.survivalRadiationTimer -= dt;
    if (this.survivalRadiationTimer > 0) return;
    this.survivalRadiationTimer = profile.intervalSeconds;

    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const targetBudget = isMobile
      ? Math.min(profile.maxTargets, this.adaptivePerformanceTier >= 2 ? 4 : this.adaptivePerformanceTier === 1 ? 6 : 8)
      : profile.maxTargets;
    const targets = this.enemies
      .filter((enemy) => enemy.state !== 'defeated' && enemy.mesh?.visible &&
        Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z) <= profile.radius)
      .sort((a, b) =>
        Math.hypot(a.x - this.playerPos.x, a.z - this.playerPos.z) -
        Math.hypot(b.x - this.playerPos.x, b.z - this.playerPos.z)
      )
      .slice(0, targetBudget);

    if (targets.length === 0) return;
    const damage = Math.max(1, Math.round(this.scaleSurvivalDamage(profile.damage) * this.survivalRadiationStrength));
    let affected = 0;
    for (const enemy of targets) {
      if (enemy.shieldActive) {
        enemy.shieldActive = false;
        if (enemy.shieldRing) enemy.shieldRing.visible = false;
        sound.playShieldBreak();
        affected++;
        continue;
      }
      this.damageEnemy(enemy, damage, this.playerPos.x, this.playerPos.z);
      affected++;
      if (enemy.hp <= 0) this.defeatEnemy(enemy, 190, false);
    }

    if (affected > 0) {
      this.spawnParticleRing(this.playerPos.x, 0.18, this.playerPos.z, 0x84cc16);
      sound.playElectricalSparks();
    }
  }

  private triggerSurvivalWarehouseEvent() {
    const point = this.getSurvivalSpawnPoint();
    const px = this.playerPos.x, pz = this.playerPos.z;
    const x = point.x, z = point.z;
    const eventIndex = Math.floor(Math.random() * 7);
    const stamp = Math.floor(performance.now());

    if (eventIndex === 0) {
      sound.playSirens();
      this.callbacks.onPerkDropBanner?.('⚡ DOSTAWA SPECJALNA — ALARM GŁODOWY!', '🧟', 'Trzech magazynierów-zombie wyczuło stripsy. Złap kubełek, zanim zrobią inwentaryzację Twojego lunchu.', '#ef4444');
      this.sayQuote('Ktoś otworzył kubełek na rampie. Teraz cała hala ma jeden cel: panierka.');
      for (let i = 0; i < 3; i++) {
        const ex = THREE.MathUtils.clamp(px + (i - 1) * 8, this.levelBounds.minX + 3, this.levelBounds.maxX - 3);
        const ez = THREE.MathUtils.clamp(pz + (i % 2 === 0 ? -8 : 8), this.levelBounds.minZ + 2, this.levelBounds.maxZ - 2);
        this.addZombieWorkerEnemy('survival_kfc_' + stamp + '_' + i, ex, Math.max(this.levelBounds.minZ + 0.5, ez - 2.5), Math.min(this.levelBounds.maxZ - 0.5, ez + 2.5), 'Zombie po nocnej zmianie — priorytet: stripsy');
      }
      this.spawnDroppedPerk(x, 0.5, z, 'kfc_bucket');
    } else if (eventIndex === 1) {
      sound.playSirens();
      this.callbacks.onPerkDropBanner?.('🚨 NIEZAPOWIEDZIANA KONTROLA BHP!', '⛑️', 'Inspektor i dodatkowa pułapka. Kask nie jest wyposażeniem opcjonalnym.', '#38bdf8');
      this.sayQuote('Inspektor BHP pyta, kto zatwierdził paletę jako schody ewakuacyjne. Wszyscy nagle nie znają kierownika.');
      this.addInspectorEnemy('survival_inspector_' + stamp, x, Math.max(this.levelBounds.minZ + 1, z - 3), Math.min(this.levelBounds.maxZ - 1, z + 3), 'Inspektor BHP — kontrola bez kawy');
      this.spawnDroppedPerk(px + 4, 0.5, pz, 'hardhat');
      this.spawnSurvivalHazard();
    } else if (eventIndex === 2) {
      sound.playPickup(3);
      this.doublePointsTimer = Math.max(this.doublePointsTimer, 20);
      this.callbacks.onPerkDropBanner?.('💸 BLACK FRIDAY W SHOWROOMIE!', '🛁', 'Przez 20 sekund podwójne punkty. Klienci pytają, czy można dać jeszcze 80% rabatu.', '#10b981');
      this.sayQuote('Rabat osiemdziesiąt procent, marża minus sto. Ktoś to zatwierdził, więc korzystaj!');
      for (let i = 0; i < 4; i++) this.spawnSurvivalXpGem(x + (i - 1.5) * 1.6, 0.4, z + (i % 2 ? 1.4 : -1.4), 2);
      this.spawnDroppedPerk(x + 3, 0.5, z, 'order_magnet');
      this.addCustomerEnemy('survival_hunter_' + stamp, x - 8, Math.max(this.levelBounds.minZ + 1, z - 4), Math.min(this.levelBounds.maxZ - 1, z + 4), 'Klient polujący na rabat -80%');
    } else if (eventIndex === 3) {
      sound.playSirens();
      this.callbacks.onPerkDropBanner?.('🤖 AWARIA SYSTEMU AGV!', '⚡', 'Roboty transportowe zgubiły trasę. Przetrwaj kontrolowany chaos i zbierz moduł drona.', '#22d3ee');
      this.sayQuote('System AGV zgłosił błąd: paleta szuka magazyniera, magazynier szuka przerwy.');
      this.addSerwisanciEnemy('survival_serwis_' + stamp, x, Math.max(this.levelBounds.minZ + 1, z - 4), Math.min(this.levelBounds.maxZ - 1, z + 4), 'Serwisant z kluczem 17');
      this.addSztaplarEnemy('survival_sztaplar_' + stamp, THREE.MathUtils.clamp(px + 11, this.levelBounds.minX + 3, this.levelBounds.maxX - 3), Math.max(this.levelBounds.minZ + 1, pz - 3), Math.min(this.levelBounds.maxZ - 1, pz + 3), 'Operator paleciaka po trzeciej kawie');
      this.addPiorunDronEnemy('survival_agv_' + stamp, x - 4, x + 4, z, 1.9, 'Dron Piorun — błędna trasa AGV');
      this.spawnDroppedPerk(x + 2, 0.5, z, 'arc_drone');
    } else if (eventIndex === 4) {
      sound.playPickup(2);
      this.callbacks.onPerkDropBanner?.('📦 ZAGINIONA PALETA PREMIUM!', '🔎', 'Dostawca Sanitarny zostawił tajemniczy ładunek. Skrzynia zawiera losowy moduł.', '#f59e0b');
      this.sayQuote('Dostawca Sanitarny przyjechał z dostawą. Dokument WZ ma cztery strony, ale żadnej strony tytułowej.');
      this.addPanRomanEnemy('survival_roman_' + stamp, x, Math.max(this.levelBounds.minZ + 1, z - 4), Math.min(this.levelBounds.maxZ - 1, z + 4), 'Dostawca Sanitarny — dostawa bez awiza');
      this.spawnLootCrate(THREE.MathUtils.clamp(px + 5, this.levelBounds.minX + 3, this.levelBounds.maxX - 3), 0, THREE.MathUtils.clamp(pz + 3, this.levelBounds.minZ + 2, this.levelBounds.maxZ - 2));
    } else if (eventIndex === 5) {
      sound.playSirens();
      this.callbacks.onPerkDropBanner?.('🟦 PILNE ZLECENIE B4 ERP: SKAN 3 PALET!', '📦', 'Na hali pojawiły się trzy złote etykiety. Zbierz je, zanim kontroler zamknie zlecenie.', '#38bdf8');
      this.sayQuote('system ERP wrzuciła trzy pilne zlecenia na tę samą minutę. Klasyka. Zbieraj etykiety, ja spróbuję dodzwonić się do IT.');
      for (let i = 0; i < 3; i++) {
        const taskX = THREE.MathUtils.clamp(x + (i - 1) * 3.4, this.levelBounds.minX + 3, this.levelBounds.maxX - 3);
        const taskZ = THREE.MathUtils.clamp(z + (i % 2 === 0 ? -2.2 : 2.2), this.levelBounds.minZ + 2, this.levelBounds.maxZ - 2);
        this.addGroutItem('survival_optima_scan_' + stamp + '_' + i, taskX, 0.55, taskZ, 180);
      }
      this.spawnDroppedPerk(x + 3.5, 0.5, z, 'xp_surge');
      this.addInspectorEnemy('survival_task_inspector_' + stamp, x - 8, Math.max(this.levelBounds.minZ + 1, z - 3), Math.min(this.levelBounds.maxZ - 1, z + 3), 'Kontroler zlecenia — podpis albo blokada');
    } else {
      // Two forklifts cross the warehouse in opposite directions. Keep the
      // event at three active hazards maximum and halve the convoy on weak phones.
      const minX = this.levelBounds.minX + 2.8;
      const maxX = this.levelBounds.maxX - 2.8;
      const upperLane = THREE.MathUtils.clamp(pz - 5.4, this.levelBounds.minZ + 1.8, this.levelBounds.maxZ - 1.8);
      const lowerLane = THREE.MathUtils.clamp(pz + 5.4, this.levelBounds.minZ + 1.8, this.levelBounds.maxZ - 1.8);
      const activeHazards = this.hazards.filter((hazard) => hazard.active).length;
      const convoySize = getSurvivalConvoyHazardCount(
        activeHazards,
        this.adaptivePerformanceTier,
        Math.abs(lowerLane - upperLane)
      );

      sound.playSirens();
      this.callbacks.onPerkDropBanner?.(
        convoySize > 0 ? 'KONWÓJ SZTAPLAREK • ALEJKI ZAMKNIĘTE' : 'KONWÓJ WSTRZYMANY • ALEJKI ZAJĘTE',
        '🚧',
        convoySize === 2
          ? 'Dwa wózki przecinają halę w przeciwnych kierunkach. Przeskakuj przez trasę albo zmień alejkę; po przejeździe zbierz premię BHP.'
          : convoySize === 1
            ? 'Wózek patroluje jedną aleję. Nie stój na trasie i wykorzystaj wolny korytarz, aby zebrać premię BHP.'
            : 'Wszystkie trzy miejsca zagrożeń są już zajęte. Konwój wstrzymany — wykorzystaj okno na zebranie premii BHP.',
        '#f59e0b'
      );
      this.sayQuote(
        convoySize === 0
          ? 'Aleje są już zajęte. Nawet konwój musi czasem poczekać na wolny slot.'
          : 'Dwa wózki, jedna hala i zero koordynacji. Klasyczna logistyka. Nie testuj zderzaków własnym czołem.'
      );

      for (let i = 0; i < convoySize; i++) {
        const laneZ = i === 0 ? upperLane : lowerLane;
        this.addForkliftHazard(
          'survival_convoy_' + stamp + '_' + i,
          minX,
          maxX,
          laneZ,
          i === 0 ? 4.0 : 4.4,
          i === 0 ? 0xf59e0b : 0x38bdf8
        );
        const convoyTruck = this.hazards[this.hazards.length - 1];
        if (convoyTruck) {
          convoyTruck.life = 16;
          if (i === 1) {
            convoyTruck.x = maxX;
            convoyTruck.mesh?.position.set(maxX, 0, laneZ);
            convoyTruck.dir = -1;
            if (convoyTruck.mesh) convoyTruck.mesh.rotation.y = Math.PI;
          }
        }
      }

      this.spawnSurvivalXpGem(x - 1.2, 0.45, z, 2);
      this.spawnSurvivalXpGem(x + 1.2, 0.45, z, 2);
      this.spawnDroppedPerk(x, 0.5, z, 'hardhat');
      this.spawnParticleRing(x, 0.25, z, 0xf59e0b);
      sound.playBossWarning();
    }
  }

  private getSurvivalSpawnPoint(): { x: number; z: number } {
    // Sample the arena perimeter, reject rack/cargo intersections, then prefer
    // a clear arrival lane. During dense waves, select the least crowded valid
    // point instead of repeatedly placing new actors on top of one another.
    const candidates: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 18 + Math.random() * 5;
      const x = THREE.MathUtils.clamp(
        this.playerPos.x + Math.cos(angle) * radius,
        this.levelBounds.minX + 2.5,
        this.levelBounds.maxX - 2.5
      );
      const z = THREE.MathUtils.clamp(
        this.playerPos.z + Math.sin(angle) * radius,
        this.levelBounds.minZ + 1.5,
        this.levelBounds.maxZ - 1.5
      );
      const blocked = this.survivalObstacles.some((obstacle) =>
        Math.abs(x - obstacle.x) < obstacle.halfWidth + 1.2 &&
        Math.abs(z - obstacle.z) < obstacle.halfDepth + 1.2
      );
      if (!blocked) candidates.push({ x, z });
    }

    const spacedSpawn = chooseSpacedSpawnPoint(candidates, this.enemies, 3.2);
    if (spacedSpawn) return spacedSpawn;

    // A fixed offset can collapse against an arena boundary and place a new
    // enemy beside the operator. Search deterministic perimeter fallbacks,
    // preferring clear points at least 12 units away from the player.
    const fallbackCandidates: { x: number; z: number }[] = [];
    const insetX = Math.min(2.5, (this.levelBounds.maxX - this.levelBounds.minX) / 2);
    const insetZ = Math.min(1.5, (this.levelBounds.maxZ - this.levelBounds.minZ) / 2);
    const minX = this.levelBounds.minX + insetX;
    const maxX = this.levelBounds.maxX - insetX;
    const minZ = this.levelBounds.minZ + insetZ;
    const maxZ = this.levelBounds.maxZ - insetZ;
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;
    fallbackCandidates.push(
      { x: minX, z: minZ }, { x: maxX, z: minZ },
      { x: minX, z: maxZ }, { x: maxX, z: maxZ },
      { x: minX, z: midZ }, { x: maxX, z: midZ },
      { x: midX, z: minZ }, { x: midX, z: maxZ },
    );

    const safeFallbacks = fallbackCandidates
      .filter((point) => Math.hypot(point.x - this.playerPos.x, point.z - this.playerPos.z) >= 12)
      .filter((point) => !this.survivalObstacles.some((obstacle) =>
        Math.abs(point.x - obstacle.x) < obstacle.halfWidth + 1.2 &&
        Math.abs(point.z - obstacle.z) < obstacle.halfDepth + 1.2
      ))
      .sort((a, b) =>
        Math.hypot(b.x - this.playerPos.x, b.z - this.playerPos.z) -
        Math.hypot(a.x - this.playerPos.x, a.z - this.playerPos.z)
      );
    const fallback = chooseSpacedSpawnPoint(safeFallbacks, this.enemies, 3.2);
    if (fallback) return fallback;

    // Last-resort bounded point: choose the farthest arena corner from the player.
    return fallbackCandidates.sort((a, b) =>
      Math.hypot(b.x - this.playerPos.x, b.z - this.playerPos.z) -
      Math.hypot(a.x - this.playerPos.x, a.z - this.playerPos.z)
    )[0] ?? { x: midX, z: midZ };
  }

  private spawnSurvivalEnemy(wave: number) {
    const { x, z } = this.getSurvivalSpawnPoint();
    const id = 'survival_enemy_' + Math.floor(performance.now()) + '_' + Math.floor(Math.random() * 100000);
    const minZ = THREE.MathUtils.clamp(z - 2.2, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    const maxZ = THREE.MathUtils.clamp(z + 2.2, this.levelBounds.minZ + 0.5, this.levelBounds.maxZ - 0.5);
    // Rare specials remain independent of the regular weighted roster and are
    // still limited to one live instance each.
    const sebixAlreadyActive = this.enemies.some((enemy) => enemy.type === 'sebix_m' && enemy.state !== 'defeated');
    const bosmanAlreadyActive = this.enemies.some((enemy) =>
      enemy.type === 'bosman_krakow' && enemy.state !== 'defeated'
    );
    if (wave >= 8 && !sebixAlreadyActive && Math.random() < 0.065) {
      this.addSebixEnemy(id, x, minZ, maxZ);
    } else if (shouldSpawnBosmanKrakow(wave, Math.random(), bosmanAlreadyActive)) {
      this.addBosmanKrakowBossEnemy(id, x, z);
    } else {
      const spawnType = chooseSurvivalEnemySpawnType(wave, this.survivalElapsed, Math.random());
      switch (spawnType) {
        case 'zombie_pracownik':
          this.addZombieWorkerEnemy(id, x, minZ, maxZ, 'Zombie-Magazynier — głodny po nocnej zmianie');
          break;
        case 'kurier':
          this.addKurierEnemy(id, x, minZ, maxZ, 'Kurier Ekspresowy — paczka bez awiza');
          break;
        case 'sztaplar_szalony':
          this.addSztaplarEnemy(id, x, minZ, maxZ, 'Operator paleciaka — drift w alei B4');
          break;
        case 'monter':
          this.addMonterEnemy(id, x, minZ, maxZ, 'Monter Wiesław — poziomica w dłoni');
          break;
        case 'inspector':
          this.addInspectorEnemy(id, x, minZ, maxZ, 'Inspektor BHP — kontrola bez zapowiedzi');
          break;
        case 'handlowiec':
          this.addHandlowiecEnemy(id, x, minZ, maxZ, 'Handlowiec — oferta nie do odrzucenia');
          break;
        case 'customer':
          this.addCustomerEnemy(id, x, minZ, maxZ, 'Klient z reklamacją na 17 stron');
          break;
        case 'architect':
          this.addArchitectEnemy(id, x, x + 4.5, z, 'Architektka — odcień beżu numer 47');
          break;
        case 'przedstawiciel_włoski':
          this.addItalianVendorEnemy(id, x, minZ, maxZ, 'Włoski dostawca armatury — mamma mia');
          break;
        case 'serwisant':
          this.addSerwisanciEnemy(id, x, minZ, maxZ, 'Serwisant — zgłoszenie numer 404');
          break;
        case 'agv_robot':
          this.addAgvRobotEnemy(id, x, x, z, 'AGV-9 — autonomiczny paleciak w trybie kolizyjnym');
          break;
        case 'pan_roman':
          this.addPanRomanEnemy(id, x, minZ, maxZ, 'Dostawca Sanitarny — dostawa bez awiza');
          break;
        case 'piorun_dron': {
          const minX = THREE.MathUtils.clamp(x - 4.5, this.levelBounds.minX + 2.5, this.levelBounds.maxX - 2.5);
          const maxX = THREE.MathUtils.clamp(x + 4.5, this.levelBounds.minX + 2.5, this.levelBounds.maxX - 2.5);
          this.addPiorunDronEnemy(id, minX, maxX, z, 1.9, 'Piorun Dron — patrol elektryczny B4');
          break;
        }
        case 'mutant_gamma_forklift':
          this.addMutantGammaForkliftEnemy(id, x, minZ, maxZ);
          break;
        case 'radioactive_pip':
          this.addRadioactivePipEnemy(id, x, minZ, maxZ);
          break;
        case 'cyber_salesman':
          this.addCyberSalesmanEnemy(id, x, minZ, maxZ);
          break;
        case 'elite_walczak_guard':
        default:
          this.addEliteGuardEnemy(id, x, minZ, maxZ, 'Elitarny strażnik sektora');
          break;
      }
    }

    const enemy = this.enemies[this.enemies.length - 1];
    if (!enemy) return;
    if (enemy.mesh) {
      const majorEnemy = enemy.type === 'walczak' || enemy.type === 'krol_leto'
        || enemy.type === 'bosman_krakow' || enemy.type === 'sebix_m';
      const detailDistance = this.isHandheldViewport ? 15 : 20;
      const nearEnoughForDetail = Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z) <= detailDistance;
      if (majorEnemy || nearEnoughForDetail) {
        this.applyEnemyVisualPolish(enemy);
        this.applyStorybookStyle(enemy.mesh);
      } else {
        enemy.mesh.userData.enemyVisualPolishPending = true;
        this.applyStorybookStyle(enemy.mesh);
      }
    }
    if (enemy.type !== 'architect' && enemy.type !== 'piorun_dron') {
      enemy.z = z;
      enemy.startX = minZ;
      enemy.endX = maxZ;
      enemy.mesh.position.set(x, enemy.y, z);
    }
    const difficultyProfile = getSurvivalDifficultyProfile(wave);
    enemy.maxHp = Math.max(1, Math.ceil(enemy.maxHp * difficultyProfile.enemyHealthMultiplier));
    enemy.hp = enemy.maxHp;
    enemy.speed *= difficultyProfile.enemySpeedMultiplier;

    const waveMutator = getSurvivalWaveMutator(wave);
    const majorBoss = enemy.type === 'walczak' || enemy.type === 'krol_leto' ||
      enemy.type === 'bosman_krakow';
    let waveXpMultiplier = 1;
    if (!majorBoss && waveMutator.id !== 'standard') {
      const tuned = applySurvivalWaveMutator(
        { maxHp: enemy.maxHp, speed: enemy.speed },
        waveMutator
      );
      enemy.maxHp = tuned.maxHp;
      enemy.hp = tuned.maxHp;
      enemy.speed = tuned.speed;
      enemy.survivalXpMultiplier = tuned.xpMultiplier;
      waveXpMultiplier = tuned.xpMultiplier;

      // The Armored Shift promotes only a small subset to visible shield duty.
      // A stricter mobile chance keeps extra transparent objects off weaker GPUs.
      if (
        waveMutator.id === 'armored' &&
        enemy.mesh &&
        Math.random() < (this.isHandheldViewport
          ? (this.adaptivePerformanceTier >= 2 ? 0.08 : this.adaptivePerformanceTier === 1 ? 0.11 : 0.14)
          : 0.22)
      ) {
        enemy.shieldActive = true;
        const shieldRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.72, 0.055, 7, 24),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.76, depthWrite: false })
        );
        shieldRing.rotation.x = Math.PI / 2;
        shieldRing.position.y = 0.72;
        enemy.mesh.add(shieldRing);
        enemy.shieldRing = shieldRing;
      }
    }

    // Map identities are gameplay modifiers, not only scenery palettes. Compose
    // them after the timed wave rule; bosses receive the map trade-off as well.
    const mapTuned = applySurvivalMapCombatModifier(
      { maxHp: enemy.maxHp, speed: enemy.speed },
      this.survivalMapId
    );
    enemy.maxHp = mapTuned.maxHp;
    enemy.hp = mapTuned.maxHp;
    enemy.speed = mapTuned.speed;
    enemy.survivalXpMultiplier = Math.min(1.8, mapTuned.xpMultiplier * waveXpMultiplier);

    // Rare late-run variant: an armored AGV with a visible shield and a telegraphed pulse.
    // It reuses the existing AGV rig and only allocates its shield ring when promoted.
    if (enemy.type === 'agv_robot' && wave >= 11 && Math.random() < 0.45) {
      enemy.name = 'AGV-9 SENTINEL • OSŁONA MAGNETYCZNA';
      enemy.maxHp = Math.ceil(enemy.maxHp * 1.75);
      enemy.hp = enemy.maxHp;
      enemy.speed *= 0.88;
      enemy.shieldActive = true;
      enemy.specialActionTimer = 3.4;
      const shieldRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.055, 7, 28),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82, depthWrite: false })
      );
      shieldRing.rotation.x = Math.PI / 2;
      shieldRing.position.y = 0.72;
      enemy.mesh.add(shieldRing);
      enemy.shieldRing = shieldRing;
      this.callbacks.onPerkDropBanner?.(
        'ELITARNY AGV-9 SENTINEL',
        '🛡️',
        'Osłona blokuje pierwsze trafienie. Uważaj na czerwone ostrzeżenie przed impulsem elektrycznym.',
        '#38bdf8'
      );
    }
    enemy.shoutTimer = 2.0 + Math.random() * 4.0;
  }

  private spawnSurvivalBoss(wave: number) {
    const { x, z } = this.getSurvivalSpawnPoint();
    const id = 'survival_boss_' + wave + '_' + Math.floor(performance.now());
    const variant = getSurvivalBossVariant(wave);

    if (variant === 'bosman_krakow') {
      this.addBosmanKrakowBossEnemy(id, x, z);
    } else if (variant === 'krol_leto') {
      this.addKrolLetoBossEnemy(id, x, z);
    } else {
      this.addWalczakBossEnemy(id, x, z);
    }

    const boss = this.enemies[this.enemies.length - 1];
    if (boss) {
      this.applyEnemyVisualPolish(boss);
      if (boss.mesh) this.applyStorybookStyle(boss.mesh);
      boss.aiOrbitSign = wave % 2 === 0 ? 1 : -1;
      if (wave === 5) boss.name = 'Inwentaryzacja Gigant • Nadzorca Zero';
      else if (variant === 'bosman_krakow') boss.name = 'Bosman Kraków • Dowódca rampy';
      else if (variant === 'krol_leto') boss.name = 'Dyrektor Widmo • Kontroler terminala';

      const baseHp = wave === 5
        ? 78
        : variant === 'bosman_krakow'
          ? Math.round(58 + wave * 3.2)
          : Math.round(46 + wave * 3.1);
      boss.maxHp = baseHp;
      boss.hp = boss.maxHp;
      boss.speed *= (variant === 'bosman_krakow' ? 0.82 : 0.86) * (1 + Math.min(0.38, wave * 0.012));
      boss.startX = this.levelBounds.minX + 2.5;
      boss.endX = this.levelBounds.maxX - 2.5;
      boss.specialActionTimer = variant === 'bosman_krakow' ? 2.3 : 2.0;
      boss.bossPhase = 1;
      boss.aiCommanderPulseTimer = 5.0;
    }

    sound.playSirens();
    this.triggerScreenShake(0.9, 0.65);
    this.triggerHitStop(0.14);
    this.triggerBloomPulse(0.7);
    this.spawnParticleRing(x, 0.6, z, 0xf59e0b);
    const bossTitle = wave === 5
      ? 'INWENTARYZACJA GIGANT WJEŻDŻA NA HALĘ!'
      : variant === 'bosman_krakow'
        ? 'BOSMAN KRAKÓW PRZEJMUJE RAMPĘ!'
        : variant === 'krol_leto'
          ? 'DYREKTOR WIDMO WRACA DO MAGAZYNU!'
          : 'NADZORCA ZERO WJEŻDŻA NA ZMIANĘ!';
    const bossIcon = variant === 'bosman_krakow' ? '⚓' : variant === 'krol_leto' ? '👑' : '👔';
    this.callbacks.onPerkDropBanner?.(
      bossTitle,
      bossIcon,
      variant === 'bosman_krakow'
        ? 'Boss fali ' + wave + ' — wyczekaj odprawy, omiń wachlarz pocisków i kontratakuj po salwie.'
        : variant === 'krol_leto'
          ? 'Boss fali ' + wave + ' — unikaj oznaczonych stref i wykorzystuj przerwy w atakach dystansowych.'
          : 'Boss fali ' + wave + ' — obserwuj szarżę, odskocz z linii uderzenia i atakuj po przejściu.',
      '#ef4444'
    );
  }

  private spawnSurvivalXpGem(x: number, y: number, z: number, value: number) {
    const mesh = new THREE.Mesh(this.survivalXpGemGeometry, this.survivalXpGemMaterial);
    mesh.position.set(x, y + 0.8, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.levelRoot.add(mesh);
    const dreamXpMultiplier = this.oniricDreamRemainingSeconds > 0 ? 1.5 : 1;
    this.survivalXpGems.push({ mesh, value: Math.max(1, Math.round(value * dreamXpMultiplier)), life: 32, phase: Math.random() * Math.PI * 2 });
  }

  private updateSurvivalXpGems(dt: number) {
    for (let i = this.survivalXpGems.length - 1; i >= 0; i--) {
      const gem = this.survivalXpGems[i];
      gem.life -= dt;
      gem.phase += dt * 2.8;
      gem.mesh.rotation.y += dt * 1.8;
      gem.mesh.position.y += Math.sin(gem.phase) * dt * 0.12;

      const dx = this.playerPos.x - gem.mesh.position.x;
      const dz = this.playerPos.z - gem.mesh.position.z;
      const distance = Math.hypot(dx, dz);
      const pickupRadius = 1.6 * this.survivalMagnetMultiplier +
        (this.activePerks.magnet > 0 ? 6.5 : 0);

      if (distance < pickupRadius) {
        const target = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.7, this.playerPos.z);
        gem.mesh.position.lerp(target, Math.min(1, dt * 7.5));
      }

      if (distance < 1.25) {
        const streak = registerSurvivalXpPickup(this.survivalXpStreak, this.survivalElapsed);
        this.survivalXpStreak = streak.state;
        const xpValue = Math.max(1, Math.round(gem.value * this.survivalXpMultiplier * ((this.activePerks.xpSurge || 0) > 0 ? 1.5 : 1) * streak.multiplier));
        if (streak.perfectChainNow) {
          const chainBonus = 350 + this.survivalWave * 25;
          this.score += chainBonus;
          this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
          this.spawnSurvivalXpGem(this.playerPos.x + 1.35, this.playerPos.y, this.playerPos.z - 0.9, 3);
          this.emitFloatingToast('ŁAŃCUCH PERFEKCYJNY • +' + chainBonus + ' PKT • BONUS 3 XP', this.playerPos.x, this.playerPos.y + 2.0, this.playerPos.z, 'easter-egg');
          this.callbacks.onSurvivalAnnouncement?.('ŁAŃCUCH XP PERFEKCYJNY', '6 KRYSZTAŁÓW BEZ PRZERWY • PREMIA ' + chainBonus + ' PKT', 'Doskonała trasa zbierania! Dodatkowy kryształ doświadczenia pojawił się obok operatora.');
          this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.55, this.playerPos.z, 0xfbbf24);
          this.triggerHitStop(0.07);
          this.triggerBloomPulse(0.42);
          sound.playEasterEgg();
        }
        this.survivalXp += xpValue;
        this.registerSurvivalContractAction('xp', xpValue);
        this.registerSurvivalShiftEventAction('xp', xpValue);
        this.score += xpValue * 12;
        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
        sound.playPickup();
        this.levelRoot.remove(gem.mesh);
        this.survivalXpGems.splice(i, 1);
        this.emitFloatingToast('+' + xpValue + ' XP' + (streak.tier >= 3 ? ' • ŁAŃCUCH XP ×' + streak.multiplier.toFixed(2) : ''), this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');
        if (this.survivalXp >= this.survivalXpToNext && this.state === 'playing') {
          this.beginSurvivalLevelUp();
          break;
        }
      } else if (gem.life <= 0) {
        this.levelRoot.remove(gem.mesh);
        this.survivalXpGems.splice(i, 1);
      }
    }
  }

  private beginSurvivalLevelUp() {
    if (this.gameMode !== 'survival' || this.state !== 'playing') return;
    this.survivalXp = Math.max(0, this.survivalXp - this.survivalXpToNext);
    this.survivalLevel++;
    this.survivalXpToNext = getSurvivalXpRequirement(this.survivalLevel);
    const progression = getSurvivalProgressionInfo(this.survivalLevel);
    this.survivalRankUpPending = progression.isPromotion;
    if (this.survivalRankUpPending) {
      // Promotions grant one tactical reroll, capped so the inventory cannot snowball.
      this.survivalRerolls = Math.min(3, this.survivalRerolls + 1);
    }
    this.survivalPendingOptions = this.rollSurvivalUpgradeOptions();
    this.state = 'levelup';
    sound.stopMusic();
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    if (this.survivalRankUpPending) {
      this.emitFloatingToast('AWANS RANGI: ' + progression.rankName + ' • +1 PRZERZUT', this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z, 'combo');
    }
    this.callbacks.onSurvivalLevelUp?.(
      [...this.survivalPendingOptions],
      this.survivalRankUpPending ? 'rank-up' : 'levelup',
    );
    sound.playAbility(this.currentCharacterId);
  }

  private beginSurvivalBossReward(bossName: string) {
    if (
      this.gameMode !== 'survival' ||
      this.state !== 'playing' ||
      this.survivalBossRewardPending
    ) return;

    const ownedWeaponIds = new Set(this.survivalWeapons.map((weapon) => weapon.id));
    let weaponOffer:
      | { kind: 'unlock'; id: string; name: string; icon: string }
      | { kind: 'upgrade'; id: string; name: string; icon: string; currentLevel: number }
      | undefined;

    // Prefer a new weapon whose time gate has already opened. If the arsenal is
    // complete, advance the least-developed owned weapon by two legendary levels.
    for (const [weaponId, definition] of Object.entries(SURVIVAL_WEAPON_DEFS) as Array<[SurvivalWeaponId, typeof SURVIVAL_WEAPON_DEFS[SurvivalWeaponId]]>) {
      if (!ownedWeaponIds.has(weaponId) && this.survivalElapsed >= definition.unlockAfter) {
        weaponOffer = { kind: 'unlock', id: weaponId, name: definition.name, icon: definition.icon };
        break;
      }
    }

    if (!weaponOffer) {
      const nextWeapon = this.survivalWeapons
        .filter((weapon) => weapon.level < 5)
        .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))[0];
      if (nextWeapon) {
        const definition = SURVIVAL_WEAPON_DEFS[nextWeapon.id];
        weaponOffer = {
          kind: 'upgrade',
          id: nextWeapon.id,
          name: definition.name,
          icon: definition.icon,
          currentLevel: nextWeapon.level,
        };
      }
    }

    this.survivalPendingOptions = createSurvivalBossRewardOptions(weaponOffer);
    this.survivalRankUpPending = false;
    this.survivalBossRewardPending = true;
    this.state = 'levelup';
    sound.stopMusic();
    this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    this.callbacks.onSurvivalLevelUp?.([...this.survivalPendingOptions], 'boss-reward');
    this.emitFloatingToast('🏆 ' + bossName.toUpperCase() + ' POKONANY — WYBIERZ LEGENDARNĄ NAGRODĘ', this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z, 'combo');
    sound.playAbility(this.currentCharacterId);
  }

  private updateSectorProgression(dt: number) {
    const px = this.playerPos.x;
    const newSector = px < 36 ? 1 : px < 116 ? 2 : 3;
    if (newSector !== this.currentActiveSector) {
      this.currentActiveSector = newSector;
      this.currentLevelId = newSector;
      this.applySectorLighting(newSector);
      if (newSector === 2) {
        this.emitFloatingToast('WKROCZONO DO SEKTORA B: SHOWROOM & SPA!', px, this.playerPos.y + 1.5, this.playerPos.z, 'vip');
        this.callbacks.onPerkDropBanner?.('SEKTOR B: SHOWROOM & SPA', '🛁', 'Punkt kontrolny odblokowany! Wykorzystaj wanny jako trampoliny!', '#ec4899');
      } else if (newSector === 3) {
        this.emitFloatingToast('WKROCZONO DO SEKTORA C: TERMINAL PRZEŁADUNKOWY!', px, this.playerPos.y + 1.5, this.playerPos.z, 'combo');
        this.callbacks.onPerkDropBanner?.('SEKTOR C: TERMINAL PRZEŁADUNKOWY', '🚛', 'Ostatnia prosta do vana dostawczego! Pokonaj Zarząd!', '#f59e0b');
      }
    }

    // Boss proximity is presentation-only. Scan at ~8 Hz instead of every
    // simulation frame, and publish only when boss identity/health actually changes.
    this.bossHudRefreshCooldown = Math.max(0, this.bossHudRefreshCooldown - dt);
    if (this.bossHudRefreshCooldown <= 0) {
      this.bossHudRefreshCooldown = 0.12;
      let nearestBoss: EnemyItem | null = null;
      let nearestDistanceSq = 36 * 36;
      for (const enemy of this.enemies) {
        if (
          enemy.state === 'defeated' ||
          (enemy.type !== 'walczak' && enemy.type !== 'krol_leto' &&
            enemy.type !== 'bosman_krakow' && enemy.type !== 'sebix_m')
        ) continue;
        const dx = enemy.x - px;
        const dz = enemy.z - this.playerPos.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < nearestDistanceSq) {
          nearestDistanceSq = distanceSq;
          nearestBoss = enemy;
        }
      }

      const signature = nearestBoss
        ? `${nearestBoss.id}|${nearestBoss.name}|${nearestBoss.hp}|${nearestBoss.maxHp}|${nearestBoss.bossPhase}`
        : '';
      if (signature !== this.lastBossHudSignature) {
        this.lastBossHudSignature = signature;
        if (nearestBoss) {
          this.callbacks.onBossUpdate?.(
            nearestBoss.name, nearestBoss.hp, nearestBoss.maxHp, true, nearestBoss.bossPhase
          );
        } else {
          this.callbacks.onBossUpdate?.('', 0, 0, false);
        }
      }
    }
  }

  private updateCoffeeMachines(dt: number) {
    for (const cm of this.coffeeMachines) {
      if (cm.cooldown > 0) {
        cm.cooldown -= dt;
      }
      const dist = Math.hypot(cm.x - this.playerPos.x, cm.z - this.playerPos.z);
      if (dist < 1.25 && cm.cooldown <= 0) {
        cm.cooldown = 12.0; // 12 second cooldown per machine
        this.activatePerk('espresso_boost', 6);
        sound.playPerkPickup();
        this.emitFloatingToast('☕ POTRÓJNE ESPRESSO Z KAWIARKI B4!', cm.x, cm.y + 1.8, cm.z, 'perk');
        this.spawnParticleRing(cm.x, cm.y + 1.0, cm.z, 0x38bdf8);
        this.sayQuote('Aaaah! Mocna czarna kawa! Szybkość +35%!');
      }
    }
  }

  private updatePerkTimers(dt: number) {
    let changed = false;
    if (this.activePerks.doubleJump > 0) {
      this.activePerks.doubleJump = Math.max(0, this.activePerks.doubleJump - dt);
      changed = true;
    }
    if (this.activePerks.magnet > 0) {
      this.activePerks.magnet = Math.max(0, this.activePerks.magnet - dt);
      changed = true;
    }
    if (this.activePerks.speedBoost > 0) {
      this.activePerks.speedBoost = Math.max(0, this.activePerks.speedBoost - dt);
      changed = true;
    }
    if ((this.activePerks.kfcBerserk || 0) > 0) {
      this.activePerks.kfcBerserk = Math.max(0, (this.activePerks.kfcBerserk || 0) - dt);
      changed = true;
    }
    if ((this.activePerks.bulldozer || 0) > 0) {
      this.activePerks.bulldozer = Math.max(0, (this.activePerks.bulldozer || 0) - dt);
      changed = true;
    }
    if ((this.activePerks.attackHaste || 0) > 0) { this.activePerks.attackHaste = Math.max(0, (this.activePerks.attackHaste || 0) - dt); changed = true; }
    if ((this.activePerks.arcDrone || 0) > 0) { this.activePerks.arcDrone = Math.max(0, (this.activePerks.arcDrone || 0) - dt); changed = true; }
    if ((this.activePerks.xpSurge || 0) > 0) { this.activePerks.xpSurge = Math.max(0, (this.activePerks.xpSurge || 0) - dt); changed = true; }
    if ((this.activePerks.damageWard || 0) > 0) { this.activePerks.damageWard = Math.max(0, (this.activePerks.damageWard || 0) - dt); changed = true; }
    if (this.armorBlockCooldown > 0) this.armorBlockCooldown = Math.max(0, this.armorBlockCooldown - dt);
    if (this.doublePointsTimer > 0) {
      this.doublePointsTimer = Math.max(0, this.doublePointsTimer - dt);
    }
    if (this.glueSlowTimer > 0) {
      this.glueSlowTimer = Math.max(0, this.glueSlowTimer - dt);
    }
    if (this.cementSlowTimer > 0) {
      this.cementSlowTimer = Math.max(0, this.cementSlowTimer - dt);
    }
    if (changed) {
      this.callbacks.onPerksUpdate?.(this.activePerks);
    }
  }

  private updatePlayerMovement(dt: number) {
    const motionProfile = getCharacterMotionProfile(this.currentCharacterId);
    let screenX = 0;
    let screenY = 0;

    if (this.keys['KeyD'] || this.keys['ArrowRight']) screenX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) screenX -= 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) screenY += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) screenY -= 1;

    if (Math.abs(this.virtualJoystick.x) > 0.08 || Math.abs(this.virtualJoystick.y) > 0.08) {
      screenX = this.virtualJoystick.x;
      screenY = -this.virtualJoystick.y;
    }

    // Stable world-axis movement: keyboard and joystick do not rotate when the camera mode changes.
    let inputX = screenX;
    let inputZ = -screenY;

    const inputLen = Math.hypot(inputX, inputZ);

    // Character-coloured footfalls are emitted at a controlled cadence into the existing particle pool.
    if (inputLen > 0.08 && this.isGrounded) {
      this.characterFootstepTimer = Math.max(0, this.characterFootstepTimer - dt);
      if (this.characterFootstepTimer <= 0) {
        const stepProfile = getCharacterMotionProfile(this.currentCharacterId);
        const sideX = -inputZ * 0.14;
        const sideZ = inputX * 0.14;
        for (let step = 0; step < stepProfile.footstepCount; step++) {
          const side = stepProfile.footstepCount === 1 ? 0 : (step === 0 ? -1 : 1);
          this.spawnDust(
            this.playerPos.x - inputX * 0.16 + sideX * side,
            this.playerPos.y,
            this.playerPos.z - inputZ * 0.16 + sideZ * side,
            stepProfile.footstepColor,
          );
        }
        this.characterFootstepTimer = stepProfile.footstepInterval;
      }
    } else {
      this.characterFootstepTimer = Math.min(this.characterFootstepTimer, 0.07);
    }

    if (inputLen > 1) {
      inputX /= inputLen;
      inputZ /= inputLen;
    }

    let speed = this.charDef.speed * this.characterMasteryBonuses.speedMultiplier * this.getPacingFactor();
    if (this.gameMode === 'survival') {
      speed *= this.survivalMoveMultiplier * getSurvivalMomentumMoveMultiplier(this.survivalMomentum.overdriveRemainingSeconds);
      if (this.oniricDreamRemainingSeconds > 0) speed *= 1.20;
    }
    if (this.marcinWoTPenaltyTimer > 0) {
      this.marcinWoTPenaltyTimer = Math.max(0, this.marcinWoTPenaltyTimer - dt);
      speed *= 0.70; // 30% speed penalty during Kierownik WoT event
    }
    if (this.charDef.id === 'mateusz' && this.invulnerableTimer > 0) {
      speed *= 1.10;
    }
    if (this.activePerks.speedBoost > 0) {
      speed *= 1.18;
      if (Math.random() < 0.25) {
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xec4899);
      }
    }
    if ((this.activePerks.kfcBerserk || 0) > 0) {
      speed *= 1.15;
      if (Math.random() < 0.3) {
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xef4444);
      }
    }
    if ((this.activePerks.bulldozer || 0) > 0) {
      speed *= 1.10;
      if (Math.random() < 0.3) {
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xfacc15);
      }
    }
    if (this.glueSlowTimer > 0 && (this.activePerks.kfcBerserk || 0) <= 0 && this.activePerks.speedBoost <= 0) {
      speed *= 0.48;
    }
    if (this.cementSlowTimer > 0 && (this.activePerks.kfcBerserk || 0) <= 0 && this.activePerks.speedBoost <= 0) {
      speed *= 0.72;
    }

    const isTacticalDashing = this.survivalDashDurationRemaining > 0;
    if (isTacticalDashing) {
      this.survivalDashDurationRemaining = Math.max(0, this.survivalDashDurationRemaining - dt);
      this.playerVel.x = this.survivalDashDirection.x * 18;
      this.playerVel.z = this.survivalDashDirection.z * 18;
      if (!this.manualAimEnabled) this.playerRot = Math.atan2(this.survivalDashDirection.x, this.survivalDashDirection.z);
    } else if (inputLen > 0.08) {
      const targetX = inputX * speed;
      const targetZ = inputZ * speed;
      const steering = this.isGrounded ? motionProfile.groundAcceleration : motionProfile.airControl;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetX, steering, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetZ, steering, dt);
      this.playerVel.x = THREE.MathUtils.clamp(this.playerVel.x, -speed * 1.08, speed * 1.08);
      this.playerVel.z = THREE.MathUtils.clamp(this.playerVel.z, -speed * 1.08, speed * 1.08);
      if (!this.manualAimEnabled) this.playerRot = Math.atan2(inputX, inputZ);

      this.walkCycle += dt * motionProfile.gaitFrequency;
      if (this.leftLeg && this.rightLeg && this.leftArm && this.rightArm) {
        const gait = Math.sin(this.walkCycle);
        this.leftLeg.rotation.x = gait * motionProfile.stride;
        this.rightLeg.rotation.x = -gait * motionProfile.stride;
        this.leftArm.rotation.x = -gait * motionProfile.armSwing;
        this.rightArm.rotation.x = gait * motionProfile.armSwing;
        const armSpread = motionProfile.lateralSway * 2.4;
        this.leftArm.rotation.z = armSpread;
        this.rightArm.rotation.z = -armSpread;
      }
    } else {
      const braking = this.isGrounded ? motionProfile.groundBraking : motionProfile.airBraking;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, braking, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, braking, dt);
      if (this.leftLeg && this.rightLeg && this.leftArm && this.rightArm) {
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
        this.leftArm.rotation.z = 0;
        this.rightArm.rotation.z = 0;
      }
    }

    if (this.grzesiekCrushTimer > 0) {
      const t = 1 - this.grzesiekCrushTimer / 0.9;
      const swing = Math.sin(t * Math.PI);
      if (this.leftArm && this.rightArm) {
        this.leftArm.rotation.z = -1.2 + swing * 1.5;
        this.rightArm.rotation.z = 1.2 - swing * 1.5;
        this.leftArm.rotation.x = -1.3 + swing * 1.8;
        this.rightArm.rotation.x = -1.3 + swing * 1.8;
      }
    }

    if (this.marcinReclamationTimer > 0 && this.playerGroup) {
      const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.08;
      this.playerGroup.scale.set(pulse, 1.08, pulse);
    }

    if (this.attackCooldownTimer > 0) {
      const attackRecoveryRate = this.gameMode === 'survival'
        ? getSurvivalMomentumRateMultiplier(this.survivalMomentum.overdriveRemainingSeconds)
        : 1;
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt * attackRecoveryRate);
    }
    if (this.attackSwingTimer > 0) {
      this.attackSwingTimer = Math.max(0, this.attackSwingTimer - dt);
    }

    const gravityMultiplier = this.playerVel.y > 0
      ? motionProfile.riseGravityMultiplier
      : motionProfile.fallGravityMultiplier;
    this.playerVel.y -= 22.0 * gravityMultiplier * dt;

    if (this.isGrounded) {
      this.coyoteTimer = 0.12;
      this.hasDoubleJumped = false;
    } else {
      this.coyoteTimer -= dt;
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        this.playerVel.y = this.charDef.jumpForce * this.characterMasteryBonuses.jumpMultiplier;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        sound.playJump();
        this.spawnDust(this.playerPos.x, this.playerPos.y, this.playerPos.z);
        if (this.playerGroup) {
          const stretchXZ = 1 / Math.sqrt(motionProfile.jumpStretchY);
          this.playerGroup.scale.set(stretchXZ, motionProfile.jumpStretchY, stretchXZ);
        }
      } else if ((this.activePerks.doubleJump > 0 || this.charDef.id === 'piotr') && !this.hasDoubleJumped) {
        this.playerVel.y = this.charDef.jumpForce * 1.05 * this.characterMasteryBonuses.jumpMultiplier;
        this.hasDoubleJumped = true;
        this.jumpBufferTimer = 0;
        sound.playDoubleJump();
        this.spawnParticleRing(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0x38bdf8);
        this.sayQuote(this.charDef.id === 'piotr' ? 'SKOK WETERANA B4! Hopsa nad paletami!' : 'PODWÓJNY SKOK! Sprężyste odbicie antypoślizgowe!');
        if (this.playerGroup) {
          const stretchXZ = 1 / Math.sqrt(motionProfile.doubleJumpStretchY);
          this.playerGroup.scale.set(stretchXZ, motionProfile.doubleJumpStretchY, stretchXZ);
        }
      }
    }

    // Campaign uses the full connected mega-map bounds. Survival uses its own arena.
    // Keep these bounds for the entire movement transaction so obstacle and conveyor
    // resolution cannot push the player outside the same limits used by the first step.
    const maxZForSector = this.playerPos.x < 36 ? 19.0 : this.playerPos.x < 116 ? 19.0 : 21.0;
    const currentBounds = this.gameMode === 'survival'
      ? this.levelBounds
      : { minX: -34.5, maxX: 204.5, minZ: -maxZForSector, maxZ: maxZForSector };

    const attemptedX = this.playerPos.x + this.playerVel.x * dt;
    const attemptedZ = this.playerPos.z + this.playerVel.z * dt;
    let nextX = THREE.MathUtils.clamp(attemptedX, currentBounds.minX, currentBounds.maxX);
    let nextZ = THREE.MathUtils.clamp(attemptedZ, currentBounds.minZ, currentBounds.maxZ);
    if (nextX !== attemptedX) this.playerVel.x = 0;
    if (nextZ !== attemptedZ) this.playerVel.z = 0;

    // Remember the locked campaign gate for the whole movement transaction.
    // A conveyor or obstacle correction later in this method must not bypass it.
    let campaignGateBoundary: number | null = null;
    if (this.gameMode === 'campaign') {
      campaignGateBoundary = this.maxUnlockedSector < 2 && this.playerPos.x <= 36
        ? 35.35
        : this.maxUnlockedSector < 3 && this.playerPos.x <= 116 ? 115.35 : null;
      if (campaignGateBoundary !== null && nextX > campaignGateBoundary) {
        nextX = campaignGateBoundary;
        this.playerVel.x = 0;
        if (this.gateNoticeCooldown <= 0) {
          const message = campaignGateBoundary < 100
            ? 'BRAMA B ZAMKNIĘTA — POKONAJ BOSMANA W SEKTORZE A'
            : 'BRAMA C ZAMKNIĘTA — POKONAJ DYREKTORA WIDMO W SEKTORZE B';
          this.emitFloatingToast(message, this.playerPos.x, this.playerPos.y + 1.7, this.playerPos.z, 'vip');
          sound.playAlert();
          this.gateNoticeCooldown = 2.4;
        }
      }
    }
    this.gateNoticeCooldown = Math.max(0, this.gateNoticeCooldown - dt);
    const nextY = this.playerPos.y + this.playerVel.y * dt;

    let landed = false;
    const pRadius = 0.28;

    // Ground-level crate stacks and staging racks in the enlarged Survival wings have real collision.
    if (this.gameMode === 'survival' && this.playerPos.y < 1.0) {
      for (const obstacle of this.survivalObstacles) {
        const dx = nextX - obstacle.x;
        const dz = nextZ - obstacle.z;
        const overlapX = obstacle.halfWidth + pRadius - Math.abs(dx);
        const overlapZ = obstacle.halfDepth + pRadius - Math.abs(dz);
        if (overlapX <= 0 || overlapZ <= 0) continue;
        if (overlapX < overlapZ) {
          const sign = Math.sign(dx || this.playerVel.x || 1);
          nextX = obstacle.x + sign * (obstacle.halfWidth + pRadius);
          this.playerVel.x = 0;
        } else {
          const sign = Math.sign(dz || this.playerVel.z || 1);
          nextZ = obstacle.z + sign * (obstacle.halfDepth + pRadius);
          this.playerVel.z = 0;
        }
      }
    }

    for (const plat of this.platforms) {
      const minX = plat.x - plat.width / 2;
      const maxX = plat.x + plat.width / 2;
      const minZ = plat.z - plat.depth / 2;
      const maxZ = plat.z + plat.depth / 2;
      const topY = plat.y + plat.height / 2;

      if (nextX + pRadius > minX && nextX - pRadius < maxX &&
          nextZ + pRadius > minZ && nextZ - pRadius < maxZ) {

        if (this.playerPos.y >= topY - 0.22 && nextY <= topY) {
          if (plat.type === 'bathtub' && plat.bounce) {
            this.playerVel.y = plat.bounce;
            sound.playBounce();
            this.cameraShake = 0.35;
            this.sayQuote('HOP DO WANNY! Odlot na regał!');
            this.spawnParticleRing(plat.x, topY, plat.z, 0x06b6d4);
          } else if (plat.type === 'jump_pad' && plat.bounce) {
            this.playerVel.y = plat.bounce;
            sound.playBounce();
            this.triggerScreenShake(0.35, 0.25);
            this.sayQuote('SKOCZNIA! ODLOT NAD REGAŁAMI!');
            this.spawnParticleRing(plat.x, topY, plat.z, 0x38bdf8);
            this.emitFloatingToast('WYBICIE SKOCZNI!', plat.x, topY + 0.6, plat.z, 'perk');
            if (this.playerGroup) this.playerGroup.scale.set(0.7, 1.4, 0.7);
          } else if (plat.type === 'speed_pad') {
            const currentSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
            const moveAngle = Math.atan2(this.playerVel.z, this.playerVel.x) || 0;
            const boost = 7.5;
            this.playerVel.x = Math.cos(moveAngle) * (currentSpeed + boost);
            this.playerVel.z = Math.sin(moveAngle) * (currentSpeed + boost);
            this.spawnParticleRing(plat.x, topY, plat.z, 0xf59e0b);
            this.emitFloatingToast('SPRINT BOOST!', plat.x, topY + 0.6, plat.z, 'perk');
            this.playerVel.y = 0;
            this.playerPos.y = topY;
            landed = true;

            if (this.camera instanceof THREE.PerspectiveCamera) {
              const baseFov = 45;
              this.camera.fov = baseFov + 8;
              this.camera.updateProjectionMatrix();
            }
          } else {
            this.playerVel.y = 0;
            this.playerPos.y = topY;
            landed = true;
            if (plat.type === 'conveyor') {
              // The position is committed from nextX below; changing playerPos.x
              // here was overwritten later and made conveyors appear decorative.
              nextX += 3.6 * dt;
            }
          }

          if (plat.type === 'finish_truck') {
            this.checkLevelFinish();
          }
        }
      }
    }

    // Re-apply the gate after platform carry (notably conveyors), then commit.
    if (campaignGateBoundary !== null && nextX > campaignGateBoundary) {
      nextX = campaignGateBoundary;
      this.playerVel.x = 0;
    }

    const wasGrounded = this.isGrounded;
    this.isGrounded = landed;
    this.playerPos.x = nextX;
    if (!landed) {
      this.playerPos.y = Math.max(0.0, nextY);
      if (this.playerPos.y === 0.0) {
        landed = true;
        this.playerVel.y = 0;
      }
    }
    this.playerPos.z = nextZ;

    // Proximity trigger for the final finish gate / delivery van at the end of Sector C (x = 201)
    const finishTriggerX = 200.0;
    if (this.playerPos.x >= finishTriggerX && Math.abs(this.playerPos.z) < 3.5 && this.playerPos.y >= 0) {
      this.checkLevelFinish();
    }

    if (!wasGrounded && landed && this.playerGroup) {
      const squashY = motionProfile.landingSquashY;
      const squashXZ = 1 / Math.sqrt(squashY);
      this.playerGroup.scale.set(squashXZ, squashY, squashXZ);
      const landingColor = motionProfile.footstepColor;
      this.spawnDust(this.playerPos.x - 0.16, this.playerPos.y, this.playerPos.z, landingColor);
      this.spawnDust(this.playerPos.x + 0.16, this.playerPos.y, this.playerPos.z, landingColor);
    }

    if (this.playerPos.y < -4.5) {
      this.takeDamage('Wypadłeś z rampy załadunkowej!');
      const respawnX = this.currentActiveSector === 3 ? 121 : this.currentActiveSector === 2 ? 41 : -32;
      this.playerPos.set(respawnX, 2, 0);
      this.playerVel.set(0, 0, 0);
    }
    // Final safety clamp uses the exact bounds selected for this mode/sector.
    // The old levelBounds clamp was narrower than the campaign mega-map and
    // silently restricted campaign movement to Z ±16 instead of ±19/±21.
    const boundedPlayerPosition = clampHorizontalPosition(
      this.playerPos.x,
      this.playerPos.z,
      currentBounds
    );
    if (boundedPlayerPosition.constrainedX) this.playerVel.x = 0;
    if (boundedPlayerPosition.constrainedZ) this.playerVel.z = 0;
    this.playerPos.x = boundedPlayerPosition.x;
    this.playerPos.z = boundedPlayerPosition.z;

    if (this.playerGroup) {
      const motionRatio = Math.min(1, Math.hypot(this.playerVel.x, this.playerVel.z) / Math.max(0.1, this.charDef.speed));
      const now = performance.now() * 0.001;
      const idlePhase = now * motionProfile.idleRate;
      const airborne = !landed && this.playerPos.y > 0.18;
      const gait = Math.sin(this.walkCycle);
      this.playerGroup.position.copy(this.playerPos);
      this.playerGroup.rotation.y = this.playerRot;
      this.playerGroup.rotation.x = airborne ? motionProfile.jumpLean : -motionProfile.runLean * motionRatio;
      this.playerGroup.rotation.z = Math.sin(idlePhase) * motionProfile.idleSway * (1 - motionRatio) + gait * motionProfile.lateralSway * motionRatio;
      const walkBob = Math.abs(Math.sin(this.walkCycle * 2)) * motionProfile.bodyBob * motionRatio;
      const idleBob = Math.sin(idlePhase * 2) * motionProfile.idleBob * (1 - motionRatio);
      this.playerGroup.position.y += walkBob + idleBob;
      this.playerGroup.scale.lerp(PLAYER_UNIT_SCALE, dt * 8);
      if (this.playerHead) {
        this.playerHead.rotation.x = airborne ? motionProfile.jumpLean * -0.35 : Math.sin(idlePhase * 0.5) * 0.018 * (1 - motionRatio);
      }
      if (this.playerAccessory) {
        this.playerAccessory.rotation.x = this.playerAccessoryRestX + gait * motionProfile.toolSwing * motionRatio;
        this.playerAccessory.rotation.z = this.playerAccessoryRestZ + Math.cos(this.walkCycle) * motionProfile.toolRoll * motionRatio;
      }
      if (airborne && this.leftLeg && this.rightLeg && this.leftArm && this.rightArm) {
        this.leftLeg.rotation.x = -motionProfile.jumpKneeTuck;
        this.rightLeg.rotation.x = -motionProfile.jumpKneeTuck * 0.78;
        this.leftArm.rotation.x = -motionProfile.jumpArmLift;
        this.rightArm.rotation.x = -motionProfile.jumpArmLift * 0.84;
        this.leftArm.rotation.z = motionProfile.jumpArmLift * 0.32;
        this.rightArm.rotation.z = -motionProfile.jumpArmLift * 0.32;
      }

      if (this.attackSwingTimer > 0 && this.attackSwingDuration > 0) {
        const attackProfile = getCharacterAttackMotionProfile(this.currentCharacterId);
        const progress = THREE.MathUtils.clamp(1 - this.attackSwingTimer / this.attackSwingDuration, 0, 1);
        const strike = getAttackPoseStrength(progress);
        if (this.rightArm && this.leftArm) {
          this.rightArm.rotation.x += attackProfile.rightArmX * strike;
          this.leftArm.rotation.x += attackProfile.leftArmX * strike;
          this.rightArm.rotation.z += attackProfile.rightArmZ * strike;
          this.leftArm.rotation.z += attackProfile.leftArmZ * strike;
        }
        this.playerGroup.rotation.x += attackProfile.torsoPitch * strike;
        this.playerGroup.rotation.z += attackProfile.torsoTwist * strike;
        if (this.playerHead) this.playerHead.rotation.x += attackProfile.headDip * strike;
        if (this.playerAccessory) {
          this.playerAccessory.rotation.x += attackProfile.toolPitch * strike;
          this.playerAccessory.rotation.z += attackProfile.toolRoll * strike;
        }
      }
    }

    if (this.targetRing) {
      // Anchored to floor or platform directly under player feet for clear ground spatial awareness
      const groundY = Math.max(0.04, this.playerPos.y + 0.02);
      this.targetRing.position.set(this.playerPos.x, groundY, this.playerPos.z);
      this.targetRing.rotation.y = this.playerRot;
      const pulse = 1.0 + Math.sin(performance.now() * 0.006) * 0.06;
      this.targetRing.scale.set(pulse, 1.0, pulse);
    }
  }

  private updateCollectibles(dt: number) {
    // Iterate backwards so collected/invalid pickups can be removed in-place
    // without skipping the next entry. This keeps the hot-loop bounded by
    // active items instead of every pickup ever collected during the session.
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      if (c.collected || !c.mesh) {
        this.collectibles.splice(i, 1);
        continue;
      }

      c.mesh.rotation.y += dt * 2.5;

      if (c.life !== undefined) {
        c.life -= Math.max(0, dt);
        if (c.life <= 0) {
          c.collected = true;
          this.levelRoot.remove(c.mesh);
          this.disposeObjectResources(c.mesh);
          this.collectibles.splice(i, 1);
          continue;
        }
      }

      // Magnet Perk pull. A pickup can briefly occupy the player's exact
      // horizontal position; avoid normalising a zero-length direction.
      if (this.activePerks.magnet > 0) {
        const magDist = Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z);
        if (magDist > 0.001 && magDist < 8.5) {
          const pullSpeed = 9.0 * dt;
          c.x += ((this.playerPos.x - c.x) / magDist) * pullSpeed;
          c.z += ((this.playerPos.z - c.z) / magDist) * pullSpeed;
          c.y += ((this.playerPos.y + 0.5 - c.y) / magDist) * pullSpeed;
          c.mesh.position.set(c.x, c.y, c.z);
        }
      }

      const dist = Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z);
      const dy = Math.abs(c.y - (this.playerPos.y + 0.5));

      if (dist < 0.95 && dy < 1.2) {
        c.collected = true;
        this.levelRoot.remove(c.mesh);
        this.disposeObjectResources(c.mesh);

        const ptsMult = this.doublePointsTimer > 0 ? 2 : 1;
        if (c.type === 'grout') {
          this.score += c.points * ptsMult;
          this.handleMateuszPassive(1);
          sound.playPickup();
          this.emitFloatingToast(`+${c.points * ptsMult} Pkt Fuga`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'vip_item') {
          this.score += c.points * ptsMult;
          this.handleMateuszPassive(1);
          this.collectedVipCount++;
          sound.playPickup(2);
          this.sayQuote(`ZEBRANO VIP: ${c.name}!`);
          this.emitFloatingToast(`📦 VIP ITEM!`, c.x, c.y + 0.5, c.z, 'vip');
        } else if (c.type === 'espresso') {
          this.activatePerk('espresso_boost', 18);
          this.emitFloatingToast(`☕ ESPRESSO!`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'magnet') {
          this.activatePerk('order_magnet', 20);
          this.emitFloatingToast(`🧲 RADIOMAGNES!`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'golden_cutter') {
          this.activatePerk('vibram_boots', 25);
          this.emitFloatingToast(`👟 BUTY ANTYPOŚLIZGOWE!`, c.x, c.y + 0.5, c.z, 'points');
        } else if (c.type === 'kfc_bucket') {
          this.score += c.points * ptsMult;
          this.activatePerk('kfc_bucket', 16);
          this.emitFloatingToast(`⚡ KUBEŁEK MOCY! +2 KAWY & FURIA!`, c.x, c.y + 0.7, c.z, 'perk');
        } else if (c.type === 'easter_egg') {
          this.score += c.points * ptsMult;
          this.handleMateuszPassive(1);
          sound.playEasterEgg();
          this.sayQuote(`EASTER EGG ODNALEZIONY: ${c.name}! (+${c.points * ptsMult} pkt)`);
          this.emitFloatingToast(`🎉 ${c.name.toUpperCase()} • +${c.points * ptsMult} PKT!`, c.x, c.y + 0.62, c.z, 'easter-egg');
        }

        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
        this.collectibles.splice(i, 1);
      }
    }
  }
  private updateHazards(dt: number) {
    const now = performance.now() * 0.001;
    this.hazards.forEach((h) => {
      if (!h.active || !h.mesh) return;
      h.cooldown = Math.max(0, (h.cooldown || 0) - dt);

      if (h.type === 'forklift') {
        h.x += h.speed * h.dir * dt;
        if (h.dir > 0 && h.x >= h.endX!) {
          h.dir = -1;
          h.mesh.rotation.y = Math.PI;
        } else if (h.dir < 0 && h.x <= h.startX) {
          h.dir = 1;
          h.mesh.rotation.y = 0;
        }
        h.mesh.position.set(h.x, h.y, h.z);

        const dist = Math.hypot(h.x - this.playerPos.x, h.z - this.playerPos.z);
        if (dist < 1.4 && Math.abs(h.y - this.playerPos.y) < 1.2) {
          if (this.charDef.id === 'marcin') {
            // Operator 01 passive: immune to forklift knockbacks
            this.emitFloatingToast('🛡️ AUTORYTET BHP: STOP SZTAPLARKI!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');
          } else {
            this.takeDamage('Zostałeś potrącony przez wózek widłowy!');
          }
        }
      } else if (h.type === 'cement_spill') {
        const radius = h.width * 0.5;
        const dist = Math.hypot(h.x - this.playerPos.x, h.z - this.playerPos.z);
        if (dist < radius && this.playerPos.y < 0.35) {
          if (this.cementSlowTimer <= 0.1 && (this.activePerks.kfcBerserk || 0) <= 0 && this.activePerks.speedBoost <= 0) {
            this.emitFloatingToast('🧱 ŚWIEŻY CEMENT! BUTY WAŻĄ TERAZ TONĘ!', this.playerPos.x, this.playerPos.y + 1.0, this.playerPos.z, 'damage');
          }
          this.cementSlowTimer = 0.45;
        }
        for (const e of this.enemies) {
          if (e.state === 'defeated') continue;
          if (Math.hypot(e.x - h.x, e.z - h.z) < radius) {
            e.x -= (e.x - h.x) * 0.18 * dt;
            e.z -= (e.z - h.z) * 0.18 * dt;
          }
        }
      } else if (h.type === 'stretch_barrier') {
        const playerCrossesBarrier =
          Math.abs(this.playerPos.x - h.x) < h.width * 0.5 &&
          Math.abs(this.playerPos.z - h.z) < 0.72 &&
          this.playerPos.y < 0.78;
        if (playerCrossesBarrier && (h.cooldown || 0) <= 0) {
          h.cooldown = 1.45;
          this.glueSlowTimer = Math.max(this.glueSlowTimer, 0.72);
          const approachDirection = Math.sign(this.playerVel.z) || (this.playerPos.z >= h.z ? 1 : -1);
          this.playerVel.z = -approachDirection * 2.4;
          this.playerVel.x *= 0.78;
          this.emitFloatingToast('🧻 FOLIA STRETCH! PRZEBIJ SIĘ ALBO PRZESKOCZ!', this.playerPos.x, this.playerPos.y + 1.0, this.playerPos.z, 'damage');
        }
        for (const enemy of this.enemies) {
          if (enemy.state === 'defeated' || enemy.stunTimer > 0) continue;
          if (Math.abs(enemy.x - h.x) < h.width * 0.5 && Math.abs(enemy.z - h.z) < 0.72) {
            enemy.stunTimer = 0.72;
            enemy.state = 'stunned';
            this.emitFloatingToast('🧻 ZAWINIĘTY W STRETCH!', enemy.x, enemy.y + 1.0, enemy.z, 'damage');
          }
        }
      } else if (h.type === 'roller_gate') {
        h.z += h.speed * h.dir * dt;
        if (h.dir > 0 && h.z >= (h.endZ ?? h.startZ + 2.35)) h.dir = -1;
        else if (h.dir < 0 && h.z <= h.startZ) h.dir = 1;
        h.mesh.position.set(h.x, h.y, h.z);
        if (h.movingPart) h.movingPart.rotation.x += dt * 9.0;

        const playerInsideGate =
          Math.abs(this.playerPos.x - h.x) < h.width * 0.5 - 0.18 &&
          Math.abs(this.playerPos.z - h.z) < 0.96 &&
          this.playerPos.y < 1.05;
        if (playerInsideGate && (h.cooldown || 0) <= 0) {
          h.cooldown = 1.35;
          this.takeDamage('Przygnieciony przez ruchomą bramę rolek transportowych!');
          this.playerVel.z += (this.playerPos.z >= h.z ? 1 : -1) * 3.8;
          this.playerVel.x += (this.playerPos.x >= h.x ? 1 : -1) * 1.2;
          this.triggerScreenShake(0.18, 0.12);
        }
        for (const enemy of this.enemies) {
          if (enemy.state === 'defeated' || enemy.stunTimer > 0) continue;
          if (Math.abs(enemy.x - h.x) < h.width * 0.5 - 0.15 && Math.abs(enemy.z - h.z) < 0.9) {
            this.damageEnemy(enemy, 1, h.x, h.z);
            enemy.stunTimer = 0.95;
            enemy.state = 'stunned';
            this.emitFloatingToast('⚙️ PRASA ROLEK -1 HP!', enemy.x, enemy.y + 1.0, enemy.z, 'damage');
            if (enemy.hp <= 0 && enemy.type !== 'walczak' && enemy.type !== 'krol_leto') this.defeatEnemy(enemy, 180, true);
          }
        }
      } else if (h.type === 'laser_cutter') {
        h.phase = (h.phase || 0) + dt * h.speed;
        const halfSpan = h.length * 0.5 - 0.35;
        const bladeZ = Math.sin(h.phase) * halfSpan;
        if (h.movingPart) {
          h.movingPart.position.z = bladeZ;
          h.movingPart.rotation.x += dt * 18.0;
        }
        const dx = Math.abs(this.playerPos.x - h.x);
        const dz = Math.abs(this.playerPos.z - h.z);
        // Player can jump over the laser beam (y > 0.65)
        if (dx < 0.65 && dz < h.length * 0.48 && this.playerPos.y < 0.58) {
          this.takeDamage('Przecięty przez laserową gilotynę do spieków CNC!');
        }
        // Enemies walking into the spinning blade take damage
        for (const e of this.enemies) {
          if (e.state === 'defeated' || e.stunTimer > 0) continue;
          if (Math.abs(e.x - h.x) < 0.65 && Math.abs(e.z - (h.z + bladeZ)) < 0.75) {
            this.damageEnemy(e, 1, h.x, h.z + bladeZ);
            e.stunTimer = 0.8;
            this.emitFloatingToast('⚡ GILOTYNA CNC -1 HP!', e.x, e.y + 1.0, e.z, 'damage');
            if (e.hp <= 0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
              this.defeatEnemy(e, 200, true);
            }
          }
        }
      } else if (h.type === 'steam_geyser') {
        const period = h.speed || 4.2;
        h.timer = ((h.timer || 0) + dt) % period;
        const isErupting = h.timer > period - 1.15;
        const isWarning = h.timer > period - 2.1 && !isErupting;

        if (h.warningMesh) {
          const mat = h.warningMesh.material as THREE.MeshBasicMaterial;
          if (isErupting) {
            mat.color.setHex(0xef4444);
            mat.opacity = 0.85;
          } else if (isWarning) {
            mat.color.setHex(0xf59e0b);
            mat.opacity = 0.4 + Math.sin(now * 22) * 0.35;
          } else {
            mat.color.setHex(0x38bdf8);
            mat.opacity = 0.25;
          }
        }

        if (h.movingPart) {
          h.movingPart.visible = isErupting;
          if (isErupting) {
            const pulse = 0.85 + Math.sin(now * 30) * 0.2;
            h.movingPart.scale.set(pulse, 1.0, pulse);
          }
        }

        if (isErupting) {
          const dx = this.playerPos.x - h.x;
          const dz = this.playerPos.z - h.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.45 && this.playerPos.y < 1.0 && (h.cooldown || 0) <= 0) {
            h.cooldown = 2.0;
            const directionX = dist > 0.05 ? dx / dist : Math.sin(this.playerRot);
            const directionZ = dist > 0.05 ? dz / dist : Math.cos(this.playerRot);
            this.playerVel.x += directionX * 3.2;
            this.playerVel.z += directionZ * 3.2;
            const horizontalSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
            if (horizontalSpeed > 7.0) {
              this.playerVel.x *= 7.0 / horizontalSpeed;
              this.playerVel.z *= 7.0 / horizontalSpeed;
            }
            // The geyser is a side blast. It never overwrites jump velocity or launches the player into the roof.
            this.takeDamage('Uderzenie bocznym podmuchem gejzera parowego!');
            this.emitFloatingToast('💨 PODMUCH PARY — ODSKOCZ W BOK!', h.x, 1.4, h.z, 'damage');
          }
          for (const e of this.enemies) {
            if (e.state === 'defeated') continue;
            if (Math.hypot(e.x - h.x, e.z - h.z) < 1.3 && e.stunTimer <= 0) {
              e.stunTimer = 2.0;
              e.state = 'stunned';
              this.emitFloatingToast('💨 POPARZONY PARĄ!', e.x, e.y + 1.1, e.z, 'damage');
            }
          }
        }
      } else if (h.type === 'hydraulic_press') {
        const cycle = h.speed || 3.2;
        const prevTimer = h.timer || 0;
        h.timer = (prevTimer + dt) % cycle;
        // Cycle phases: 0..1.6 open, 1.6..2.2 warning, 2.2..2.55 slam down, 2.55..cycle retract
        let stamperY = 2.6;
        let isSlamming = false;
        if (h.timer >= 2.2 && h.timer < 2.55) {
          const t = (h.timer - 2.2) / 0.35;
          stamperY = THREE.MathUtils.lerp(2.6, 0.42, Math.min(1, t * 2.5));
          isSlamming = stamperY < 0.75;
          if (prevTimer < 2.28 && h.timer >= 2.28) {
            this.spawnParticleRing(h.x, 0.15, h.z, 0xf59e0b);
            if (Math.hypot(this.playerPos.x - h.x, this.playerPos.z - h.z) < 14) {
              this.triggerScreenShake(0.35, 0.2);
            }
          }
        } else if (h.timer >= 2.55) {
          const t = (h.timer - 2.55) / Math.max(0.1, cycle - 2.55);
          stamperY = THREE.MathUtils.lerp(0.42, 2.6, t);
        }
        if (h.movingPart) {
          h.movingPart.position.y = stamperY;
        }
        if (isSlamming) {
          if (Math.abs(this.playerPos.x - h.x) < 1.05 && Math.abs(this.playerPos.z - h.z) < 1.05 && this.playerPos.y < 1.2) {
            this.takeDamage('Zmieciony przez 500-tonową Prasę Hydrauliczną do Spieków!');
          }
          for (const e of this.enemies) {
            if (e.state === 'defeated') continue;
            if (Math.abs(e.x - h.x) < 1.2 && Math.abs(e.z - h.z) < 1.2 && e.stunTimer <= 0) {
              this.damageEnemy(e, 3, h.x, h.z);
              e.stunTimer = 2.5;
              this.emitFloatingToast('💥 ZMIAŻDŻONY PRASĄ -3 HP!', e.x, e.y + 1.2, e.z, 'damage');
              if (e.hp <= 0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
                this.defeatEnemy(e, 280, true);
              }
            }
          }
        }
      }
    });
  }

  private updateExplosiveBarrels(dt: number) {
    for (let i = this.explosiveBarrels.length - 1; i >= 0; i--) {
      const b = this.explosiveBarrels[i];
      if (b.exploded || !b.mesh) continue;

      const distToPlayer = Math.hypot(b.x - this.playerPos.x, b.z - this.playerPos.z);
      const isPlayerAttacking = this.attackSwingTimer > 0;

      // Trigger fuse on melee attack or player proximity when attacking
      if (isPlayerAttacking && distToPlayer < 2.4 && b.fuseTimer < 0) {
        b.fuseTimer = 0.55;
        sound.playAlert();
        this.emitFloatingToast('⚡ LONT ZAPALONY!', b.x, b.y + 1.2, b.z, 'damage');
      }

      if (b.fuseTimer > 0) {
        b.fuseTimer -= dt;
        const pulse = 1.0 + Math.sin(performance.now() * 0.04) * 0.22;
        b.mesh.scale.set(pulse, pulse, pulse);

        if (b.fuseTimer <= 0) {
          b.exploded = true;
          this.levelRoot.remove(b.mesh);
          this.disposeTemporaryObject(b.mesh);
          this.platforms = this.platforms.filter((platform) => platform.mesh !== b.mesh);
          sound.playExplosion();
          this.triggerScreenShake(1.2, 0.8);
          this.spawnParticleRing(b.x, b.y + 0.5, b.z, 0xef4444);
          this.emitFloatingToast('💥 EKSPLOZJA KLEJU PRO FLEX!', b.x, b.y + 1.2, b.z, 'damage');

          // Detonate and damage enemies in 5.2m radius
          this.enemies.forEach((e) => {
            if (e.state === 'defeated') return;
            const edist = Math.hypot(e.x - b.x, e.z - b.z);
            if (edist < 5.2) {
              this.damageEnemy(e, 3, b.x, b.z);
              e.stunTimer = 3.5;
              e.state = 'stunned';
              this.emitFloatingToast('💥 -3 HP!', e.x, e.y + 1.2, e.z, 'damage');
              if (e.hp <= 0 && e.type !== 'walczak' && e.type !== 'krol_leto') {
                e.state = 'defeated';
                if (e.mesh) e.mesh.visible = false;
                this.score += 350;
                this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
              }
            }
          });

          // Player splash damage if close
          if (distToPlayer < 3.2) {
            this.takeDamage('Zostałeś obrzucony eksplozyjnym klejem PRO FLEX!');
          }

          this.explosiveBarrels.splice(i, 1);
        }
      }
    }
  }

  // Reference to quotes defined at top of class


  private getSurvivalEnemyRole(enemy: EnemyItem): 'bruiser' | 'flanker' | 'ranged' | 'support' {
    return enemy.aiCoalitionRole ?? getSurvivalCoalitionRole(enemy.type);
  }

  private updateSurvivalCommanderPulse(boss: EnemyItem, dt: number): void {
    if (this.gameMode !== 'survival' || boss.state === 'defeated') return;
    const profile = getSurvivalCommanderProfile(boss.type, boss.bossPhase ?? 1);
    if (!profile) return;

    const timing = advanceSurvivalCommanderTiming(
      boss.aiCommanderPulseTimer ?? 5.0,
      boss.aiCommanderWindupTimer ?? 0,
      dt,
      (boss.stunTimer ?? 0) > 0,
      profile.cooldownSeconds,
    );
    boss.aiCommanderPulseTimer = timing.cooldownRemaining;
    boss.aiCommanderWindupTimer = timing.windupRemaining;

    if (timing.phase === 'cooldown' || timing.phase === 'windup') return;
    if (timing.phase === 'windup-started') {
      this.spawnParticleRing(boss.x, boss.y + 0.42, boss.z, 0xfbbf24);
      this.emitFloatingToast(
        '⚠️ ' + profile.title + ': ' + profile.callout + ' • PRZYGOTOWUJE ROZKAZ — OGŁUSZ GO, ABY PRZERWAĆ!',
        boss.x,
        boss.y + 2.0,
        boss.z,
        'damage',
      );
      sound.playBossWarning();
      return;
    }
    if (timing.phase === 'interrupted') {
      this.spawnParticleRing(boss.x, boss.y + 0.42, boss.z, 0x38bdf8);
      this.emitFloatingToast(
        '🛑 ' + profile.title + ': ROZKAZ PRZERWANY!',
        boss.x,
        boss.y + 2.0,
        boss.z,
        'damage',
      );
      sound.playShieldBreak();
      return;
    }

    const targets = selectSurvivalCommanderTargets(
      {
        id: boss.id,
        type: boss.type,
        x: boss.x,
        z: boss.z,
        state: boss.state,
      },
      this.enemies.map((enemy) => ({
        id: enemy.id,
        type: enemy.type,
        x: enemy.x,
        z: enemy.z,
        state: enemy.state,
        role: enemy.aiCoalitionRole ?? getSurvivalCoalitionRole(enemy.type),
      })),
      profile,
    );
    if (targets.length === 0) return;

    const targetIds = new Set(targets);
    for (const ally of this.enemies) {
      if (!targetIds.has(ally.id) || ally.state === 'defeated') continue;
      ally.aiCommandBoostTimer = Math.max(ally.aiCommandBoostTimer ?? 0, profile.durationSeconds);
      ally.aiCommandBoostMultiplier = Math.max(
        ally.aiCommandBoostMultiplier ?? 1,
        profile.moveSpeedMultiplier,
      );
      this.spawnParticleRing(ally.x, ally.y + 0.38, ally.z, 0xfbbf24);
    }

    this.spawnParticleRing(boss.x, boss.y + 0.42, boss.z, 0xf59e0b);
    this.emitFloatingToast(
      '🚨 ' + profile.title + ': ' + profile.callout + ' • ' + targets.length + ' JEDNOSTKI W RUCHU!',
      boss.x,
      boss.y + 2.0,
      boss.z,
      'damage',
    );
    sound.playBossWarning();
  }

  private updateSurvivalSupportPulse(support: EnemyItem, dt: number): void {
    if (support.aiCoalitionId === undefined || support.state === 'defeated') return;

    support.aiSupportPulseTimer = Math.max(0, (support.aiSupportPulseTimer ?? 2.8) - dt);
    if (support.aiSupportPulseTimer > 0) return;
    support.aiSupportPulseTimer = SURVIVAL_SUPPORT_PULSE_INTERVAL_SECONDS;

    const targets = selectSurvivalSupportPulseTargets(
      {
        id: support.id,
        coalitionId: support.aiCoalitionId,
        x: support.x,
        z: support.z,
        state: support.state,
      },
      this.enemies.map((ally) => ({
        id: ally.id,
        coalitionId: ally.aiCoalitionId,
        x: ally.x,
        z: ally.z,
        state: ally.state,
        type: ally.type,
      })),
      SURVIVAL_SUPPORT_PULSE_RADIUS,
      3,
    );

    let shielded = 0;
    for (const targetId of targets) {
      const ally = this.enemies.find((candidate) => candidate.id === targetId);
      if (!ally || ally.state === 'defeated' || ally.shieldActive || !ally.mesh) continue;

      ally.shieldActive = true;
      ally.supportShieldTimer = SURVIVAL_SUPPORT_SHIELD_SECONDS;
      if (!ally.shieldRing) {
        const ring = new THREE.Mesh(this.survivalShieldRingGeometry, this.survivalShieldRingMaterial);
        ring.position.y = 0.82;
        ring.renderOrder = 4;
        ally.mesh.add(ring);
        ally.shieldRing = ring;
      } else {
        ally.shieldRing.visible = true;
      }
      this.spawnParticleRing(ally.x, ally.y + 0.55, ally.z, 0x38bdf8);
      shielded++;
    }

    if (shielded > 0) {
      this.spawnParticleRing(support.x, support.y + 0.7, support.z, 0x7dd3fc);
    }
  }

  private clearSurvivalSupportShield(enemy: EnemyItem): void {
    enemy.shieldActive = false;
    enemy.supportShieldTimer = undefined;
    if (enemy.shieldRing) {
      enemy.mesh?.remove(enemy.shieldRing);
      enemy.shieldRing = undefined;
    }
  }

  private updateSurvivalEnemyTactics(enemy: EnemyItem, dt: number, distanceToPlayer: number) {
    const role = this.getSurvivalEnemyRole(enemy);
    if (role === 'support') this.updateSurvivalSupportPulse(enemy, dt);
    const engaged = this.activeChaserIds.has(enemy.id) || enemy.type === 'pomazaniec' || !!enemy.surgeRunner;
    const slot = enemy.aiSlot || 0;
    const inHordeRing = !!enemy.surgeRunner && this.survivalSurgeTimeLeft > 0;
    const anchorX = inHordeRing ? this.survivalSurgeCenterX : this.playerPos.x;
    const anchorZ = inHordeRing ? this.survivalSurgeCenterZ : this.playerPos.z;
    const anchorAngle = enemy.aiFlankAngle ?? Math.atan2(enemy.x - anchorX, enemy.z - anchorZ);
    const drift = Math.sin(this.survivalElapsed * 0.62 + slot * 1.7) * (engaged ? 0.10 : 0.10);
    const angle = anchorAngle + drift;

    // Ring members follow the visible contracting perimeter instead of all
    // selecting the same close-range target and collapsing onto the player.
    const defaultEngageRadius = role === 'support' ? 5.5 : role === 'ranged' ? 7.7 : role === 'bruiser' ? 2.25 : 3.0;
    const assignedFormationRadius = Number.isFinite(enemy.aiFormationRadius)
      ? THREE.MathUtils.clamp(enemy.aiFormationRadius as number, 2.0, 8.2)
      : defaultEngageRadius;
    let preferredRadius = inHordeRing
      ? this.survivalSurgeCurrentRadius
      : engaged
        ? assignedFormationRadius
        : role === 'support' ? 15.0 : role === 'ranged' ? 14.0 : 12.6;

    // Ranged attackers try to hold a useful firing lane instead of walking into melee range.
    if (!inHordeRing && engaged && role === 'ranged' && distanceToPlayer < preferredRadius - 1.0) preferredRadius += 1.0;
    const targetX = anchorX + Math.sin(angle) * preferredRadius;
    const targetZ = anchorZ + Math.cos(angle) * preferredRadius * (inHordeRing ? 0.62 : 1);
    let steerX = targetX - enemy.x;
    let steerZ = targetZ - enemy.z;
    const steerLength = Math.hypot(steerX, steerZ);

    if (steerLength < 0.72 && engaged) {
      const orbitSign = enemy.aiOrbitSign || 1;
      steerX = Math.cos(angle) * orbitSign;
      steerZ = -Math.sin(angle) * orbitSign;
    } else if (steerLength < 0.72 && !engaged) {
      steerX = Math.cos(angle);
      steerZ = -Math.sin(angle);
    }

    const nearbyEnemies = this.enemySpatialIndex.query(enemy.x, enemy.z, 4.1);
    const separation = calculateEnemySeparationVector(enemy, nearbyEnemies, 2.6);
    const separationX = separation.x;
    const separationZ = separation.z;

    const obstacleAvoidance = calculateEnemyObstacleAvoidanceVector(
      enemy,
      { x: targetX, z: targetZ },
      this.survivalObstacles,
      4.6,
      0.8,
    );
    steerX += separationX * 3.0 + obstacleAvoidance.x * 1.25;
    steerZ += separationZ * 3.0 + obstacleAvoidance.z * 1.25;
    const isTelegraphingRangedBoss = enemy.chargeTimer !== undefined &&
      (enemy.type === 'bosman_krakow' || (enemy.type === 'agv_robot' && enemy.name.includes('AGV-9 SENTINEL')));
    if (isTelegraphingRangedBoss) {
      // Keep the emitter at the origin shown by the locked attack lane.
      steerX = 0;
      steerZ = 0;
    }
    const steerMagnitude = Math.hypot(steerX, steerZ) || 1;
    steerX /= steerMagnitude;
    steerZ /= steerMagnitude;

    const roleSpeed = role === 'bruiser' ? 0.82 : role === 'flanker' ? 1.12 : role === 'support' ? 0.88 : 0.94;
    const waveSpeed = 1 + Math.min(0.18, Math.max(0, this.survivalWave - 1) * 0.009);
    const pressureSpeed = engaged ? 1 : 0.48;
    const commandBoost = enemy.aiCommandBoostTimer && enemy.aiCommandBoostTimer > 0
      ? THREE.MathUtils.clamp(enemy.aiCommandBoostMultiplier ?? 1, 1, 1.25)
      : 1;
    const moraleBreak = getSurvivalMoraleBreakMultiplier(enemy.aiMoraleBreakTimer ?? 0);
    const speed = enemy.speed * roleSpeed * waveSpeed * pressureSpeed * commandBoost * moraleBreak;

    enemy.x = THREE.MathUtils.clamp(enemy.x + steerX * speed * dt, this.levelBounds.minX + 1.2, this.levelBounds.maxX - 1.2);
    enemy.z = THREE.MathUtils.clamp(enemy.z + steerZ * speed * dt, this.levelBounds.minZ + 1.0, this.levelBounds.maxZ - 1.0);
    enemy.mesh.rotation.y = Math.atan2(this.playerPos.x - enemy.x, this.playerPos.z - enemy.z);
    enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
    enemy.state = engaged ? 'chase' : 'patrol';

    if (engaged && !enemy.alerted) {
      enemy.alerted = true;
      this.emitFloatingToast(enemy.type === 'zombie_pracownik' ? '⚡!' : '!', enemy.x, enemy.y + 1.25, enemy.z, 'damage');
    } else if (!engaged) {
      enemy.alerted = false;
    }
  }

  private damageEnemy(
    enemy: EnemyItem,
    amount: number,
    sourceX = this.playerPos.x,
    sourceZ = this.playerPos.z,
    damageSource: SurvivalDamageSource = 'ability',
  ): number {
    if (enemy.state === 'defeated' || !Number.isFinite(amount) || amount <= 0) return enemy.hp;
    if (enemy.shieldActive) {
      this.clearSurvivalSupportShield(enemy);
      this.spawnParticleRing(enemy.x, enemy.y + 0.65, enemy.z, 0x38bdf8);
      sound.playShieldBreak();
      return enemy.hp;
    }
    const previousHp = enemy.hp;
    // One shared Survival output nerf keeps every operator, weapon and ability
    // from deleting waves before the enemy director can create real pressure.
    const appliedDamage = this.gameMode === 'survival'
      ? scaleSurvivalOutgoingDamage(amount)
      : amount;
    enemy.hp = Math.max(0, enemy.hp - appliedDamage);
    const actualDamage = Math.max(0, previousHp - enemy.hp);
    if (this.gameMode === 'survival' && actualDamage > 0) {
      recordSurvivalDamage(this.survivalDamageStats, damageSource, actualDamage);
      if (previousHp > 0 && enemy.hp <= 0) {
        recordSurvivalKill(this.survivalDamageStats, damageSource);
      }
    }
    this.triggerEnemyHitReaction(enemy, actualDamage, sourceX, sourceZ);
    if (actualDamage > 0) {
      const isCrit = actualDamage >= 4 || Math.random() < 0.28;
      const comicWords = ['POW!', 'BUM!', 'KRACH!', 'WZ-CRIT!', '44 TON!', 'FAKTURA!', 'DYLATACJA!'];
      const chosenWord = comicWords[Math.floor(Math.random() * comicWords.length)];
      if (isCrit) {
        this.emitFloatingToast(`💥 ${chosenWord} -${actualDamage}`, enemy.x, enemy.y + 1.25, enemy.z, 'combo');
      } else {
        this.emitFloatingToast(`-${actualDamage}`, enemy.x, enemy.y + 1.05, enemy.z, 'damage');
      }
    }
    return enemy.hp;
  }

  private triggerEnemyHitReaction(enemy: EnemyItem, damage: number, sourceX: number, sourceZ: number): void {
    if (!enemy.mesh?.scale) return;
    const isBoss = enemy.type === 'walczak' || enemy.type === 'krol_leto' || enemy.type === 'bosman_krakow' || enemy.type === 'sebix_m';
    const reaction = createEnemyHitReaction(enemy.x, enemy.z, sourceX, sourceZ, damage, isBoss);
    if (!enemy.hitBaseScale) {
      enemy.hitBaseScale = {
        x: enemy.mesh.scale.x,
        y: enemy.mesh.scale.y,
        z: enemy.mesh.scale.z,
      };
    }
    enemy.hitReactTimer = Math.max(enemy.hitReactTimer || 0, reaction.duration);
    enemy.hitReactDuration = reaction.duration;
    enemy.hitReactStrength = Math.max(enemy.hitReactStrength || 0, reaction.strength);
    enemy.hitRecoilX = (enemy.hitRecoilX || 0) + reaction.impulseX;
    enemy.hitRecoilZ = (enemy.hitRecoilZ || 0) + reaction.impulseZ;
  }

  private updateEnemyHitReaction(enemy: EnemyItem, dt: number): void {
    if (!enemy.mesh) return;

    const timer = Math.max(0, (enemy.hitReactTimer || 0) - dt);
    enemy.hitReactTimer = timer;
    if (timer > 0 && enemy.hitBaseScale) {
      const pulse = getEnemyHitPulse(timer, enemy.hitReactDuration || 0.21);
      const squash = pulse * (enemy.hitReactStrength || 0.08);
      enemy.mesh.scale.set(
        enemy.hitBaseScale.x * (1 + squash * 0.45),
        enemy.hitBaseScale.y * (1 - squash),
        enemy.hitBaseScale.z * (1 + squash * 0.45),
      );
    } else if (enemy.hitBaseScale) {
      enemy.mesh.scale.set(enemy.hitBaseScale.x, enemy.hitBaseScale.y, enemy.hitBaseScale.z);
      enemy.hitBaseScale = undefined;
      enemy.hitReactStrength = 0;
    }

    const recoilX = enemy.hitRecoilX || 0;
    const recoilZ = enemy.hitRecoilZ || 0;
    if (Math.abs(recoilX) + Math.abs(recoilZ) > 0.001) {
      enemy.x += recoilX * dt;
      enemy.z += recoilZ * dt;
      const damping = Math.exp(-8.5 * dt);
      enemy.hitRecoilX = recoilX * damping;
      enemy.hitRecoilZ = recoilZ * damping;
      if (Math.abs(enemy.hitRecoilX) + Math.abs(enemy.hitRecoilZ) < 0.025) {
        enemy.hitRecoilX = 0;
        enemy.hitRecoilZ = 0;
      }
      enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
    }
  }

  private clampEnemyToArena(enemy: EnemyItem): void {
    const zLimit = enemy.x < 36 ? 19.0 : enemy.x < 116 ? 19.0 : 21.0;
    const bounds = this.gameMode === 'survival'
      ? this.levelBounds
      : { minX: -34.5, maxX: 204.5, minZ: -zLimit, maxZ: zLimit };
    const inset = isMajorSurvivalBossType(enemy.type)
      ? 1.55
      : enemy.type === 'sebix_m'
        ? 1.4
        : 0.8;
    const bounded = clampHorizontalPosition(enemy.x, enemy.z, bounds, inset);
    enemy.x = bounded.x;
    enemy.z = bounded.z;
    enemy.mesh.position.x = bounded.x;
    enemy.mesh.position.z = bounded.z;
  }

  private resolveEnemyPlayerOverlap(enemy: EnemyItem, minimumDistance: number): void {
    if (enemy.state === 'defeated' || !enemy.mesh) return;
    // The player may jump over enemies and land on raised platforms. Only
    // resolve horizontal model contact when both actors occupy the same floor band.
    if (Math.abs(enemy.y - this.playerPos.y) >= 1.1) return;

    const zLimit = enemy.x < 36 ? 19.0 : enemy.x < 116 ? 19.0 : 21.0;
    const bounds = this.gameMode === 'survival'
      ? this.levelBounds
      : { minX: -34.5, maxX: 204.5, minZ: -zLimit, maxZ: zLimit };
    const inset = isMajorSurvivalBossType(enemy.type)
      ? 1.55
      : enemy.type === 'sebix_m'
        ? 1.4
        : 0.8;
    const resolved = resolveEnemyPlayerSeparation(
      enemy,
      { x: this.playerPos.x, z: this.playerPos.z },
      minimumDistance,
      bounds,
      inset,
    );
    if (!resolved.corrected) return;

    enemy.x = resolved.x;
    enemy.z = resolved.z;
    // Keep the render transform synchronized with the hit-test/collision state.
    enemy.mesh.position.x = resolved.x;
    enemy.mesh.position.z = resolved.z;
  }

  private updateEnemies(dt: number) {
    const survivalAbilityRate = this.gameMode === 'survival'
      ? getSurvivalDifficultyProfile(this.survivalWave).enemyAbilityRateMultiplier
      : 1;
    if (this.globalEnemyShoutCooldown > 0) {
      this.globalEnemyShoutCooldown -= dt;
    }

    // Progressive pressure: unlock more simultaneous attackers as a run develops.
    // It uses the campaign's existing enemy set; no extra entities are spawned here.
    const elapsedSec = this.levelStartTime > 0 ? (performance.now() - this.levelStartTime) / 1000 : 0;
    const nextThreatTier = Math.min(4, Math.floor(elapsedSec / 90));
    if (nextThreatTier > this.threatTier) {
      this.threatTier = nextThreatTier;
      const tierMessages = [
        '',
        'ALARM MAGAZYNU: wzmożona aktywność przeciwników!',
        'UWAGA: kolejna zmiana weszła do akcji!',
        'SEKTOR ZAOSTRZA OCHRONĘ — trzymaj pozycję!',
        'MAKSYMALNY POZIOM ZAGROŻENIA — przetrwaj napór!',
      ];
      this.emitFloatingToast(tierMessages[this.threatTier], this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'damage');
      sound.playAlert();
    }

    // WAVE DIRECTOR: Rebuild the nearest-engager list at 5-6 Hz. Enemy movement
    // still updates every frame; only the expensive candidate allocation/sort is throttled.
    this.waveDirectorCooldown -= dt;
    if (this.waveDirectorCooldown <= 0) {
      this.waveDirectorCooldown = 0.18;
      const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
      const survivalMode = this.gameMode === 'survival';
      const pressureSteps = survivalMode ? Math.floor(Math.max(0, this.survivalWave - 1) / 3) : Math.floor(this.threatTier * 0.75);
      const baseChasers = survivalMode ? (isMobile ? 3 : 4) : (isMobile ? 1 : 2);
      const platformCap = survivalMode ? (isMobile ? 6 : 8) : (isMobile ? 2 : 3);
      const maxActiveChasers = Math.min(platformCap, baseChasers + pressureSteps);
      const activeCandidates: { enemy: EnemyItem; dist: number }[] = [];

      for (const e of this.enemies) {
        if (e.state === 'defeated' || !e.mesh) continue;
        const d = Math.hypot(this.playerPos.x - e.x, this.playerPos.z - e.z);
        if (d > 26.0 && !isMajorSurvivalBossType(e.type) && e.type !== 'sebix_m') {
          if (e.mesh.visible) e.mesh.visible = false;
          continue;
        }
        if (!e.mesh.visible) e.mesh.visible = true;
        const engageRadius = survivalMode ? 28.0 : 18.0;
        if (e.type !== 'walczak' && e.type !== 'krol_leto' && d <= engageRadius) {
          activeCandidates.push({ enemy: e, dist: d });
        }
      }

      activeCandidates.sort((a, b) => a.dist - b.dist || a.enemy.id.localeCompare(b.enemy.id));
      this.activeChaserIds.clear();
      const activeCount = Math.min(maxActiveChasers, activeCandidates.length);
      const formationBase = this.playerRot + Math.PI * 0.5;

      if (survivalMode) {
        // Before rebuilding assignments, detect any living members whose previous
        // coordinator has fallen. The response is short and deliberately mild.
        const leaderLossTargets = new Set(getSurvivalLeaderLossTargets(
          this.enemies.map((enemy) => ({
            id: enemy.id,
            state: enemy.state,
            coalitionId: enemy.aiCoalitionId,
            leaderId: enemy.aiCoalitionLeaderId,
          })),
        ));
        if (leaderLossTargets.size > 0) {
          for (const enemy of this.enemies) {
            if (!leaderLossTargets.has(enemy.id)) continue;
            enemy.aiMoraleBreakTimer = Math.max(
              enemy.aiMoraleBreakTimer ?? 0,
              SURVIVAL_LEADER_LOSS_BREAK_SECONDS,
            );
          }
        }

        // Rebuild compact squad orders every 0.18s, not in the per-frame enemy loop.
        // Clearing stale assignments here lets enemies fall back to patrol roles cleanly.
        for (const enemy of this.enemies) {
          enemy.aiCoalitionId = undefined;
          enemy.aiCoalitionLeaderId = undefined;
          enemy.aiCoalitionRole = undefined;
          enemy.aiFormationRadius = undefined;
          enemy.aiCoalitionSize = undefined;
        }

        const orders = buildSurvivalCoalitionOrders(
          activeCandidates
            .filter(({ enemy }) => !enemy.surgeRunner || this.survivalSurgeTimeLeft <= 0)
            .map(({ enemy }) => enemy),
          this.playerPos.x,
          this.playerPos.z,
          formationBase,
          maxActiveChasers,
          4,
        );
        const activeById = new Map(activeCandidates.map(({ enemy }) => [enemy.id, enemy] as const));
        for (const order of orders) {
          const enemy = activeById.get(order.enemyId);
          if (!enemy) continue;
          enemy.aiSlot = order.slot;
          enemy.aiFlankAngle = order.flankAngle;
          enemy.aiOrbitSign = order.orbitSign;
          enemy.aiCoalitionId = order.squadId;
          enemy.aiCoalitionLeaderId = order.leaderId;
          enemy.aiCoalitionRole = order.role;
          enemy.aiFormationRadius = order.preferredRadius;
          enemy.aiCoalitionSize = order.squadSize;
          this.activeChaserIds.add(enemy.id);
        }
      } else {
        // Campaign keeps its original ring pressure; coalition squads are a Survival feature.
        for (const candidate of activeCandidates) {
          candidate.enemy.aiCoalitionId = undefined;
          candidate.enemy.aiCoalitionLeaderId = undefined;
          candidate.enemy.aiCoalitionRole = undefined;
          candidate.enemy.aiFormationRadius = undefined;
          candidate.enemy.aiCoalitionSize = undefined;
        }
        for (let i = 0; i < activeCount; i++) {
          const enemy = activeCandidates[i].enemy;
          enemy.aiSlot = i;
          enemy.aiFlankAngle = formationBase + (i / Math.max(1, activeCount)) * Math.PI * 2;
          enemy.aiOrbitSign = i % 2 === 0 ? 1 : -1;
          this.activeChaserIds.add(enemy.id);
        }
      }
    }

    // Build one broad-phase grid per frame instead of scanning the full crowd for every enemy.
    this.enemySpatialIndex.rebuild(this.enemies);

    this.enemies.forEach((e) => {
      if (e.state === 'defeated' || !e.mesh) return;

      if ((e.aiCommandBoostTimer ?? 0) > 0) {
        e.aiCommandBoostTimer = Math.max(0, (e.aiCommandBoostTimer ?? 0) - dt);
        if (e.aiCommandBoostTimer <= 0) e.aiCommandBoostMultiplier = 1;
      }
      if ((e.aiMoraleBreakTimer ?? 0) > 0) {
        e.aiMoraleBreakTimer = Math.max(0, (e.aiMoraleBreakTimer ?? 0) - dt);
      }

      // Clamp before culling/AI so even actors displaced by hazards or a prior
      // special move cannot remain outside the playable arena while off-screen.
      this.clampEnemyToArena(e);
      const dx = this.playerPos.x - e.x;
      const dz = this.playerPos.z - e.z;
      const distToPlayer = Math.hypot(dx, dz);

      if (e.mesh.userData.enemyVisualPolishPending
        && distToPlayer <= (this.isHandheldViewport ? 15 : 20)) {
        delete e.mesh.userData.enemyVisualPolishPending;
        this.applyEnemyVisualPolish(e);
        this.applyStorybookStyle(e.mesh);
      }

      // Distance culling: skip heavy updates for distant non-boss enemies
      if (distToPlayer > 26.0 && !isMajorSurvivalBossType(e.type) && e.type !== 'sebix_m') {
        if (e.mesh.visible) e.mesh.visible = false;
        return;
      }
      if (!e.mesh.visible) e.mesh.visible = true;

      if (!e.hpBar) {
        e.hpBar = new THREE.Group();
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        fill.position.z = 0.01;
        e.hpBar.add(bg, fill);
        e.hpBar.position.y = e.type === 'sebix_m' ? 2.65 : isMajorSurvivalBossType(e.type) ? 2.4 : 1.65;
        e.mesh.add(e.hpBar);
        e.hpFill = fill;
        e.hpBar.visible = false;
      }
      if (e.hpBar) {
        const isDamaged = e.hp < e.maxHp;
        e.hpBar.visible = isDamaged;
        if (isDamaged) {
          e.hpBar.lookAt(this.camera.position);
          e.hpFill.scale.x = Math.max(0, e.hp / e.maxHp);
          e.hpFill.position.x = (e.hpFill.scale.x - 1) * 0.4;
        }
      }

      e.walkCycle += dt * 8;
      this.updateEnemyHitReaction(e, dt);
      if (e.shieldActive) {
        e.supportShieldTimer = Math.max(0, (e.supportShieldTimer ?? 0) - dt);
        if (e.supportShieldTimer <= 0) this.clearSurvivalSupportShield(e);
      }
      if (e.shieldRing?.visible) e.shieldRing.rotation.z += dt * 1.25;
      if (e.auraRing) e.auraRing.rotation.z += dt * 0.18;
      if (e.bikeWheels) e.bikeWheels.forEach((wheel) => wheel.rotateX(dt * (e.state === 'chase' ? 8.5 : 3.4)));
      if (e.propeller) e.propeller.rotation.y += dt * (e.state === 'chase' ? 34 : 18);
      if (e.type === 'pomazaniec') e.mesh.rotation.x = THREE.MathUtils.lerp(e.mesh.rotation.x, 0, Math.min(1, dt * 3.2));
      if (e.legL && e.legR && e.type !== 'piorun_dron') {
        e.legL.rotation.x = Math.sin(e.walkCycle) * 0.5;
        e.legR.rotation.x = -Math.sin(e.walkCycle) * 0.5;
      }
      if (e.armL && e.armR && e.type !== 'piorun_dron') {
        const armSwing = Math.sin(e.walkCycle) * (e.state === 'chase' ? 0.34 : 0.20);
        e.armL.rotation.x = -armSwing;
        e.armR.rotation.x = armSwing;
      }

      // Ground Threat Ring for actively chasing enemies
      if (!e.threatRing && e.type !== 'piorun_dron') {
        const isCoalitionLeader = e.aiCoalitionLeaderId === e.id;
        const isMoraleBroken = (e.aiMoraleBreakTimer ?? 0) > 0;
        const baseRingColor = e.surgeRunner ? 0xf59e0b : e.type === 'pomazaniec' ? 0xec4899 : 0xef4444;
        const ringMesh = new THREE.Mesh(
          new THREE.RingGeometry(0.42, 0.54, 20),
          new THREE.MeshBasicMaterial({
            color: isMoraleBroken ? 0xfb923c : isCoalitionLeader ? 0xfbbf24 : baseRingColor,
            transparent: true,
            opacity: isMoraleBroken ? 0.9 : isCoalitionLeader ? 0.82 : 0.65,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.04;
        ringMesh.userData.coalitionLeader = isCoalitionLeader;
        ringMesh.userData.coalitionMoraleBroken = isMoraleBroken;
        e.threatRing = ringMesh;
        e.mesh.add(ringMesh);
      }
      if (e.threatRing) {
        const isCoalitionLeader = e.aiCoalitionLeaderId === e.id;
        const isMoraleBroken = (e.aiMoraleBreakTimer ?? 0) > 0;
        if (
          e.threatRing.userData.coalitionLeader !== isCoalitionLeader ||
          e.threatRing.userData.coalitionMoraleBroken !== isMoraleBroken
        ) {
          const ringMaterial = e.threatRing.material as THREE.MeshBasicMaterial;
          const baseRingColor = e.surgeRunner ? 0xf59e0b : e.type === 'pomazaniec' ? 0xec4899 : 0xef4444;
          ringMaterial.color.setHex(
            isMoraleBroken ? 0xfb923c : isCoalitionLeader ? 0xfbbf24 : baseRingColor,
          );
          ringMaterial.opacity = isMoraleBroken ? 0.9 : isCoalitionLeader ? 0.82 : 0.65;
          e.threatRing.userData.coalitionLeader = isCoalitionLeader;
          e.threatRing.userData.coalitionMoraleBroken = isMoraleBroken;
        }
        e.threatRing.visible = (e.state === 'chase' || e.state === 'charging') && distToPlayer < 14;
      }

      if (e.stunTimer > 0) {
        // Let the commander inspect the stun before the early return so the
        // player can interrupt a boss order during its visible wind-up.
        if (this.gameMode === 'survival') this.updateSurvivalCommanderPulse(e, dt);
        e.stunTimer -= dt;
        if (e.stunTimer <= 0) {
          e.state = 'searching';
          e.searchTimer = 2.5;
        }
        return;
      }

      if (this.gameMode === 'survival') this.updateSurvivalCommanderPulse(e, dt);

      // Check whether this enemy is allowed to engage or must hold position in wave
      const canActivelyChase = e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow' || e.type === 'pomazaniec' || e.type === 'sebix_m' || !!e.surgeRunner || this.activeChaserIds.has(e.id);

      // SIGHT & DETECTION LOGIC
      const threatAwareness = 1 + this.threatTier * 0.025;
      const detectionRange = e.surgeRunner
        ? 40.0
        : (e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow')
          ? 16.0
          : (e.state === 'chase' ? 12.0 : 8.5) * threatAwareness;
      const canSeePlayer = distToPlayer < detectionRange && canActivelyChase;

      if (canSeePlayer) {
        e.state = 'chase';
        e.lastKnownPlayerPos = { x: this.playerPos.x, z: this.playerPos.z };
        e.searchTimer = 0;
      } else if (e.state === 'chase') {
        e.state = 'searching';
        e.searchTimer = 2.5;
      }

      if (e.state === 'searching' && e.searchTimer !== undefined) {
        e.searchTimer -= dt;
        if (e.searchTimer <= 0) {
          e.state = 'patrol';
          e.lastKnownPlayerPos = null;
        } else if (e.lastKnownPlayerPos) {
          const sdx = e.lastKnownPlayerPos.x - e.x;
          const sdz = e.lastKnownPlayerPos.z - e.z;
          const sdist = Math.hypot(sdx, sdz);
          if (sdist > 0.5) {
            const avoidance = this.gameMode === 'campaign'
              ? calculateEnemyObstacleAvoidanceVector(e, e.lastKnownPlayerPos, this.campaignEnemyObstacles, 3.8, 0.75)
              : { x: 0, z: 0 };
            let searchX = sdx / sdist + avoidance.x * 0.9;
            let searchZ = sdz / sdist + avoidance.z * 0.9;
            const searchLength = Math.hypot(searchX, searchZ) || 1;
            searchX /= searchLength;
            searchZ /= searchLength;
            e.x += searchX * e.speed * 0.7 * dt;
            e.z += searchZ * e.speed * 0.7 * dt;
          }
        }
      }

      // Global Throttled Shout Quotes (max 1 quote at a time across all enemies with 4.0s minimum gap)
      e.shoutTimer = (e.shoutTimer || 0) - dt;
      if (e.shoutTimer <= 0 && distToPlayer < 12.0 && this.globalEnemyShoutCooldown <= 0) {
        e.shoutTimer = 5.0 + Math.random() * 2.4;
        this.globalEnemyShoutCooldown = 3.1;
        const quoteType = e.survivalAuditor ? 'inspector' : e.type;
        const quotes = PaleciakiGameEngine.ENEMY_QUOTES[quoteType] || ["Z drogi!"];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        e.shoutText = quote;
        this.emitFloatingToast(quote, e.x, e.y + 1.25, e.z, 'enemy_shout', { enemyType: quoteType, enemyName: e.name });
      }

      // Special movement per type
      if (e.type === 'piorun_dron') {
        if (e.legL) e.legL.rotation.y += dt * 30;
        if (e.legR) e.legR.rotation.y += dt * 30;
        if (e.armL) e.armL.rotation.y += dt * 30;
        if (e.armR) e.armR.rotation.y += dt * 30;

        e.x += e.speed * e.dir * dt;
        if (e.dir > 0 && e.x >= e.endX) {
          e.dir = -1;
        } else if (e.dir < 0 && e.x <= e.startX) {
          e.dir = 1;
        }
        e.mesh.position.set(e.x, e.y + Math.sin(performance.now() * 0.005) * 0.12, e.z);
      } else if (e.type === 'walczak') {
        // Boss AI: Walczak
        const isPhase2 = e.hp <= e.maxHp * 0.5;
        if (isPhase2 && e.bossPhase !== 2) {
          e.bossPhase = 2;
          e.speed *= 1.45;
          sound.playSirens();
          this.triggerScreenShake(0.8, 1.0);
          const bossTitle = e.name.includes('Inwentaryzacja Gigant')
            ? 'INWENTARYZACJA GIGANT'
            : e.survivalAuditor ? 'AUDYTOR' : 'NADZORCA ZERO';
          this.emitFloatingToast('🚨 ' + bossTitle + ': TRYB SZAŁU (FAZA 2)!', e.x, e.y + 1.8, e.z, 'damage');
        }

        const isChargingImpact = e.name.includes('Inwentaryzacja Gigant') && e.chargeTimer !== undefined;
        if (isChargingImpact) {
          // Hold the boss at the marked impact point until the warning resolves.
          e.mesh.rotation.y = Math.atan2(dx, dz);
        } else if (distToPlayer < 14.0) {
          const angle = Math.atan2(dx, dz);
          e.mesh.rotation.y = angle;
          if (this.gameMode === 'survival') {
            const side = e.aiOrbitSign || 1;
            const invDist = 1 / Math.max(0.1, distToPlayer);
            e.x += ((dx * invDist) * 0.72 + (dz * invDist) * 0.46 * side) * e.speed * dt;
            e.z += ((dz * invDist) * 0.72 - (dx * invDist) * 0.46 * side) * e.speed * dt;
          } else {
            const avoidance = calculateEnemyObstacleAvoidanceVector(
              e,
              { x: this.playerPos.x, z: this.playerPos.z },
              this.campaignEnemyObstacles,
              5.4,
              1.25,
            );
            let bossMoveX = dx / Math.max(0.1, distToPlayer) + avoidance.x * 1.0;
            let bossMoveZ = dz / Math.max(0.1, distToPlayer) + avoidance.z * 1.0;
            const bossMoveLength = Math.hypot(bossMoveX, bossMoveZ) || 1;
            bossMoveX /= bossMoveLength;
            bossMoveZ /= bossMoveLength;
            e.x += bossMoveX * e.speed * 0.95 * dt;
            e.z += bossMoveZ * e.speed * 0.95 * dt;
          }
        } else {
          e.x += e.speed * e.dir * dt;
          if (e.dir > 0 && e.x >= e.endX) {
            e.dir = -1;
            e.mesh.rotation.y = Math.PI / 2;
          } else if (e.dir < 0 && e.x <= e.startX) {
            e.dir = 1;
            e.mesh.rotation.y = -Math.PI / 2;
          }
        }
        e.mesh.position.set(e.x, e.y, e.z);

        if (e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          const cooldown = isPhase2 ? 1.8 : 3.0;
          if (e.specialActionTimer <= 0) {
            if (e.name.includes('Inwentaryzacja Gigant')) {
              if (e.chargeTimer === undefined) {
                e.chargeTimer = 0.88;
                this.spawnBossImpactTelegraph(e.x, e.z, 8.7, 0xef4444, 0.88);
                this.spawnParticleRing(e.x, 0.16, e.z, 0xef4444);
                this.emitFloatingToast('⚠️ INWENTARYZACJA GIGANT — UDERZENIE ZA CHWILĘ!', e.x, e.y + 1.8, e.z, 'damage');
                sound.playBossWarning();
              } else {
                e.chargeTimer -= dt;
                if (e.chargeTimer <= 0) {
                  e.chargeTimer = undefined;
                  e.specialActionTimer = cooldown + 0.7;
                  this.triggerScreenShake(0.78, 0.48);
                  this.triggerHitStop(0.09);
                  this.triggerBloomPulse(0.52);
                  this.spawnParticleRing(e.x, 0.2, e.z, 0xf97316);
                  this.spawnExplosionParticles(e.x, 0.55, e.z, 0xfbbf24, 24);
                  if (isWithinBossImpactRadius(this.playerPos.x, this.playerPos.z, e.x, e.z, 8.7)) {
                    this.takeDamage('💥 FALA UDERZENIOWA INWENTARYZACJI GIGANT!');
                  }
                  else this.emitFloatingToast('💨 FALA UDERZENIOWA MINĘŁA!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'perk');
                }
              }
            } else {
              e.specialActionTimer = cooldown;
              this.spawnPenaltyNotice(e.x, e.y + 1.2, e.z);
            }
          }
        }
        this.callbacks.onBossUpdate?.(e.name, e.hp, e.maxHp, true, e.bossPhase);
      } else if (e.type === 'krol_leto') {
        // Boss AI: Król-Leto
        const isPhase2 = e.hp <= e.maxHp * 0.5;
        if (isPhase2 && e.bossPhase !== 2) {
          e.bossPhase = 2;
          e.speed *= 1.5;
          sound.playEvilLaugh();
          this.triggerScreenShake(1.2, 1.5);
          this.emitFloatingToast('🔥 DYREKTOR WIDMO: OSTATECZNE ZWOLNIENIE!', e.x, e.y + 1.8, e.z, 'damage');
        }

        if (e.chargeTimer !== undefined) {
          // Keep the boss aligned with the committed lane while the warning is visible.
          e.mesh.rotation.y = e.chargeDir ?? Math.atan2(dx, dz);
        } else if (distToPlayer < 15.0) {
          const angle = Math.atan2(dx, dz);
          e.mesh.rotation.y = angle;
          if (this.gameMode === 'survival') {
            const side = e.aiOrbitSign || -1;
            const invDist = 1 / Math.max(0.1, distToPlayer);
            e.x += ((dx * invDist) * 0.68 + (dz * invDist) * 0.52 * side) * e.speed * dt;
            e.z += ((dz * invDist) * 0.68 - (dx * invDist) * 0.52 * side) * e.speed * dt;
          } else {
            const avoidance = calculateEnemyObstacleAvoidanceVector(
              e,
              { x: this.playerPos.x, z: this.playerPos.z },
              this.campaignEnemyObstacles,
              5.8,
              1.35,
            );
            let bossMoveX = dx / Math.max(0.1, distToPlayer) + avoidance.x * 1.0;
            let bossMoveZ = dz / Math.max(0.1, distToPlayer) + avoidance.z * 1.0;
            const bossMoveLength = Math.hypot(bossMoveX, bossMoveZ) || 1;
            bossMoveX /= bossMoveLength;
            bossMoveZ /= bossMoveLength;
            e.x += bossMoveX * e.speed * 1.05 * dt;
            e.z += bossMoveZ * e.speed * 1.05 * dt;
          }
          if (isPhase2 && Math.random() < 0.05) this.triggerScreenShake(0.1, 0.2);
        } else if (e.state === 'searching' && e.lastKnownPlayerPos) {
          const angle = Math.atan2(e.lastKnownPlayerPos.x - e.x, e.lastKnownPlayerPos.z - e.z);
          e.mesh.rotation.y = angle;
        } else {
          e.x += e.speed * e.dir * dt;
          if (e.dir > 0 && e.x >= e.endX) {
            e.dir = -1;
            e.mesh.rotation.y = Math.PI / 2;
          } else if (e.dir < 0 && e.x <= e.startX) {
            e.dir = 1;
            e.mesh.rotation.y = -Math.PI / 2;
          }
        }
        e.mesh.position.set(e.x, e.y, e.z);

        if (e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          const cooldown = isPhase2 ? 2.7 : 3.8;
          if (e.chargeTimer !== undefined) {
            e.chargeTimer = Math.max(0, e.chargeTimer - dt);
            if (e.chargeTimer <= 0) {
              const lockedDirection = e.chargeDir ?? Math.atan2(dx, dz);
              e.chargeTimer = undefined;
              e.chargeDir = undefined;
              e.specialActionTimer = cooldown;
              this.spawnDyscyplinarkaNotice(e.x, e.y + 1.2, e.z, lockedDirection);
              this.emitFloatingToast('⚖️ WYROK WYSTRZELONY — UNIKAJ LINII!', e.x, e.y + 1.5, e.z, 'damage');
            }
          } else if (e.specialActionTimer <= 0 && distToPlayer < 12.0) {
            e.chargeTimer = 0.68;
            e.chargeDir = Math.atan2(dx, dz);
            this.spawnBossLaneTelegraph(e.x, e.z, e.chargeDir, 13.5, 2.2, isPhase2 ? 0xf97316 : 0xef4444, 0.68, e);
            this.emitFloatingToast('🚨 DYSCYPLINARKA — ZEJDŹ Z ZAZNACZONEJ LINII!', e.x, e.y + 1.5, e.z, 'damage');
            sound.playBossWarning();
            this.triggerScreenShake(0.12, 0.12);
          }
        }
        this.callbacks.onBossUpdate?.(e.name, e.hp, e.maxHp, true, e.bossPhase);
      } else {
        if (e.type === 'sebix_m') {
          this.updateSebixBehaviour(e,dt,distToPlayer,dx,dz);
        } else if (e.type === 'bosman_krakow' && e.chargeTimer !== undefined) {
          e.mesh.rotation.y = e.chargeDir ?? Math.atan2(dx, dz);
        } else if (this.gameMode === 'survival') {
          this.updateSurvivalEnemyTactics(e, dt, distToPlayer);
        } else {
          // Dynamic Chase / Tracking AI for ground enemies
          const chaseRadius =
            e.type === 'zombie_pracownik'
              ? 18.0
              : e.type === 'kurier'
                ? 14.0
                : e.type === 'sztaplar_szalony'
                  ? 12.0
                  : 10.0;
  
          if (distToPlayer < chaseRadius) {
            if (e.state === 'patrol' && !e.alerted) {
              e.alerted = true;
              this.emitFloatingToast(e.type === 'zombie_pracownik' ? '⚡!' : '!', e.x, e.y + 1.35, e.z, 'damage');
              sound.playAlert();
            }
            e.state = 'chase';
            const angle = Math.atan2(dx, dz);
            e.mesh.rotation.y = angle;
  
            const chaseSpeed =
              e.speed *
              (e.type === 'zombie_pracownik'
                ? 1.42
                : e.type === 'kurier'
                  ? 1.35
                  : 1.2) *
              (1 + this.threatTier * 0.04);
            // Keep campaign enemies from converging on a single point. This
            // separation is also applied to coincident actors, so low-FPS frames
            // or simultaneous spawns cannot leave a permanent enemy stack.
            const nearbyCampaignEnemies = this.enemySpatialIndex.query(e.x, e.z, 4.0);
            const separation = calculateEnemySeparationVector(e, nearbyCampaignEnemies, 2.5);
            const avoidance = calculateEnemyObstacleAvoidanceVector(
              e,
              { x: this.playerPos.x, z: this.playerPos.z },
              this.campaignEnemyObstacles,
              4.6,
              0.8,
            );
            let moveX = dx / Math.max(0.1, distToPlayer) + separation.x * 1.2 + avoidance.x * 1.05;
            let moveZ = dz / Math.max(0.1, distToPlayer) + separation.z * 1.2 + avoidance.z * 1.05;
            const moveLength = Math.hypot(moveX, moveZ) || 1;
            moveX /= moveLength;
            moveZ /= moveLength;
            e.x += moveX * chaseSpeed * dt;
            e.z += moveZ * chaseSpeed * dt;
          } else {
            e.alerted = false;
            e.state = 'patrol';
            e.z += e.speed * e.dir * dt;
            if (e.dir > 0 && e.z >= e.endX) {
              e.dir = -1;
              e.mesh.rotation.y = Math.PI;
            } else if (e.dir < 0 && e.z <= e.startX) {
              e.dir = 1;
              e.mesh.rotation.y = 0;
            }
          }
          e.mesh.position.set(e.x, e.y, e.z);
  
  
        }

        // The Sentinel commits to a visible lane before firing. The emitter holds still
        // through the wind-up so the telegraph and the eventual projectile stay aligned.
        if (this.gameMode === 'survival' && e.name.includes('AGV-9 SENTINEL') && e.specialActionTimer !== undefined) {
          if (e.specialActionTimer > 0) {
            e.specialActionTimer -= dt * survivalAbilityRate;
          } else if (distToPlayer < 15.0) {
            if (e.chargeTimer === undefined) {
              e.chargeTimer = 0.9;
              e.chargeDir = Math.atan2(dx, dz);
              this.spawnBossLaneTelegraph(e.x, e.z, e.chargeDir, 14.0, 1.8, 0xef4444, 0.9, e);
              this.spawnParticleRing(e.x, 0.24, e.z, 0xef4444);
              this.emitFloatingToast('AGV-9: ŁADOWANIE IMPULSU — ZEJDŹ Z LINII!', e.x, e.y + 1.2, e.z, 'damage');
              sound.playBossWarning();
            } else {
              e.chargeTimer -= dt;
              if (e.chargeTimer <= 0) {
                const lockedDirection = e.chargeDir;
                this.spawnSparkZapProjectile(e.x, e.y + 0.75, e.z, lockedDirection);
                this.emitFloatingToast('⚡ AGV-9: IMPULS OCHRONY!', e.x, e.y + 1.3, e.z, 'damage');
                e.specialActionTimer = 6.4;
                e.chargeTimer = undefined;
                e.chargeDir = undefined;
              }
            }
          }
        }

        // The tiny riders keep their distance and throw visible, arcing lollipops.
        if (e.type === 'pomazaniec' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 13.0) {
            e.specialActionTimer = 4.35 + Math.random() * 1.25;
            e.mesh.rotation.y = Math.atan2(dx, dz);
            e.mesh.rotation.x = -0.08;
            this.spawnPomazaniecLollipop(e.x, e.y + 1.03, e.z, this.playerPos.x, this.playerPos.z, e.aiSlot || 0);
          }
        } else if ((e.type === 'handlowiec' || e.type === 'przedstawiciel_włoski') && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 9.0) {
            e.specialActionTimer = 2.8;
            this.spawnPenaltyNotice(e.x, e.y + 0.8, e.z);
            const msg = e.type === 'przedstawiciel_włoski' ? '🇮🇹 ARMATURA DE LUX!' : '📑 OFERTA RABATOWA!';
            this.emitFloatingToast(msg, e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'inspector' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 6.5) {
            e.specialActionTimer = 2.8;
            sound.playWhistle();
            this.emitFloatingToast('🚨 KONTROLA BHP!', e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'pan_roman' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 10.0) {
            e.specialActionTimer = 2.5;
            this.spawnSanitarywareProjectile(e.x, e.y + 0.8, e.z);
            this.emitFloatingToast('📦 UMYWALKA W DRODZE!', e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'serwisant' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 8.5) {
            e.specialActionTimer = 2.2;
            this.spawnSparkZapProjectile(e.x, e.y + 0.8, e.z);
            this.emitFloatingToast('⚡ ISKRA SERWISU!', e.x, e.y + 1.2, e.z, 'damage');
          }
        } else if (e.type === 'mutant_gamma_forklift' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0) {
            e.specialActionTimer = 2.8;
            this.spawnParticleRing(e.x, 0.15, e.z, 0x4ade80);
            this.emitFloatingToast('☣️ SKAŻENIE GAMMA!', e.x, e.y + 1.2, e.z, 'damage');
            sound.playElectricalSparks();
          }
        } else if (e.type === 'radioactive_pip' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 9.5) {
            e.specialActionTimer = 3.4;
            this.spawnParticleRing(e.x, 0.25, e.z, 0x84cc16);
            this.emitFloatingToast('☢️ PROTOKÓŁ SKAŻENIA PIP!', e.x, e.y + 1.2, e.z, 'damage');
            sound.playSirens();
          }
        } else if (e.type === 'cyber_salesman' && e.specialActionTimer !== undefined) {
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.specialActionTimer <= 0 && distToPlayer < 10.0) {
            e.specialActionTimer = 2.4;
            this.spawnPenaltyNotice(e.x, e.y + 0.8, e.z);
            this.emitFloatingToast('💻 CYBER-KATALOG 3.0!', e.x, e.y + 1.2, e.z, 'damage');
            sound.playAttackWhoosh();
          }
        } else if (e.type === 'bosman_krakow' && e.specialActionTimer !== undefined) {
          const isPhase2 = e.hp <= e.maxHp * 0.5;
          if (isPhase2 && e.bossPhase !== 2) {
            e.bossPhase = 2;
            e.speed *= 1.18;
            this.triggerScreenShake(0.28, 0.18);
            sound.playBossWarning();
            this.emitFloatingToast('📋 BOSMAN: ODPRAWA PRZYSPIESZONA — FAZA 2!', e.x, e.y + 1.6, e.z, 'damage');
          }
          e.specialActionTimer -= dt * survivalAbilityRate;
          if (e.chargeTimer !== undefined) {
            e.chargeTimer = Math.max(0, e.chargeTimer - dt);
            if (e.chargeTimer <= 0) {
              const lockedDirection = e.chargeDir;
              e.chargeTimer = undefined;
              e.chargeDir = undefined;
              e.specialActionTimer = isPhase2 ? 1.85 : 2.4;
              this.spawnOdprawaClipboardProjectile(e.x, e.y + 1.0, e.z, lockedDirection);
              this.emitFloatingToast('📋 ODPRAWA WYSTRZELONA — ZMIANA LINII!', e.x, e.y + 1.4, e.z, 'damage');
            }
          } else if (e.specialActionTimer <= 0 && distToPlayer < 12.0) {
            const direction = Math.atan2(dx, dz);
            const warningDuration = isPhase2 ? 0.58 : 0.78;
            e.chargeTimer = warningDuration;
            e.chargeDir = direction;
            e.mesh.rotation.y = direction;
            this.spawnBossLaneTelegraph(e.x, e.z, direction, isPhase2 ? 14.0 : 11.5, isPhase2 ? 3.0 : 2.35, isPhase2 ? 0xf97316 : 0xf59e0b, warningDuration, e);
            this.emitFloatingToast(isPhase2 ? '🚨 BOSMAN: ODPRAWA PREMIUM — ZEJDŹ Z LINII!' : '🚨 BOSMAN: ODPRAWA ZA CHWILĘ — ZEJDŹ Z LINII!', e.x, e.y + 1.4, e.z, 'damage');
            sound.playBossWarning();
          }
        }
      }

      // One final guard after every archetype-specific movement path. Several
      // bosses and special enemies move directly (dash/chase), bypassing patrol
      // bounds; keep the rendered mesh and hit-test position in sync.
      this.clampEnemyToArena(e);

      // Check collision with player
      const dist = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
      if (e.type === 'pomazaniec') {
        e.mesh.position.y = e.y + Math.sin(e.walkCycle * 1.65) * 0.025;
        e.mesh.rotation.z = Math.sin(e.walkCycle * 1.1) * 0.018;
      }
      const hitRadius = e.type === 'sebix_m' ? (e.dashTimer && e.dashTimer > 0 ? 1.85 : 1.35) : isMajorSurvivalBossType(e.type) ? 1.5 : e.type === 'elite_walczak_guard' ? 1.3 : 1.1;
      const contactRadius = hitRadius + 0.18;
      let stompedThisFrame = false;

      if (dist < contactRadius) {
        // 1. STOMP MECHANIC (Naskok z góry). Preserve the original stomp radius;
        // the slightly wider contact radius only compensates for model clearance.
        if (dist < hitRadius && this.playerVel.y < -0.8 && this.playerPos.y > e.y + 0.35) {
          stompedThisFrame = true;
          const bounceForce = e.type === 'agv_robot' ? this.charDef.jumpForce * 1.3 : this.charDef.jumpForce * 0.95;
          this.playerVel.y = bounceForce;
          sound.playBounce();
          this.cameraShake = 0.35;
          this.spawnParticleRing(e.x, e.y + 0.8, e.z, 0x38bdf8);

          this.damageEnemy(e, this.scaleSurvivalDamage(2));
          this.emitFloatingToast('💥 STOMP! +150', e.x, e.y + 1.2, e.z, 'points');
          this.emitFloatingToast('-2 HP', e.x, e.y + 0.7, e.z, 'damage');

          if (e.hp <= 0) {
            this.defeatEnemy(e, 260, true);
          } else {
            e.stunTimer = 1.0;
            e.state = 'stunned';
          }
        } else if (Math.abs(e.y - this.playerPos.y) < 1.1) {
          // Horizontal Contact
          if ((this.activePerks.bulldozer || 0) > 0) {
            const nowMs = performance.now();
            const lastHit = this.bulldozerHitCooldowns.get(e.id) || 0;
            if (nowMs - lastHit > 550) {
              this.bulldozerHitCooldowns.set(e.id, nowMs);
              this.damageEnemy(e, this.scaleSurvivalDamage(3));
              e.stunTimer = 2.2;
              e.state = 'stunned';
              sound.playSmack();
              this.triggerScreenShake(0.45, 0.25);
              this.spawnParticleRing(e.x, e.y + 0.8, e.z, 0xfacc15);
              this.emitFloatingToast('🚜 TARAN PALECIAKIEM! -3 HP!', e.x, e.y + 1.2, e.z, 'combo');
              if (e.hp <= 0) this.defeatEnemy(e, 300, true);
            }
          } else if (this.marcinReclamationTimer > 0) {
            e.stunTimer = 2.5;
            e.state = 'stunned';
            this.emitFloatingToast('🛡️ AUDYT BHP!', e.x, e.y + 1, e.z, 'perk');
          } else if (this.grzesiekCrushTimer > 0) {
            this.damageEnemy(e, this.scaleSurvivalDamage(3));
            this.emitFloatingToast('-3 HP ŚCISK!', e.x, e.y + 1, e.z, 'damage');
            if (e.hp <= 0) this.defeatEnemy(e, 280, true);
          } else if (e.type === 'krol_leto') {
            if (this.activePerks.shield) {
              this.activePerks.shield = false;
              this.invulnerableTimer = 1.2;
              sound.playShieldBreak();
              this.sayQuote('Kask BHP zamortyzował atak Dyrektora Widmo!');
            } else {
              this.takeDamage('🚨 ZWOLNIENIE DYSCYPLINARNE NA HITA OD DYREKTORA WIDMO!');
            }
          } else {
            this.takeDamage(`Zaatakował Cię: ${e.name}!`);
          }
        }
      }

      // Contact damage uses the small model-clearance margin above, so enemies
      // can still hit without entering the player's visible body footprint.
      // The stomp keeps its original tighter radius and is intentionally exempt.
      if (!stompedThisFrame) {
        // The resolver itself ignores defeated actors; keep this call independent
        // of TypeScript's earlier per-enemy state narrowing.
        this.resolveEnemyPlayerOverlap(e, contactRadius);
      }
    });
  }

  private spawnPenaltyNotice(x: number, y: number, z: number) {
    const mesh = createPenaltyNoticeProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, disposeOnRemove: true, vel: dir.multiplyScalar(7.5), life: 3.5 });
    sound.playWhistle();
  }

  private spawnDyscyplinarkaNotice(x: number, y: number, z: number, lockedDirection?: number) {
    const mesh = createPenaltyNoticeProjectile();
    mesh.scale.setScalar(1.6);
    (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xef4444);
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = Number.isFinite(lockedDirection)
      ? new THREE.Vector3(Math.sin(lockedDirection as number), 0, Math.cos(lockedDirection as number))
      : new THREE.Vector3(this.playerPos.x - x, 0, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, disposeOnRemove: true, vel: dir.multiplyScalar(10.0), life: 3.5, isDyscyplinarka: true });
    sound.playWhistle();
  }

  private spawnSanitarywareProjectile(x: number, y: number, z: number) {
    const mesh = createSanitarywareProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = new THREE.Vector3(this.playerPos.x - x, 0.2, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, disposeOnRemove: true, vel: dir.multiplyScalar(8.2), life: 3.5 });
    sound.playWoosh();
  }

  private spawnSparkZapProjectile(x: number, y: number, z: number, lockedDirection?: number) {
    const mesh = createSparkZapProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = Number.isFinite(lockedDirection)
      ? new THREE.Vector3(Math.sin(lockedDirection as number), 0.1, Math.cos(lockedDirection as number))
      : new THREE.Vector3(this.playerPos.x - x, 0.1, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, disposeOnRemove: true, vel: dir.normalize().multiplyScalar(9.5), life: 3.0 });
    sound.playElectricalSparks();
  }

  private spawnOdprawaClipboardProjectile(x: number, y: number, z: number, lockedDirection?: number) {
    const mesh = createOdprawaClipboardProjectile();
    mesh.position.set(x, y, z);
    this.levelRoot.add(mesh);
    const dir = Number.isFinite(lockedDirection)
      ? new THREE.Vector3(Math.sin(lockedDirection as number), 0.1, Math.cos(lockedDirection as number))
      : new THREE.Vector3(this.playerPos.x - x, 0.1, this.playerPos.z - z).normalize();
    this.enemyProjectiles.push({ mesh, disposeOnRemove: true, vel: dir.normalize().multiplyScalar(10.0), life: 4.0, isDyscyplinarka: true });
    sound.playWhistle();
    this.triggerScreenShake(0.4, 0.3);
  }

  private spawnFallingTileHazard(x: number, z: number, targetY = 0) {
    const tileMesh = createLargeTileModel();
    tileMesh.position.set(x, 12, z);
    tileMesh.rotation.x = 0.2;
    tileMesh.rotation.z = -0.35;
    this.levelRoot.add(tileMesh);

    // Red warning circle/ring indicator on ground
    const ringGeo = new THREE.RingGeometry(0.2, 1.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const warningRing = new THREE.Mesh(ringGeo, ringMat);
    warningRing.rotation.x = -Math.PI / 2;
    warningRing.position.set(x, targetY + 0.02, z);
    this.levelRoot.add(warningRing);

    sound.playSirenAlert();
    this.emitFloatingToast('⚠️ UWAGA! SPADAJĄCY GRES 120x280!', x, targetY + 1.5, z, 'damage');

    this.fallingTiles.push({
      id: `tile_${Date.now()}_${Math.random()}`,
      x,
      y: 12,
      z,
      targetY,
      fallSpeed: 0,
      state: 'warning',
      warningTimer: 1.1,
      mesh: tileMesh,
      warningRing,
    });
  }

  private updateFallingTiles(dt: number) {
    // Periodically auto-spawn falling tile hazards near player in active game
    this.fallingTileSpawnTimer += dt;
    if (this.fallingTileSpawnTimer >= 8.5) {
      this.fallingTileSpawnTimer = 0;
      // Spawn near player offset
      const offsetX = (Math.random() - 0.5) * 12;
      const offsetZ = (Math.random() - 0.5) * 8;
      const spawnX = Math.max(this.levelBounds.minX + 4, Math.min(this.levelBounds.maxX - 4, this.playerPos.x + offsetX));
      const spawnZ = Math.max(this.levelBounds.minZ + 2, Math.min(this.levelBounds.maxZ - 2, this.playerPos.z + offsetZ));
      this.spawnFallingTileHazard(spawnX, spawnZ, 0);
    }

    for (let i = this.fallingTiles.length - 1; i >= 0; i--) {
      const tile = this.fallingTiles[i];
      if (tile.state === 'warning') {
        tile.warningTimer -= dt;
        // Pulse warning ring scale and opacity
        const scale = 1 + Math.sin(tile.warningTimer * 20) * 0.15;
        tile.warningRing.scale.set(scale, scale, 1);
        (tile.warningRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(tile.warningTimer * 25) * 0.35;

        if (tile.warningTimer <= 0) {
          tile.state = 'falling';
        }
      } else if (tile.state === 'falling') {
        tile.fallSpeed += 28 * dt; // Gravity acceleration
        tile.y -= tile.fallSpeed * dt;
        tile.mesh.position.y = tile.y;
        tile.mesh.rotation.x += dt * 3.0;
        tile.mesh.rotation.y += dt * 4.0;

        if (tile.y <= tile.targetY + 0.1) {
          // Impact!
          tile.state = 'shattered';
          this.levelRoot.remove(tile.mesh);
          this.levelRoot.remove(tile.warningRing);
          this.disposeTemporaryObject(tile.mesh);
          this.disposeTemporaryObject(tile.warningRing);
          this.fallingTiles.splice(i, 1);

          // Explosion sound & screen shake
          sound.playExplosion();
          this.triggerScreenShake(0.6, 0.4);

          // Glass / Tile Shatter Particles
          this.spawnExplosionParticles(tile.x, tile.targetY + 0.3, tile.z, 0xf3f4f6, 28);
          this.spawnParticleRing(tile.x, tile.targetY + 0.1, tile.z, 0xd97706);

          // AoE Damage to Player
          const playerDist = Math.hypot(this.playerPos.x - tile.x, this.playerPos.z - tile.z);
          if (playerDist < 2.2 && Math.abs(this.playerPos.y - tile.targetY) < 1.5) {
            this.takeDamage('Spadający Wielki Format Gresu Marmur B4 120x280!');
          }

          // Damage or stun nearby enemies
          for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            const enemyDist = Math.hypot(enemy.x - tile.x, enemy.z - tile.z);
            if (enemyDist < 2.5) {
              this.damageEnemy(enemy, 3, tile.x, tile.z);
              enemy.stunTimer = 2.5;
              this.emitFloatingToast('💥 TILE CRASH! -3 HP', enemy.x, enemy.y + 1.2, enemy.z, 'damage');
              if (enemy.hp <= 0) {
                this.defeatEnemy(enemy, 260, true);
              }
            }
          }
        }
      }
    }
  }

  private updateRandomSpawners(dt: number) {
    const interval = this.gameMode === 'survival' ? 24.0 : 18.0;
    this.randomSpawnTimer += dt;
    if (this.randomSpawnTimer < interval) return;
    this.randomSpawnTimer = 0;

    // Build one shared occupancy snapshot so rewards do not appear inside an
    // enemy, another pickup, or a warehouse obstacle.
    const occupied = [
      ...this.enemies.filter((enemy) => enemy.state !== 'defeated'),
      ...this.collectibles.filter((item) => !item.collected),
      ...this.droppedPerks.filter((item) => !item.collected),
      ...this.survivalXpGems.map((gem, index) => ({
        id: 'xp-gem-' + index,
        x: gem.mesh.position.x,
        z: gem.mesh.position.z,
      })),
    ];
    const rewardPoint = this.gameMode === 'campaign'
      ? chooseCampaignNearbyRewardSpawnPoint(
        this.currentActiveSector,
        this.playerPos,
        Math.random(),
        Math.random(),
        this.campaignEnemyObstacles,
        occupied,
        { minimumPlayerDistance: 5.0, maximumPlayerDistance: 11.5, minimumOccupiedDistance: 2.8 },
      )
      : chooseNearbySpawnPoint(
        this.playerPos,
        this.levelBounds,
        this.survivalObstacles,
        occupied,
        Math.random(),
        Math.random(),
        { minimumPlayerDistance: 5.5, maximumPlayerDistance: 10.5, minimumOccupiedDistance: 2.8 },
      );

    if (!rewardPoint) {
      // A crowded/blocked arena should delay a find, not force it into scenery.
      this.randomSpawnTimer = interval - 5.0;
      return;
    }

    const rx = rewardPoint.x;
    const rz = rewardPoint.z;
    const id = 'rand_pickup_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const rewardRoll = Math.random();
    if (rewardRoll < 0.28) {
      this.addEspressoItem('rand_esp_' + id, rx, 0.4, rz);
      this.emitFloatingToast('DOKIEROWANE ESPRESSO Z AUTOMATU!', rx, 1.2, rz, 'perk');
    } else if (rewardRoll < 0.48) {
      this.addMagnetItem('rand_magnet_' + id, rx, 0.42, rz);
      this.emitFloatingToast('SKANER RADIOWY — ZNAJDŹKA!', rx, 1.2, rz, 'perk');
    } else if (rewardRoll < 0.66) {
      this.addGroutItem('rand_grout_' + id, rx, 0.6, rz, 140);
      this.emitFloatingToast('RZADKA PUSZKA FUGI B4!', rx, 1.2, rz, 'points');
    } else if (rewardRoll < 0.84) {
      this.addKfcBucketItem('rand_kfc_' + id, rx, 0.45, rz);
      this.emitFloatingToast('KUBEŁEK MOCY POJAWIŁ SIĘ NA HALI!', rx, 1.25, rz, 'perk');
    } else {
      this.spawnDroppedPerk(rx, 0.5, rz);
    }
  }

  public triggerTimedWarehouseEvent(forcedIndex?: number) {
    if (this.state !== 'playing' || this.gameMode === 'survival') return;
    const eventIdx = forcedIndex !== undefined ? forcedIndex : this.timedEventIndex % 5;
    this.timedEventIndex++;
    this.timedEventCooldown = 42.0;

    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    if (eventIdx === 0) {
      // EVENT 1: DOSTAWA ENERGETYCZNYCH ZAPASÓW! FALA GŁODNYCH ZOMBIE!
      sound.playSirenAlert();
      this.triggerScreenShake(0.75, 0.7);
      this.callbacks.onPerkDropBanner?.(
        '⚡ DOSTAWA ENERGETYCZNYCH ZAPASÓW!',
        '🧟‍♂️',
        'Fala magazynierów-zombie szarżuje po zapasy! Zbierz pakiet pierwszy (+2 Kawy i Furia 2x Obrażeń)!',
        '#ef4444'
      );
      this.sayQuote('DOSTAWA PRZYWIÓZŁA ZAPASY ENERGII! Cała zmiana biegnie jak horda zombie — zbierz pakiet, zanim zniknie!');

      // Drop 2 energy packs + 1 power-up crate around the player
      this.addKfcBucketItem(`event_kfc_${Date.now()}_1`, px + 4.5, 0.45, THREE.MathUtils.clamp(pz - 2.2, -14, 14));
      this.addKfcBucketItem(`event_kfc_${Date.now()}_2`, px + 6.5, 0.45, THREE.MathUtils.clamp(pz + 2.2, -14, 14));
      this.spawnDroppedPerk(px + 2.8, 0.5, pz, 'kfc_bucket');

      // Spawn a charging horde of 5 hungry zombie warehouse workers around the player
      const offsets = [
        { dx: 11, dz: -4.5 },
        { dx: 12.5, dz: -1.5 },
        { dx: 13.5, dz: 1.8 },
        { dx: 11.5, dz: 4.5 },
        { dx: -10.5, dz: 0 },
      ];
      offsets.forEach((off, idx) => {
        const zx = THREE.MathUtils.clamp(px + off.dx, this.levelBounds.minX + 3, this.levelBounds.maxX - 3);
        const zz = THREE.MathUtils.clamp(pz + off.dz, -14, 14);
        this.addZombieWorkerEnemy(`zombie_wave_${Date.now()}_${idx}`, zx, zz - 5, zz + 5, 'Zombie-Magazynier (Zapas Energii!)');
      });
    } else if (eventIdx === 1) {
      // EVENT 2: SZARŻA SZALONYCH SZTAPLAREK & ZŁOTY PALECIAK!
      sound.playSirenAlert();
      this.triggerScreenShake(0.8, 0.6);
      this.callbacks.onPerkDropBanner?.(
        '🚜 EVENT: SZARŻA SZTAPLAREK B4!',
        '⚡',
        'Sztaplarz Turbo spuścił wózki ze smyczy! Złap Złoty Paleciak Turbo i taranuj wszystko na drodze!',
        '#eab308'
      );
      this.sayQuote('UWAGA NA KORYTARZ! Szarża sztaplarek! Łap Złoty Paleciak i jedziesz z nimi jak taran!');
      this.spawnDroppedPerk(px + 3.2, 0.5, pz - 1.5, 'golden_paleciak');
      this.spawnDroppedPerk(px + 3.2, 0.5, pz + 1.5, 'stretch_armor');
      this.addSztaplarEnemy(`event_sztaplar_${Date.now()}_1`, px + 12, Math.max(-14, pz - 5), Math.min(14, pz + 5), 'Szalony Rajdowiec Paleciaka');
      this.addSztaplarEnemy(`event_sztaplar_${Date.now()}_2`, px - 11, Math.max(-14, pz - 5), Math.min(14, pz + 5), 'Driftujący Sztaplarz B4');
    } else if (eventIdx === 2) {
      // EVENT 3: NALOT INSPEKCJI BHP & DESZCZ GRESU 120x280!
      sound.playSirenAlert();
      this.triggerScreenShake(0.7, 0.6);
      this.callbacks.onPerkDropBanner?.(
        '🚨 EVENT: NALOT INSPEKCJI BHP & DESZCZ GRESU!',
        '⛑️',
        'Z sufitu lecą płyty Marmur B4 120x280! Zbierz Atestowany Kask BHP oraz Podwójne Espresso!',
        '#38bdf8'
      );
      this.sayQuote('NALOT INSPEKCJI BHP! Z góry sypie się wielki format 120x280 – zakładaj kask!');
      this.spawnDroppedPerk(px + 2.5, 0.5, pz, 'hardhat');
      this.spawnDroppedPerk(px + 4.5, 0.5, pz + 2.0, 'espresso_boost');
      for (let i = 0; i < 4; i++) {
        const tx = THREE.MathUtils.clamp(px + (i - 1.5) * 4.5, this.levelBounds.minX + 4, this.levelBounds.maxX - 4);
        const tz = THREE.MathUtils.clamp(pz + (Math.random() - 0.5) * 7, -12, 12);
        this.spawnFallingTileHazard(tx, tz, 0);
      }
      this.addInspectorEnemy(`event_insp_${Date.now()}`, px + 11, Math.max(-12, pz - 5), Math.min(12, pz + 5), 'Komisarz Lotnej Brygady BHP');
    } else if (eventIdx === 3) {
      // EVENT 4: BLACK FRIDAY -80% NA WANNY & PODWÓJNE PUNKTY!
      sound.playPickup(3);
      this.doublePointsTimer = 16.0;
      this.callbacks.onPerkDropBanner?.(
        '💸 PROMOCJA -80% NA WANNY! 2X PUNKTY (16s)!',
        '🛁',
        'Szturm klientów i architektów na salon! Wszystkie punkty x2 oraz deszcz złotych fug!',
        '#10b981'
      );
      this.sayQuote('PROMOCJA -80% NA WANNY WOLNOSTOJĄCE! Klienci szturmują bramę, a punkty liczą się PODWÓJNIE!');
      for (let i = 0; i < 4; i++) {
        this.addGroutItem(`event_grout_${Date.now()}_${i}`, px + 3 + i * 2.0, 0.6, THREE.MathUtils.clamp(pz + (i % 2 === 0 ? -1.5 : 1.5), -14, 14), 120);
      }
      this.spawnDroppedPerk(px + 3.5, 0.5, pz, 'order_magnet');
      this.addCustomerEnemy(`event_cust_${Date.now()}_1`, px + 10, Math.max(-12, pz - 5), Math.min(12, pz + 5), 'Łowca Promocji -80%');
      this.addArchitectEnemy(`event_arch_${Date.now()}_2`, px + 12, px + 18, pz, 'Architektka na Wyprzedaży');
    } else {
      // EVENT 5: OPERATOR 01 PRZEGRYWA SYMULACJĘ CZOŁGÓW!
      sound.playSirenAlert();
      this.triggerScreenShake(0.75, 0.65);
      this.marcinWoTPenaltyTimer = 6.0;
      this.callbacks.onPerkDropBanner?.(
        '🎮 OPERATOR 01 PRZEGRYWA SYMULACJĘ CZOŁGÓW!',
        '💢',
        'Operator 01 przegrał symulację czołgów B4 i szuka winnego w alejkach! "Znajdę Ci zajęcie, wesołku..." (-30% szybkości na 6s)',
        '#f97316'
      );
      this.sayQuote('Operator 01 przegrał bitwę w symulator czołgów B4! "Znajdę Ci zaraz zajęcie, wesołku..."');
      this.spawnDroppedPerk(px + 2.8, 0.5, pz, 'espresso_boost');
      this.addHandlowiecEnemy(`event_marcin_wot_${Date.now()}`, px + 11, Math.max(-12, pz - 4), Math.min(12, pz + 4), 'Zirytowany Operator 01');
    }
  }

  private updateTimedEvents(dt: number) {
    this.timedEventCooldown -= dt;
    if (this.timedEventCooldown <= 0) {
      this.triggerTimedWarehouseEvent();
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      // Boomerang return logic (Operator 05's Pipe Wrench)
      if (p.boomerang && !p.returning && p.maxLife && p.life < p.maxLife * 0.52) {
        p.returning = true;
        p.hitIds?.clear(); // Can hit enemies again on return!
      }
      if (p.boomerang && p.returning) {
        const toPlayer = new THREE.Vector3(
          this.playerPos.x - p.mesh.position.x,
          this.playerPos.y + 0.75 - p.mesh.position.y,
          this.playerPos.z - p.mesh.position.z
        );
        const distBack = toPlayer.length();
        if (distBack < 0.75) {
          this.levelRoot.remove(p.mesh);
          if (p.weaponProjectile || p.disposeOnRemove) this.disposeTemporaryObject(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
        toPlayer.normalize().multiplyScalar(17.5);
        p.vel.lerp(toPlayer, dt * 9.0);
      }

      // Homing logic (Operator 04's DualSense RGB discs)
      if (p.homing) {
        let nearest: EnemyItem | null = null;
        let minDist = 11.0;
        for (const e of this.enemies) {
          if (e.state === 'defeated') continue;
          const d = Math.hypot(e.x - p.mesh.position.x, e.z - p.mesh.position.z);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const desired = new THREE.Vector3(nearest.x - p.mesh.position.x, 0, nearest.z - p.mesh.position.z)
            .normalize()
            .multiplyScalar(p.vel.length());
          p.vel.lerp(desired, dt * 8.5);
        }
      }

      const previousProjectileX = p.mesh.position.x;
      const previousProjectileY = p.mesh.position.y;
      const previousProjectileZ = p.mesh.position.z;

      if (p.orbiting) {
        p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 2.5) * dt;
        const orbitAngle = p.orbitAngle;
        const radius = p.orbitRadius || 1.55;
        p.mesh.position.set(
          this.playerPos.x + Math.cos(orbitAngle) * radius,
          this.playerPos.y + 0.78 + Math.sin(orbitAngle * 2.0) * 0.08,
          this.playerPos.z + Math.sin(orbitAngle) * radius
        );
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
      }
      if (p.spinSpeed) {
        p.mesh.rotation.y += p.spinSpeed * dt;
      }
      if (p.weaponId) {
        p.trailTimer = (p.trailTimer ?? 0) - dt;
        const trailInterval = this.adaptivePerformanceTier >= 2 ? 0.34 : this.adaptivePerformanceTier === 1 ? 0.24 : 0.15;
        if (p.trailTimer <= 0) {
          this.spawnSurvivalWeaponTrail(p);
          p.trailTimer = trailInterval * (p.orbiting ? 1.6 : 1);
        }
      }

      // Ricochet off Z corridor walls (Operator 03's 45-degree diamond blade & tiles)
      if (p.ricochet && Math.abs(p.mesh.position.z) > 17.5) {
        p.vel.z *= -1;
        p.mesh.position.z = Math.sign(p.mesh.position.z) * 17.4;
        this.spawnParticleRing(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0xd97706);
      }

      // Operator 03 passive: projectiles collect grouts & items along their path!
      if (p.collectItems) {
        for (const c of this.collectibles) {
          if (c.collected || !c.mesh) continue;
          if (Math.hypot(c.x - p.mesh.position.x, c.z - p.mesh.position.z) < 1.35) {
            c.x = this.playerPos.x;
            c.y = this.playerPos.y + 0.5;
            c.z = this.playerPos.z;
            c.mesh.position.set(c.x, c.y, c.z);
          }
        }
      }

      let destroyProj = false;
      const berserkMult = (this.activePerks.kfcBerserk || 0) > 0 ? 2 : 1;
      // Untagged projectiles belong to abilities; weapon damage remains independent
      // from the operator's primary-attack class multiplier.
      const projectileDamageSource: SurvivalDamageSource = p.damageSource ?? (p.weaponId
        ? getSurvivalWeaponDamageSource(p.weaponId)
        : 'ability');
      const adjustedProjectileDamage =
        this.scaleSurvivalDamage(p.damage ?? (this.charDef.id === 'dawid' ? 2 : 1)) *
        berserkMult * (p.chainDamageMultiplier || 1);
      const baseDmg = projectileDamageSource === 'basic_attack'
        ? scaleCharacterBasicAttackDamage(adjustedProjectileDamage, this.charDef.basicAttackDamageMultiplier * this.characterMasteryBonuses.attackMultiplier)
        : Math.max(1, Math.round(adjustedProjectileDamage));
      const segmentX = p.mesh.position.x - previousProjectileX;
      const segmentY = p.mesh.position.y - previousProjectileY;
      const segmentZ = p.mesh.position.z - previousProjectileZ;
      const segmentLengthSq = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;

      const segmentMidX = (previousProjectileX + p.mesh.position.x) * 0.5;
      const segmentMidZ = (previousProjectileZ + p.mesh.position.z) * 0.5;
      const broadphaseRadius = Math.sqrt(segmentLengthSq) * 0.5 + 3.0;
      const collisionCandidates = this.enemies.length >= 12
        ? this.enemySpatialIndex.query(segmentMidX, segmentMidZ, broadphaseRadius)
        : this.enemies;
      for (const e of collisionCandidates) {
        if (e.state === 'defeated') continue;
        if (p.hitIds && p.hitIds.has(e.id)) continue;

        // Test the closest point on this frame's movement segment, not only
        // the projectile endpoint. Fast shots remain reliable on lower-FPS phones.
        const projection = segmentLengthSq > 0.000001
          ? THREE.MathUtils.clamp(
              ((e.x - previousProjectileX) * segmentX +
                (e.y - previousProjectileY) * segmentY +
                (e.z - previousProjectileZ) * segmentZ) / segmentLengthSq,
              0,
              1
            )
          : 0;
        const closestX = previousProjectileX + segmentX * projection;
        const closestY = previousProjectileY + segmentY * projection;
        const closestZ = previousProjectileZ + segmentZ * projection;
        const offsetX = closestX - e.x;
        const offsetZ = closestZ - e.z;
        if (offsetX * offsetX + offsetZ * offsetZ < 1.35 * 1.35 &&
          Math.abs(closestY - e.y) < 1.35) {
          p.hitIds?.add(e.id);

          // Check if guard has active shield
          if (e.shieldActive && this.charDef.id !== 'grzesiek' && (this.activePerks.kfcBerserk || 0) <= 0) {
            sound.playShieldBreak();
            this.triggerBloomPulse(0.08);
            this.emitFloatingToast('🛡️ BLOK TARCZY!', e.x, e.y + 1, e.z, 'damage');
            e.shieldActive = false;
            if (e.shieldRing) e.shieldRing.visible = false;
          } else {
            if (e.shieldActive) {
              e.shieldActive = false;
              if (e.shieldRing) e.shieldRing.visible = false;
            }
            this.damageEnemy(e, baseDmg, p.mesh.position.x, p.mesh.position.z, projectileDamageSource);
            if (this.gameMode === 'survival' && p.criticalBurstState && !p.criticalBurstState.consumed) {
              p.criticalBurstState.consumed = true;
              this.applySurvivalCriticalShrapnel(e, baseDmg, projectileDamageSource);
            }
            sound.playSmack();
            if (p.weaponProjectile) {
              this.spawnCompactImpact(e.x, e.y + 0.72, e.z, p.weaponId ? SURVIVAL_DAMAGE_WEAPONS[p.weaponId].color : 0x7dd3fc);
            } else {
              this.triggerBloomPulse(0.1);
              this.cameraShake = 0.25;
              this.spawnParticleRing(e.x, e.y + 0.8, e.z, this.charDef.color);
            }
            this.emitFloatingToast(`-${baseDmg} HP`, e.x, e.y + 0.8, e.z, 'damage');

            if (p.slowOnHit) {
              e.speed = Math.max(1.0, e.speed * 0.72);
              this.emitFloatingToast('👾 GLITCH -30% SPD', e.x, e.y + 1.25, e.z, 'perk');
            }
            if (p.igniteOnHit) {
              e.onFireTimer = 2.5;
              if (!p.weaponProjectile) this.spawnParticleRing(e.x, e.y + 0.5, e.z, 0xff5500);
            }

            // AoE shockwave on hit (Operator 01's WZ Binder Stamp)
            if (p.aoeRadius && p.aoeRadius > 0) {
              if (p.weaponProjectile) this.spawnCompactImpact(e.x, e.y + 0.36, e.z, p.weaponId ? SURVIVAL_DAMAGE_WEAPONS[p.weaponId].color : 0xf59e0b);
              else this.spawnParticleRing(e.x, e.y + 0.4, e.z, 0xf59e0b);
              for (const other of this.enemies) {
                if (other.id !== e.id && other.state !== 'defeated') {
                  if (Math.hypot(other.x - e.x, other.z - e.z) <= p.aoeRadius) {
                    const splashDamage = projectileDamageSource === 'basic_attack'
                      ? scaleCharacterBasicAttackDamage(this.scaleSurvivalDamage(1), this.charDef.basicAttackDamageMultiplier * this.characterMasteryBonuses.attackMultiplier)
                      : this.scaleSurvivalDamage(1);
                    this.damageEnemy(other, splashDamage, e.x, e.z, projectileDamageSource);
                    other.stunTimer = Math.max(other.stunTimer, this.gameMode === 'survival' ? 0.22 : (p.stunDuration || 1.2));
                    if (this.gameMode !== 'survival' || (p.stunDuration || 0) > 0.8) other.state = 'stunned';
                    if (!p.weaponProjectile) this.emitFloatingToast('📑 AUDYT AoE -1 HP!', other.x, other.y + 1.1, other.z, 'damage');
                    if (other.hp <= 0) {
                      this.defeatEnemy(other, 240, true);
                    }
                  }
                }
              }
            }

            if (e.hp <= 0) {
              this.defeatEnemy(e, 250, true);
            } else {
              e.stunTimer = Math.max(e.stunTimer, this.gameMode === 'survival' ? 0.14 : (p.stunDuration || 0.65));
              if (this.gameMode !== 'survival' || (p.stunDuration || 0) > 0.8) e.state = 'stunned';
            }
          }

          if (p.chainable && (p.bouncesRemaining || 0) > 0 && p.hitIds) {
            const nextTarget = chooseSurvivalRicochetTarget(
              { x: e.x, z: e.z },
              this.enemies,
              p.hitIds,
              p.chainMaxDistance || 7,
            );
            if (nextTarget) {
              const directionX = nextTarget.x - e.x;
              const directionZ = nextTarget.z - e.z;
              const projectileSpeed = Math.max(6, p.vel.length());
              p.vel.set(directionX, 0, directionZ).normalize().multiplyScalar(projectileSpeed);
              p.mesh.position.set(e.x, e.y + 0.72, e.z);
              p.bouncesRemaining = Math.max(0, (p.bouncesRemaining ?? 0) - 1);
              p.chainDamageMultiplier = (p.chainDamageMultiplier || 1) * (p.chainDamageRetention || 0.7);
              p.pierce = 0;
              p.life = Math.max(p.life, 0.72);
              this.spawnCompactImpact(e.x, e.y + 0.72, e.z, 0xa78bfa);
              sound.playElectricalSparks();
              break;
            }
          }

          if (p.boomerang) {
            // Boomerang keeps flying and turns back after hitting
            if (!p.returning) p.returning = true;
          } else if (p.pierce && p.pierce > 0) {
            p.pierce--;
          } else {
            destroyProj = true;
            break;
          }
        }
      }

      if (destroyProj || p.life <= 0) {
        this.levelRoot.remove(p.mesh);
        if (p.weaponProjectile || p.disposeOnRemove) this.disposeTemporaryObject(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.life -= dt;
      if (ep.gravity) ep.vel.y -= ep.gravity * dt;
      ep.mesh.position.addScaledVector(ep.vel, dt);
      if (ep.spin) {
        ep.mesh.rotation.z += ep.spin * dt;
        ep.mesh.rotation.x += ep.spin * 0.32 * dt;
      }

      const dist = Math.hypot(ep.mesh.position.x - this.playerPos.x, ep.mesh.position.z - this.playerPos.z);
      if (dist < 0.85 && Math.abs(ep.mesh.position.y - this.playerPos.y) < 1.0) {
        if (ep.isDyscyplinarka) {
          if (this.activePerks.shield) {
            this.activePerks.shield = false;
            this.invulnerableTimer = 1.2;
            sound.playShieldBreak();
            this.sayQuote('Kask BHP zamortyzował DYSCYPLINARKĘ Dyrektora Widmo!');
            this.emitFloatingToast('🛡️ BLOK DYSCYPLINARKI!', this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 'perk');
          } else {
            this.takeDamage('🚨 ZWOLNIENIE DYSCYPLINARNE NA HITA OD DYREKTORA WIDMO!', 99);
          }
        } else if (ep.kind === 'pomazaniec_lollipop') {
          this.takeDamage('🍭 Trafił Cię lizak wystrzelony przez Pomazańca!');
          this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.55, this.playerPos.z, 0xf472b6);
          this.triggerBloomPulse(0.16);
          sound.playLollipopHit();
          this.emitFloatingToast('🍭 LIZAK PROSTO W CZOŁO!', this.playerPos.x, this.playerPos.y + 1.25, this.playerPos.z, 'damage');
        } else if (ep.kind === 'sebix_brick') {
          this.takeDamage('🧱 Operator Turbo trafił Cię cegłą z nocnej zmiany!');
          this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.55, this.playerPos.z, 0xf97316);
          this.spawnExplosionParticles(this.playerPos.x,0.18,this.playerPos.z,0xff7a18,8);
          this.triggerScreenShake(0.26,0.16);
          sound.playSmack();
          this.emitFloatingToast('🧱 CEGŁA PROSTO W KASK!', this.playerPos.x, this.playerPos.y + 1.25, this.playerPos.z, 'damage');
        } else {
          this.takeDamage('Trafiło Cię wezwanie wyjaśniające od Nadzorcy Zero!');
        }
        this.levelRoot.remove(ep.mesh);
        if (ep.kind === 'pomazaniec_lollipop' || ep.kind === 'sebix_brick' || ep.disposeOnRemove) this.disposeTemporaryObject(ep.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (ep.life <= 0) {
        this.levelRoot.remove(ep.mesh);
        if (ep.kind === 'pomazaniec_lollipop' || ep.kind === 'sebix_brick' || ep.disposeOnRemove) this.disposeTemporaryObject(ep.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private updateSpecialEffects(dt: number) {
    for (let i = this.specialEffects.length - 1; i >= 0; i--) {
      const effect = this.specialEffects[i];
      effect.life -= dt;
      const t = 1 - effect.life / effect.maxLife;

      if (effect.update) {
        effect.update(dt, t);
      } else {
        effect.mesh.scale.setScalar(1 + t * effect.grow);
        effect.mesh.rotation.z += dt * effect.spin;
        const mat = (effect.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined;
        if (mat && 'opacity' in mat) {
          mat.opacity = Math.max(0, (effect.life / effect.maxLife) * 0.9);
        }
      }

      if (effect.life <= 0) {
        this.levelRoot.remove(effect.mesh);
        if (effect.cleanup) effect.cleanup();
        else if (effect.disposeOnRemove) this.disposeTemporaryObject(effect.mesh);
        this.specialEffects.splice(i, 1);
      }
    }
  }

  private spawnGrzesiekShockwave() {
    // 1. Ground Shockwaves
    const geo = new THREE.TorusGeometry(0.9, 0.12, 14, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(this.playerPos.x, this.playerPos.y + 0.12, this.playerPos.z);
    mesh.scale.setScalar(0.2);
    this.levelRoot.add(mesh);
    this.specialEffects.push({ mesh, life: 0.7, maxLife: 0.7, grow: 7.5, spin: 9.0, disposeOnRemove: true });

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.08, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.set(this.playerPos.x, this.playerPos.y + 0.12, this.playerPos.z);
    ring2.scale.setScalar(0.18);
    this.levelRoot.add(ring2);
    this.specialEffects.push({ mesh: ring2, life: 0.6, maxLife: 0.6, grow: 8.5, spin: -7.0, disposeOnRemove: true });

    // 2. GIANT ROTATING & SQUEEZING MECHANICAL CRUSHER ARM (ŚCIŚK ZAGŁADY)
    const armGroup = new THREE.Group();
    armGroup.position.set(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.3, emissive: 0x15803d, emissiveIntensity: 0.5 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.2, emissive: 0xeab308, emissiveIntensity: 0.4 });

    // Base Turret
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 16), steelMat);
    armGroup.add(baseMesh);

    // Boom arm
    const boomGroup = new THREE.Group();
    boomGroup.position.set(0, 0.15, 0);

    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), greenMat);
    boomMesh.position.set(0, 0.6, 0.2);
    boomMesh.rotation.x = 0.4;
    boomGroup.add(boomMesh);

    // Hydraulic cylinder
    const cylMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12), chromeMat);
    cylMesh.position.set(0, 0.5, 0.05);
    cylMesh.rotation.x = 0.4;
    boomGroup.add(cylMesh);

    // Forearm
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, 1.1, 0.5);

    const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), steelMat);
    forearmMesh.position.set(0, 0.4, 0.2);
    forearmMesh.rotation.x = -0.5;
    forearmGroup.add(forearmMesh);

    // Squeezing Pincer Jaws
    const clawBaseGroup = new THREE.Group();
    clawBaseGroup.position.set(0, 0.8, 0.4);

    const clawHub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), greenMat);
    clawBaseGroup.add(clawHub);

    // Left Jaw
    const leftJaw = new THREE.Group();
    const leftJawBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.15), steelMat);
    leftJawBar.position.set(-0.25, 0.35, 0);
    leftJawBar.rotation.z = -0.2;
    leftJaw.add(leftJawBar);

    const leftTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), teethMat);
    leftTeeth.position.set(-0.15, 0.6, 0.08);
    leftJaw.add(leftTeeth);
    clawBaseGroup.add(leftJaw);

    // Right Jaw
    const rightJaw = new THREE.Group();
    const rightJawBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.15), steelMat);
    rightJawBar.position.set(0.25, 0.35, 0);
    rightJawBar.rotation.z = 0.2;
    rightJaw.add(rightJawBar);

    const rightTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), teethMat);
    rightTeeth.position.set(0.15, 0.6, 0.08);
    rightJaw.add(rightTeeth);
    clawBaseGroup.add(rightJaw);

    forearmGroup.add(clawBaseGroup);
    boomGroup.add(forearmGroup);
    armGroup.add(boomGroup);

    armGroup.scale.setScalar(1.6);
    this.levelRoot.add(armGroup);

    let sparkTimer = 0;

    this.specialEffects.push({
      mesh: armGroup,
      life: 0.9,
      maxLife: 0.9,
      disposeOnRemove: true,
      grow: 0,
      spin: 0,
      update: (dt: number, progress: number) => {
        // High-speed rotation around Y-axis
        armGroup.rotation.y += dt * 18.0;

        // Dynamic heavy slam arc
        armGroup.rotation.x = Math.sin(progress * Math.PI) * 0.5;

        // SQUEEZING / PINCHING CLAW ACTION (Obracające się i ściskające ramię):
        const closeAmount = Math.max(0, Math.sin(progress * Math.PI)); 
        leftJaw.rotation.z = closeAmount * 0.85;
        rightJaw.rotation.z = -closeAmount * 0.85;

        // Glowing teeth intensity
        teethMat.emissiveIntensity = 0.4 + closeAmount * 1.8;

        // Energy sparks burst during peak crush
        if (progress > 0.2 && progress < 0.8) {
          sparkTimer += dt;
          if (sparkTimer > 0.04) {
            sparkTimer = 0;
            this.spawnParticleRing(
              armGroup.position.x + (Math.random() - 0.5) * 0.8,
              armGroup.position.y + 1.2,
              armGroup.position.z + (Math.random() - 0.5) * 0.8,
              0x4ade80
            );
          }
        }

        // Smooth scale fade out near end
        if (progress > 0.7) {
          const fade = (1 - progress) / 0.3;
          armGroup.scale.setScalar(1.6 * fade);
        }
      },
    });
  }

  private spawnCompactImpact(x: number, y: number, z: number, color: number) {
    for (let i = 0; i < 3; i++) {
      const size = 0.055 + Math.random() * 0.025;
      const baseScale = size * (0.8 + Math.random() * 0.35);
      const mesh = this.particlePool.acquire('tetrahedron', color, baseScale, 0.95);
      if (!mesh) break;

      const angle = (i / 3) * Math.PI * 2;
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.levelRoot.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * 1.5, 0.75 + i * 0.16, Math.sin(angle) * 1.5),
        life: 0.28,
        maxLife: 0.28,
        gravity: 1.8,
        baseScale,
        rotVel: new THREE.Vector3(5 + Math.random() * 4, 4 + Math.random() * 5, 3 + Math.random() * 4),
      });
    }
  }

  private updateParticles(dt: number) {
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const maxBudget = isMobile ? (this.adaptivePerformanceTier >= 2 ? 14 : this.adaptivePerformanceTier === 1 ? 24 : 36) : 75;
    if (this.particles.length > maxBudget) {
      const excess = this.particles.splice(0, this.particles.length - maxBudget);
      excess.forEach((particle) => this.particlePool.release(particle.mesh));
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.gravity !== undefined) pt.vel.y -= pt.gravity * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.rotVel) {
        pt.mesh.rotation.x += pt.rotVel.x * dt;
        pt.mesh.rotation.y += pt.rotVel.y * dt;
        pt.mesh.rotation.z += pt.rotVel.z * dt;
      }
      const lifeRatio = THREE.MathUtils.clamp(pt.life / pt.maxLife, 0, 1);
      pt.mesh.scale.setScalar((pt.baseScale ?? 1) * Math.max(0.001, lifeRatio));
      const material = pt.mesh.material as THREE.MeshBasicMaterial;
      if (material.transparent) material.opacity = lifeRatio * 0.96;

      if (pt.life <= 0) {
        this.particlePool.release(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  public triggerJump() {
    if (this.state !== 'playing') return;
    this.jumpBufferTimer = 0.22;
  }

  public triggerAttack() {
    if (this.state !== 'playing' || this.attackCooldownTimer > 0) return;

    const campaignCounterattackReady = this.gameMode === 'campaign' && this.campaignCounterattackReady;
    if (campaignCounterattackReady) {
      this.campaignCounterattackReady = false;
      this.emitFloatingToast('✦ KONTRATAK! NASTĘPNY ATAK +1 OBRAŻENIE', this.playerPos.x, this.playerPos.y + 1.25, this.playerPos.z, 'combo');
    }
    const charId = this.currentCharacterId;
    this.attackComboStep = (this.attackComboStep + 1) % 3;
    const isThirdCombo = this.attackComboStep === 0;

    // Deliberate, readable cadence: these are physical signature attacks, not machine-gun spam.
    const baseAttackCooldown = getBaseAttackCooldownSeconds(charId, this.gameMode);
    const attackHasteFactor = (this.activePerks.attackHaste || 0) > 0
      ? (this.gameMode === 'survival' ? 0.90 : 0.94)
      : 1;
    this.attackCooldownTimer = baseAttackCooldown *
      (this.gameMode === 'survival' ? this.survivalAttackRateMultiplier : 1) *
      attackHasteFactor;
    this.attackSwingDuration = getCharacterAttackMotionProfile(charId).durationSeconds;
    this.attackSwingTimer = this.attackSwingDuration;
    const firstPrimaryProjectile = this.projectiles.length;

    sound.playAttackWhoosh();
    const forward = this.manualAimEnabled
      ? new THREE.Vector3(this.manualAimDirection.x, 0, this.manualAimDirection.z)
      : new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
    const startOrigin = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.82, this.playerPos.z).addScaledVector(forward, 0.65);

    if (charId === 'marcin') {
      // Operator 01 casts a compact B4 ERP spell: a holographic work-order rune.
      const spell = new THREE.Group();
      const coreMat = new THREE.MeshStandardMaterial({
        color: isThirdCombo ? 0x67e8f9 : 0x38bdf8,
        emissive: isThirdCombo ? 0x0891b2 : 0x0369a1,
        emissiveIntensity: isThirdCombo ? 1.25 : 0.8,
        metalness: 0.35,
        roughness: 0.22,
      });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(isThirdCombo ? 0.29 : 0.22, 0), coreMat);
      const ringA = new THREE.Mesh(
        new THREE.TorusGeometry(isThirdCombo ? 0.42 : 0.32, 0.035, 7, 18),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85 })
      );
      ringA.rotation.x = Math.PI / 2;
      const ringB = new THREE.Mesh(
        new THREE.TorusGeometry(isThirdCombo ? 0.34 : 0.26, 0.022, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.75 })
      );
      ringB.rotation.y = Math.PI / 2;
      spell.add(core, ringA, ringB);
      spell.position.copy(startOrigin);
      this.levelRoot.add(spell);
      this.projectiles.push({
        mesh: spell,
        disposeOnRemove: true,
        vel: forward.clone().multiplyScalar(14.2),
        life: getPrimaryAttackLifetimeSeconds('marcin', 14.2),
        damage: (isThirdCombo ? 2 : 1) + (campaignCounterattackReady ? 1 : 0),
        pierce: isThirdCombo ? 2 : 1,
        aoeRadius: isThirdCombo ? 1.55 : 1.0,
        stunDuration: isThirdCombo ? 1.15 : 0.55,
        spinSpeed: 8.0,
        damageSource: 'basic_attack',
        hitIds: new Set(),
      });
      if (isThirdCombo) {
        this.emitFloatingToast('🟦 B4 ERP: ZLECENIE ZATWIERDZONE!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'perk');
      }
    } else if (charId === 'grzesiek') {
      // Operator 02 throws a steel dumbbell; every third throw is the heavy 44 cm special.
      const dumbbell = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      const collarMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.55, roughness: 0.25 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.74, 10), steel);
      shaft.rotation.x = Math.PI / 2;
      dumbbell.add(shaft);
      [-0.34, 0.34].forEach((z) => {
        const weight = new THREE.Mesh(
          new THREE.CylinderGeometry(isThirdCombo ? 0.25 : 0.21, isThirdCombo ? 0.25 : 0.21, 0.18, 12),
          steel
        );
        weight.rotation.x = Math.PI / 2;
        weight.position.z = z;
        dumbbell.add(weight);
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 6, 12), collarMat);
        collar.position.z = z > 0 ? z - 0.10 : z + 0.10;
        dumbbell.add(collar);
      });
      if (isThirdCombo) dumbbell.scale.setScalar(1.18);
      dumbbell.position.copy(startOrigin);
      this.levelRoot.add(dumbbell);
      this.projectiles.push({
        mesh: dumbbell,
        disposeOnRemove: true,
        vel: forward.clone().multiplyScalar(14.6),
        life: getPrimaryAttackLifetimeSeconds('grzesiek', 14.6),
        damage: (isThirdCombo ? 3 : 2) + (campaignCounterattackReady ? 1 : 0),
        pierce: isThirdCombo ? 3 : 1,
        stunDuration: 0.65,
        spinSpeed: 13.0,
        damageSource: 'basic_attack',
        hitIds: new Set(),
      });
      if (isThirdCombo) this.emitFloatingToast('💪 HANTLA 44 CM — CIĘŻKI RZUT!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'combo');
    } else if (charId === 'dawid') {
      // Operator 03 launches a roll of stretch wrap; a hit briefly binds/slows the target.
      const wrapRoll = new THREE.Group();
      const filmMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.16, roughness: 0.12, transparent: true, opacity: 0.84 });
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 14), filmMat);
      roll.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.58, 10), coreMat);
      core.rotation.x = Math.PI / 2;
      const looseFilm = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.48),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
      );
      looseFilm.position.z = -0.24;
      wrapRoll.add(roll, core, looseFilm);
      wrapRoll.position.copy(startOrigin);
      this.levelRoot.add(wrapRoll);
      this.projectiles.push({
        mesh: wrapRoll,
        disposeOnRemove: true,
        vel: forward.clone().multiplyScalar(14.8),
        life: getPrimaryAttackLifetimeSeconds('dawid', 14.8),
        damage: (isThirdCombo ? 2 : 1) + (campaignCounterattackReady ? 1 : 0),
        pierce: isThirdCombo ? 3 : 2,
        slowOnHit: true,
        stunDuration: isThirdCombo ? 1.2 : 0.7,
        spinSpeed: 18.0,
        damageSource: 'basic_attack',
        hitIds: new Set(),
      });
      if (isThirdCombo) this.emitFloatingToast('📦 STRETCH VIP — ZAWIJAMY TEMAT!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'combo');
    } else if (charId === 'mateusz') {
      // Operator 04 uses a taser: a single fast, readable electric dart, not a screen-filling triple burst.
      const taserDart = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.10, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.55, roughness: 0.25, emissive: 0x4c1d95, emissiveIntensity: 0.35 })
      );
      const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
      emitter.position.z = 0.18;
      taserDart.add(body, emitter);
      [-0.065, 0.065].forEach((x) => {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 }));
        prong.position.set(x, 0, 0.26);
        prong.rotation.x = Math.PI / 2;
        taserDart.add(prong);
      });
      taserDart.position.copy(startOrigin);
      this.levelRoot.add(taserDart);
      this.projectiles.push({
        mesh: taserDart,
        disposeOnRemove: true,
        vel: forward.clone().multiplyScalar(19.5),
        life: getPrimaryAttackLifetimeSeconds('mateusz', 19.5),
        damage: (isThirdCombo ? 2 : 1) + (campaignCounterattackReady ? 1 : 0),
        pierce: 1,
        slowOnHit: true,
        stunDuration: isThirdCombo ? 1.65 : 1.0,
        spinSpeed: 2.0,
        damageSource: 'basic_attack',
        hitIds: new Set(),
      });
      sound.playElectricalSparks();
      if (isThirdCombo) this.emitFloatingToast('⚡ TASER: PODWÓJNY IMPULS!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'combo');
    } else if (charId === 'piotr') {
      // Operator 05 fires small steel BBs. A short-lived laser line makes the firing direction readable.
      // Operator 05 throws a heavy ratchet wrench. It cuts through a line of enemies,
      // then returns through the crowd for a second pass like a seasoned B4 boomerang.
      const wrench = new THREE.Group();
      const chrome = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.17 });
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.88, roughness: 0.23 });
      const redGrip = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.68 });
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.92), chrome);
      wrench.add(shaft);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.19, 0.26), redGrip);
      grip.position.z = -0.28;
      wrench.add(grip);
      const jawRing = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.075, 8, 18, Math.PI * 1.58), chrome);
      jawRing.position.z = 0.49;
      jawRing.rotation.z = -Math.PI * 0.20;
      wrench.add(jawRing);
      const jawLeft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.12), chrome);
      jawLeft.position.set(-0.15, 0.14, 0.62);
      jawLeft.rotation.z = -0.42;
      const jawRight = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.12), chrome);
      jawRight.position.set(0.15, 0.14, 0.62);
      jawRight.rotation.z = 0.42;
      wrench.add(jawLeft, jawRight);
      const ratchetCore = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 12), darkSteel);
      ratchetCore.rotation.x = Math.PI / 2;
      ratchetCore.position.set(0, 0, 0.50);
      wrench.add(ratchetCore);
      if (isThirdCombo) {
        const hotRim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 18), new THREE.MeshBasicMaterial({ color: 0xf87171 }));
        hotRim.position.z = 0.50;
        wrench.add(hotRim);
        wrench.scale.setScalar(1.16);
      }
      wrench.position.copy(startOrigin);
      wrench.rotation.y = this.playerRot;
      this.levelRoot.add(wrench);
      this.projectiles.push({
        mesh: wrench,
        vel: forward.clone().multiplyScalar(22.5),
        life: getPiotrBoomerangMaxLifeSeconds(22.5),
        maxLife: getPiotrBoomerangMaxLifeSeconds(22.5),
        damage: (isThirdCombo ? 3 : 2) + (campaignCounterattackReady ? 1 : 0),
        pierce: isThirdCombo ? 4 : 2,
        boomerang: true,
        stunDuration: 0.48,
        spinSpeed: 20,
        weaponProjectile: true,
        damageSource: 'basic_attack',
        hitIds: new Set(),
      });
      if (isThirdCombo) this.emitFloatingToast('🔧 GRZECHOTKA B4 — GWINT ZAGŁADY!', this.playerPos.x, this.playerPos.y + 1.3, this.playerPos.z, 'combo');
    }

    if (this.gameMode === 'survival' && (this.survivalUpgradeStacks.ricochet || 0) > 0) {
      const profile = getSurvivalRicochetProfile(
        this.survivalUpgradeStacks.ricochet || 0,
        this.survivalEvolutions.has('chain_reactor'),
      );
      for (let index = firstPrimaryProjectile; index < this.projectiles.length; index++) {
        const projectile = this.projectiles[index];
        projectile.chainable = profile.bounceCount > 0;
        projectile.bouncesRemaining = profile.bounceCount;
        projectile.chainMaxDistance = profile.maxDistance;
        projectile.chainDamageRetention = Math.min(0.94, profile.damageRetention * this.survivalRicochetStrength);
        projectile.chainDamageMultiplier = 1;
        projectile.hitIds ||= new Set<string>();
      }
    }

    // Small dodge reactions remain readable and do not drown the operator's projectile.
    this.enemies.forEach((e) => {
      if (e.state === 'defeated' || e.state === 'stunned') return;
      const dist = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
      if (dist < 4.0 && (e.type === 'piorun_dron' || e.type === 'kurier' || e.type === 'monter' || e.type === 'elite_walczak_guard')) {
        if (Math.random() < 0.22) {
          const dodgeOffset = Math.random() > 0.5 ? 1.1 : -1.1;
          e.z = THREE.MathUtils.clamp(e.z + dodgeOffset, e.startX, e.endX);
        }
      }
    });
  }

  private createMarcinTankModel(): { group: THREE.Group; turret: THREE.Group; tracks: THREE.Mesh[] } {
    const group = new THREE.Group();
    group.name = 'marcin_wz404_tank';
    const olive = new THREE.MeshStandardMaterial({ color: 0x647a3a, roughness: 0.66, metalness: 0.34 });
    const oliveLight = new THREE.MeshStandardMaterial({ color: 0x8ca34b, roughness: 0.54, metalness: 0.3 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.82, metalness: 0.52 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.82 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.72 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0x7f1d1d, emissiveIntensity: 0.22 });
    const addBox = (parent: THREE.Object3D, geometry: THREE.BoxGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Low-profile six-wheeled tracked hull with a readable front glacis.
    const hull = addBox(group, new THREE.BoxGeometry(1.38, 0.42, 1.95), olive, 0, 0.48, 0);
    hull.rotation.x = -0.045;
    addBox(group, new THREE.BoxGeometry(1.47, 0.13, 1.78), oliveLight, 0, 0.73, -0.02);
    const frontGlacis = addBox(group, new THREE.BoxGeometry(1.30, 0.28, 0.25), oliveLight, 0, 0.42, 0.88);
    frontGlacis.rotation.x = -0.28;
    addBox(group, new THREE.BoxGeometry(1.18, 0.12, 0.28), darkSteel, 0, 0.28, 0.99);

    const tracks: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const track = new THREE.Mesh(
        new THREE.TorusGeometry(0.40, 0.105, 7, 26),
        darkSteel
      );
      track.position.set(side * 0.72, 0.39, -0.03);
      track.rotation.y = Math.PI / 2;
      track.castShadow = true;
      group.add(track);
      tracks.push(track);
      for (let wheelIndex = 0; wheelIndex < 4; wheelIndex++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), steel);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.76, 0.37, -0.62 + wheelIndex * 0.40);
        group.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.13, 10), oliveLight);
        hub.rotation.z = Math.PI / 2;
        hub.position.copy(wheel.position);
        group.add(hub);
      }
      const fender = addBox(group, new THREE.BoxGeometry(0.10, 0.15, 1.48), oliveLight, side * 0.77, 0.66, -0.02);
      fender.castShadow = false;
    }

    // A distinct rotating turret with a long barrel and a glowing muzzle ring.
    const turret = new THREE.Group();
    turret.position.set(0, 0.82, -0.06);
    group.add(turret);
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.54, 0.18, 16), darkSteel);
    turretBase.position.y = -0.05;
    turret.add(turretBase);
    addBox(turret, new THREE.BoxGeometry(0.92, 0.38, 0.78), oliveLight, 0, 0.16, -0.04);
    const mantlet = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.26, 12), olive);
    mantlet.rotation.x = Math.PI / 2;
    mantlet.position.set(0, 0.18, 0.36);
    turret.add(mantlet);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.115, 1.16, 12), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.18, 0.91);
    turret.add(barrel);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.13, 12), darkSteel);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.18, 1.48);
    turret.add(muzzle);
    const muzzleBand = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 6, 14), amber);
    muzzleBand.position.set(0, 0.18, 1.55);
    turret.add(muzzleBand);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.12, 12), darkSteel);
    hatch.position.set(-0.22, 0.40, -0.20);
    turret.add(hatch);
    const commander = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), olive);
    commander.position.set(-0.22, 0.52, -0.20);
    turret.add(commander);

    for (const side of [-1, 1]) {
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), amber);
      headlight.position.set(side * 0.48, 0.50, 1.02);
      group.add(headlight);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.24, 8), darkSteel);
      exhaust.position.set(side * 0.43, 0.72, -0.76);
      group.add(exhaust);
    }
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.17, 0.035), red);
    badge.position.set(0, 0.69, 1.0);
    group.add(badge);
    // Keep the tank model legible at normal gameplay zoom without adding a heavy text texture.
    const badgeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.015), amber);
    badgeStripe.position.set(0, 0.70, 1.022);
    group.add(badgeStripe);

    group.scale.setScalar(0.92);
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
    });
    return { group, turret, tracks };
  }

  private spawnMarcinTank() {
    if (this.marcinTank) {
      this.levelRoot.remove(this.marcinTank.group);
      this.disposeTemporaryObject(this.marcinTank.group);
      this.marcinTank = null;
    }
    const built = this.createMarcinTankModel();
    const forward = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
    built.group.position.set(
      this.playerPos.x - forward.x * 2.6,
      0.06,
      this.playerPos.z - forward.z * 2.6
    );
    built.group.rotation.y = this.playerRot;
    this.levelRoot.add(built.group);
    const duration = this.gameMode === 'survival' ? 6.0 : 8.0;
    this.marcinTank = {
      group: built.group,
      turret: built.turret,
      tracks: built.tracks,
      life: duration,
      maxLife: duration,
      cooldown: 0.45,
      dustTimer: 0,
    };
    this.sayQuote('KONWÓJ WZ-404! DO BOJU! Zajmijcie pozycje, artyleria system ERP wjeżdża!');
    this.callbacks.onPerkDropBanner?.(
      'KONWÓJ WZ-404! DO BOJU!',
      '🚜',
      'Czołg WZ-404 melduje gotowość. Przez kilka sekund sam namierza i ostrzeliwuje przeciwników.',
      '#8ca34b'
    );
    this.emitFloatingToast('🚜 WZ-404 • ARTYLERIA B4 ERP ONLINE!', this.playerPos.x, this.playerPos.y + 1.55, this.playerPos.z, 'combo');
    this.triggerScreenShake(0.30, 0.18);
    this.triggerBloomPulse(0.30);
    this.spawnParticleRing(this.playerPos.x, 0.22, this.playerPos.z, 0x8ca34b);
  }

  private updateMarcinTank(dt: number) {
    const tank = this.marcinTank;
    if (!tank) return;
    tank.life -= dt;
    if (tank.life <= 0) {
      const position = tank.group.position.clone();
      this.levelRoot.remove(tank.group);
      this.disposeTemporaryObject(tank.group);
      this.marcinTank = null;
      this.spawnParticleRing(position.x, 0.18, position.z, 0xfbbf24);
      this.emitFloatingToast('🏁 WZ-404 wraca do garażu. Raport: noobów mniej.', position.x, 1.25, position.z, 'perk');
      return;
    }

    const forward = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
    const desiredX = this.playerPos.x - forward.x * 2.6;
    const desiredZ = this.playerPos.z - forward.z * 2.6;
    tank.group.position.x = THREE.MathUtils.lerp(tank.group.position.x, desiredX, Math.min(1, dt * 2.8));
    tank.group.position.z = THREE.MathUtils.lerp(tank.group.position.z, desiredZ, Math.min(1, dt * 2.8));
    tank.group.position.y = 0.06 + Math.sin(performance.now() * 0.004) * 0.018;
    tank.group.rotation.y = THREE.MathUtils.lerp(tank.group.rotation.y, this.playerRot, Math.min(1, dt * 2.2));
    tank.tracks.forEach((track) => { track.rotation.x += dt * 5.5; });

    let target: EnemyItem | null = null;
    let nearest = 23.5;
    for (const enemy of this.enemies) {
      if (enemy.state === 'defeated' || !enemy.mesh?.visible) continue;
      const distance = Math.hypot(enemy.x - tank.group.position.x, enemy.z - tank.group.position.z);
      if (distance < nearest) {
        nearest = distance;
        target = enemy;
      }
    }
    if (!target) return;

    const aimX = target.x - tank.group.position.x;
    const aimZ = target.z - tank.group.position.z;
    const worldAngle = Math.atan2(aimX, aimZ);
    tank.turret.rotation.y = THREE.MathUtils.lerp(
      tank.turret.rotation.y,
      worldAngle - tank.group.rotation.y,
      Math.min(1, dt * 5.5)
    );

    tank.cooldown -= dt;
    if (tank.cooldown > 0) return;
    tank.cooldown = this.gameMode === 'survival' ? 1.35 : 1.05;

    const direction = new THREE.Vector3(aimX, target.y + 0.65 - (tank.group.position.y + 1.02), aimZ);
    if (direction.lengthSq() < 0.001) return;
    direction.normalize();
    const shell = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xf97316, emissiveIntensity: 1.4, roughness: 0.26, metalness: 0.36,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), shellMat);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.035, 6, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff7ae })
    );
    collar.rotation.x = Math.PI / 2;
    shell.add(core, collar);
    const start = tank.group.position.clone().add(new THREE.Vector3(0, 1.12, 0)).addScaledVector(direction, 1.18);
    shell.position.copy(start);
    this.levelRoot.add(shell);
    const damage = this.gameMode === 'survival' ? 2 : 3;
    this.projectiles.push({
      mesh: shell,
      vel: direction.multiplyScalar(23),
      life: 2.2,
      maxLife: 2.2,
      damage,
      pierce: 0,
      aoeRadius: 1.7,
      stunDuration: 0.7,
      weaponProjectile: true,
      hitIds: new Set<string>(),
    });
    sound.playTankCannon();
    this.triggerScreenShake(0.10, 0.07);
    this.spawnParticleRing(start.x, start.y, start.z, 0xfbbf24);
  }

  private createMateuszCatModel(index: number): { group: THREE.Group; tail: THREE.Group } {
    const group = new THREE.Group();
    group.name = 'mateusz_cat_companion_' + index;
    const furPalette = [0xd97706, 0x1f2937, 0xe2e8f0];
    const fur = new THREE.MeshStandardMaterial({ color: furPalette[index % furPalette.length], roughness: 0.9 });
    const furLight = new THREE.MeshStandardMaterial({ color: index === 2 ? 0xf8fafc : 0xfbbf24, roughness: 0.86 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.7 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.35 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 9), fur);
    body.scale.set(1.0, 0.80, 1.35);
    body.position.y = 0.38;
    group.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), furLight);
    chest.scale.set(0.82, 1.05, 0.62);
    chest.position.set(0, 0.36, 0.32);
    group.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), fur);
    head.position.set(0, 0.69, 0.43);
    group.add(head);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.25, 7), fur);
      ear.position.set(side * 0.16, 0.91, 0.40);
      ear.rotation.z = side * -0.22;
      group.add(ear);
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.047, 0.14, 6), pink);
      innerEar.position.set(side * 0.16, 0.91, 0.438);
      innerEar.rotation.z = side * -0.22;
      group.add(innerEar);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark);
      eye.position.set(side * 0.09, 0.72, 0.655);
      group.add(eye);
      for (let whisker = 0; whisker < 2; whisker++) {
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 5), furLight);
        line.position.set(side * (0.17 + whisker * 0.015), 0.60 - whisker * 0.045, 0.64);
        line.rotation.z = side * (Math.PI / 2 + 0.14 * (whisker ? -1 : 1));
        line.rotation.x = Math.PI / 2;
        group.add(line);
      }
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), pink);
    nose.position.set(0, 0.63, 0.68);
    group.add(nose);

    for (const side of [-1, 1]) {
      for (const z of [-0.02, 0.54]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.27, 8), fur);
        leg.position.set(side * 0.19, 0.17, z);
        group.add(leg);
      }
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 6, 14), cyan);
    collar.position.set(0, 0.55, 0.35);
    collar.rotation.x = Math.PI / 2;
    group.add(collar);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), amber);
    bell.position.set(0, 0.50, 0.50);
    group.add(bell);

    const tail = new THREE.Group();
    tail.position.set(0, 0.43, -0.35);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.10, -0.17),
      new THREE.Vector3(0, 0.31, -0.27),
      new THREE.Vector3(0, 0.44, -0.14),
    ]);
    const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 10, 0.045, 6, false), fur);
    tail.add(tailMesh);
    group.add(tail);

    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
    });
    return { group, tail };
  }

  private spawnMateuszCats() {
    for (const cat of this.mateuszCats) {
      this.levelRoot.remove(cat.group);
      this.disposeTemporaryObject(cat.group);
    }
    this.mateuszCats = [];
    const duration = this.gameMode === 'survival' ? 6.5 : 9.5;
    for (let index = 0; index < 3; index++) {
      const built = this.createMateuszCatModel(index);
      const angle = this.playerRot + (index / 3) * Math.PI * 2;
      built.group.position.set(
        this.playerPos.x + Math.sin(angle) * 1.65,
        0.08,
        this.playerPos.z + Math.cos(angle) * 1.65
      );
      built.group.rotation.y = angle + Math.PI;
      this.levelRoot.add(built.group);
      this.mateuszCats.push({
        group: built.group,
        tail: built.tail,
        life: duration,
        maxLife: duration,
        attackCooldown: 0.35 + index * 0.28,
        orbitAngle: (index / 3) * Math.PI * 2,
        pounceTimer: 0,
        pounceTarget: null,
      });
    }
    this.sayQuote('KOCIA ARMIA ONLINE! Trzy futrzaste jednostki bojowe: Miau, Miau i Miau-Critical!');
    this.callbacks.onPerkDropBanner?.(
      'KOCIA ARMIA ONLINE • 3× MIAU-CRITICAL',
      '🐈',
      'Trzy koty orbitują wokół Volta, doskakują do przeciwników i zadają obrażenia przez kilka sekund.',
      '#67e8f9'
    );
    this.emitFloatingToast('🐈🐈🐈 TRZY KOTY • MIAU-CRITICAL!', this.playerPos.x, this.playerPos.y + 1.55, this.playerPos.z, 'combo');
    this.triggerBloomPulse(0.26);
    this.triggerScreenShake(0.16, 0.10);
    this.spawnParticleRing(this.playerPos.x, 0.22, this.playerPos.z, 0x67e8f9);
    sound.playCatPounce();
  }

  private updateMateuszCats(dt: number) {
    for (let index = this.mateuszCats.length - 1; index >= 0; index--) {
      const cat = this.mateuszCats[index];
      cat.life -= dt;
      if (cat.life <= 0) {
        this.levelRoot.remove(cat.group);
        this.disposeTemporaryObject(cat.group);
        this.mateuszCats.splice(index, 1);
        continue;
      }

      cat.orbitAngle += dt * (cat.pounceTimer > 0 ? 0.65 : 1.15);
      const angle = this.playerRot + cat.orbitAngle;
      const baseX = this.playerPos.x + Math.sin(angle) * 1.72;
      const baseZ = this.playerPos.z + Math.cos(angle) * 1.72;
      let targetX = baseX;
      let targetZ = baseZ;
      let jumpHeight = 0;
      if (cat.pounceTimer > 0 && cat.pounceTarget) {
        cat.pounceTimer = Math.max(0, cat.pounceTimer - dt);
        const progress = 1 - cat.pounceTimer / 0.42;
        const reach = progress < 0.58 ? progress / 0.58 : (1 - progress) / 0.42;
        const weight = THREE.MathUtils.clamp(reach, 0, 1);
        targetX = THREE.MathUtils.lerp(baseX, cat.pounceTarget.x, weight);
        targetZ = THREE.MathUtils.lerp(baseZ, cat.pounceTarget.z, weight);
        jumpHeight = Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1)) * 0.62;
        if (cat.pounceTimer <= 0) cat.pounceTarget = null;
      }

      cat.group.position.x = THREE.MathUtils.lerp(cat.group.position.x, targetX, Math.min(1, dt * 8.5));
      cat.group.position.z = THREE.MathUtils.lerp(cat.group.position.z, targetZ, Math.min(1, dt * 8.5));
      cat.group.position.y = 0.08 + jumpHeight + Math.sin(performance.now() * 0.008 + index * 2.1) * 0.035;
      cat.group.rotation.y = Math.atan2(this.playerPos.x - cat.group.position.x, this.playerPos.z - cat.group.position.z);
      cat.tail.rotation.x = Math.sin(performance.now() * 0.006 + index) * 0.42;
      if (cat.life < 0.8) cat.group.scale.setScalar(Math.max(0.05, cat.life / 0.8));

      cat.attackCooldown -= dt;
      if (cat.attackCooldown > 0 || cat.pounceTimer > 0) continue;
      let target: EnemyItem | null = null;
      let nearest = 10.5;
      for (const enemy of this.enemies) {
        if (enemy.state === 'defeated' || !enemy.mesh?.visible) continue;
        const distance = Math.hypot(enemy.x - cat.group.position.x, enemy.z - cat.group.position.z);
        if (distance < nearest) {
          nearest = distance;
          target = enemy;
        }
      }
      if (!target) continue;
      const damage = this.scaleSurvivalDamage(1);
      this.damageEnemy(target, damage, cat.group.position.x, cat.group.position.z);
      target.stunTimer = Math.max(target.stunTimer, 0.28);
      if (target.hp <= 0) this.defeatEnemy(target, 220, false);
      cat.pounceTarget = new THREE.Vector3(target.x, 0.08, target.z);
      cat.pounceTimer = 0.42;
      cat.attackCooldown = 1.28 + index * 0.17;
      this.spawnParticleRing(target.x, target.y + 0.28, target.z, index === 0 ? 0xfbbf24 : index === 1 ? 0x67e8f9 : 0xf9a8d4);
      this.emitFloatingToast('🐈 MIAU-CRITICAL! -' + damage + ' HP', target.x, target.y + 1.15, target.z, 'damage');
      sound.playCatPounce();
    }
  }


  private createMafiCapybaraModel(index: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'mafi_kapibara_companion_' + (index + 1);

    // Three visibly different, oversized enforcers: Don, the dual-baton bruiser,
    // and the hybrid guard. The props are stylised arcade-game shapes, not realistic
    // weapon replicas; all geometry remains deliberately low-poly for mobile.
    const furColors = [0x98704b, 0x825b3e, 0xa98259];
    const suitColors = [0x101722, 0x302733, 0x17342f];
    const furMat = new THREE.MeshStandardMaterial({ color: furColors[index % furColors.length], roughness: 0.9 });
    const muzzleMat = new THREE.MeshStandardMaterial({ color: 0xc49b75, roughness: 0.86 });
    const suitMat = new THREE.MeshStandardMaterial({ color: suitColors[index % suitColors.length], roughness: 0.55, metalness: 0.14 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x202b39, roughness: 0.38, metalness: 0.62 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.62 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x070b12, roughness: 0.24, metalness: 0.24 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.24, metalness: 0.82, emissive: 0x854d0e, emissiveIntensity: 0.16 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.28, emissive: 0x7f1d1d, emissiveIntensity: 0.7 });
    const hatMat = new THREE.MeshStandardMaterial({ color: index === 1 ? 0x3b1d27 : 0x101820, roughness: 0.42, metalness: 0.12 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 });

    // Heavy, broad silhouette with a larger head and reinforced shoulders.
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), suitMat);
    body.scale.set(1.18, 0.92, 1.38);
    body.position.set(0, 0.42, -0.015);
    group.add(body);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.15), armorMat);
    vest.position.set(0, 0.47, 0.235);
    group.add(vest);

    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.23, 0.045), shirtMat);
    shirt.position.set(0, 0.47, 0.323);
    group.add(shirt);

    const tieMat = index === 1
      ? new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.38, metalness: 0.22 })
      : new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.48 });
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.23, 4), tieMat);
    tie.position.set(0, 0.42, 0.36);
    tie.rotation.x = -Math.PI / 2;
    group.add(tie);

    // Thick shoulder guards make the silhouettes read clearly at camera distance.
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.25), armorMat);
      shoulder.position.set(side * 0.31, 0.62, 0.075);
      shoulder.rotation.z = side * -0.12;
      group.add(shoulder);

      const shoulderMark = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.03), redMat);
      shoulderMark.position.set(side * 0.31, 0.69, 0.205);
      group.add(shoulderMark);

      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.38, 7), suitMat);
      sleeve.position.set(side * 0.34, 0.43, 0.19);
      sleeve.rotation.z = side * 0.3;
      group.add(sleeve);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 5, 10), goldMat);
      cuff.position.set(side * 0.39, 0.27, 0.27);
      cuff.rotation.x = Math.PI / 2;
      group.add(cuff);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), muzzleMat);
      hand.position.set(side * 0.39, 0.23, 0.31);
      group.add(hand);
    }

    // A stern capybara face, dark shades and red eye glints.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 9), furMat);
    head.scale.set(1.08, 0.98, 1.02);
    head.position.set(0, 0.79, 0.31);
    group.add(head);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), muzzleMat);
    muzzle.scale.set(1.15, 0.7, 1.0);
    muzzle.position.set(0, 0.67, 0.535);
    group.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), blackMat);
    nose.scale.set(1.0, 0.72, 0.64);
    nose.position.set(0, 0.70, 0.655);
    group.add(nose);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 6), furMat);
      ear.scale.set(0.72, 1.08, 0.55);
      ear.position.set(side * 0.19, 0.98, 0.265);
      group.add(ear);

      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.085, 0.045), blackMat);
      lens.position.set(side * 0.088, 0.80, 0.548);
      lens.rotation.z = side * -0.08;
      group.add(lens);

      const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 5), redMat);
      eyeGlow.position.set(side * 0.088, 0.80, 0.576);
      group.add(eyeGlow);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.035), blackMat);
      temple.position.set(side * 0.22, 0.80, 0.48);
      group.add(temple);
    }

    const glassesBridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.026, 0.035), goldMat);
    glassesBridge.position.set(0, 0.80, 0.565);
    group.add(glassesBridge);

    // Fedora with a stronger crown, band and prominent family insignia.
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 16), hatMat);
    brim.position.set(0, 1.04, 0.29);
    brim.scale.z = 0.92;
    group.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.22, 12), hatMat);
    crown.position.set(0, 1.17, 0.29);
    group.add(crown);

    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 12), goldMat);
    hatBand.position.set(0, 1.105, 0.29);
    group.add(hatBand);

    const familyPin = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), goldMat);
    familyPin.position.set(0.13, 1.12, 0.47);
    group.add(familyPin);

    // Gold chain, signet and reinforced belt.
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 6, 16), goldMat);
    chain.position.set(0, 0.53, 0.31);
    chain.rotation.x = Math.PI / 2;
    group.add(chain);

    const signet = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), goldMat);
    signet.position.set(0, 0.40, 0.43);
    group.add(signet);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.13), blackMat);
    belt.position.set(0, 0.25, 0.16);
    group.add(belt);

    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.085, 0.035), goldMat);
    beltBuckle.position.set(0, 0.25, 0.24);
    group.add(beltBuckle);

    // Briefcase on the hip; the hybrid guard carries it on the opposite side.
    const briefcase = new THREE.Group();
    const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.09), hatMat);
    const caseHandle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 5, 10, Math.PI), goldMat);
    caseHandle.position.y = 0.105;
    briefcase.add(caseBody, caseHandle);
    briefcase.position.set(index === 2 ? -0.34 : 0.34, 0.39, 0.08);
    briefcase.rotation.z = index === 2 ? 0.12 : -0.12;
    group.add(briefcase);

    // A stylised compact arcade carbine: chunky stock, receiver, oversized
    // barrel and glowing muzzle. It is intentionally a fictional prop silhouette.
    // The rifle guards visibly shoulder and grip the prop instead of letting it float.
    if (index !== 1) {
      const grips = [
        { start: new THREE.Vector3(-0.30, 0.62, 0.10), end: new THREE.Vector3(-0.15, 0.43, 0.50) },
        { start: new THREE.Vector3(0.30, 0.62, 0.10), end: new THREE.Vector3(0.13, 0.39, 0.69) },
      ];
      for (const grip of grips) {
        const armVector = grip.end.clone().sub(grip.start);
        const forearm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.072, 0.082, armVector.length(), 7),
          suitMat
        );
        forearm.position.copy(grip.start).add(grip.end).multiplyScalar(0.5);
        forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armVector.normalize());
        group.add(forearm);

        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 6), muzzleMat);
        glove.position.copy(grip.end);
        group.add(glove);
      }
    }

    const weaponRig = new THREE.Group();
    weaponRig.name = 'mafi_rifle_rig';
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.38), blackMat);
    receiver.position.set(-0.035, 0.43, 0.48);
    weaponRig.add(receiver);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.22), armorMat);
    stock.position.set(-0.035, 0.44, 0.17);
    weaponRig.add(stock);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.115, 0.29), armorMat);
    handguard.position.set(-0.035, 0.44, 0.77);
    weaponRig.add(handguard);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.032, 0.42, 7), blackMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(-0.035, 0.455, 1.10);
    weaponRig.add(barrel);

    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.055, 8), redMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(-0.035, 0.455, 1.32);
    weaponRig.add(muzzleBrake);

    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.20, 0.12), blackMat);
    magazine.position.set(-0.015, 0.27, 0.52);
    magazine.rotation.x = -0.10;
    weaponRig.add(magazine);

    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.065, 0.11), goldMat);
    optic.position.set(-0.035, 0.535, 0.58);
    weaponRig.add(optic);

    const opticGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.018), redMat);
    opticGlass.position.set(-0.035, 0.54, 0.64);
    weaponRig.add(opticGlass);

    // The Don and hybrid guard carry carbines; the middle enforcer is a
    // dedicated dual-baton bruiser. The hybrid also keeps a visible side baton.
    if (index !== 1) {
      group.add(weaponRig);
      group.userData.mafiMuzzleLocal = new THREE.Vector3(-0.035, 0.455, 1.35);
    }

    const batonRig = new THREE.Group();
    batonRig.name = 'mafi_baton_rig';
    const batonMat = new THREE.MeshStandardMaterial({
      color: 0x111827, roughness: 0.28, metalness: 0.72, emissive: 0x7f1d1d, emissiveIntensity: 0.18,
    });
    const batonGripMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55, metalness: 0.22 });
    const batonCount = index === 1 ? 2 : index === 2 ? 1 : 1;
    for (let batonIndex = 0; batonIndex < batonCount; batonIndex++) {
      const side = index === 1 ? (batonIndex === 0 ? -1 : 1) : 1;
      const baton = new THREE.Group();
      baton.name = 'mafi_baton_' + batonIndex;

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.58, 7), batonMat);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.18, 7), batonGripMat);
      grip.position.y = -0.20;
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), goldMat);
      pommel.position.y = -0.31;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.055, 7), goldMat);
      cap.position.y = 0.30;
      baton.add(shaft, grip, pommel, cap);
      baton.position.set(side * 0.39, 0.33, 0.39);
      baton.rotation.z = side * -0.48;
      baton.rotation.x = index === 1 ? -0.12 : 0.18;
      batonRig.add(baton);
    }
    group.add(batonRig);

    for (const side of [-1, 1]) {
      for (const z of [-0.24, 0.24]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.073, 0.25, 7), suitMat);
        leg.position.set(side * 0.21, 0.16, z);
        const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), soleMat);
        shoe.scale.set(1.0, 0.48, 1.3);
        shoe.position.set(side * 0.21, 0.035, z + 0.035);
        group.add(leg, shoe);
      }
    }

    group.userData.mafiRole = index === 0 ? 'DON • CARBINE' : index === 1 ? 'ENFORCER • DUAL BATONS' : 'HYBRID • CARBINE + BATON';
    group.userData.mafiWeaponRig = weaponRig;
    group.userData.mafiBatonRig = batonRig;

    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    return group;
  }

  private spawnMafiPentagramEffect(groundY: number) {
    const ritual = new THREE.Group();
    ritual.name = 'MafiKapibar_Pentagram_B4';
    const crimson = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide,
    });
    const gold = new THREE.MeshBasicMaterial({
      color: 0xfbbf24, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
    });
    const starLineMaterial = new THREE.LineBasicMaterial({
      color: 0xf43f5e, transparent: true, opacity: 0.95, depthWrite: false,
    });
    const aura = new THREE.MeshBasicMaterial({
      color: 0x7e22ce, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide,
    });

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.075, 8, 72), crimson);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.055;
    ritual.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.026, 6, 72), gold);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.07;
    ritual.add(innerRing);

    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(3.15, 48), aura);
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 0.025;
    ritual.add(glowDisc);

    const starPoints: THREE.Vector3[] = [];
    const vertices = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
      return new THREE.Vector3(Math.cos(angle) * 3.05, 0.095, Math.sin(angle) * 3.05);
    });
    for (const index of [0, 2, 4, 1, 3, 0]) starPoints.push(vertices[index].clone());
    const starGeometry = new THREE.BufferGeometry().setFromPoints(starPoints);
    const star = new THREE.Line(starGeometry, starLineMaterial);
    ritual.add(star);

    for (const point of vertices) {
      const seal = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), gold);
      seal.position.copy(point);
      seal.position.y = 0.13;
      ritual.add(seal);
    }

    const centralSigil = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 7, 32), gold);
    centralSigil.rotation.x = Math.PI / 2;
    centralSigil.position.y = 0.12;
    ritual.add(centralSigil);

    const summoningColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.82, 3.25, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
    );
    summoningColumn.position.y = 1.68;
    ritual.add(summoningColumn);

    ritual.position.set(this.playerPos.x, groundY, this.playerPos.z);
    this.levelRoot.add(ritual);

    this.specialEffects.push({
      mesh: ritual,
      life: 1.25,
      maxLife: 1.25,
      grow: 0,
      spin: 0,
      update: (dt, progress) => {
        const pulse = 0.78 + Math.sin(progress * Math.PI) * 0.24;
        ritual.scale.setScalar(pulse);
        ritual.rotation.y += dt * 0.42;
        crimson.opacity = 0.95 * (1 - progress * 0.58);
        starLineMaterial.opacity = 0.95 * (1 - progress * 0.58);
        gold.opacity = 0.9 * (1 - progress * 0.42);
        aura.opacity = 0.24 * (1 - progress);
        const columnMaterial = summoningColumn.material as THREE.MeshBasicMaterial;
        columnMaterial.opacity = 0.2 * (1 - progress);
      },
      cleanup: () => this.disposeTemporaryObject(ritual),
    });
  }

  private spawnMafiCapybaras(abilityDamageMultiplier: number) {
    for (const capybara of this.mafiCapybaras) {
      this.levelRoot.remove(capybara.group);
      this.disposeTemporaryObject(capybara.group);
    }
    this.mafiCapybaras = [];

    const groundY = Math.max(0.04, this.playerPos.y - 0.48);
    this.spawnMafiPentagramEffect(groundY);
    sound.playAttackWhoosh();
    this.triggerScreenShake(0.38, 0.28);
    this.triggerBloomPulse(0.58);

    // The pentagram itself has a real combat payoff: it breaks shields,
    // damages the whole nearby pack and briefly interrupts their attacks.
    const ritualRadius = this.gameMode === 'survival' ? 5.7 : 6.2;
    const burstDamage = Math.max(2, Math.ceil(3 * abilityDamageMultiplier));
    for (const enemy of this.enemies) {
      if (enemy.state === 'defeated') continue;
      const distance = Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z);
      if (distance > ritualRadius || Math.abs(enemy.y - this.playerPos.y) > 2.0) continue;

      enemy.shieldActive = false;
      this.damageEnemy(enemy, burstDamage, this.playerPos.x, this.playerPos.z);
      if (enemy.hp <= 0) {
        this.defeatEnemy(enemy, 320, false);
      } else {
        enemy.stunTimer = Math.max(enemy.stunTimer, this.gameMode === 'survival' ? 0.85 : 1.15);
        enemy.state = 'stunned';
      }
      this.spawnParticleRing(enemy.x, enemy.y + 0.65, enemy.z, 0xd946ef);
      this.emitFloatingToast('✦ PENTAGRAM B4 • -' + burstDamage + ' HP', enemy.x, enemy.y + 1.0, enemy.z, 'damage');
    }

    const duration = this.gameMode === 'survival' ? 12.0 : 15.0;
    const formationForwardX = Math.sin(this.playerRot);
    const formationForwardZ = Math.cos(this.playerRot);
    const formationRightX = Math.cos(this.playerRot);
    const formationRightZ = -Math.sin(this.playerRot);
    // A stable rear V keeps both rifle guards on the flanks and the baton
    // enforcer in the centre lane. They move with the operator, not in circles.
    const formationSlots = [
      { lateral: -2.05, forward: -0.55 },
      { lateral: 0, forward: -2.45 },
      { lateral: 2.05, forward: -0.55 },
    ] as const;
    for (let index = 0; index < formationSlots.length; index++) {
      const group = this.createMafiCapybaraModel(index);
      const slot = formationSlots[index];
      group.position.set(
        this.playerPos.x + formationRightX * slot.lateral + formationForwardX * slot.forward,
        groundY,
        this.playerPos.z + formationRightZ * slot.lateral + formationForwardZ * slot.forward
      );
      group.rotation.y = this.playerRot + Math.PI;
      this.levelRoot.add(group);
      this.mafiCapybaras.push({
        group,
        life: duration,
        maxLife: duration,
        age: 0,
        attackCooldown: 0.22 + index * 0.2,
        pounceTimer: 0,
        pounceTarget: null,
        index,
      });
    }

    this.sayQuote('MAFIKAPIBARY WEZWANE! Trzy garnitury, jeden interes — porządek na hali.');
    this.callbacks.onPerkDropBanner?.(
      'MAFIKAPIBAR • RYTUAŁ B4',
      '🐾🕶️',
      'Trzy większe MafiKapibary trzymają szyk V za operatorem: karabinowi ochroniarze kryją lewe i prawe skrzydło, a egzekutor z podwójną pałką pilnuje odwrotu. Cała trójka priorytetowo przechwytuje wrogów zagrażających operatorowi przez 12–15 sekund.',
      '#d946ef'
    );
    this.emitFloatingToast('🕶️ MAFIKAPIBARY PRZEJMUJĄ MAGAZYN!', this.playerPos.x, this.playerPos.y + 1.55, this.playerPos.z, 'combo');
    this.spawnParticleRing(this.playerPos.x, groundY + 0.2, this.playerPos.z, 0xd946ef);
  }

  private updateMafiCapybaras(dt: number) {
    if (this.mafiCapybaras.length === 0) return;

    const forwardX = Math.sin(this.playerRot);
    const forwardZ = Math.cos(this.playerRot);
    const rightX = Math.cos(this.playerRot);
    const rightZ = -Math.sin(this.playerRot);
    // Stable bodyguard V: two ranged flankers cover the sides while the
    // dual-baton enforcer protects the rear approach. No idle orbiting.
    const formationSlots = [
      { lateral: -2.05, forward: -0.55 },
      { lateral: 0, forward: -2.45 },
      { lateral: 2.05, forward: -0.55 },
    ] as const;

    for (let index = this.mafiCapybaras.length - 1; index >= 0; index--) {
      const capybara = this.mafiCapybaras[index];
      capybara.age += dt;
      capybara.life -= dt;

      if (capybara.life <= 0) {
        const position = capybara.group.position.clone();
        this.levelRoot.remove(capybara.group);
        this.disposeTemporaryObject(capybara.group);
        this.mafiCapybaras.splice(index, 1);
        this.spawnParticleRing(position.x, 0.18, position.z, 0xfbbf24);
        if (this.mafiCapybaras.length === 0) {
          this.emitFloatingToast('MAFIKAPIBARY WRACAJĄ NA ODPRAWĘ.', this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z, 'perk');
        }
        continue;
      }

      const slot = formationSlots[capybara.index] || formationSlots[1];
      const baseX = this.playerPos.x + rightX * slot.lateral + forwardX * slot.forward;
      const baseZ = this.playerPos.z + rightZ * slot.lateral + forwardZ * slot.forward;
      let targetX = baseX;
      let targetZ = baseZ;
      let jumpHeight = 0;

      if (capybara.pounceTimer > 0 && capybara.pounceTarget) {
        capybara.pounceTimer = Math.max(0, capybara.pounceTimer - dt);
        const progress = 1 - capybara.pounceTimer / 0.52;
        const reach = progress < 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
        const weight = THREE.MathUtils.clamp(reach, 0, 1);
        targetX = THREE.MathUtils.lerp(baseX, capybara.pounceTarget.x, weight);
        targetZ = THREE.MathUtils.lerp(baseZ, capybara.pounceTarget.z, weight);
        jumpHeight = Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1)) * 0.72;
        if (capybara.pounceTimer <= 0) capybara.pounceTarget = null;
      }

      const groundY = Math.max(0.04, this.playerPos.y - 0.48);
      const fadeIn = THREE.MathUtils.clamp(capybara.age / 0.42, 0, 1);
      const fadeOut = THREE.MathUtils.clamp(capybara.life / 0.85, 0, 1);
      capybara.group.scale.setScalar(1.34 * fadeIn * fadeOut);
      const followLerp = Math.min(1, dt * (capybara.pounceTimer > 0 ? 5.5 : 9.5));
      capybara.group.position.x = THREE.MathUtils.lerp(capybara.group.position.x, targetX, followLerp);
      capybara.group.position.z = THREE.MathUtils.lerp(capybara.group.position.z, targetZ, followLerp);
      capybara.group.position.y = groundY - (1 - fadeIn) * 0.18 +
        jumpHeight + Math.sin(performance.now() * 0.006 + capybara.index * 2.1) * 0.025;
      capybara.group.rotation.y = capybara.pounceTimer > 0 && capybara.pounceTarget
        ? Math.atan2(capybara.pounceTarget.x - capybara.group.position.x, capybara.pounceTarget.z - capybara.group.position.z)
        : this.playerRot + Math.PI;

      capybara.attackCooldown -= dt;
      if (capybara.attackCooldown > 0 || capybara.pounceTimer > 0) continue;

      // Select the most dangerous nearby enemy, not simply the closest model
      // to this companion. Enemies threatening the player get first priority.
      let target: EnemyItem | null = null;
      let nearest = 15.5;
      let bestThreatScore = Number.POSITIVE_INFINITY;
      for (const enemy of this.enemies) {
        if (enemy.state === 'defeated' || !enemy.mesh?.visible) continue;
        const guardDistance = Math.hypot(enemy.x - capybara.group.position.x, enemy.z - capybara.group.position.z);
        if (guardDistance > 15.5) continue;
        const playerDistance = Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z);
        const threatensPlayer = playerDistance <= 6.25;
        const isMajorBoss = enemy.type === 'walczak' || enemy.type === 'krol_leto' || enemy.type === 'bosman_krakow';
        const isElite = enemy.maxHp >= 12 || isMajorBoss || enemy.type === 'sebix_m';
        const flankBias = capybara.index === 0 && enemy.x < this.playerPos.x
          ? -0.65
          : capybara.index === 2 && enemy.x > this.playerPos.x
            ? -0.65
            : 0;
        const threatScore =
          (threatensPlayer ? -8 : 0) +
          playerDistance * 0.48 +
          guardDistance * 0.28 +
          (isElite ? -1.2 : 0) +
          (isMajorBoss ? -0.75 : 0) +
          flankBias;
        if (threatScore < bestThreatScore) {
          bestThreatScore = threatScore;
          nearest = guardDistance;
          target = enemy;
        }
      }
      if (!target) continue;

      capybara.group.rotation.y = Math.atan2(
        target.x - capybara.group.position.x,
        target.z - capybara.group.position.z
      );
      const rifleGuard = capybara.index !== 1 && nearest > 4.0;
      if (rifleGuard) {
        const muzzleLocal = capybara.group.userData.mafiMuzzleLocal as THREE.Vector3 | undefined;
        const muzzlePosition = capybara.group.localToWorld(
          (muzzleLocal || new THREE.Vector3(-0.035, 0.455, 1.35)).clone()
        );
        const targetPosition = new THREE.Vector3(target.x, target.y + 0.62, target.z);
        const direction = targetPosition.sub(muzzlePosition);
        if (direction.lengthSq() < 0.001) continue;
        direction.normalize();

        // One low-poly tracer keeps the shot readable at half the object count.
        const tracer = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 7, 5),
          new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false })
        );
        tracer.name = 'mafi_carbine_tracer';
        tracer.scale.set(0.9, 0.9, 1.8);
        tracer.position.copy(muzzlePosition);
        this.levelRoot.add(tracer);

        const targetIsMajorBoss = target.type === 'walczak' || target.type === 'krol_leto' || target.type === 'bosman_krakow';
        this.projectiles.push({
          mesh: tracer,
          vel: direction.multiplyScalar(27),
          life: 1.05,
          maxLife: 1.05,
          damage: capybara.index === 0 && targetIsMajorBoss ? 3 : 2,
          pierce: capybara.index === 0 ? 1 : 0,
          weaponProjectile: true,
          disposeOnRemove: true,
          stunDuration: 0.22,
          hitIds: new Set<string>(),
        });
        capybara.attackCooldown = capybara.index === 0 ? 0.72 : 0.88;
        this.spawnParticleRing(muzzlePosition.x, muzzlePosition.y, muzzlePosition.z, 0xfbbf24);
        sound.playAttackWhoosh();
        continue;
      }

      // The baton unit intercepts threats close to the player; ranged guards
      // switch to a close protection strike if an enemy breaks through the V.
      const playerThreatDistance = Math.hypot(target.x - this.playerPos.x, target.z - this.playerPos.z);
      const interceptingPlayer = playerThreatDistance <= 5.2;
      target.shieldActive = false;
      const targetIsMajorBoss = target.type === 'walczak' || target.type === 'krol_leto' || target.type === 'bosman_krakow';
      const damage = this.scaleSurvivalDamage(capybara.index === 1 ? (targetIsMajorBoss ? 4 : 3) : targetIsMajorBoss ? 3 : 2);
      this.damageEnemy(target, damage, capybara.group.position.x, capybara.group.position.z);
      if (target.hp <= 0) {
        this.defeatEnemy(target, 300, false);
      } else {
        target.stunTimer = Math.max(target.stunTimer, interceptingPlayer ? 0.82 : this.gameMode === 'survival' ? 0.58 : 0.72);
        target.state = 'stunned';
      }
      capybara.pounceTarget = new THREE.Vector3(target.x, groundY, target.z);
      capybara.pounceTimer = 0.52;
      capybara.attackCooldown = capybara.index === 1 ? 1.02 : 1.24;
      this.spawnParticleRing(target.x, target.y + 0.42, target.z, capybara.index === 1 ? 0xef4444 : 0xfbbf24);
      if (interceptingPlayer || target.maxHp >= 12) {
        this.emitFloatingToast(
          interceptingPlayer ? '🕶️ MAFIA OCHRANIA OPERATORA!' : '🥊 ODPRAWA MAFII • CEL PRIORYTETOWY!',
          target.x,
          target.y + 1.1,
          target.z,
          'damage'
        );
      }
      const batonRig = capybara.group.userData.mafiBatonRig as THREE.Group | undefined;
      if (batonRig) batonRig.rotation.z = (capybara.index % 2 === 0 ? 1 : -1) * 0.34;
      sound.playSmack();
    }
  }

  private resetAbilityCooldown() {
    this.abilityCooldownState = createAbilityCooldown(0);
    this.abilityCooldownUiTimer = 0;
    this.abilityCooldownLastProgress = -1;
    this.abilityCooldownLastReady = null;
    this.updateAbilityCooldown(0, true);
  }

  private updateAbilityCooldown(dt: number, force = false) {
    this.abilityCooldownState = advanceAbilityCooldown(this.abilityCooldownState, dt);
    this.abilityCooldownUiTimer = Math.max(0, this.abilityCooldownUiTimer - (Number.isFinite(dt) ? Math.max(0, dt) : 0));

    const progress = getAbilityCooldownProgress(this.abilityCooldownState);
    const ready = this.abilityCooldownState.remainingSeconds <= 0.0001;
    const shouldNotify = force ||
      this.abilityCooldownUiTimer <= 0 ||
      ready !== this.abilityCooldownLastReady ||
      Math.abs(progress - this.abilityCooldownLastProgress) >= 0.008;

    if (!shouldNotify) return;
    this.callbacks.onAbilityCooldown(
      progress,
      ready,
      this.abilityCooldownState.remainingSeconds,
      true
    );
    this.abilityCooldownLastProgress = progress;
    this.abilityCooldownLastReady = ready;
    // 12.5 Hz is enough for the visible recharge bar without writing to the DOM every frame.
    this.abilityCooldownUiTimer = 0.08;
  }

  private rechargeAbilityFromKill(isElite: boolean, isBoss = false) {
    if (this.abilityCooldownState.remainingSeconds <= 0.0001) return;
    const mode = this.gameMode;
    const modeMultiplier = mode === 'survival' ? this.survivalAbilityKillRechargeMultiplier : 1;
    // Bosses provide a clear tactical payoff; ordinary kills still build the
    // Archero-style chain but are bounded by a per-use recharge budget.
    const baseRechargeSeconds = getAbilityKillRechargeSeconds(mode, isElite, isBoss);
    const chainMultiplier = 1 + Math.min(0.35, Math.max(0, this.comboStreak - 1) * 0.04);
    const requestedSeconds = baseRechargeSeconds * modeMultiplier * chainMultiplier;
    const capRatio = mode === 'survival'
      ? this.survivalAbilityKillRechargeCapRatio
      : getAbilityKillRechargeCapRatio('campaign');
    const rechargeLimit = this.abilityCooldownState.durationSeconds * capRatio;
    const result = applyAbilityKillRecharge(this.abilityCooldownState, requestedSeconds, rechargeLimit);
    if (result.rechargedSeconds <= 0) return;

    this.abilityCooldownState = result.state;
    this.updateAbilityCooldown(0, true);
    if (isElite || isBoss || this.comboStreak % 5 === 0) {
      const chainLabel = this.comboStreak >= 5 ? ' • SERIA x' + this.comboStreak : '';
      const targetLabel = isBoss ? 'BOSS' : 'ELITA';
      this.emitFloatingToast(
        '⚡ ' + targetLabel + ' • ŁADUNEK +' + result.rechargedSeconds.toFixed(1) + ' s' + chainLabel,
        this.playerPos.x,
        this.playerPos.y + 1.55,
        this.playerPos.z,
        'combo'
      );
    }
  }

  private updateSurvivalDashCooldown(dt: number, force = false) {
    this.survivalDashCooldownRemaining = Math.max(0, this.survivalDashCooldownRemaining - Math.max(0, dt));
    this.survivalDashUiTimer = Math.max(0, this.survivalDashUiTimer - Math.max(0, dt));
    const progress = getSurvivalDashProgress(this.survivalDashCooldownRemaining, this.survivalDashCooldownDuration);
    const ready = this.survivalDashCooldownRemaining <= 0.0001;
    const shouldNotify = force ||
      this.survivalDashUiTimer <= 0 ||
      ready !== this.survivalDashLastReady ||
      Math.abs(progress - this.survivalDashLastProgress) >= 0.02;
    if (!shouldNotify) return;
    this.callbacks.onSurvivalDashUpdate?.(progress, ready, this.survivalDashCooldownRemaining);
    this.survivalDashLastProgress = progress;
    this.survivalDashLastReady = ready;
    this.survivalDashUiTimer = 0.08;
  }

  public triggerDash(): boolean {
    if (this.gameMode === 'pvp') {
      this.triggerPvpDash();
      return true;
    }
    if (
      this.state !== 'playing' ||
      this.survivalDashCooldownRemaining > 0.0001 ||
      this.survivalDashDurationRemaining > 0
    ) return false;

    const dashDuration = 0.22;
    const dashSpeed = 18;
    const dashDistance = dashDuration * dashSpeed;
    let warningEnemy: EnemyItem | null = null;
    let warningDirection = 0;

    // Only the final 0.30 seconds of a visible, committed boss lane qualify.
    // This prevents an ordinary dash through a harmless warning from farming rewards.
    for (const enemy of this.enemies) {
      const remaining = enemy.chargeTimer;
      if (
        enemy.state === 'defeated' ||
        remaining === undefined ||
        remaining <= 0.001 ||
        remaining > 0.30 ||
        !Number.isFinite(enemy.chargeDir) ||
        !Number.isFinite(enemy.chargeLaneLength) ||
        !Number.isFinite(enemy.chargeLaneWidth)
      ) continue;

      const laneDirection = enemy.chargeDir as number;
      if (!isInsideBossAttackLane(
        this.playerPos.x,
        this.playerPos.z,
        enemy.x,
        enemy.z,
        laneDirection,
        enemy.chargeLaneLength as number,
        enemy.chargeLaneWidth as number
      )) continue;

      warningEnemy = enemy;
      warningDirection = laneDirection;
      break;
    }

    let directionX = 0;
    let directionZ = 0;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) directionX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) directionX -= 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) directionZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) directionZ += 1;

    if (Math.abs(this.virtualJoystick.x) > 0.08 || Math.abs(this.virtualJoystick.y) > 0.08) {
      directionX = this.virtualJoystick.x;
      directionZ = this.virtualJoystick.y;
    }

    let directionLength = Math.hypot(directionX, directionZ);
    if (directionLength <= 0.08 && warningEnemy) {
      // On a last-moment boss warning, a no-direction input becomes an automatic
      // sidestep. Pick the side with more free arena space instead of dashing into the lane.
      const sideX = Math.cos(warningDirection);
      const sideZ = -Math.sin(warningDirection);
      // The connected Campaign map has sector-specific playable depth; do not
      // use Survival's arena bounds or a stale single-sector rectangle here.
      const campaignHalfDepth = this.playerPos.x < 116 ? 19 : 21;
      const dashBounds = this.gameMode === 'campaign'
        ? { ...this.levelBounds, minZ: -campaignHalfDepth, maxZ: campaignHalfDepth }
        : this.levelBounds;
      const clearance = (x: number, z: number): number => {
        let available = Number.POSITIVE_INFINITY;
        if (x > 0.0001) available = Math.min(available, (dashBounds.maxX - this.playerPos.x) / x);
        else if (x < -0.0001) available = Math.min(available, (dashBounds.minX - this.playerPos.x) / x);
        if (z > 0.0001) available = Math.min(available, (dashBounds.maxZ - this.playerPos.z) / z);
        else if (z < -0.0001) available = Math.min(available, (dashBounds.minZ - this.playerPos.z) / z);
        return Math.max(0, available);
      };
      const leftClearance = clearance(sideX, sideZ);
      const rightClearance = clearance(-sideX, -sideZ);
      const preferredSide = leftClearance >= rightClearance ? 1 : -1;
      directionX = sideX * preferredSide;
      directionZ = sideZ * preferredSide;
      directionLength = 1;
    }

    if (directionLength > 0.08) {
      directionX /= directionLength;
      directionZ /= directionLength;
    } else {
      directionX = Math.sin(this.playerRot);
      directionZ = Math.cos(this.playerRot);
    }

    const isPerfectDodge = warningEnemy !== null && isEffectiveBossLaneDodge(
      this.playerPos.x,
      this.playerPos.z,
      directionX,
      directionZ,
      dashDistance,
      warningEnemy.x,
      warningEnemy.z,
      warningDirection,
      warningEnemy.chargeLaneLength as number,
      warningEnemy.chargeLaneWidth as number
    );

    this.survivalDashDirection.set(directionX, 0, directionZ).normalize();
    this.survivalDashDurationRemaining = dashDuration;
    this.survivalDashCooldownDuration = this.gameMode === 'survival'
      ? getSurvivalDashCooldownSeconds(this.survivalDashCooldownMultiplier)
      : 7.0;
    this.survivalDashCooldownRemaining = this.survivalDashCooldownDuration;
    // Invulnerability covers the dodge and a short exit window, not a full defensive shield.
    this.invulnerableTimer = Math.max(this.invulnerableTimer, 0.32);
    if (!this.manualAimEnabled) this.playerRot = Math.atan2(directionX, directionZ);
    this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.28, this.playerPos.z, isPerfectDodge ? 0xfacc15 : 0x67e8f9);
    this.triggerScreenShake(isPerfectDodge ? 0.20 : 0.10, isPerfectDodge ? 0.14 : 0.09);
    sound.playAttackWhoosh();

    if (isPerfectDodge) {
      if (this.gameMode === 'survival') {
        this.survivalPerfectDodges++;
        // One perfect dodge charges exactly one subsequent weapon volley; charges do not stack.
        this.survivalCounterattackReady = true;
      } else {
        // Campaign has character-specific primary attacks instead of Survival weapons.
        // Charge one +1 damage hit and consume it on the next valid primary attack.
        this.campaignCounterattackReady = true;
      }
      this.score += 100;
      this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);

      // A clean last-moment sidestep shortens the next dodge and special recharge.
      this.survivalDashCooldownRemaining = Math.max(
        this.gameMode === 'survival' ? 1.6 : 2.2,
        this.survivalDashCooldownRemaining - 1.35
      );
      this.abilityCooldownState = advanceAbilityCooldown(this.abilityCooldownState, 0.65);
      this.updateAbilityCooldown(0, true);
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.65, this.playerPos.z, 0xfacc15);
      this.triggerBloomPulse(0.32);
      this.emitFloatingToast(
        this.gameMode === 'survival'
          ? '✦ PERFECT DODGE! +100 PKT • SALWA +1 • SUPER +0,65 s'
          : '✦ IDEALNY UNIK BOSSA! +100 PKT • KONTRATAK +1 • SUPER +0,65 s',
        this.playerPos.x,
        this.playerPos.y + 1.35,
        this.playerPos.z,
        'combo'
      );
      sound.playPickup();
      if (this.gameMode === 'survival') this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
    } else {
      this.emitFloatingToast('↗ UNIK TAKTYCZNY!', this.playerPos.x, this.playerPos.y + 1.15, this.playerPos.z, 'perk');
    }

    this.updateSurvivalDashCooldown(0, true);
    return true;
  }

  public triggerAbility() {
    if (this.gameMode === 'pvp') {
      this.triggerPvpAbility();
      return;
    }
    if (this.state !== 'playing' || this.abilityCooldownState.remainingSeconds > 0.0001) return;
    const cooldownSeconds = getAbilityCooldownSeconds(this.charDef.abilityCooldown, this.gameMode) *
      this.characterMasteryBonuses.abilityCooldownMultiplier *
      (this.gameMode === 'survival' ? this.survivalAbilityCooldownMultiplier : 1);
    this.abilityCooldownState = createAbilityCooldown(cooldownSeconds);
    this.updateAbilityCooldown(0, true);
    const abilityDamageMultiplier = this.gameMode === 'survival'
      ? Math.min(1.2, this.survivalDamageMultiplier * 0.78) : 1;

    sound.playAbility(this.currentCharacterId);
    this.cameraShake = 0.45;
    this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, this.charDef.color);

    if (this.currentCharacterId === 'marcin') {
      // The WZ-404 is a temporary autonomous support unit, not a one-frame visual burst.
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.callbacks.onHpUpdate(this.hp, this.maxHp);
      this.activatePerk('order_magnet', 8);
      this.spawnMarcinTank();
      this.sayQuote('KONWÓJ WZ-404! DO BOJU! To nie jest samouczek — wsparcie ciężkie wjeżdża na halę!');
    } else if (this.currentCharacterId === 'grzesiek') {
      this.grzesiekCrushTimer = 0.9;
      this.grzesiekCrushPulse = 1.0;
      this.activatePerk('golden_paleciak', this.gameMode === 'survival' ? 2.6 : 6);
      this.spawnGrzesiekShockwave();
      const forward = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
      this.playerPos.x += forward.x * 1.8;
      this.playerPos.z += forward.z * 1.8;
      this.sayQuote('ŚCIŚK ZAGŁADY 44CM + TRYB TARANA! Z drogi śledzie, Operator 02 jedzie!');
      sound.playSciskCrush();
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0x4ade80);
      this.enemies.forEach((e) => {
        if (e.state === 'defeated') return;
        const dx = e.x - this.playerPos.x;
        const dz = e.z - this.playerPos.z;
        const dist = Math.hypot(dx, dz);
        const dirDot = (dx * forward.x + dz * forward.z) / Math.max(1, dist);
        if (dist < 5.6 && dirDot > -0.35) {
          e.shieldActive = false;
          const damage = Math.ceil(3 * abilityDamageMultiplier);
          this.damageEnemy(e, damage);
          e.stunTimer = this.gameMode === 'survival' ? 0.9 : 2.0;
          e.state = 'stunned';
          this.cameraShake = 0.65;
          this.spawnParticleRing(e.x, e.y + 0.6, e.z, 0x86efac);
          this.emitFloatingToast('-' + Math.ceil(3 * abilityDamageMultiplier) + ' HP ŚCISK 44CM!', e.x, e.y + 0.8, e.z, 'damage');
          if (e.hp <= 0) {
            this.defeatEnemy(e, 300, false);
          }
        }
      });
    } else if (this.currentCharacterId === 'dawid') {
      this.activatePerk('hardhat', this.gameMode === 'survival' ? 4.5 : 15);
      // Operator 03 also drops a fresh KFC bucket right in front of him!
      const fwd = new THREE.Vector3(Math.sin(this.playerRot), 0, Math.cos(this.playerRot));
      this.addKfcBucketItem(
        `dawid_kfc_${Date.now()}`,
        this.playerPos.x + fwd.x * 2.2,
        0.45,
        THREE.MathUtils.clamp(this.playerPos.z + fwd.z * 2.2, -15, 15)
      );
      this.sayQuote('JA WIEM LEPIEJ! Salwa 5 płyt Marmur B4 120x280 pod kątem 45° + świeży Kubełek Mocy!');
      sound.playAttackWhoosh();
      const angles = this.gameMode === 'survival' ? [-0.22, 0, 0.22] : [-0.5, -0.25, 0, 0.25, 0.5];
      angles.forEach((offsetAngle) => {
        const rot = this.playerRot + offsetAngle;
        const forward = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
        const tileGeo = new THREE.BoxGeometry(0.85, 0.12, 0.55);
        const tileMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: 0xd97706,
          emissiveIntensity: 0.65,
          metalness: 0.8,
          roughness: 0.2,
        });
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.set(this.playerPos.x, this.playerPos.y + 0.65, this.playerPos.z).addScaledVector(forward, 0.65);
        this.levelRoot.add(tile);
        this.projectiles.push({
          mesh: tile,
          disposeOnRemove: true,
          vel: forward.multiplyScalar(17.5),
          life: 1.45,
          damage: this.gameMode === 'survival' ? 1 : 2,
          pierce: this.gameMode === 'survival' ? 1 : 4,
          ricochet: true,
          collectItems: true,
          spinSpeed: 12.0,
          hitIds: new Set(),
        });
      });
      this.emitFloatingToast('🧱 SALWA GRESU 120x280 + ⚡ Kubełek Mocy!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'perk');
    } else if (this.currentCharacterId === 'mateusz') {
      this.activatePerk('espresso_boost', this.gameMode === 'survival' ? 3.5 : 7);
      this.activatePerk('vibram_boots', this.gameMode === 'survival' ? 3.5 : 8);
      this.spawnMateuszCats();
    } else if (this.currentCharacterId === 'piotr') {
      this.attackSwingDuration = 0.3;
      this.attackSwingTimer = this.attackSwingDuration;
      if (this.rightArm) this.rightArm.rotation.x = -1.15;
      this.sayQuote('RYTUAŁ MAFIKAPIBAR! Pentagram B4 otwiera przejście. Rodzina, do roboty!');
      this.spawnMafiCapybaras(abilityDamageMultiplier);
    }
  }

  private throwBimberMolotov(angleOffset = 0) {
    sound.playMolotovThrow();
    this.attackSwingDuration = 0.35;
    this.attackSwingTimer = this.attackSwingDuration;
    if (this.rightArm) {
      this.rightArm.rotation.x = -2.2;
    }

    const rot = this.playerRot + angleOffset;
    const forward = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const molotovData = createBimberBottleMolotov();
    const startPos = new THREE.Vector3(
      this.playerPos.x + forward.x * 0.7,
      this.playerPos.y + 1.1,
      this.playerPos.z + forward.z * 0.7
    );
    molotovData.group.position.copy(startPos);
    this.levelRoot.add(molotovData.group);

    // Initial forward velocity + high arc
    const throwVel = forward.clone().multiplyScalar(13.5);
    throwVel.y = 5.8;

    this.bimberMolotovs.push({
      mesh: molotovData.group,
      pos: startPos,
      vel: throwVel,
      spin: new THREE.Vector3(
        8.0 + Math.random() * 4.0,
        3.0 + Math.random() * 2.0,
        2.0 + Math.random() * 2.0
      ),
      life: 2.8,
      flameLight: molotovData.flameLight,
      flameMesh: molotovData.flameMesh,
    });

    this.emitFloatingToast('🍾 KOKTAJL MOŁOTOWA Z BIMBREM!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'combo');
  }

  private updateBimberMolotovs(dt: number) {
    for (let i = this.bimberMolotovs.length - 1; i >= 0; i--) {
      const b = this.bimberMolotovs[i];
      b.life -= dt;

      // Gravity pulls it down
      b.vel.y -= 17.0 * dt;
      b.pos.addScaledVector(b.vel, dt);

      // Tumbling spin in flight
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      b.mesh.position.copy(b.pos);

      // Flickering flame wick
      if (b.flameMesh) {
        const pulse = 1.0 + Math.sin(performance.now() * 0.02) * 0.3;
        b.flameMesh.scale.set(pulse, pulse * 1.2, pulse);
      }
      if (b.flameLight) {
        b.flameLight.intensity = 2.0 + Math.sin(performance.now() * 0.03) * 0.8;
      }

      // Trail of glowing sparks/smoke
      if (Math.random() < 0.5) {
        this.spawnParticleRing(b.pos.x, b.pos.y, b.pos.z, 0xff7700);
      }

      // Check collision with enemies
      let hitEnemy = false;
      this.enemies.forEach((e) => {
        if (e.state === 'defeated') return;
        const dist = Math.hypot(b.pos.x - e.x, b.pos.z - e.z);
        if (dist < 1.15 && Math.abs(b.pos.y - e.y) < 1.2) {
          hitEnemy = true;
        }
      });

      // Find platform ground height beneath the bottle
      let floorY = 0;
      for (const p of this.platforms) {
        const halfW = p.width / 2;
        const halfD = p.depth / 2;
        if (
          b.pos.x >= p.x - halfW &&
          b.pos.x <= p.x + halfW &&
          b.pos.z >= p.z - halfD &&
          b.pos.z <= p.z + halfD
        ) {
          const top = p.y + p.height / 2;
          if (top > floorY && b.pos.y >= top - 0.4) {
            floorY = top;
          }
        }
      }

      const hitGround = b.pos.y <= floorY + 0.15 && b.vel.y <= 0;

      if (hitEnemy || hitGround || b.life <= 0) {
        // DETONATION!
        this.detonateBimberMolotov(b.pos.x, Math.max(floorY, 0), b.pos.z);
        this.levelRoot.remove(b.mesh);
        this.disposeTemporaryObject(b.mesh);
        this.bimberMolotovs.splice(i, 1);
      }
    }
  }

  private detonateBimberMolotov(x: number, y: number, z: number) {
    sound.playGlassShatter();
    sound.playFireCrackle();
    this.triggerScreenShake(0.55, 0.45);

    // 1. Shards of broken glass flying in all directions
    for (let s = 0; s < 12; s++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 5.0;
      const shard = this.particlePool.acquire('flat-box', 0x86efac, 0.08, 0.9);
      if (!shard) break;
      shard.position.set(x, y + 0.3, z);
      this.levelRoot.add(shard);
      this.particles.push({
        mesh: shard,
        vel: new THREE.Vector3(Math.cos(angle) * speed, 2.5 + Math.random() * 3.5, Math.sin(angle) * speed),
        life: 0.6,
        maxLife: 0.6,
        baseScale: 0.08,
      });
    }

    // 2. Fireball impact flash
    const flashGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.85,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(x, y + 0.6, z);
    this.levelRoot.add(flash);
    this.specialEffects.push({
      mesh: flash,
      life: 0.45,
      maxLife: 0.45,
      disposeOnRemove: true,
      grow: 3.5,
      spin: 4.0,
    });

    // 3. Initial burst damage to anyone in the direct splash
    this.enemies.forEach((e) => {
      if (e.state === 'defeated') return;
      const dist = Math.hypot(e.x - x, e.z - z);
      if (dist < 3.2 && Math.abs(e.y - y) < 1.8) {
        this.damageEnemy(e, this.scaleSurvivalDamage(2));
        e.stunTimer = 1.5;
        e.state = 'stunned';
        e.onFireTimer = 3.5;
        this.emitFloatingToast('💥 -2 HP • PŁONĄCA MIESZANKA!', e.x, e.y + 0.9, e.z, 'damage');
        if (e.hp <= 0) {
          this.defeatEnemy(e, 280, false);
        }
      }
    });

    this.emitFloatingToast('🔥 MORZE OGNIA!', x, y + 1.3, z, 'combo');

    // 4. Create persistent burning fire puddle
    const puddle = createMolotovFirePuddle(3.8);
    puddle.group.position.set(x, y + 0.02, z);
    this.levelRoot.add(puddle.group);

    this.bimberFirePuddles.push({
      group: puddle.group,
      x,
      y,
      z,
      radius: 3.8,
      duration: 6.0,
      maxDuration: 6.0,
      tickTimer: 0.4,
      flames: puddle.flames,
      light: puddle.light,
    });
  }

  private updateBimberFirePuddles(dt: number) {
    for (let i = this.bimberFirePuddles.length - 1; i >= 0; i--) {
      const p = this.bimberFirePuddles[i];
      p.duration -= dt;

      // Animate flickering fire spires
      const time = performance.now() * 0.001;
      p.flames.forEach((flame) => {
        const u = flame.userData;
        const flicker = Math.sin(time * u.speed + u.phase);
        const scaleY = Math.max(0.3, 1.0 + flicker * 0.4);
        flame.scale.set(1.0 + flicker * 0.15, scaleY, 1.0 + flicker * 0.15);
      });

      // Flickering light
      p.light.intensity = 3.5 + Math.sin(time * 14) * 1.2;

      // Rising smoke and embers
      if (Math.random() < 0.45) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (p.radius * 0.7);
        const ex = p.x + Math.cos(angle) * r;
        const ez = p.z + Math.sin(angle) * r;
        const ember = this.particlePool.acquire('box', 0xffaa00, 0.08, 0.9);
        if (ember) {
          ember.position.set(ex, p.y + 0.3, ez);
          this.levelRoot.add(ember);
          this.particles.push({
            mesh: ember,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.8 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8),
            life: 0.5,
            maxLife: 0.5,
            baseScale: 0.08,
          });
        }
      }

      // Damage ticks over time
      p.tickTimer -= dt;
      if (p.tickTimer <= 0) {
        p.tickTimer = 0.5; // Damage every 0.5s

        this.enemies.forEach((e) => {
          if (e.state === 'defeated') return;
          const dist = Math.hypot(e.x - p.x, e.z - p.z);
          if (dist < p.radius && Math.abs(e.y - p.y) < 1.5) {
            this.damageEnemy(e, this.scaleSurvivalDamage(1), p.x, p.z);
            e.onFireTimer = 2.0;
            e.speed = Math.max(1.0, e.speed * 0.85); // Slowed by burning bimber
            sound.playHit();
            this.emitFloatingToast('🔥 -1 HP OGIEŃ!', e.x, e.y + 0.8, e.z, 'damage');
            this.spawnParticleRing(e.x, e.y + 0.5, e.z, 0xff5500);

            if (e.hp <= 0) {
              this.defeatEnemy(e, 260, false);
            }
          }
        });
      }

      // Fade out near expiration
      if (p.duration <= 0.8) {
        const fade = p.duration / 0.8;
        p.group.scale.set(fade, fade, fade);
        p.light.intensity *= fade;
      }

      if (p.duration <= 0) {
        // Puddle extinguishes with a puff of smoke
        for (let k = 0; k < 6; k++) {
          this.spawnDust(p.x + (Math.random() - 0.5) * 2, p.y + 0.2, p.z + (Math.random() - 0.5) * 2, 0x64748b);
        }
        this.levelRoot.remove(p.group);
        this.disposeTemporaryObject(p.group);
        this.bimberFirePuddles.splice(i, 1);
      }
    }
  }

  private defeatEnemy(e: EnemyItem, points: number, showToast: boolean = true) {
    if (e.state === 'defeated') return;
    this.clearSurvivalSupportShield(e);
    e.state = 'defeated';
    e.mesh.visible = false;
    if (this.gameMode === 'campaign') {
      if (e.id === 'bosman_l1') this.unlockCampaignSector(2);
      if (e.id === 'boss_krol_leto_l2') this.unlockCampaignSector(3);
    }
    const hitStopDur = (e.type === 'walczak' || e.type === 'krol_leto') ? 0.22 : 0.05;
    this.triggerHitStop(hitStopDur);

    // Combo streak calculation
    this.comboStreak++;
    this.comboTimer = this.charDef.id === 'mateusz' ? 5.5 : 3.8;
    const comboMultiplier = 1 + (this.comboStreak - 1) * 0.25;
    const survivalDifficultyMultiplier = this.gameMode === 'survival'
      ? getSurvivalKillScoreMultiplier(this.survivalWave)
      : 1;
    const finalPoints = Math.round(points * comboMultiplier * survivalDifficultyMultiplier);
    this.score += finalPoints;
    this.handleMateuszPassive(2);
    const isAbilityRechargeBoss =
      e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow';
    if (this.gameMode === 'survival' && isAbilityRechargeBoss) this.survivalBossesDefeated++;
    const isAbilityRechargeElite = isAbilityRechargeBoss ||
      e.type === 'elite_walczak_guard' || e.type === 'sebix_m' || e.maxHp >= 4;
    this.rechargeAbilityFromKill(isAbilityRechargeElite, isAbilityRechargeBoss);
    if (this.gameMode === 'survival') {
      this.survivalKills++;
      this.registerSurvivalContractAction('eliminations', 1);
      this.registerSurvivalContractAction('combo', this.comboStreak);
      this.registerSurvivalShiftEventAction('kills', 1);
      this.registerSurvivalShiftEventAction('combo', this.comboStreak);
      const momentumResult = registerSurvivalKill(this.survivalMomentum);
      this.survivalMomentum = momentumResult.state;
      if (momentumResult.overdriveStarted) {
        this.emitFloatingToast('⚡ OVERDRIVE B4! SERIA 6 ELIMINACJI', this.playerPos.x, this.playerPos.y + 1.85, this.playerPos.z, 'combo');
        this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.35, this.playerPos.z, 0xfbbf24);
        this.triggerBloomPulse(0.42);
        this.triggerScreenShake(0.20, 0.13);
        sound.playPickup(3);
        this.callbacks.onSurvivalUpdate?.(this.getSurvivalSnapshot());
      }
      const isShiftMilestone = this.survivalKills % 8 === 0;
      const rawXpMultiplier = e.survivalXpMultiplier;
      const waveXpMultiplier = Number.isFinite(rawXpMultiplier)
        ? THREE.MathUtils.clamp(rawXpMultiplier as number, 1, 1.75)
        : 1;
      const baseXpDrop = Math.max(1, Math.round((e.maxHp >= 4 ? 3 : 1) * waveXpMultiplier));
      // Merge the small milestone bonus into the normal gem instead of spawning
      // two overlapping pickups at exactly the same coordinates.
      this.spawnSurvivalXpGem(e.x, e.y, e.z, baseXpDrop + (isShiftMilestone ? 2 : 0));
      if (isShiftMilestone) {
        this.spawnParticleRing(e.x, e.y + 0.7, e.z, 0x38bdf8);
        this.emitFloatingToast('📦 NORMA ZMIANY x8 — BONUS +2 XP DO ZEBRANIA!', e.x, e.y + 1.8, e.z, 'combo');
      }
    }

    if (e.type === 'pomazaniec') {
      this.spawnParticleRing(e.x, e.y + 0.35, e.z, 0xf472b6);
      this.spawnParticleRing(e.x, e.y + 0.78, e.z, 0xfacc15);
      sound.playLollipopHit();
      const pomazanceRemaining = this.enemies.filter((enemy) =>
        enemy.type === 'pomazaniec' && enemy.state !== 'defeated'
      ).length;
      if (pomazanceRemaining === 0 && this.survivalPomazaniecTriggered && !this.survivalPomazaniecCompleted) {
        this.survivalPomazaniecCompleted = true;
        this.score += 1500;
        this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
        // Each of the five defeated riders already drops 3 XP. Keep the bonus at
        // 15 XP total instead of spawning a second, duplicate set of XP gems.
        this.callbacks.onSurvivalAnnouncement?.(
          'ROWEROWY BOSS: OCALONA (CHWILOWO)',
          'RAJD POMAZAŃCÓW ROZBITY!',
          'Pięć rowerków, zero hamulców. Premia za obronę hali: +1 500 punktów i 15 XP do zebrania.'
        );
        this.emitFloatingToast('🏆 POMAZANIEC RAID — +1 500 PKT!', this.playerPos.x, this.playerPos.y + 1.9, this.playerPos.z, 'combo');
        sound.playPomazaniecVictory();
        this.triggerHitStop(0.12);
        this.triggerScreenShake(0.42, 0.34);
        this.triggerBloomPulse(0.42);
      }
    }

    if (showToast) {
      this.emitFloatingToast(`+${finalPoints} Pkt Neutralizacja!`, e.x, e.y + 1, e.z, 'points');
    }

    if (this.comboStreak >= 2) {
      const comboMsg =
        this.comboStreak >= 5
          ? `👑 LEGENDARNY KIEROWNIK x${this.comboStreak}!`
          : this.comboStreak >= 4
            ? `⚡⚡ SAKRAMENCKI FLOW x${this.comboStreak}!`
            : this.comboStreak >= 3
              ? `🔥🔥 WŚCIEKŁY MAGAZYNIER x${this.comboStreak}!`
              : `🔥 COMBO x${this.comboStreak}!`;
      this.emitFloatingToast(comboMsg, e.x, e.y + 1.6, e.z, 'combo');
    }

    this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);

    // In-world Perk Drop (Perki dropione na mapie z wrogów!)
    const isBossReward =
      e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow' ||
      e.type === 'elite_walczak_guard' || e.maxHp >= 4;
    const isSurvivalEliteReward =
      e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow' ||
      e.type === 'elite_walczak_guard' || e.type === 'sebix_m' ||
      e.type === 'mutant_gamma_forklift' || e.type === 'radioactive_pip' || e.type === 'cyber_salesman';
    const dropChance = this.gameMode === 'survival'
      ? (isSurvivalEliteReward ? 1.0 : 0.18)
      : this.charDef.id === 'piotr'
        ? 1.0
        : isBossReward
          ? 1.0
          : 0.48;
    const finalDropChance = this.gameMode === 'survival'
      ? (isSurvivalEliteReward ? 1.0 : Math.min(0.55, dropChance * this.survivalDropMultiplier))
      : dropChance;

    if (Math.random() <= finalDropChance) {
      this.spawnDroppedPerk(e.x, e.y + 0.1, e.z);
    }

    if (this.gameMode === 'survival' && (e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow' || e.type === 'sebix_m')) {
      this.spawnLootCrate(e.x + 1.2, 0, e.z);
      this.spawnSurvivalXpGem(e.x, e.y, e.z, e.type === 'sebix_m' ? 5 : 8);
      this.emitFloatingToast(e.type === 'sebix_m' ? '🔥 OPERATOR TURBO ROZBROJONY — SKRZYNIA B4!' : '🏆 SKRZYNIA Z NAGRODĄ BOSS-A!', e.x, e.y + 2.0, e.z, 'combo');
    }

    if (this.gameMode === 'survival' && (e.type === 'mutant_gamma_forklift' || e.type === 'radioactive_pip' || e.type === 'cyber_salesman')) {
      this.spawnLootCrate(e.x + 0.8, 0, e.z);
      this.spawnSurvivalXpGem(e.x, e.y, e.z, 6);
      this.spawnParticleRing(e.x, e.y + 0.5, e.z, e.type === 'cyber_salesman' ? 0x38bdf8 : 0x4ade80);
      this.emitFloatingToast('☣️ ZMUTOWANY ELITARIUSZ POKONANY — ZŁOTA SKRZYNIA!', e.x, e.y + 1.8, e.z, 'combo');
      sound.playEasterEgg();
    }

    if (e.type === 'sebix_m') {
      this.callbacks.onBossUpdate?.(e.name, 0, e.maxHp, false);
      this.sayQuote('OPERATOR TURBO ZGASZONY! Cegły wracają na paletę, a B4 odzyskuje spokój.');
      this.triggerScreenShake(1.05, 0.72);
      this.triggerBloomPulse(0.48);
      this.spawnParticleRing(e.x, e.y + 0.7, e.z, 0xf97316);
      this.spawnParticleRing(e.x, e.y + 1.35, e.z, 0xef4444);
      this.spawnExplosionParticles(e.x, e.y + 0.8, e.z, 0xff7a18, 20);
    } else if (e.type === 'walczak' || e.maxHp >= 4) {
      this.callbacks.onBossUpdate?.(e.name, 0, e.maxHp, false);
      const defeatLine = e.survivalAuditor
        ? 'AUDYTOR NIEZAPOWIEDZIANY ZNEUTRALIZOWANY! Strefa czerwonej kontroli wygasła!'
        : e.name.includes('Inwentaryzacja Gigant')
          ? 'INWENTARYZACJA GIGANT ZAMKNIĘTA! Ostatni protokół podpisany!'
          : e.type === 'walczak'
            ? 'NADZORCA ZERO POKONANY! Droga wolna!'
            : e.name.toUpperCase() + ' — NEUTRALIZACJA ZAKOŃCZONA!';
      this.sayQuote(defeatLine);

      // Intense long screen shake for major enemy defeats.
      this.triggerScreenShake(2.2, 1.25);

      this.spawnParticleRing(e.x, e.y + 1.0, e.z, 0xef4444);
      this.spawnParticleRing(e.x, e.y + 1.5, e.z, 0xf59e0b);
      this.spawnParticleRing(e.x, e.y + 2.0, e.z, 0x3b82f6);

      const geo = new THREE.TorusGeometry(1.2, 0.18, 16, 48);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(e.x, e.y + 0.5, e.z);
      this.levelRoot.add(mesh);
      this.specialEffects.push({ mesh, life: 1.2, maxLife: 1.2, grow: 12.0, spin: 15.0, disposeOnRemove: true });
      this.spawnExplosionParticles(e.x, e.y + 1.1, e.z, 0xfbbf24, 28);
    } else {
      // A compact shard burst gives ordinary enemies a visible but lightweight hit-confirm.
      const impactColor = e.type === 'pomazaniec' ? 0xf472b6 : e.id.includes('sebix') ? 0xf97316 : 0x38bdf8;
      this.spawnCompactImpact(e.x, e.y + 0.62, e.z, impactColor);
      this.triggerScreenShake(0.35, 0.25);
    }

    if (
      this.gameMode === 'survival' &&
      (e.type === 'walczak' || e.type === 'krol_leto' || e.type === 'bosman_krakow' || e.type === 'sebix_m')
    ) {
      this.beginSurvivalBossReward(e.name);
    }
  }

  private takeDamage(reason: string, amount: number = 1) {
    if (this.invulnerableTimer > 0) return;

    if (this.marcinReclamationTimer > 0) {
      this.triggerScreenShake(0.2, 0.2);
      return;
    }

    if ((this.activePerks.damageWard || 0) > 0 && this.armorBlockCooldown <= 0) {
      this.armorBlockCooldown = 2.4;
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.9, this.playerPos.z, 0x84cc16);
      this.emitFloatingToast('🪵 PALETA EURO ZABLOKOWAŁA UDERZENIE!', this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z, 'perk');
      sound.playShieldBreak();
      this.triggerScreenShake(0.22, 0.18);
      return;
    }

    if (this.activePerks.shield) {
      this.activePerks.shield = false;
      this.invulnerableTimer = 1.2;
      sound.playShieldBreak();
      this.sayQuote('Kask BHP amortyzował uderzenie!');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 0x3b82f6);
      this.callbacks.onPerksUpdate?.(this.activePerks);
      this.triggerScreenShake(0.4, 0.3);
      return;
    }

    const incomingAmount = this.gameMode === 'survival'
      ? scaleSurvivalIncomingDamage(amount)
      : amount;
    const damageResolution = resolveCharacterIncomingDamage(
      incomingAmount,
      this.charDef.damageTakenMultiplier * this.characterMasteryBonuses.damageTakenMultiplier,
      this.characterDamageRemainder,
    );
    this.characterDamageRemainder = damageResolution.remainder;
    this.invulnerableTimer = this.gameMode === 'survival'
      ? SURVIVAL_HIT_INVULNERABILITY_SECONDS
      : 1.8;
    if (damageResolution.damage <= 0) {
      sound.playShieldBreak();
      this.emitFloatingToast('🛡️ REDUKCJA OBRAŻEŃ • PANCERZ OPERATORA', this.playerPos.x, this.playerPos.y + 1.25, this.playerPos.z, 'perk');
      this.triggerScreenShake(0.2, 0.15);
      return;
    }
    this.hp = Math.max(0, this.hp - damageResolution.damage);
    sound.playHit();
    this.triggerBloomPulse(0.45);
    this.callbacks.onHpUpdate(this.hp, this.maxHp);

    // Short directional vignette makes real HP loss readable without tinting shield blocks.
    const gameShell = document.getElementById('game-shell');
    if (gameShell) {
      gameShell.classList.remove('damage-flash');
      void gameShell.offsetWidth;
      gameShell.classList.add('damage-flash');
      window.setTimeout(() => gameShell.classList.remove('damage-flash'), 480);
    }

    // Screen Shake on damage received by player!
    this.triggerScreenShake(0.9, 0.5);

    if (this.hp <= 0) {
      this.state = 'gameover';
      this.playerVel.set(0, 0, 0);
      this.screenShakeTimer = 0;
      this.screenShakeIntensity = 0;
      this.cameraShake = 0;
      if (this.container) {
        this.container.style.transform = '';
      }
      sound.stopMusic();
      sound.playGameOver();
      const finalReason = this.gameMode === 'survival'
        ? reason + ' | Fala ' + this.survivalWave + ' • ' + this.survivalKills + ' eliminacji • ' + this.survivalPerfectDodges + ' perfekcyjnych uników • ' + Math.floor(this.survivalElapsed) + ' s'
        : reason;
      this.callbacks.onGameOver(finalReason);
    }
  }

  private checkLevelFinish() {
    if (this.state !== 'playing') return;

    const finalBossIds = ['boss_walczak', 'boss_krol_leto_l3'];
    const livingFinalBosses = this.enemies.filter((enemy) => finalBossIds.includes(enemy.id) && enemy.state !== 'defeated');
    if (livingFinalBosses.length > 0) {
      if (this.finishWarningTimer <= 0) {
        this.finishWarningTimer = 3.0;
        this.emitFloatingToast('TERMINAL VIP ZABLOKOWANY — POKONAJ OBU BOSSÓW!', this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z, 'vip');
        sound.playHit();
      }
      return;
    }
    const requiredVip = Math.min(4, this.totalVipCount);
    if (this.collectedVipCount < requiredVip) {
      if (this.finishWarningTimer <= 0) {
        this.finishWarningTimer = 2.5;
        const remaining = requiredVip - this.collectedVipCount;
        this.sayQuote(`BHP Magazynu: Zbierz jeszcze min. ${remaining} zamówień VIP przed załadunkiem do vana!`);
        this.emitFloatingToast(`BRAKUJE ${remaining} VIP!`, this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'vip');
        sound.playHit();
      }
      return;
    }

    this.state = 'victory';
    sound.stopMusic();
    sound.playWin();
    const elapsed = Math.max(1, Math.round((performance.now() - this.levelStartTime) / 1000));
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
    this.callbacks.onLevelComplete(3, this.score, timeStr);
  }

  private spawnDust(x: number, y: number, z: number, color = 0xd1d5db) {
    const mesh = this.particlePool.acquire('sphere', color, 0.08, 0.8);
    if (!mesh) return;
    mesh.position.set(x, y + 0.1, z);
    this.levelRoot.add(mesh);
    this.particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.8 + 0.2, (Math.random() - 0.5) * 1.5),
      life: 0.4,
      maxLife: 0.4,
      baseScale: 0.08,
    });
  }

  private spawnParticleRing(x: number, y: number, z: number, color = 0x38bdf8) {
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const num = isMobile ? (this.adaptivePerformanceTier >= 2 ? 4 : this.adaptivePerformanceTier === 1 ? 6 : 8) : 14;
    const lightColor = new THREE.Color(color);
    for (let i = 0; i < num; i++) {
      const angle = (i / num) * Math.PI * 2;
      const size = 0.085 + Math.random() * 0.065;
      const shape: ParticleShape = i % 3 === 0 ? 'octahedron' : 'tetrahedron';
      const baseScale = size * (0.75 + Math.random() * 0.65);
      const tint = lightColor.clone().offsetHSL(0, 0, i % 2 === 0 ? 0.12 : -0.055);
      const mesh = this.particlePool.acquire(shape, tint, baseScale, 0.96);
      if (!mesh) continue;

      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.levelRoot.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * (3.4 + Math.random() * 1.4),
          0.7 + Math.random() * 1.65,
          Math.sin(angle) * (3.4 + Math.random() * 1.4)
        ),
        life: 0.62,
        maxLife: 0.62,
        gravity: 3.6,
        baseScale,
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 11,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 11
        ),
      });
    }
  }

  private spawnExplosionParticles(x: number, y: number, z: number, color = 0xf3f4f6, count = 20) {
    const isMobile = window.innerWidth < 900 || ('ontouchstart' in window);
    const mobileBurstCap = this.adaptivePerformanceTier >= 2 ? 4 : this.adaptivePerformanceTier === 1 ? 7 : 10;
    const actualCount = isMobile ? Math.min(mobileBurstCap, count) : Math.min(28, count);
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < actualCount; i++) {
      const size = 0.075 + Math.random() * 0.105;
      let shape: ParticleShape;
      let shapeScale = 1;
      if (i % 3 === 0) {
        shape = 'box';
      } else if (i % 3 === 1) {
        shape = 'tetrahedron';
        shapeScale = 1.35;
      } else {
        shape = 'octahedron';
        shapeScale = 1.15;
      }
      const baseScale = size * shapeScale * (0.7 + Math.random() * 0.8);
      const tint = baseColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.18);
      const mesh = this.particlePool.acquire(shape, tint, baseScale, 0.96);
      if (!mesh) continue;

      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.levelRoot.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.2 + Math.random() * 4.8;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * speed, 1.4 + Math.random() * 3.8, Math.sin(angle) * speed),
        life: 0.74,
        maxLife: 0.74,
        gravity: 4.5,
        baseScale,
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 13,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 13
        ),
      });
    }
  }

  private sayQuote(quote: string) {
    this.speechBubbleTimer = 3.5;
    this.callbacks.onSpeechBubble(quote);
  }

  private sayRandomVoiceLine() {
    if (this.charDef.voiceLines && this.charDef.voiceLines.length > 0) {
      const idx = Math.floor(Math.random() * this.charDef.voiceLines.length);
      this.sayQuote(this.charDef.voiceLines[idx]);
    }
  }

  private applyOniricDreamProjection() {
    const width = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth || 390));
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || 844));
    const aspect = width / height;
    const halfHeight = this.isHandheldViewport ? 16.5 : 13.5;
    const halfWidth = halfHeight * aspect;
    this.camera.projectionMatrix.makeOrthographic(
      -halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 160,
    );
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  private updateCamera(dt: number) {
    const now = performance.now();
    if (this.state === 'title') {
      const t = now * 0.0006;
      const radius = 4.5;
      const height = 1.8 + Math.sin(t * 0.8) * 0.35;
      const px = this.playerPos.x;
      const py = this.playerPos.y;
      const pz = this.playerPos.z;

      this.camera.position.x = px + Math.sin(t) * radius;
      this.camera.position.z = pz + Math.cos(t) * radius;
      this.camera.position.y = py + height;
      this.camera.lookAt(px, py + 1.0, pz);

      if (this.playerGroup) {
        this.playerGroup.rotation.y = Math.sin(t * 0.8) * 0.35;
      }
      return;
    }

    if (this.gameMode === 'survival' && this.oniricDreamRemainingSeconds > 0) {
      this.oniricDreamCameraActive = true;
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(this.playerPos.x, 38, this.playerPos.z);
      this.camera.lookAt(this.playerPos.x, 0, this.playerPos.z);
      this.applyOniricDreamProjection();
      if (this.dofBlurPassMesh) this.dofBlurPassMesh.visible = false;
      return;
    }

    if (this.oniricDreamCameraActive) {
      this.oniricDreamCameraActive = false;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
    }

    // Determine target positions with smooth velocity look-ahead
    const lookAheadFactor = this.isHandheldViewport ? 0.11 : 0.14;
    const lookAheadLimit = this.isHandheldViewport ? 1.7 : 2.1;
    const velLookAheadX = THREE.MathUtils.clamp(this.playerVel.x * lookAheadFactor, -lookAheadLimit, lookAheadLimit);
    const velLookAheadZ = THREE.MathUtils.clamp(this.playerVel.z * lookAheadFactor, -lookAheadLimit, lookAheadLimit);
    const targetX = this.playerPos.x + velLookAheadX;
    const targetZ = this.playerPos.z + velLookAheadZ;

    // Smooth vertical tracking: dampen camera Y so jumping doesn't violently bounce the screen
    const targetGroundY = this.isGrounded ? this.playerPos.y : this.smoothCamY;
    this.smoothCamY = THREE.MathUtils.damp(this.smoothCamY, targetGroundY, this.isGrounded ? 8.0 : 2.4, dt);
    const targetY = this.smoothCamY;

    // Boss proximity does not need a full enemy-array scan every rendered frame.
    // Refresh it at 5 Hz and smoothly interpolate the resulting camera pull-back.
    this.cameraBossCheckCooldown -= dt;
    if (this.cameraBossCheckCooldown <= 0) {
      this.cameraBossTargetZoom = 1.0;
      for (const enemy of this.enemies) {
        if (!isMajorSurvivalBossType(enemy.type) || enemy.state === 'defeated') continue;
        const bossDist = Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z);
        if (bossDist < 22) {
          this.cameraBossTargetZoom = 1.14;
          break;
        }
      }
      this.cameraBossCheckCooldown = 0.2;
    }
    this.bossCamZoom = THREE.MathUtils.damp(this.bossCamZoom, this.cameraBossTargetZoom, 2.8, dt);

    // Target offsets for camera modes:
    // 'tpp' (Default): Podwyższony widok taktyczny (~45° widok z góry i zza pleców w stylu Hades / Brawl Stars)
    // Zapewnia pełną widoczność flankujących wrogów, pułapek posadzkowych i alei magazynu bez zasłaniania przez regały!
    const zoomMultiplier = this.bossCamZoom * this.camZoomFactor;
    let baseOffsetX = -2.2;
    let baseOffsetY = 10.8;
    let baseOffsetZ = 9.2;
    if (this.cameraMode === 'close') {
      // Closer, lower over-the-shoulder framing makes faces, props and character silhouettes readable.
      baseOffsetX = -2.2;
      baseOffsetY = 6.9;
      baseOffsetZ = 8.2;
    } else if (this.cameraMode === 'iso') {
      baseOffsetX = 0.0;
      baseOffsetY = 15.8;
      baseOffsetZ = 10.2;
    }
    // Survival uses the same low oblique follow camera; never force a near-vertical overhead view.

    const targetOffsetX = baseOffsetX * zoomMultiplier;
    const targetOffsetY = baseOffsetY * zoomMultiplier;
    const targetOffsetZ = baseOffsetZ * zoomMultiplier;

    // Smoothly interpolate camera offset between modes
    this.currentCamOffset.x = THREE.MathUtils.damp(this.currentCamOffset.x, targetOffsetX, 4.6, dt);
    this.currentCamOffset.y = THREE.MathUtils.damp(this.currentCamOffset.y, targetOffsetY, 4.6, dt);
    this.currentCamOffset.z = THREE.MathUtils.damp(this.currentCamOffset.z, targetOffsetZ, 4.6, dt);

    // Responsive FOV based on screen aspect ratio (mobile portrait vs landscape vs desktop)
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const aspect = this.viewportAspect;
      const baseFov = this.gameMode === 'survival'
        ? (aspect < 0.65 ? 58 : aspect < 1.0 ? 54 : aspect < 1.35 ? 48 : 45)
        : (aspect < 0.65 ? 60 : aspect < 1.0 ? 54 : aspect < 1.35 ? 48 : 45);
      if (Math.abs(this.camera.fov - baseFov) > 0.2) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, baseFov, 4.0, dt);
        this.camera.updateProjectionMatrix();
      }
    }

    const camTarget = this.cameraTargetPosition.set(
      targetX + this.currentCamOffset.x,
      targetY + this.currentCamOffset.y,
      targetZ + this.currentCamOffset.z
    );

    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    const isMobileDevice = this.isHandheldViewport;
    const shakePhase = now * 0.032;

    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= dt;
      const progress = Math.max(0, this.screenShakeTimer / Math.max(0.001, this.screenShakeDuration));
      // Smooth camera-space impact pulse: no random per-frame jitter and no DOM transform.
      const currentIntensity = this.screenShakeIntensity * Math.pow(progress, 1.2) * 0.30;
      shakeX = Math.sin(shakePhase * 1.07) * currentIntensity * 0.52;
      shakeY = Math.cos(shakePhase * 1.31) * currentIntensity * 0.34;
      shakeZ = Math.sin(shakePhase * 0.79) * currentIntensity * 0.18;

      if (this.screenShakeTimer <= 0) this.screenShakeIntensity = 0;
    } else if (this.cameraShake > 0) {
      shakeX = Math.sin(shakePhase * 0.91) * this.cameraShake * 0.20;
      shakeY = Math.cos(shakePhase * 1.17) * this.cameraShake * 0.16;
      shakeZ = Math.sin(shakePhase * 0.73) * this.cameraShake * 0.08;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
    }

    camTarget.x += shakeX;
    camTarget.y += shakeY;
    camTarget.z += shakeZ;

    // Keep the playfield crisp on phones: depth-of-field softens small enemies,
    // telegraphs and pickup silhouettes on a high-density 6.67-inch display.
    if (this.dofBlurPassMesh) this.dofBlurPassMesh.visible =
      this.gameMode !== 'survival' && !isMobileDevice;
    // Frame-rate independent camera follow. The previous linear lerp was tied to FPS:
    // on a 60/90/120 Hz phone it produced different response and visible judder.
    const positionDamping = this.gameMode === 'survival'
      ? (this.isHandheldViewport ? 7.8 : 7.2)
      : (this.isHandheldViewport ? 8.4 : 7.7);
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camTarget.x, positionDamping, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camTarget.y, positionDamping, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camTarget.z, positionDamping, dt);

    // Look ahead framing for tactical readability
    const lookAheadX = this.cameraMode === 'tpp' ? 1.8 : this.cameraMode === 'close' ? 2.4 : 0.5;
    const lookAheadY = this.cameraMode === 'tpp' ? 0.7 : this.cameraMode === 'close' ? 1.1 : 0.5;
    const lookAheadZ = this.cameraMode === 'tpp' ? 0.0 : this.cameraMode === 'close' ? -0.5 : 0.0;

    const desiredLookAt = this.desiredLookAtPosition.set(
      this.playerPos.x + lookAheadX + velLookAheadX * 0.45 + shakeX * 0.3,
      this.smoothCamY + lookAheadY + shakeY * 0.3,
      this.playerPos.z + lookAheadZ + velLookAheadZ * 0.45 + shakeZ * 0.3
    );
    const lookDamping = this.isHandheldViewport ? 9.2 : 8.6;
    this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, desiredLookAt.x, lookDamping, dt);
    this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, desiredLookAt.y, lookDamping, dt);
    this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, desiredLookAt.z, lookDamping, dt);
    this.camera.lookAt(this.currentLookAt);
    this.updateCameraOcclusion(dt);

    if (this.dirLight) {
      this.dirLight.position.set(this.playerPos.x + 14, 28, this.playerPos.z + 12);
      this.dirLight.target.position.copy(this.playerPos);
      this.dirLight.target.updateMatrixWorld();
      if (this.isHandheldViewport) {
        // Shadow refresh is wall-clock paced: a 2x simulation must not double
        // the GPU shadow workload. Under load, reduce refresh cadence smoothly.
        this.mobileShadowRefreshCooldown -= dt / this.timeScale;
        if (this.mobileShadowRefreshCooldown <= 0) {
          this.dirLight.shadow.needsUpdate = true;
          const shadowHz = this.adaptivePerformanceTier >= 2 ? 12 : this.adaptivePerformanceTier === 1 ? 18 : 24;
          this.mobileShadowRefreshCooldown = 1 / shadowHz;
        }
      }
    }

    // Dynamic Shader Uniform Updates for Depth of Field and Stencil Outline
    if (this.dofBlurMaterial) {
      this.dofBlurMaterial.uniforms.uTime.value = now * 0.001;
      this.dofBlurMaterial.uniforms.uScreenSize.value.set(
        window.visualViewport?.width || window.innerWidth || 1280,
        window.visualViewport?.height || window.innerHeight || 720
      );
    }
    if (this.outlineMaterial) {
      this.outlineMaterial.uniforms.uTime.value = now * 0.001;
      if ((this.activePerks.kfcBerserk || 0) > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xef4444);
      } else if ((this.activePerks.bulldozer || 0) > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xfacc15);
      } else if (this.activePerks.speedBoost > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xec4899);
      } else if (this.marcinWoTPenaltyTimer > 0) {
        this.outlineMaterial.uniforms.uColor.value.setHex(0xf97316);
      } else {
        this.outlineMaterial.uniforms.uColor.value.setHex(0x38bdf8);
      }
    }
    if (this.rimLight) {
      this.rimLight.position.set(this.playerPos.x - 18, 12, this.playerPos.z - 18);
    }
  }

  public getPlayerPos(): THREE.Vector3 {
    return this.playerPos.clone();
  }

  public getScore(): number {
    return this.score;
  }

  public getCollectedVipCount(): number {
    return this.collectedVipCount;
  }

  public getElapsedSeconds(): number {
    // Count simulated active play, not real time spent paused or choosing upgrades.
    return Math.max(1, Math.round(this.activeElapsedSeconds));
  }

  public isBossDefeated(): boolean {
    const bossTypes = new Set(['walczak', 'krol_leto', 'bosman_krakow', 'sebix_m']);
    return this.enemies.some((enemy) => bossTypes.has(enemy.type) && enemy.state === 'defeated');
  }

  public getActivePerks(): ActivePerks {
    return { ...this.activePerks };
  }

  public activatePerk(perkId: PerkType, duration: number = 20): boolean {
    if (perkId === 'hardhat') {
      this.activePerks.shield = true;
      sound.playPerkPickup();
      this.sayQuote('Założono atestowany kask BHP!');
    } else if (perkId === 'vibram_boots') {
      this.activePerks.doubleJump = Math.max(this.activePerks.doubleJump, duration);
      sound.playDoubleJump();
      this.sayQuote('Buty robocze antypoślizgowe: podwójny skok w powietrzu aktywny!');
    } else if (perkId === 'order_magnet') {
      this.activePerks.magnet = Math.max(this.activePerks.magnet, duration);
      sound.playMagnetHum();
      this.sayQuote('Skaner radiowy przyciąga zamówienia!');
    } else if (perkId === 'espresso_boost') {
      this.activePerks.speedBoost = Math.max(this.activePerks.speedBoost, duration);
      sound.playPerkPickup();
      this.sayQuote('Podwójne espresso: sprint po korytarzu!');
    } else if (perkId === 'kfc_bucket') {
      this.hp = Math.min(this.maxHp, this.hp + 2);
      this.callbacks.onHpUpdate(this.hp, this.maxHp);
      this.activePerks.kfcBerserk = Math.max(this.activePerks.kfcBerserk || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('PAKIET ENERGII OD VECTORA! +2 Kawy, podwójne obrażenia i odporność na klej!');
    } else if (perkId === 'golden_paleciak') {
      this.activePerks.bulldozer = Math.max(this.activePerks.bulldozer || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('ZŁOTY PALECIAK TURBO! Rozjeżdżam wrogów na pełnej prędkości!');
    } else if (perkId === 'stretch_armor') {
      this.activePerks.shield = true;
      this.invulnerableTimer = Math.max(this.invulnerableTimer, duration);
      sound.playPerkPickup();
      this.sayQuote('ZBROJA Z CZARNEJ FOLII STRETCH VIP! 10 sekund całkowitej nietykalności!');
    } else if (perkId === 'attack_haste') {
      this.activePerks.attackHaste = Math.max(this.activePerks.attackHaste || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('Skaner w trybie turbo. Wreszcie ktoś tutaj pracuje szybciej niż drukarka etykiet.');
    } else if (perkId === 'arc_drone') {
      this.activePerks.arcDrone = Math.max(this.activePerks.arcDrone || 0, duration);
      sound.playElectricalSparks();
      this.sayQuote('Dron Piorun dołącza do zmiany. Tym razem nie zgubił ładowarki.');
    } else if (perkId === 'xp_surge') {
      this.activePerks.xpSurge = Math.max(this.activePerks.xpSurge || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('Premia za normę naliczona. Dział kadr potwierdza, że to nie pomyłka.');
    } else if (perkId === 'damage_ward') {
      this.activePerks.damageWard = Math.max(this.activePerks.damageWard || 0, duration);
      sound.playShieldBreak();
      this.sayQuote('Paleta EURO klasy A. Wreszcie coś w tym magazynie ma certyfikat.');
    } else if (perkId === 'forklift_horn') {
      let affected = 0;
      for (const enemy of this.enemies) {
        if (enemy.state === 'defeated' || Math.hypot(enemy.x - this.playerPos.x, enemy.z - this.playerPos.z) > 7) continue;
        enemy.stunTimer = Math.max(enemy.stunTimer, 1.6);
        enemy.state = 'stunned';
        this.damageEnemy(enemy, 1);
        affected++;
        if (enemy.hp <= 0) this.defeatEnemy(enemy, 220, true);
        this.spawnParticleRing(enemy.x, enemy.y + 0.55, enemy.z, 0xf97316);
      }
      sound.playBossWarning();
      this.triggerScreenShake(0.32, 0.18);
      this.spawnParticleRing(this.playerPos.x, 0.18, this.playerPos.z, 0xf97316);
      this.emitFloatingToast('📣 KLAKSON B4! ' + affected + ' WROGÓW OGŁUSZONYCH', this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z, 'combo');
    } else if (perkId === 'night_shift_espresso') {
      this.activePerks.speedBoost = Math.max(this.activePerks.speedBoost, duration);
      this.activePerks.attackHaste = Math.max(this.activePerks.attackHaste || 0, duration);
      sound.playPerkPickup();
      this.sayQuote('NOCNA ZMIANA: PODWÓJNE ESPRESSO! Kto śpi, ten nie wyrabia normy!');
    } else if (perkId === 'golden_wz') {
      this.score += 600;
      this.callbacks.onScoreUpdate(this.score, this.collectedVipCount, this.totalVipCount);
      if (this.gameMode === 'survival') {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          this.spawnSurvivalXpGem(this.playerPos.x + Math.cos(angle) * 1.5, 0.25, this.playerPos.z + Math.sin(angle) * 1.5, 1);
        }
      }
      sound.playEasterEgg();
      this.sayQuote('ZŁOTA WZ-TKA! Kadry zatwierdziły premię. Tego dokumentu nie zgub!');
      this.emitFloatingToast('📜 +600 PKT • 8 XP', this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z, 'combo');
    } else if (perkId === 'pallet_guard') {
      this.activePerks.damageWard = Math.max(this.activePerks.damageWard || 0, duration);
      this.activePerks.shield = true;
      sound.playShieldBreak();
      this.sayQuote('BARYKADA EURO! Teraz nawet reklamacja odbije się od palety!');
    }

    this.callbacks.onPerksUpdate?.(this.activePerks);
    return true;
  }

  private handleMateuszPassive(amount: number) {
    if (this.currentCharacterId !== 'mateusz') return;
    this.mateuszPassiveCount += amount;
    if (this.mateuszPassiveCount >= 9) {
      this.mateuszPassiveCount -= 9;
      this.activatePerk('espresso_boost', 3);
      this.invulnerableTimer = Math.max(this.invulnerableTimer, 3);
      this.sayQuote('UMOWA NA 9 MIESIĘCY! Speedrun aktywowany!');
      this.emitFloatingToast('🚀 SPEEDRUN CONTRACT!', this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 'combo');
      this.spawnParticleRing(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z, 0xffffff);
    }
  }

}
