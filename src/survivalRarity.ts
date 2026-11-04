export type SurvivalUpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SurvivalUpgradeRarityMeta {
  rarity: SurvivalUpgradeRarity;
  rarityLabel: string;
  strengthMultiplier: number;
}

const RARITY_META: Record<SurvivalUpgradeRarity, SurvivalUpgradeRarityMeta> = {
  common: { rarity: 'common', rarityLabel: 'ZWYKŁA', strengthMultiplier: 1 },
  rare: { rarity: 'rare', rarityLabel: 'RZADKA', strengthMultiplier: 1.2 },
  epic: { rarity: 'epic', rarityLabel: 'EPICKA', strengthMultiplier: 1.45 },
  legendary: { rarity: 'legendary', rarityLabel: 'LEGENDARNA', strengthMultiplier: 1.75 },
};

/**
 * Skill rarity inspired by Archero-style run drafting.
 * Better tiers become slightly more likely as a run progresses, without
 * making legendary upgrades routine or front-loading early power.
 */
export function rollSurvivalUpgradeRarity(randomValue: number, survivalLevel: number): SurvivalUpgradeRarity {
  const roll = Number.isFinite(randomValue) ? Math.max(0, Math.min(0.999999, randomValue)) : 0.5;
  const level = Number.isFinite(survivalLevel) ? Math.max(1, Math.floor(survivalLevel)) : 1;
  const progressionBonus = Math.min(0.025, (level - 1) * 0.001);

  const legendaryLimit = 0.01 + progressionBonus;
  const epicLimit = 0.08 + progressionBonus * 1.4;
  const rareLimit = 0.30 + progressionBonus * 1.2;

  if (roll < legendaryLimit) return 'legendary';
  if (roll < epicLimit) return 'epic';
  if (roll < rareLimit) return 'rare';
  return 'common';
}

export function getSurvivalUpgradeRarityMeta(rarity: SurvivalUpgradeRarity): SurvivalUpgradeRarityMeta {
  return RARITY_META[rarity] || RARITY_META.common;
}

/** Weapon unlocks can arrive partially levelled at higher skill rarities. */
export function getSurvivalWeaponInitialLevel(rarity: SurvivalUpgradeRarity): number {
  return rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : 1;
}

/** Legendary weapon cards grant a two-step upgrade, still capped at level five. */
export function getSurvivalWeaponUpgradeSteps(rarity: SurvivalUpgradeRarity): number {
  return rarity === 'legendary' ? 2 : 1;
}
