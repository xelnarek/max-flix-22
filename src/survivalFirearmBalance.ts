import type { SurvivalFirearmDefinition } from './survivalFirearms.ts';

export interface SurvivalFirearmBalance {
  /** Direct damage from one trigger when every projectile/pellet connects. */
  readonly damagePerTrigger: number;
  /** Direct damage available in one full magazine when every projectile connects. */
  readonly magazineDamage: number;
  /** Time from the first shot in a magazine to the first shot after its reload. */
  readonly magazineCycleSeconds: number;
  /** Sustained direct DPS, including the weapon-specific reload downtime. */
  readonly sustainedDirectDps: number;
}

/**
 * Compare weapon profiles on a consistent direct-hit basis.
 * Splash, status effects, penetration through multiple targets and accuracy are
 * intentionally excluded: those depend on target placement and cannot be
 * represented honestly by a single catalogue number.
 */
export function getSurvivalFirearmBalance(
  firearm: Pick<SurvivalFirearmDefinition, 'damage' | 'pellets' | 'magazineSize' | 'fireIntervalSeconds' | 'reloadSeconds'>,
): SurvivalFirearmBalance {
  const damage = Number.isFinite(firearm.damage) ? Math.max(0, firearm.damage) : 0;
  const pellets = Number.isFinite(firearm.pellets) ? Math.max(1, Math.floor(firearm.pellets)) : 1;
  const magazineSize = Number.isFinite(firearm.magazineSize) ? Math.max(1, Math.floor(firearm.magazineSize)) : 1;
  const fireInterval = Number.isFinite(firearm.fireIntervalSeconds)
    ? Math.max(0.01, firearm.fireIntervalSeconds)
    : 0.01;
  const reloadSeconds = Number.isFinite(firearm.reloadSeconds)
    ? Math.max(0, firearm.reloadSeconds)
    : 0;

  const damagePerTrigger = damage * pellets;
  const magazineDamage = damagePerTrigger * magazineSize;
  // The reload and the final shot's normal cadence elapse in parallel.
  const magazineCycleSeconds = (magazineSize - 1) * fireInterval + Math.max(fireInterval, reloadSeconds);

  return {
    damagePerTrigger,
    magazineDamage,
    magazineCycleSeconds,
    sustainedDirectDps: magazineDamage / magazineCycleSeconds,
  };
}
