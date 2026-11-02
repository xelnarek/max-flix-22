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
  const strength = Math.min(isBoss ? 0.09 : 0.16, (isBoss ? 0.065 : 0.085) * damageScale);
  const impulse = isBoss
    ? Math.min(0.48, 0.28 + safeDamage * 0.035)
    : Math.min(1.05, 0.52 + safeDamage * 0.12);

  return {
    duration: isBoss ? 0.15 : 0.21,
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
