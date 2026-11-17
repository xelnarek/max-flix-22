import type { HorizontalVector } from './enemySpacing.ts';

export interface EnemySteeringInput {
  readonly chase: HorizontalVector;
  readonly separation?: HorizontalVector;
  readonly avoidance?: HorizontalVector;
  readonly previous?: HorizontalVector;
  readonly dt: number;
  readonly separationWeight?: number;
  readonly avoidanceWeight?: number;
  readonly response?: number;
}

/** Blend pursuit, crowd separation and cover avoidance without force cancellation or frame-to-frame jitter. */
export function calculateStableEnemySteering(input: EnemySteeringInput): HorizontalVector {
  const safe = (value: number | undefined) => Number.isFinite(value) ? value as number : 0;
  const chaseX = safe(input.chase.x);
  const chaseZ = safe(input.chase.z);
  const chaseLength = Math.hypot(chaseX, chaseZ);
  if (chaseLength < 1e-5) return { x: 0, z: 0 };
  const baseX = chaseX / chaseLength;
  const baseZ = chaseZ / chaseLength;
  const separationWeight = Math.max(0, safe(input.separationWeight ?? 0.9));
  const avoidanceWeight = Math.max(0, safe(input.avoidanceWeight ?? 0.85));
  let desiredX = baseX * 1.15 + safe(input.separation?.x) * separationWeight +
    safe(input.avoidance?.x) * avoidanceWeight;
  let desiredZ = baseZ * 1.15 + safe(input.separation?.z) * separationWeight +
    safe(input.avoidance?.z) * avoidanceWeight;
  const forward = desiredX * baseX + desiredZ * baseZ;
  if (forward < 0.28) {
    desiredX += baseX * (0.28 - forward);
    desiredZ += baseZ * (0.28 - forward);
  }
  const desiredLength = Math.hypot(desiredX, desiredZ);
  if (desiredLength < 1e-5) {
    desiredX = baseX;
    desiredZ = baseZ;
  } else {
    desiredX /= desiredLength;
    desiredZ /= desiredLength;
  }
  const previousX = safe(input.previous?.x);
  const previousZ = safe(input.previous?.z);
  const previousLength = Math.hypot(previousX, previousZ);
  if (previousLength < 1e-5) return { x: desiredX, z: desiredZ };
  const dt = Math.max(0, Math.min(0.1, safe(input.dt)));
  const response = Math.max(0.1, safe(input.response ?? 7.5));
  const blend = 1 - Math.exp(-response * dt);
  const x = previousX / previousLength * (1 - blend) + desiredX * blend;
  const z = previousZ / previousLength * (1 - blend) + desiredZ * blend;
  const length = Math.hypot(x, z);
  if (length < 0.12) return { x: desiredX, z: desiredZ };
  return { x: x / length, z: z / length };
}

/** Role-specific engagement distance: melee closes to contact; ranged units hold a firing lane. */
export function getEnemyEngageRadius(role: 'bruiser' | 'flanker' | 'ranged' | 'support' | 'standard'): number {
  switch (role) {
    case 'bruiser': return 1.08;
    case 'flanker': return 1.18;
    case 'ranged': return 7.7;
    case 'support': return 5.5;
    default: return 1.15;
  }
}
