export interface IncomingCharacterDamage {
  damage: number;
  remainder: number;
}

/**
 * Basic attacks keep one decimal of character-specific tuning. The shared
 * Survival scaling still controls upgrades; this multiplier only defines the
 * operator's own signature primary attack.
 */
export function scaleCharacterBasicAttackDamage(baseDamage: number, multiplier: number): number {
  const safeDamage = Number.isFinite(baseDamage) ? Math.max(0, baseDamage) : 0;
  const safeMultiplier = Number.isFinite(multiplier)
    ? Math.min(1.8, Math.max(0.5, multiplier))
    : 1;
  return Math.max(0, Math.round(safeDamage * safeMultiplier * 10) / 10);
}

/**
 * Preserve integer HP while applying fractional armour over repeated hits.
 * Remainders accumulate, so mitigation is deterministic rather than a random
 * chance to ignore damage and cannot create fractional HUD hearts.
 */
export function resolveCharacterIncomingDamage(
  amount: number,
  damageTakenMultiplier: number,
  previousRemainder = 0,
): IncomingCharacterDamage {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const safeMultiplier = Number.isFinite(damageTakenMultiplier)
    ? Math.min(1.5, Math.max(0.5, damageTakenMultiplier))
    : 1;
  const safeRemainder = Number.isFinite(previousRemainder)
    ? Math.min(0.999999999, Math.max(0, previousRemainder))
    : 0;
  const accumulated = safeAmount * safeMultiplier + safeRemainder;
  const damage = Math.floor(accumulated + 1e-9);
  return {
    damage,
    remainder: Math.max(0, accumulated - damage),
  };
}
