export interface CriticalDamageResult {
  damage: number;
  critical: boolean;
}

/**
 * Resolves one weapon-volley critical roll.
 * The caller rolls once per volley so every projectile in a spread shares the same
 * critical state instead of independently rerolling for every shard or target.
 */
export function rollSurvivalCriticalDamage(
  baseDamage: number,
  criticalChance: number,
  criticalMultiplier: number,
  randomValue: number
): CriticalDamageResult {
  const safeDamage = Number.isFinite(baseDamage) ? Math.max(1, Math.round(baseDamage)) : 1;
  const safeChance = Number.isFinite(criticalChance)
    ? Math.min(0.6, Math.max(0, criticalChance))
    : 0;
  const safeMultiplier = Number.isFinite(criticalMultiplier)
    ? Math.min(3, Math.max(1, criticalMultiplier))
    : 1;
  const safeRoll = Number.isFinite(randomValue)
    ? Math.min(0.999999, Math.max(0, randomValue))
    : 1;
  const critical = safeRoll < safeChance;

  return {
    damage: critical
      ? Math.max(safeDamage + 1, Math.round(safeDamage * safeMultiplier))
      : safeDamage,
    critical,
  };
}

/**
 * Adds a single, non-stacking +1 damage charge earned by a perfect boss-lane dodge.
 * The bonus is applied to one complete weapon volley, before its shared critical roll.
 */
export function applyPerfectDodgeCounterattack(baseDamage: number, counterattackReady: boolean): number {
  const safeDamage = Number.isFinite(baseDamage) ? Math.max(1, Math.round(baseDamage)) : 1;
  return counterattackReady ? safeDamage + 1 : safeDamage;
}

/** Returns a bounded Survival dash cooldown; upgrades cannot make the dodge spammy. */
export function getSurvivalDashCooldownSeconds(cooldownMultiplier: number): number {
  const safeMultiplier = Number.isFinite(cooldownMultiplier) && cooldownMultiplier > 0
    ? cooldownMultiplier
    : 1;
  return Math.min(5.2, Math.max(3, 5.2 * safeMultiplier));
}

/** Converts the remaining dash cooldown into a stable 0–1 HUD fill value. */
export function getSurvivalDashProgress(remainingSeconds: number, durationSeconds: number): number {
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  const remaining = Number.isFinite(remainingSeconds) ? Math.max(0, remainingSeconds) : duration;
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - remaining / duration));
}
