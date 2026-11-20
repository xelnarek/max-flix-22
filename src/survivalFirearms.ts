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

export const SURVIVAL_FIREARM_DEFS: Readonly<Record<SurvivalFirearmId, SurvivalFirearmDefinition>> = Object.freeze({
  starter_pistol: {
    id: 'starter_pistol', name: 'Pistolet serwisowy', shortName: 'PISTOLET', icon: '🔫',
    color: 0xcbd5e1, archetype: 'pistol', roleDescription: 'Broń startowa • mocniejszy pojedynczy strzał, spokojny rytm', rangeMeters: 28, fireIntervalSeconds: 1.05, magazineSize: 12,
    reloadSeconds: 1.6, damage: 1.55, pellets: 1, spreadRadians: 0.012,
    projectileSpeed: 34, projectileRadius: 0.075,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 0,
  },
  smg_45: {
    id: 'smg_45', name: 'Pistolet maszynowy .45', shortName: 'PM .45', icon: '🔫',
    color: 0x94a3b8, archetype: 'smg', roleDescription: 'Szybka seria cięższych pocisków • kontroluj zużycie amunicji', rangeMeters: 22, fireIntervalSeconds: 0.68, magazineSize: 30,
    reloadSeconds: 2.2, damage: 1.05, pellets: 1, spreadRadians: 0.055,
    projectileSpeed: 30, projectileRadius: 0.065,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  assault_rifle: {
    id: 'assault_rifle', name: 'Karabin szturmowy', shortName: 'KARABIN', icon: '🪖',
    color: 0x86a873, archetype: 'rifle', roleDescription: 'Uniwersalny karabin • stabilna siła i średnia szybkostrzelność', rangeMeters: 38, fireIntervalSeconds: 0.92, magazineSize: 27,
    reloadSeconds: 2.35, damage: 1.5, pellets: 1, spreadRadians: 0.026,
    projectileSpeed: 38, projectileRadius: 0.07,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  shotgun_12g: {
    id: 'shotgun_12g', name: 'Strzelba 12G', shortName: 'STRZELBA', icon: '💥',
    color: 0xfbbf24, archetype: 'shotgun', roleDescription: 'Ciężka salwa siedmiu śrutów • zabójcza z bliska, długi cykl', rangeMeters: 10, fireIntervalSeconds: 1.8, magazineSize: 6,
    reloadSeconds: 2.75, damage: 0.62, pellets: 7, spreadRadians: 0.235,
    projectileSpeed: 25, projectileRadius: 0.09,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  battle_rifle: {
    id: 'battle_rifle', name: 'Karabin bojowy 7.62', shortName: '7.62', icon: '🎯',
    color: 0x60a5fa, archetype: 'heavy-rifle', roleDescription: 'Precyzyjny pocisk dużego kalibru • mocne trafienie i przebicie', rangeMeters: 46, fireIntervalSeconds: 1.85, magazineSize: 10,
    reloadSeconds: 2.9, damage: 3.1, pellets: 1, spreadRadians: 0.009,
    projectileSpeed: 45, projectileRadius: 0.085,
    pierce: 1, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  minigun: {
    id: 'minigun', name: 'Minigun', shortName: 'MINIGUN', icon: '⚙️',
    color: 0xf97316, archetype: 'minigun', roleDescription: 'Długie serie z ciężkiej broni • szeroki rozrzut i długi reload', rangeMeters: 29, fireIntervalSeconds: 0.5, magazineSize: 60,
    reloadSeconds: 4.2, damage: 0.68, pellets: 1, spreadRadians: 0.078,
    projectileSpeed: 35, projectileRadius: 0.062,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
  },
  rocket_launcher: {
    id: 'rocket_launcher', name: 'Wyrzutnia rakiet', shortName: 'RAKIETY', icon: '🚀',
    color: 0xef4444, archetype: 'rocket', roleDescription: 'Ciężka rakieta • duża detonacja obszarowa, bardzo wolny cykl', rangeMeters: 34, fireIntervalSeconds: 3.6, magazineSize: 4,
    reloadSeconds: 3.6, damage: 4.8, pellets: 1, spreadRadians: 0.006,
    projectileSpeed: 15.5, projectileRadius: 0.16,
    pierce: 0, aoeRadius: 3.1, aoeDamageMultiplier: 0.55, igniteOnHit: true, dropWeight: 1,
  },
  flamethrower: {
    id: 'flamethrower', name: 'Miotacz płomieni', shortName: 'MIOTACZ', icon: '🔥',
    color: 0xfb923c, archetype: 'flame', roleDescription: 'Krótki stożek ognia • podpalenie i kontrola przestrzeni', rangeMeters: 6, fireIntervalSeconds: 0.65, magazineSize: 40,
    reloadSeconds: 2.9, damage: 0.5, pellets: 2, spreadRadians: 0.20,
    projectileSpeed: 14, projectileRadius: 0.095,
    pierce: 0, aoeRadius: 0.45, aoeDamageMultiplier: 0.38, igniteOnHit: true, dropWeight: 1,
  },
  plasma_rifle: {
    id: 'plasma_rifle', name: 'Karabin plazmowy', shortName: 'PLAZMA', icon: '🟣',
    color: 0xa78bfa, archetype: 'plasma', roleDescription: 'Skondensowany pocisk plazmowy • mocny wybuch punktowy', rangeMeters: 32, fireIntervalSeconds: 1.2, magazineSize: 18,
    reloadSeconds: 2.65, damage: 1.8, pellets: 1, spreadRadians: 0.018,
    projectileSpeed: 21, projectileRadius: 0.13,
    pierce: 0, aoeRadius: 0.86, aoeDamageMultiplier: 0.40, igniteOnHit: false, dropWeight: 1,
  },
  ballistic_grenade_launcher: {
    id: 'ballistic_grenade_launcher', name: 'Granatnik balistyczny', shortName: 'GRANATNIK', icon: '💣',
    color: 0xd4a24f, archetype: 'grenade', roleDescription: 'Łuk balistyczny z zapalnikiem • eksplozja obszarowa przy kontakcie z podłożem lub celem',
    rangeMeters: 26, fireIntervalSeconds: 2.9, magazineSize: 4, reloadSeconds: 4.1,
    damage: 3.9, pellets: 1, spreadRadians: 0.004, projectileSpeed: 17, projectileRadius: 0.12,
    pierce: 0, aoeRadius: 3.8, aoeDamageMultiplier: 0.72, igniteOnHit: false, dropWeight: 1,
    projectileGravity: 12.5, projectileLaunchVelocity: 7.4, projectileFuseSeconds: 1.4, detonateOnImpact: true,
  },
  gauss_rifle: {
    id: 'gauss_rifle', name: 'Karabin Gaussa', shortName: 'GAUSS', icon: '⚡',
    color: 0x22d3ee, archetype: 'gauss', roleDescription: 'Wolny strzał snajperski • najwyższa penetracja i ciężkie trafienie', rangeMeters: 80, fireIntervalSeconds: 2.7, magazineSize: 5,
    reloadSeconds: 3.05, damage: 4.65, pellets: 1, spreadRadians: 0.002,
    projectileSpeed: 62, projectileRadius: 0.095,
    pierce: 5, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 1,
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

/** Rare Survival-only world loot: 4% normal, 22% elite, boss guaranteed; pity after 18 eligible kills. */
export function rollSurvivalFirearmDrop(
  killCount: number, enemyTier: SurvivalFirearmEnemyTier, consecutiveMisses: number, roll: number,
): SurvivalFirearmDropRoll {
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0.5;
  const safeKills = Number.isFinite(killCount) ? Math.max(0, Math.floor(killCount)) : 0;
  const misses = Number.isFinite(consecutiveMisses) ? Math.max(0, Math.floor(consecutiveMisses)) : 0;
  const minimumKillsReached = safeKills >= 8;
  const baseChance = enemyTier === 'boss' ? 1 : enemyTier === 'elite' ? 0.22 : 0.04;
  const isPityDrop = minimumKillsReached && enemyTier !== 'boss' && misses >= 17;
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

export function isSurvivalFirearmId(value: string): value is SurvivalFirearmId {
  return Object.prototype.hasOwnProperty.call(SURVIVAL_FIREARM_DEFS, value);
}
