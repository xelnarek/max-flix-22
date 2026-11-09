export interface EnemyHitReaction {
  duration: number;
  strength: number;
  impulseX: number;
  impulseZ: number;
}

/** Create a short, bounded recoil and squash response for a confirmed hit. */
export function createEnemyHitReaction(
  enemyX: number,
  enemyZ: number,
  sourceX: number,
  sourceZ: number,
  damage: number,
  isBoss = false,
): EnemyHitReaction {
  const dx = Number.isFinite(enemyX - sourceX) ? enemyX - sourceX : 0;
  const dz = Number.isFinite(enemyZ - sourceZ) ? enemyZ - sourceZ : 0;
  const distance = Math.hypot(dx, dz);
  const directionX = distance > 0.0001 ? dx / distance : 1;
  const directionZ = distance > 0.0001 ? dz / distance : 0;
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const damageScale = Math.min(1.4, 0.8 + safeDamage * 0.12);
  const strength = Math.min(isBoss ? 0.105 : 0.18, (isBoss ? 0.073 : 0.095) * damageScale);
  const impulse = isBoss
    ? Math.min(0.56, 0.32 + safeDamage * 0.04)
    : Math.min(1.2, 0.58 + safeDamage * 0.14);

  return {
    duration: isBoss ? 0.18 : 0.24,
    strength,
    impulseX: directionX * impulse,
    impulseZ: directionZ * impulse,
  };
}

/** Smooth 0..1 pulse envelope; 0 at both ends and 1 at the midpoint. */
export function getEnemyHitPulse(timer: number, duration: number): number {
  if (!Number.isFinite(timer) || !Number.isFinite(duration) || duration <= 0 || timer <= 0) return 0;
  const progress = Math.max(0, Math.min(1, timer / duration));
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(progress * Math.PI);
}


export interface EnemyImpactBurstProfile {
  particleCount: number;
  particleScale: number;
  particleSpeed: number;
  duration: number;
}

/** Bounded hit sparks; mobile quality tiers reduce particle count, never combat feedback. */
export function getEnemyImpactBurstProfile(
  damage: number,
  isBoss = false,
  isMobile = false,
  effectsTier = 0,
): EnemyImpactBurstProfile {
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const tier = Number.isFinite(effectsTier)
    ? Math.max(0, Math.min(2, Math.floor(effectsTier)))
    : 1;
  const intensity = Math.min(1.45, 0.82 + Math.min(8, safeDamage) * 0.075);
  const particleCount = isMobile
    ? (tier >= 2 ? 1 : tier === 1 ? 2 : isBoss ? 3 : 2)
    : (isBoss ? 5 : safeDamage >= 3 ? 4 : 3);

  return {
    particleCount,
    particleScale: (0.044 + intensity * 0.018) * (isBoss ? 1.12 : 1),
    particleSpeed: Math.min(4.2, 2.25 + intensity * 1.2),
    duration: isBoss ? 0.24 : 0.19,
  };
}
