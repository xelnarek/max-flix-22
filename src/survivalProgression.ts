/**
 * Survival progression uses short early thresholds, named operator ranks and
 * predictable promotion checkpoints. Rank promotions improve one draft card
 * and award a bounded reroll instead of adding a second, runaway power system.
 */
export type SurvivalPromotionRarity = 'rare' | 'epic' | 'legendary';

export interface SurvivalProgressionInfo {
  rankName: string;
  nextRankName: string;
  nextRankLevel: number;
  isPromotion: boolean;
}

const SURVIVAL_RANKS = [
  { level: 1, name: 'NOWICJUSZ' },
  { level: 5, name: 'OPERATOR' },
  { level: 10, name: 'SPECJALISTA' },
  { level: 15, name: 'BRYGADZISTA' },
  { level: 20, name: 'KIEROWNIK' },
  { level: 25, name: 'LEGENDA B4' },
] as const;

function safeLevel(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

/** XP required to move from the current level to the next one. */
export function getSurvivalXpRequirement(level: number): number {
  const current = safeLevel(level);

  // Keep the first upgrade quick and shave 10% from the old long-run curve.
  if (current === 1) return 9;
  if (current === 2) return 15;
  return Math.max(12, Math.round((10 + current * 3) * 0.90));
}

/** The player's current named rank and the next promotion checkpoint. */
export function getSurvivalProgressionInfo(level: number): SurvivalProgressionInfo {
  const current = safeLevel(level);
  let activeRank = SURVIVAL_RANKS[0];
  let nextRank: typeof SURVIVAL_RANKS[number] | null = null;

  for (const rank of SURVIVAL_RANKS) {
    if (rank.level <= current) activeRank = rank;
    else {
      nextRank = rank;
      break;
    }
  }

  const nextRankLevel = nextRank?.level ?? (Math.floor(current / 5) + 1) * 5;
  return {
    rankName: activeRank.name,
    nextRankName: nextRank?.name ?? 'MISTRZOSTWO B4',
    nextRankLevel,
    isPromotion: current > 1 && current % 5 === 0,
  };
}

/**
 * Every fifth level is a promotion. The first promotion guarantees a Rare
 * card, later ranks guarantee Epic, and senior ranks guarantee Legendary.
 */
export function getSurvivalPromotionRarityFloor(level: number): SurvivalPromotionRarity | null {
  const current = safeLevel(level);
  if (current < 5 || current % 5 !== 0) return null;
  if (current === 5) return 'rare';
  if (current < 20) return 'epic';
  return 'legendary';
}
