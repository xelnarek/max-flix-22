export type SurvivalChaosRouletteKind =
  | 'skill' | 'perk' | 'shield' | 'heal' | 'explosion' | 'nova'
  | 'enemy_pack' | 'xp_rain' | 'overdrive' | 'bounty' | 'time_lock' | 'elite_delivery'
  | 'magnet_surge' | 'xp_surge' | 'golden_crate' | 'hazard_clear' | 'double_or_nothing' | 'weapon_draft';

export interface SurvivalChaosRouletteEntry {
  kind: SurvivalChaosRouletteKind;
  weight: number;
}

/**
 * Eighteen weighted outcomes total 100%. Direct enemy deliveries remain at 8%;
 * double-or-nothing adds a 2% entry with a 45% hostile second roll.
 */
export const SURVIVAL_CHAOS_ROULETTE_TABLE: readonly SurvivalChaosRouletteEntry[] = [
  { kind: 'skill', weight: 14 },
  { kind: 'perk', weight: 13 },
  { kind: 'shield', weight: 8 },
  { kind: 'heal', weight: 8 },
  { kind: 'explosion', weight: 6 },
  { kind: 'nova', weight: 6 },
  { kind: 'enemy_pack', weight: 6 },
  { kind: 'xp_rain', weight: 5 },
  { kind: 'overdrive', weight: 4 },
  { kind: 'bounty', weight: 4 },
  { kind: 'time_lock', weight: 4 },
  { kind: 'elite_delivery', weight: 2 },
  { kind: 'magnet_surge', weight: 5 },
  { kind: 'xp_surge', weight: 4 },
  { kind: 'golden_crate', weight: 4 },
  { kind: 'hazard_clear', weight: 3 },
  { kind: 'double_or_nothing', weight: 2 },
  { kind: 'weapon_draft', weight: 2 },
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
