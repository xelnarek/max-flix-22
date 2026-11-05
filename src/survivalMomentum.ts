export interface SurvivalMomentumState {
  killStreak: number;
  killStreakRemainingSeconds: number;
  overdriveRemainingSeconds: number;
  overdriveCooldownRemainingSeconds: number;
}

export const SURVIVAL_KILL_STREAK_TARGET = 6;
export const SURVIVAL_KILL_STREAK_WINDOW_SECONDS = 4.5;
export const SURVIVAL_OVERDRIVE_DURATION_SECONDS = 6;
export const SURVIVAL_OVERDRIVE_COOLDOWN_SECONDS = 24;

export function createSurvivalMomentumState(): SurvivalMomentumState {
  return {
    killStreak: 0,
    killStreakRemainingSeconds: 0,
    overdriveRemainingSeconds: 0,
    overdriveCooldownRemainingSeconds: 0,
  };
}

function finiteSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function advanceSurvivalMomentum(
  state: SurvivalMomentumState,
  deltaSeconds: number
): SurvivalMomentumState {
  const dt = finiteSeconds(deltaSeconds);
  const next = {
    killStreak: Math.max(0, Math.floor(Number.isFinite(state.killStreak) ? state.killStreak : 0)),
    killStreakRemainingSeconds: Math.max(0, finiteSeconds(state.killStreakRemainingSeconds) - dt),
    overdriveRemainingSeconds: Math.max(0, finiteSeconds(state.overdriveRemainingSeconds) - dt),
    overdriveCooldownRemainingSeconds: Math.max(0, finiteSeconds(state.overdriveCooldownRemainingSeconds) - dt),
  };

  if (next.killStreakRemainingSeconds <= 0) next.killStreak = 0;
  return next;
}

/** Register one confirmed Survival elimination; a chain never pauses or stacks its own cooldown. */
export function registerSurvivalKill(
  state: SurvivalMomentumState
): { state: SurvivalMomentumState; overdriveStarted: boolean } {
  const activeWindow = finiteSeconds(state.killStreakRemainingSeconds);
  const killStreak = activeWindow > 0
    ? Math.max(0, Math.floor(Number.isFinite(state.killStreak) ? state.killStreak : 0)) + 1
    : 1;
  const cooldown = finiteSeconds(state.overdriveCooldownRemainingSeconds);

  if (killStreak >= SURVIVAL_KILL_STREAK_TARGET && cooldown <= 0) {
    return {
      state: {
        killStreak: 0,
        killStreakRemainingSeconds: 0,
        overdriveRemainingSeconds: SURVIVAL_OVERDRIVE_DURATION_SECONDS,
        overdriveCooldownRemainingSeconds: SURVIVAL_OVERDRIVE_COOLDOWN_SECONDS,
      },
      overdriveStarted: true,
    };
  }

  // During the 24-second lockout, hold the chain at one short of activation.
  // This prevents extra kills from banking multiple Overdrives for later.
  return {
    state: {
      killStreak: Math.min(SURVIVAL_KILL_STREAK_TARGET - 1, killStreak),
      killStreakRemainingSeconds: SURVIVAL_KILL_STREAK_WINDOW_SECONDS,
      overdriveRemainingSeconds: finiteSeconds(state.overdriveRemainingSeconds),
      overdriveCooldownRemainingSeconds: cooldown,
    },
    overdriveStarted: false,
  };
}

export function getSurvivalMomentumRateMultiplier(overdriveRemainingSeconds: number): number {
  return finiteSeconds(overdriveRemainingSeconds) > 0 ? 1.18 : 1;
}

export function getSurvivalMomentumDamageMultiplier(overdriveRemainingSeconds: number): number {
  return finiteSeconds(overdriveRemainingSeconds) > 0 ? 1.12 : 1;
}

export function getSurvivalMomentumMoveMultiplier(overdriveRemainingSeconds: number): number {
  return finiteSeconds(overdriveRemainingSeconds) > 0 ? 1.07 : 1;
}
