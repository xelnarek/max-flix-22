export interface SurvivalXpStreakState {
  count: number;
  lastPickupAt: number;
  perfectRewardClaimed: boolean;
}

export interface SurvivalXpStreakResult {
  state: SurvivalXpStreakState;
  multiplier: number;
  tier: number;
  continued: boolean;
  perfectChainNow: boolean;
}

const STREAK_WINDOW_SECONDS = 4.5;
const STREAK_MULTIPLIERS = [1, 1.03, 1.06, 1.10, 1.15, 1.20] as const;

export function createSurvivalXpStreakState(): SurvivalXpStreakState {
  return { count: 0, lastPickupAt: Number.NEGATIVE_INFINITY, perfectRewardClaimed: false };
}

/** Consecutive XP pickups reward active routing without changing base gem values. */
export function registerSurvivalXpPickup(
  state: SurvivalXpStreakState,
  elapsedSeconds: number,
): SurvivalXpStreakResult {
  const now = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const continued = Number.isFinite(state.lastPickupAt) && now >= state.lastPickupAt &&
    now - state.lastPickupAt <= STREAK_WINDOW_SECONDS;
  const count = continued ? Math.min(STREAK_MULTIPLIERS.length, state.count + 1) : 1;
  const multiplier = STREAK_MULTIPLIERS[count - 1];
  const perfectChainNow = count === STREAK_MULTIPLIERS.length && !state.perfectRewardClaimed;
  return {
    state: { count, lastPickupAt: now, perfectRewardClaimed: continued ? state.perfectRewardClaimed || perfectChainNow : perfectChainNow },
    multiplier,
    tier: count,
    continued,
    perfectChainNow,
  };
}

/** A streak is considered active only while another pickup can still extend it. */
export function getSurvivalXpStreakTier(state: SurvivalXpStreakState, elapsedSeconds: number): number {
  const now = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  return Number.isFinite(state.lastPickupAt) && now >= state.lastPickupAt &&
    now - state.lastPickupAt <= STREAK_WINDOW_SECONDS ? state.count : 0;
}
