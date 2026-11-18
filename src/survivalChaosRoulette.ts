export type SurvivalChaosRouletteKind =
  | 'skill'
  | 'perk'
  | 'shield'
  | 'heal'
  | 'explosion'
  | 'nova'
  | 'enemy_pack'
  | 'xp_rain'
  | 'overdrive'
  | 'bounty'
  | 'time_lock'
  | 'elite_delivery';

export interface SurvivalChaosRouletteEntry {
  kind: SurvivalChaosRouletteKind;
  weight: number;
}

/**
 * The 12-outcome B4 machine totals exactly 100. Enemy deliveries remain a
 * deliberate 9% combined risk rather than an accidental dominant result.
 */
export const SURVIVAL_CHAOS_ROULETTE_TABLE: readonly SurvivalChaosRouletteEntry[] = [
  { kind: 'skill', weight: 17 },
  { kind: 'perk', weight: 16 },
  { kind: 'shield', weight: 10 },
  { kind: 'heal', weight: 10 },
  { kind: 'explosion', weight: 8 },
  { kind: 'nova', weight: 8 },
  { kind: 'enemy_pack', weight: 7 },
  { kind: 'xp_rain', weight: 7 },
  { kind: 'overdrive', weight: 6 },
  { kind: 'bounty', weight: 5 },
  { kind: 'time_lock', weight: 4 },
  { kind: 'elite_delivery', weight: 2 },
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
