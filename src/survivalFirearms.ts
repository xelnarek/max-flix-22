export type SurvivalFirearmId =
  | 'starter_pistol' | 'smg_45' | 'assault_rifle' | 'shotgun_12g' | 'battle_rifle'
  | 'minigun' | 'rocket_launcher' | 'flamethrower' | 'plasma_rifle' | 'gauss_rifle' | 'ballistic_grenade_launcher';

export type SurvivalFirearmArchetype =
  | 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle'
  | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade';

export interface SurvivalFirearmDefinition {
  readonly id: SurvivalFirearmId;
  readonly name: string;
  readonly shortName: string;
  readonly icon: string;
  readonly color: number;
  readonly archetype: SurvivalFirearmArchetype;
  readonly roleDescription: string;
  readonly rangeMeters: number;
  readonly fireIntervalSeconds: number;
  readonly magazineSize: number;
  readonly reloadSeconds: number;
  readonly damage: number;
  readonly pellets: number;
  readonly spreadRadians: number;
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  readonly pierce: number;
  readonly aoeRadius: number;
  readonly aoeDamageMultiplier: number;
  readonly igniteOnHit: boolean;
  readonly dropWeight: number;
  /** Optional ballistic parameters; omitted weapons remain straight, constant-speed shots. */
  readonly projectileGravity?: number;
  readonly projectileLaunchVelocity?: number;
  readonly projectileFuseSeconds?: number;
  readonly detonateOnImpact?: boolean;
}

export interface SurvivalFirearmState {
  readonly id: SurvivalFirearmId;
  ammoInMagazine: number;
  cooldown: number;
  reloadRemaining: number;
  shotCounter: number;
}

export type SurvivalFirearmEnemyTier = 'normal' | 'elite' | 'boss';

export interface SurvivalFirearmDropRoll {
  readonly shouldDrop: boolean;
  readonly isGuaranteed: boolean;
  readonly isPityDrop: boolean;
  readonly chance: number;
}

/** Independent primary-weapon system; never part of the perk deck or roulette. */
export const STARTING_SURVIVAL_FIREARM: SurvivalFirearmId = 'starter_pistol';

/** Shared PvE world-drop rules for Survival and Campaign. */
export const SURVIVAL_FIREARM_DROP_POLICY = Object.freeze({
  unlockElapsedSeconds: 45,
  minimumKills: 8,
  minimumIntervalSeconds: 75,
  dropLifetimeSeconds: 40,
  maximumActiveDrops: 1,
  normalChance: 0.07,
  eliteChance: 0.30,
  pityMisses: 10,
});

export const SURVIVAL_FIREARM_DEFS: Readonly<Record<SurvivalFirearmId, SurvivalFirearmDefinition>> = Object.freeze({
  starter_pistol: {
    id: 'starter_pistol', name: 'Pistolet serwisowy', shortName: 'PISTOLET', icon: '🔫',
    color: 0xcbd5e1, archetype: 'pistol', roleDescription: 'Precyzyjny pistolet serwisowy do pojedynczych celów i spokojnego kontrolowania średniego dystansu. Niewielki rozrzut, 12 nabojów i krótki czas przeładowania; strzela wolniej niż broń automatyczna.', rangeMeters: 28, fireIntervalSeconds: 1.05, magazineSize: 12,
    reloadSeconds: 1.35, damage: 1.55, pellets: 1, spreadRadians: 0.018,
    projectileSpeed: 34, projectileRadius: 0.08,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 0,
  },
  smg_45: {
    id: 'smg_45', name: 'Pistolet maszynowy .45', shortName: 'PM .45', icon: '💨',
    color: 0x94a3b8, archetype: 'smg', roleDescription: 'Bardzo szybki ogień na krótki i średni dystans. Magazynek 36 nabojów pozwala utrzymać presję, ale wyraźny rozrzut utrudnia celne prowadzenie ognia z daleka.', rangeMeters: 23, fireIntervalSeconds: 0.24, magazineSize: 36,
    reloadSeconds: 1.48, damage: 0.78, pellets: 1, spreadRadians: 0.082,
    projectileSpeed: 32, projectileRadius: 0.072,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  assault_rifle: {
    id: 'assault_rifle', name: 'Karabin szturmowy', shortName: 'KARABIN', icon: '🪖',
    color: 0x86a873, archetype: 'rifle', roleDescription: 'Uniwersalny karabin do walki na średnim i dalszym dystansie. Stabilny rytm ognia, 30-nabojowy magazynek i umiarkowany rozrzut sprawdzają się w większości sytuacji.', rangeMeters: 38, fireIntervalSeconds: 0.32, magazineSize: 30,
    reloadSeconds: 1.68, damage: 1.24, pellets: 1, spreadRadians: 0.036,
    projectileSpeed: 38, projectileRadius: 0.078,
    pierce: 1, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  shotgun_12g: {
    id: 'shotgun_12g', name: 'Strzelba 12G', shortName: 'STRZELBA', icon: '💥',
    color: 0xfbbf24, archetype: 'shotgun', roleDescription: 'Jedna salwa rozdziela się na siedem śrutów w szerokim stożku. Najgroźniejsza z bliska; zasięg 10 metrów wymaga wejścia w niebezpieczną odległość i dobrego ustawienia celu.', rangeMeters: 10, fireIntervalSeconds: 0.94, magazineSize: 8,
    reloadSeconds: 1.85, damage: 0.92, pellets: 7, spreadRadians: 0.24,
    projectileSpeed: 27, projectileRadius: 0.095,
    pierce: 1, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  battle_rifle: {
    id: 'battle_rifle', name: 'Karabin bojowy 7,62', shortName: '7,62', icon: '🎯',
    color: 0x60a5fa, archetype: 'heavy-rifle', roleDescription: 'Karabin 7,62 mm do mocnych, kontrolowanych strzałów na dalekim dystansie. Zadaje wysokie obrażenia pojedynczym pociskiem, ale ma tylko 14 nabojów i wolniejsze tempo ognia.', rangeMeters: 46, fireIntervalSeconds: 0.78, magazineSize: 14,
    reloadSeconds: 1.76, damage: 3.15, pellets: 1, spreadRadians: 0.012,
    projectileSpeed: 46, projectileRadius: 0.092,
    pierce: 3, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  minigun: {
    id: 'minigun', name: 'Minigun', shortName: 'MINIGUN', icon: '⚙️',
    color: 0xf97316, archetype: 'minigun', roleDescription: 'Sześciolufowa broń do długiego utrzymywania ognia na grupie przeciwników. Bęben mieści 90 nabojów, a bardzo szybkie strzelanie rekompensuje większy rozrzut i dłuższe przeładowanie.', rangeMeters: 29, fireIntervalSeconds: 0.14, magazineSize: 90,
    reloadSeconds: 2.38, damage: 0.68, pellets: 1, spreadRadians: 0.105,
    projectileSpeed: 36, projectileRadius: 0.068,
    pierce: 1, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  rocket_launcher: {
    id: 'rocket_launcher', name: 'Wyrzutnia rakiet', shortName: 'RAKIETY', icon: '🚀',
    color: 0xef4444, archetype: 'rocket', roleDescription: 'Wyrzutnia rakiet do niszczenia skupisk przeciwników. Rakieta detonuje przy trafieniu, zadaje obrażenia w promieniu 4,4 m i podpala cele; pięć rakiet w magazynku wymaga oszczędnego użycia.', rangeMeters: 34, fireIntervalSeconds: 1.55, magazineSize: 5,
    reloadSeconds: 2.25, damage: 3.85, pellets: 1, spreadRadians: 0.006,
    projectileSpeed: 23, projectileRadius: 0.17,
    pierce: 0, aoeRadius: 4.4, aoeDamageMultiplier: 1.05, igniteOnHit: true, dropWeight: 1,
    detonateOnImpact: true,
  },
  flamethrower: {
    id: 'flamethrower', name: 'Miotacz płomieni', shortName: 'MIOTACZ', icon: '🔥',
    color: 0xfb923c, archetype: 'flame', roleDescription: 'Krótki, intensywny strumień ognia do walki na bardzo małym dystansie. Płomienie nakładają podpalenie i obejmują niewielki obszar, ale skuteczny zasięg wynosi tylko 6 metrów.', rangeMeters: 6, fireIntervalSeconds: 0.15, magazineSize: 64,
    reloadSeconds: 1.95, damage: 0.42, pellets: 2, spreadRadians: 0.22,
    projectileSpeed: 14, projectileRadius: 0.105,
    pierce: 3, aoeRadius: 0.65, aoeDamageMultiplier: 0.45, igniteOnHit: true, dropWeight: 1,
  },
  plasma_rifle: {
    id: 'plasma_rifle', name: 'Karabin plazmowy', shortName: 'PLAZMA', icon: '🟣',
    color: 0xa78bfa, archetype: 'plasma', roleDescription: 'Karabin energetyczny o równym tempie ognia. Pocisk plazmowy wywołuje wyładowanie jonowe w promieniu 2,3 m, dlatego dobrze sprawdza się przeciwko celom stojącym blisko siebie.', rangeMeters: 32, fireIntervalSeconds: 0.36, magazineSize: 28,
    reloadSeconds: 1.82, damage: 1.65, pellets: 1, spreadRadians: 0.024,
    projectileSpeed: 26, projectileRadius: 0.14,
    pierce: 1, aoeRadius: 2.3, aoeDamageMultiplier: 0.55, igniteOnHit: false, dropWeight: 1,
  },
  ballistic_grenade_launcher: {
    id: 'ballistic_grenade_launcher', name: 'Granatnik balistyczny', shortName: 'GRANATNIK', icon: '💣',
    color: 0xd4a24f, archetype: 'grenade', roleDescription: 'Granatnik balistyczny wystrzeliwuje granat po łuku, dzięki czemu może przerzucać przeszkody. Granat detonuje przy kontakcie lub po zapalniku; eksplozja obejmuje promień 4,8 m. Magazynek mieści cztery sztuki.',
    rangeMeters: 24, fireIntervalSeconds: 1.18, magazineSize: 4, reloadSeconds: 3.2,
    damage: 3.7, pellets: 1, spreadRadians: 0.004, projectileSpeed: 17, projectileRadius: 0.13,
    pierce: 0, aoeRadius: 4.8, aoeDamageMultiplier: 1.08, igniteOnHit: false, dropWeight: 1,
    projectileGravity: 12.5, projectileLaunchVelocity: 7.4, projectileFuseSeconds: 1.4, detonateOnImpact: true,
  },
  gauss_rifle: {
    id: 'gauss_rifle', name: 'Karabin Gaussa', shortName: 'GAUSS', icon: '⚡',
    color: 0x22d3ee, archetype: 'gauss', roleDescription: 'Broń elektromagnetyczna do bardzo dalekich i precyzyjnych strzałów. Zasięg 80 metrów, wysoka prędkość pocisku i 7,4 obrażeń bazowych dają największy pojedynczy cios w arsenale; magazynek ma osiem nabojów.', rangeMeters: 80, fireIntervalSeconds: 1.38, magazineSize: 8,
    reloadSeconds: 2.15, damage: 7.4, pellets: 1, spreadRadians: 0.003,
    projectileSpeed: 64, projectileRadius: 0.11,
    pierce: 8, aoeRadius: 1.4, aoeDamageMultiplier: 0.4, igniteOnHit: false, dropWeight: 1,
  },
});

export function createStartingSurvivalFirearmState(): SurvivalFirearmState {
  const definition = SURVIVAL_FIREARM_DEFS[STARTING_SURVIVAL_FIREARM];
  return {
    id: STARTING_SURVIVAL_FIREARM, ammoInMagazine: definition.magazineSize,
    cooldown: 0, reloadRemaining: 0, shotCounter: 0,
  };
}

export function createSurvivalFirearmState(id: SurvivalFirearmId): SurvivalFirearmState {
  const definition = SURVIVAL_FIREARM_DEFS[id] || SURVIVAL_FIREARM_DEFS[STARTING_SURVIVAL_FIREARM];
  return { id: definition.id, ammoInMagazine: definition.magazineSize, cooldown: 0, reloadRemaining: 0, shotCounter: 0 };
}

/** Shared Survival/Campaign world loot with a bounded pity guarantee. */
export function rollSurvivalFirearmDrop(
  killCount: number, enemyTier: SurvivalFirearmEnemyTier, consecutiveMisses: number, roll: number,
): SurvivalFirearmDropRoll {
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0.5;
  const safeKills = Number.isFinite(killCount) ? Math.max(0, Math.floor(killCount)) : 0;
  const misses = Number.isFinite(consecutiveMisses) ? Math.max(0, Math.floor(consecutiveMisses)) : 0;
  const minimumKillsReached = safeKills >= SURVIVAL_FIREARM_DROP_POLICY.minimumKills;
  const baseChance = enemyTier === 'boss' ? 1
    : enemyTier === 'elite' ? SURVIVAL_FIREARM_DROP_POLICY.eliteChance
      : SURVIVAL_FIREARM_DROP_POLICY.normalChance;
  const isPityDrop = minimumKillsReached && enemyTier !== 'boss'
    && misses >= SURVIVAL_FIREARM_DROP_POLICY.pityMisses;
  const isGuaranteed = minimumKillsReached && (enemyTier === 'boss' || isPityDrop);
  return {
    shouldDrop: minimumKillsReached && (isGuaranteed || safeRoll < baseChance),
    isGuaranteed,
    isPityDrop,
    chance: minimumKillsReached ? (isGuaranteed ? 1 : baseChance) : 0,
  };
}

/** Equal-probability world loot excludes the starter pistol and the weapon already held. */
export function rollSurvivalFirearmId(currentId: SurvivalFirearmId, elapsedSeconds: number, roll: number): SurvivalFirearmId | null {
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0.5;
  const eligible = Object.values(SURVIVAL_FIREARM_DEFS).filter((definition) =>
    definition.id !== STARTING_SURVIVAL_FIREARM && definition.id !== currentId && definition.dropWeight > 0);
  if (eligible.length === 0 || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return null;
  const totalWeight = eligible.reduce((sum, definition) => sum + definition.dropWeight, 0);
  const target = safeRoll * totalWeight;
  let cumulative = 0;
  for (const definition of eligible) {
    cumulative += definition.dropWeight;
    if (target < cumulative) return definition.id;
  }
  return eligible[eligible.length - 1].id;
}

export function getSurvivalFirearmDamageSource(id: SurvivalFirearmId): `firearm:${SurvivalFirearmId}` {
  return `firearm:${id}`;
}

export type SurvivalFirearmAmmoAlert = 'ready' | 'low' | 'critical' | 'empty';

/**
 * Shared magazine warning thresholds for Survival, Campaign and PvP HUDs.
 * The final quarter is amber, the final 10% is critical, and an empty magazine
 * is reported separately. Small magazines always retain at least one warning
 * round so four-shot launchers can still communicate their remaining capacity.
 */
export function getSurvivalFirearmAmmoAlert(
  ammoInMagazine: number,
  magazineSize: number,
): SurvivalFirearmAmmoAlert {
  const safeMagazineSize = Number.isFinite(magazineSize)
    ? Math.max(1, Math.floor(magazineSize))
    : 1;
  const safeAmmo = Number.isFinite(ammoInMagazine)
    ? Math.max(0, Math.min(safeMagazineSize, Math.floor(ammoInMagazine)))
    : 0;
  if (safeAmmo <= 0) return 'empty';

  const criticalThreshold = Math.max(1, Math.floor(safeMagazineSize * 0.1));
  const lowThreshold = Math.max(criticalThreshold + 1, Math.ceil(safeMagazineSize * 0.25));
  if (safeAmmo <= criticalThreshold) return 'critical';
  if (safeAmmo <= lowThreshold) return 'low';
  return 'ready';
}

export function isSurvivalFirearmId(value: string): value is SurvivalFirearmId {
  return Object.prototype.hasOwnProperty.call(SURVIVAL_FIREARM_DEFS, value);
}
