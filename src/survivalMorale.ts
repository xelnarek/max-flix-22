export interface SurvivalMoraleUnit {
  id: string;
  state: string;
  coalitionId?: number;
  leaderId?: string;
}

export const SURVIVAL_LEADER_LOSS_BREAK_SECONDS = 1.45;
export const SURVIVAL_LEADER_LOSS_SPEED_MULTIPLIER = 0.76;

/**
 * Return living coalition members whose previous leader is no longer alive.
 * The wave director calls this before rebuilding squad assignments, so the
 * loss is detected once and the newly elected leader is not penalized.
 */
export function getSurvivalLeaderLossTargets(
  units: readonly SurvivalMoraleUnit[],
): string[] {
  const livingIds = new Set<string>();
  for (const unit of units) {
    if (unit.id && unit.state !== 'defeated') livingIds.add(unit.id);
  }

  const affectedIds = new Set<string>();
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

  return [...affectedIds].sort((a, b) => a.localeCompare(b));
}

/** Briefly soften movement after a squad loses its coordinator. */
export function getSurvivalMoraleBreakMultiplier(remainingSeconds: number): number {
  return Number.isFinite(remainingSeconds) && remainingSeconds > 0
    ? SURVIVAL_LEADER_LOSS_SPEED_MULTIPLIER
    : 1;
}
