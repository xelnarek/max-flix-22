import type { EnemyType } from './types.ts';

export type SurvivalXpDropClass = 'regular' | 'heavy' | 'elite' | 'boss';

export interface SurvivalXpDropProfile {
  readonly dropClass: SurvivalXpDropClass;
  readonly chance: number;
  readonly minValue: number;
  readonly maxValue: number;
}

export interface SurvivalXpDropResult {
  readonly dropClass: SurvivalXpDropClass;
  readonly value: number;
  readonly isMilestone: boolean;
  /** True when bad-luck protection, rather than the base roll, secured this crystal. */
  readonly isPityDrop: boolean;
}

const BOSS_TYPES: ReadonlySet<EnemyType> = new Set([
  'walczak', 'krol_leto', 'bosman_krakow',
]);

const ELITE_TYPES: ReadonlySet<EnemyType> = new Set([
  'elite_walczak_guard', 'sebix_m', 'mutant_gamma_forklift',
  'radioactive_pip', 'cyber_salesman', 'pomazaniec',
]);

const HEAVY_TYPES: ReadonlySet<EnemyType> = new Set([
  'sztaplar_szalony', 'monter', 'inspector', 'serwisant',
  'pan_roman', 'piorun_dron', 'agv_robot', 'forklift',
]);

export function getSurvivalXpDropProfile(type: EnemyType): SurvivalXpDropProfile {
  if (BOSS_TYPES.has(type)) return { dropClass: 'boss', chance: 1, minValue: 3, maxValue: 4 };
  if (ELITE_TYPES.has(type)) return { dropClass: 'elite', chance: 0.88, minValue: 2, maxValue: 3 };
  if (HEAVY_TYPES.has(type)) return { dropClass: 'heavy', chance: 0.56, minValue: 2, maxValue: 3 };
  return { dropClass: 'regular', chance: 0.32, minValue: 1, maxValue: 2 };
}

function safeRoll(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
}

function safeMultiplier(value: number): number {
  return Number.isFinite(value) ? Math.max(0.25, Math.min(2, value)) : 1;
}

function safeChanceMultiplier(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 1;
}

function safeMissStreak(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(8, Math.floor(value))) : 0;
}

function getPityThreshold(dropClass: SurvivalXpDropClass): number {
  if (dropClass === 'regular') return 4;
  if (dropClass === 'heavy') return 2;
  if (dropClass === 'elite') return 1;
  return Number.POSITIVE_INFINITY;
}

/**
 * Regular workers no longer drop XP on every kill. Heavy/elite enemies are
 * better sources; milestone kills and bosses remain guaranteed rewards.
 */
export function rollSurvivalXpDrop(
  type: EnemyType,
  chanceRoll: number,
  valueRoll: number,
  waveValueMultiplier = 1,
  anomalyChanceMultiplier = 1,
  anomalyValueMultiplier = 1,
  milestoneBonus = 0,
  consecutiveMisses = 0,
): SurvivalXpDropResult | null {
  const profile = getSurvivalXpDropProfile(type);
  const isMilestone = Number.isFinite(milestoneBonus) && milestoneBonus > 0;
  const chanceMultiplier = safeChanceMultiplier(anomalyChanceMultiplier);
  const baseChance = Math.min(1, profile.chance * chanceMultiplier);
  const threshold = getPityThreshold(profile.dropClass);
  const misses = safeMissStreak(consecutiveMisses);
  // Pity fills only the remaining gap to 100%: regular enemies are protected
  // after four misses, heavies after two and elites after one. A zero chance
  // anomaly remains an intentional hard block and cannot be bypassed.
  const pityProgress = chanceMultiplier > 0 && Number.isFinite(threshold)
    ? Math.min(1, misses / threshold)
    : 0;
  const chance = Math.min(1, baseChance + (1 - baseChance) * pityProgress);
  const roll = safeRoll(chanceRoll);
  if (!isMilestone && roll >= chance) return null;

  const range = profile.maxValue - profile.minValue + 1;
  const rolledBase = profile.minValue + Math.floor(safeRoll(valueRoll) * range);
  const scaled = Math.round(rolledBase * safeMultiplier(waveValueMultiplier) * safeMultiplier(anomalyValueMultiplier));
  const bonus = isMilestone ? Math.max(0, Math.floor(milestoneBonus)) : 0;
  return {
    dropClass: profile.dropClass,
    value: Math.max(1, Math.min(18, scaled + bonus)),
    isMilestone,
    isPityDrop: !isMilestone && pityProgress > 0 && roll >= baseChance,
  };
}
