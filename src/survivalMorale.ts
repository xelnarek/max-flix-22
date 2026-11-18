export interface SurvivalMoraleUnit {
  id: string;
  state: string;
  coalitionId?: number;
  leaderId?: string;
}

export const SURVIVAL_LEADER_LOSS_BREAK_SECONDS = 1.45;
export const SURVIVAL_LEADER_LOSS_SPEED_MULTIPLIER = 0.76;

/**
 * Fill reusable leader/member membership sets and return the affected-ID set.
 * This is used by the Wave Director's 180 ms update; callers keep the returned
 * set only until the next invocation because the same scratch is reused.
 */
export function updateSurvivalLeaderLossTargets(
  units: readonly SurvivalMoraleUnit[],
  livingIds: Set<string>,
  affectedIds: Set<string>,
): ReadonlySet<string> {
  livingIds.clear();
  affectedIds.clear();
  for (const unit of units) {
    if (unit.id && unit.state !== 'defeated') livingIds.add(unit.id);
  }

  for (const unit of units) {
    if (
      !unit.id ||
      unit.state === 'defeated' ||
      !Number.isFinite(unit.coalitionId) ||
      !unit.leaderId ||
      unit.leaderId === unit.id ||
      livingIds.has(unit.leaderId)
    ) continue;
    affectedIds.add(unit.id);
  }
  return affectedIds;
}

/** Allocating convenience wrapper retained for tests and non-hot-path callers. */
export function getSurvivalLeaderLossTargets(
  units: readonly SurvivalMoraleUnit[],
): string[] {
  const livingIds = new Set<string>();
  const affectedIds = new Set<string>();
  updateSurvivalLeaderLossTargets(units, livingIds, affectedIds);
  return [...affectedIds].sort((a, b) => a.localeCompare(b));
}

/** Briefly soften movement after a squad loses its coordinator. */
export function getSurvivalMoraleBreakMultiplier(remainingSeconds: number): number {
  return Number.isFinite(remainingSeconds) && remainingSeconds > 0
    ? SURVIVAL_LEADER_LOSS_SPEED_MULTIPLIER
    : 1;
}
