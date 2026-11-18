export type SurvivalChaosRouletteKind =
  | 'skill'
  | 'perk'
  | 'shield'
  | 'heal'
  | 'explosion'
  | 'nova'
  | 'enemy_pack';

export interface SurvivalChaosRouletteEntry {
  kind: SurvivalChaosRouletteKind;
  weight: number;
}

/** Weighted table totals 100; an unwanted enemy delivery is an intentional risk. */
export const SURVIVAL_CHAOS_ROULETTE_TABLE: readonly SurvivalChaosRouletteEntry[] = [
  { kind: 'skill', weight: 24 },
  { kind: 'perk', weight: 24 },
  { kind: 'shield', weight: 12 },
  { kind: 'heal', weight: 12 },
  { kind: 'explosion', weight: 10 },
  { kind: 'nova', weight: 10 },
  { kind: 'enemy_pack', weight: 8 },
];

export function rollSurvivalChaosRoulette(roll: number): SurvivalChaosRouletteKind {
  const safeRoll = Number.isFinite(roll)
    ? Math.max(0, Math.min(0.999999999, roll))
    : 0.5;
  const totalWeight = SURVIVAL_CHAOS_ROULETTE_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  const target = safeRoll * totalWeight;
  let cumulative = 0;
  for (const entry of SURVIVAL_CHAOS_ROULETTE_TABLE) {
    cumulative += entry.weight;
    if (target < cumulative) return entry.kind;
  }
  return SURVIVAL_CHAOS_ROULETTE_TABLE[SURVIVAL_CHAOS_ROULETTE_TABLE.length - 1].kind;
}
