export interface AbilityCooldownState {
  remainingSeconds: number;
  durationSeconds: number;
  killRechargeUsedSeconds: number;
}

export interface AbilityCooldownRechargeResult {
  state: AbilityCooldownState;
  rechargedSeconds: number;
}

function safeSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeState(state: AbilityCooldownState): AbilityCooldownState {
  const durationSeconds = safeSeconds(state.durationSeconds);
  return {
    durationSeconds,
    remainingSeconds: Math.min(durationSeconds, safeSeconds(state.remainingSeconds)),
    killRechargeUsedSeconds: safeSeconds(state.killRechargeUsedSeconds),
  };
}

/** Starts a fresh special-ability cooldown and resets its per-use kill charge. */
export function createAbilityCooldown(durationSeconds: number): AbilityCooldownState {
  const duration = safeSeconds(durationSeconds);
  return {
    remainingSeconds: duration,
    durationSeconds: duration,
    killRechargeUsedSeconds: 0,
  };
}

/** Advances the timer by simulation seconds; negative, NaN and infinite deltas are ignored. */
export function advanceAbilityCooldown(
  state: AbilityCooldownState,
  elapsedSeconds: number,
): AbilityCooldownState {
  const current = normalizeState(state);
  const elapsed = safeSeconds(elapsedSeconds);
  return {
    ...current,
    remainingSeconds: Math.max(0, current.remainingSeconds - elapsed),
  };
}

/** Returns a stable 0..1 fill fraction (1 means fully charged and ready). */
export function getAbilityCooldownProgress(state: AbilityCooldownState): number {
  const current = normalizeState(state);
  if (current.durationSeconds <= 0 || current.remainingSeconds <= 0.0001) return 1;
  return Math.max(0, Math.min(1, 1 - current.remainingSeconds / current.durationSeconds));
}

/**
 * Applies a cooldown efficiency multiplier without changing the current fill
 * percentage. This is used by Survival level-up choices so upgrades shorten
 * an in-progress recharge rather than unexpectedly resetting or completing it.
 */
export function scaleAbilityCooldown(
  state: AbilityCooldownState,
  factor: number,
): AbilityCooldownState {
  const current = normalizeState(state);
  const safeFactor = Number.isFinite(factor) ? Math.max(0.1, Math.min(2, factor)) : 1;
  return {
    remainingSeconds: current.remainingSeconds * safeFactor,
    durationSeconds: current.durationSeconds * safeFactor,
    killRechargeUsedSeconds: current.killRechargeUsedSeconds * safeFactor,
  };
}

/**
 * Defeated enemies can refill part of a Survival cooldown, but only up to a
 * per-use cap. The cap is supplied by the caller so a rare build evolution can
 * increase it without changing campaign behaviour.
 */
export function applyAbilityKillRecharge(
  state: AbilityCooldownState,
  requestedSeconds: number,
  maximumRechargeSeconds: number,
): AbilityCooldownRechargeResult {
  const current = normalizeState(state);
  const requested = safeSeconds(requestedSeconds);
  const cap = Math.min(current.durationSeconds, safeSeconds(maximumRechargeSeconds));
  const budget = Math.max(0, cap - current.killRechargeUsedSeconds);
  const rechargedSeconds = Math.min(requested, current.remainingSeconds, budget);

  return {
    state: {
      ...current,
      remainingSeconds: Math.max(0, current.remainingSeconds - rechargedSeconds),
      killRechargeUsedSeconds: current.killRechargeUsedSeconds + rechargedSeconds,
    },
    rechargedSeconds,
  };
}
