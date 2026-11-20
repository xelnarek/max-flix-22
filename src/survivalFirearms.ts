export type SurvivalFirearmId =
  | 'starter_pistol'
  | 'smg_45'
  | 'assault_rifle'
  | 'shotgun_12g'
  | 'battle_rifle'
  | 'minigun'
  | 'rocket_launcher'
  | 'flamethrower'
  | 'plasma_rifle'
  | 'gauss_rifle';

export type SurvivalFirearmArchetype =
  | 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle'
  | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss';

export interface SurvivalFirearmDefinition {
  readonly id: SurvivalFirearmId;
  readonly name: string;
  readonly shortName: string;
  readonly icon: string;
  readonly color: number;
  readonly archetype: SurvivalFirearmArchetype;
  readonly fireIntervalSeconds: number;
  readonly magazineSize: number;
  readonly reloadSeconds: number;
  readonly damage: number;
  readonly pellets: number;
  readonly spreadRadians: number;
  readonly projectileSpeed: number;
  readonly projectileLifeSeconds: number;
  readonly projectileRadius: number;
  readonly pierce: number;
  readonly aoeRadius: number;
  readonly aoeDamageMultiplier: number;
  readonly igniteOnHit: boolean;
  readonly dropWeight: number;
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

/**
 * Primary firearms are independent of the Survival perk draft, boss rewards
 * and B4 roulette. All operators receive this exact same sidearm at run start.
 */
export const STARTING_SURVIVAL_FIREARM: SurvivalFirearmId = 'starter_pistol';

export const SURVIVAL_FIREARM_DEFS: Readonly<Record<SurvivalFirearmId, SurvivalFirearmDefinition>> = Object.freeze({
  starter_pistol: {
    id: 'starter_pistol', name: 'Pistolet serwisowy', shortName: 'PISTOLET', icon: '🔫',
    color: 0xcbd5e1, archetype: 'pistol', fireIntervalSeconds: 0.34, magazineSize: 12,
    reloadSeconds: 1.05, damage: 1.0, pellets: 1, spreadRadians: 0.012,
    projectileSpeed: 31, projectileLifeSeconds: 1.0, projectileRadius: 0.075,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 0,
  },
  smg_45: {
    id: 'smg_45', name: 'Pistolet maszynowy .45', shortName: 'PM .45', icon: '🔫',
    color: 0x94a3b8, archetype: 'smg', fireIntervalSeconds: 0.105, magazineSize: 32,
    reloadSeconds: 1.42, damage: 0.62, pellets: 1, spreadRadians: 0.055,
    projectileSpeed: 27, projectileLifeSeconds: 0.92, projectileRadius: 0.065,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 15,
  },
  assault_rifle: {
    id: 'assault_rifle', name: 'Karabin szturmowy', shortName: 'KARABIN', icon: '🪖',
    color: 0x86a873, archetype: 'rifle', fireIntervalSeconds: 0.18, magazineSize: 27,
    reloadSeconds: 1.58, damage: 0.96, pellets: 1, spreadRadians: 0.026,
    projectileSpeed: 34, projectileLifeSeconds: 1.12, projectileRadius: 0.07,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 15,
  },
  shotgun_12g: {
    id: 'shotgun_12g', name: 'Strzelba 12G', shortName: 'STRZELBA', icon: '💥',
    color: 0xfbbf24, archetype: 'shotgun', fireIntervalSeconds: 0.78, magazineSize: 8,
    reloadSeconds: 1.9, damage: 0.43, pellets: 7, spreadRadians: 0.235,
    projectileSpeed: 23, projectileLifeSeconds: 0.48, projectileRadius: 0.09,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 13,
  },
  battle_rifle: {
    id: 'battle_rifle', name: 'Karabin bojowy 7.62', shortName: '7.62', icon: '🎯',
    color: 0x60a5fa, archetype: 'heavy-rifle', fireIntervalSeconds: 0.64, magazineSize: 10,
    reloadSeconds: 1.72, damage: 2.05, pellets: 1, spreadRadians: 0.009,
    projectileSpeed: 42, projectileLifeSeconds: 1.05, projectileRadius: 0.085,
    pierce: 1, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 10,
  },
  minigun: {
    id: 'minigun', name: 'Minigun', shortName: 'MINIGUN', icon: '⚙️',
    color: 0xf97316, archetype: 'minigun', fireIntervalSeconds: 0.075, magazineSize: 72,
    reloadSeconds: 2.55, damage: 0.42, pellets: 1, spreadRadians: 0.078,
    projectileSpeed: 32, projectileLifeSeconds: 0.88, projectileRadius: 0.062,
    pierce: 0, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 7,
  },
  rocket_launcher: {
    id: 'rocket_launcher', name: 'Wyrzutnia rakiet', shortName: 'RAKIETY', icon: '🚀',
    color: 0xef4444, archetype: 'rocket', fireIntervalSeconds: 1.42, magazineSize: 5,
    reloadSeconds: 2.45, damage: 3.35, pellets: 1, spreadRadians: 0.006,
    projectileSpeed: 13.8, projectileLifeSeconds: 2.3, projectileRadius: 0.16,
    pierce: 0, aoeRadius: 2.9, aoeDamageMultiplier: 0.48, igniteOnHit: true, dropWeight: 8,
  },
  flamethrower: {
    id: 'flamethrower', name: 'Miotacz płomieni', shortName: 'MIOTACZ', icon: '🔥',
    color: 0xfb923c, archetype: 'flame', fireIntervalSeconds: 0.105, magazineSize: 46,
    reloadSeconds: 2.18, damage: 0.30, pellets: 2, spreadRadians: 0.20,
    projectileSpeed: 12.8, projectileLifeSeconds: 0.42, projectileRadius: 0.095,
    pierce: 0, aoeRadius: 0.38, aoeDamageMultiplier: 0.32, igniteOnHit: true, dropWeight: 7,
  },
  plasma_rifle: {
    id: 'plasma_rifle', name: 'Karabin plazmowy', shortName: 'PLAZMA', icon: '🟣',
    color: 0xa78bfa, archetype: 'plasma', fireIntervalSeconds: 0.36, magazineSize: 20,
    reloadSeconds: 1.78, damage: 1.22, pellets: 1, spreadRadians: 0.018,
    projectileSpeed: 18.5, projectileLifeSeconds: 1.7, projectileRadius: 0.13,
    pierce: 0, aoeRadius: 0.76, aoeDamageMultiplier: 0.34, igniteOnHit: false, dropWeight: 9,
  },
  gauss_rifle: {
    id: 'gauss_rifle', name: 'Karabin Gaussa', shortName: 'GAUSS', icon: '⚡',
    color: 0x22d3ee, archetype: 'gauss', fireIntervalSeconds: 0.96, magazineSize: 6,
    reloadSeconds: 2.12, damage: 3.05, pellets: 1, spreadRadians: 0.002,
    projectileSpeed: 58, projectileLifeSeconds: 1.45, projectileRadius: 0.095,
    pierce: 5, aoeRadius: 0, aoeDamageMultiplier: 0, igniteOnHit: false, dropWeight: 6,
  },
});

export function createStartingSurvivalFirearmState(): SurvivalFirearmState {
  const definition = SURVIVAL_FIREARM_DEFS[STARTING_SURVIVAL_FIREARM];
  return {
    id: STARTING_SURVIVAL_FIREARM,
    ammoInMagazine: definition.magazineSize,
    cooldown: 0,
    reloadRemaining: 0,
    shotCounter: 0,
  };
}

export function createSurvivalFirearmState(id: SurvivalFirearmId): SurvivalFirearmState {
  const definition = SURVIVAL_FIREARM_DEFS[id] || SURVIVAL_FIREARM_DEFS[STARTING_SURVIVAL_FIREARM];
  return { id: definition.id, ammoInMagazine: definition.magazineSize, cooldown: 0, reloadRemaining: 0, shotCounter: 0 };
}

/**
 * Crimsonland-inspired cadence: first kill guarantees the first weapon swap;
 * normal enemies roll 14%, elites 58%, bosses 100%, with a six-kill pity guard.
 * The public game does not disclose exact original RNG percentages.
 */
export function rollSurvivalFirearmDrop(
  killCount: number,
  enemyTier: SurvivalFirearmEnemyTier,
  consecutiveMisses: number,
  roll: number,
): SurvivalFirearmDropRoll {
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0.5;
  const misses = Number.isFinite(consecutiveMisses) ? Math.max(0, Math.floor(consecutiveMisses)) : 0;
  const firstKill = Number.isFinite(killCount) && killCount <= 1;
  const baseChance = enemyTier === 'boss' ? 1 : enemyTier === 'elite' ? 0.58 : 0.14;
  const isPityDrop = !firstKill && enemyTier !== 'boss' && baseChance < 1 && misses >= 5;
  const isGuaranteed = firstKill || enemyTier === 'boss' || isPityDrop;
  return {
    shouldDrop: isGuaranteed || safeRoll < baseChance,
    isGuaranteed,
    isPityDrop,
    chance: isGuaranteed ? 1 : baseChance,
  };
}

/** Weighted world loot roll. The sidearm is a starter, never a world-drop. */
export function rollSurvivalFirearmId(
  currentId: SurvivalFirearmId,
  elapsedSeconds: number,
  roll: number,
): SurvivalFirearmId | null {
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0.5;
  const eligible = Object.values(SURVIVAL_FIREARM_DEFS).filter((definition) =>
    definition.id !== STARTING_SURVIVAL_FIREARM &&
    definition.id !== currentId &&
    definition.dropWeight > 0 &&
    elapsedSeconds >= 0
  );
  if (eligible.length === 0) return null;
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
