export const SURVIVAL_COMMAND_WINDUP_SECONDS = 0.72;
export const SURVIVAL_COMMAND_INTERRUPT_COOLDOWN_RATIO = 0.65;

export type SurvivalCommanderTimingPhase =
  | 'cooldown'
  | 'windup-started'
  | 'windup'
  | 'execute'
  | 'interrupted';

export interface SurvivalCommanderTimingStep {
  cooldownRemaining: number;
  windupRemaining: number;
  phase: SurvivalCommanderTimingPhase;
}

/**
 * Advance the boss command clock without side effects.
 * A visible wind-up gives the player time to react; stunning the boss during
 * that window cancels the order and grants a meaningful interruption reward.
 */
export function advanceSurvivalCommanderTiming(
  cooldownRemaining: number,
  windupRemaining: number,
  deltaSeconds: number,
  isStunned: boolean,
  cooldownDuration: number,
): SurvivalCommanderTimingStep {
  const cooldown = Number.isFinite(cooldownRemaining)
    ? Math.max(0, cooldownRemaining)
    : 0;
  const windup = Number.isFinite(windupRemaining)
    ? Math.max(0, windupRemaining)
    : 0;
  const delta = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(0.1, deltaSeconds))
    : 0;
  const duration = Number.isFinite(cooldownDuration)
    ? Math.max(1, cooldownDuration)
    : 12;

  if (isStunned) {
    if (windup > 0) {
      return {
        cooldownRemaining: duration * SURVIVAL_COMMAND_INTERRUPT_COOLDOWN_RATIO,
        windupRemaining: 0,
        phase: 'interrupted',
      };
    }
    return { cooldownRemaining: cooldown, windupRemaining: 0, phase: 'cooldown' };
  }

  if (windup > 0) {
    const remaining = Math.max(0, windup - delta);
    if (remaining > 0) {
      return { cooldownRemaining: 0, windupRemaining: remaining, phase: 'windup' };
    }
    return { cooldownRemaining: duration, windupRemaining: 0, phase: 'execute' };
  }

  const nextCooldown = Math.max(0, cooldown - delta);
  if (nextCooldown > 0) {
    return { cooldownRemaining: nextCooldown, windupRemaining: 0, phase: 'cooldown' };
  }

  return {
    cooldownRemaining: 0,
    windupRemaining: SURVIVAL_COMMAND_WINDUP_SECONDS,
    phase: 'windup-started',
  };
}
