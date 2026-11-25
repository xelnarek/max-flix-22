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
  | 'wkurzona_zona'
  | 'kluska_piekielna'
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
  { type: 'wkurzona_zona', minWave: 4, minElapsedSeconds: 120, weight: 5 },
  { type: 'kluska_piekielna', minWave: 6, minElapsedSeconds: 210, weight: 4 },
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

function isRecentSurvivalSpawnType(
  type: SurvivalEnemySpawnType,
  recentTypes: readonly SurvivalEnemySpawnType[],
): boolean {
  const firstRecentIndex = Math.max(0, recentTypes.length - SURVIVAL_SPAWN_VARIETY_MEMORY);
  for (let index = firstRecentIndex; index < recentTypes.length; index += 1) {
    if (recentTypes[index] === type) return true;
  }
  return false;
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

  // Avoid the two most recent regular deliveries without allocating a Set or
  // filtered pool in the gameplay spawn path. Fall back when all are recent.
  let variedTotalWeight = 0;
  for (const entry of eligible) {
    if (!isRecentSurvivalSpawnType(entry.type, recentTypes)) variedTotalWeight += entry.weight;
  }
  const useVarietyPool = variedTotalWeight > 0 && recentTypes.length > 0;
  let totalWeight = variedTotalWeight;
  if (!useVarietyPool) {
    totalWeight = 0;
    for (const entry of eligible) totalWeight += entry.weight;
  }

  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999999, roll)) : 0.5;
  const target = safeRoll * totalWeight;
  let cumulative = 0;
  let fallbackType = eligible[eligible.length - 1].type;
  for (const entry of eligible) {
    if (useVarietyPool && isRecentSurvivalSpawnType(entry.type, recentTypes)) continue;
    fallbackType = entry.type;
    cumulative += entry.weight;
    if (target < cumulative) return entry.type;
  }
  return fallbackType;
}
