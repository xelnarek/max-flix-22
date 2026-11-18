import type { EnemyType } from './types.ts';

export type SurvivalEnemySpawnType = Extract<EnemyType,
  | 'zombie_pracownik'
  | 'kurier'
  | 'sztaplar_szalony'
  | 'monter'
  | 'inspector'
  | 'handlowiec'
  | 'customer'
  | 'architect'
  | 'przedstawiciel_włoski'
  | 'serwisant'
  | 'agv_robot'
  | 'pan_roman'
  | 'piorun_dron'
  | 'elite_walczak_guard'
  | 'mutant_gamma_forklift'
  | 'radioactive_pip'
  | 'cyber_salesman'
>;

/** Per-run memory used only by regular random Survival deliveries. */
export const SURVIVAL_SPAWN_VARIETY_MEMORY = 2;

export interface SurvivalEnemySpawnWeight {
  readonly type: SurvivalEnemySpawnType;
  readonly minWave: number;
  readonly minElapsedSeconds: number;
  readonly weight: number;
}

// This is the complete regular Survival roster. Bosses and one-off secrets
// remain in their dedicated encounter systems, but every regular archetype
// now has a clear unlock point and a meaningful share of the random spawn pool.
const SURVIVAL_ENEMY_ROSTER: readonly SurvivalEnemySpawnWeight[] = [
  { type: 'zombie_pracownik', minWave: 1, minElapsedSeconds: 0, weight: 15 },
  { type: 'kurier', minWave: 1, minElapsedSeconds: 0, weight: 14 },
  { type: 'sztaplar_szalony', minWave: 1, minElapsedSeconds: 0, weight: 12 },
  { type: 'monter', minWave: 1, minElapsedSeconds: 0, weight: 11 },
  { type: 'inspector', minWave: 1, minElapsedSeconds: 0, weight: 10 },
  { type: 'handlowiec', minWave: 1, minElapsedSeconds: 0, weight: 10 },
  { type: 'customer', minWave: 3, minElapsedSeconds: 0, weight: 9 },
  { type: 'architect', minWave: 4, minElapsedSeconds: 0, weight: 8 },
  { type: 'przedstawiciel_włoski', minWave: 5, minElapsedSeconds: 70, weight: 8 },
  { type: 'serwisant', minWave: 6, minElapsedSeconds: 0, weight: 8 },
  { type: 'piorun_dron', minWave: 6, minElapsedSeconds: 0, weight: 6 },
  { type: 'agv_robot', minWave: 7, minElapsedSeconds: 0, weight: 6 },
  { type: 'pan_roman', minWave: 7, minElapsedSeconds: 0, weight: 6 },
  { type: 'elite_walczak_guard', minWave: 8, minElapsedSeconds: 0, weight: 5 },
  { type: 'mutant_gamma_forklift', minWave: 2, minElapsedSeconds: 90, weight: 4 },
  { type: 'radioactive_pip', minWave: 3, minElapsedSeconds: 150, weight: 4 },
  { type: 'cyber_salesman', minWave: 4, minElapsedSeconds: 210, weight: 3 },
];

function safeWave(wave: number): number {
  return Number.isFinite(wave) ? Math.max(1, Math.floor(wave)) : 1;
}

function safeElapsed(elapsedSeconds: number): number {
  return Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
}

/** Return the eligible roster and weights for the requested Survival stage. */
export function getSurvivalEnemySpawnWeights(
  wave: number,
  elapsedSeconds: number,
): SurvivalEnemySpawnWeight[] {
  const safeWaveValue = safeWave(wave);
  const safeElapsedValue = safeElapsed(elapsedSeconds);
  return SURVIVAL_ENEMY_ROSTER.filter((entry) =>
    safeWaveValue >= entry.minWave && safeElapsedValue >= entry.minElapsedSeconds
  ).map((entry) => ({ ...entry }));
}

/**
 * Weighted, deterministic selection from the unlocked regular roster.
 * roll=0 selects the first eligible archetype; values approach 1 select the
 * final entry. Invalid rolls are safely replaced with the pool midpoint.
 */
export function chooseSurvivalEnemySpawnType(
  wave: number,
  elapsedSeconds: number,
  roll: number,
  recentTypes: readonly SurvivalEnemySpawnType[] = [],
): SurvivalEnemySpawnType {
  const eligible = getSurvivalEnemySpawnWeights(wave, elapsedSeconds);
  if (eligible.length === 0) return 'zombie_pracownik';

  // Avoid the last two regular archetypes inside a delivery group. If every
  // unlocked type is in the recent window, fall back to the full roster.
  const recent = new Set(recentTypes.slice(-SURVIVAL_SPAWN_VARIETY_MEMORY));
  const varied = recent.size > 0 ? eligible.filter((entry) => !recent.has(entry.type)) : eligible;
  const pool = varied.length > 0 ? varied : eligible;
  const totalWeight = pool.reduce((total, entry) => total + entry.weight, 0);
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999999, roll)) : 0.5;
  const target = safeRoll * totalWeight;
  let cumulative = 0;
  for (const entry of pool) {
    cumulative += entry.weight;
    if (target < cumulative) return entry.type;
  }
  return pool[pool.length - 1].type;
}
