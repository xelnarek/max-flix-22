import type { HorizontalVector } from './enemySpacing.ts';

export interface EnemySteeringInput {
  readonly chase: HorizontalVector;
  readonly separation?: HorizontalVector;
  readonly avoidance?: HorizontalVector;
  readonly previous?: HorizontalVector;
  readonly evasion?: HorizontalVector;
  readonly dt: number;
  readonly separationWeight?: number;
  readonly avoidanceWeight?: number;
  readonly evasionWeight?: number;
  readonly response?: number;
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? value as number : 0;
}

/** Blend pursuit, crowd separation and cover avoidance without force cancellation or frame-to-frame jitter. */
export function calculateStableEnemySteering(
  input: EnemySteeringInput,
  out: HorizontalVector = { x: 0, z: 0 },
): HorizontalVector {
  out.x = 0;
  out.z = 0;
  const chaseX = finiteOrZero(input.chase.x);
  const chaseZ = finiteOrZero(input.chase.z);
  const chaseLength = Math.hypot(chaseX, chaseZ);
  if (chaseLength < 1e-5) return out;
  const baseX = chaseX / chaseLength;
  const baseZ = chaseZ / chaseLength;
  const separationWeight = Math.max(0, finiteOrZero(input.separationWeight ?? 0.9));
  const avoidanceWeight = Math.max(0, finiteOrZero(input.avoidanceWeight ?? 0.85));
  const evasionWeight = Math.max(0, finiteOrZero(input.evasionWeight ?? 1.0));
  let desiredX = baseX * 1.15 + finiteOrZero(input.separation?.x) * separationWeight +
    finiteOrZero(input.avoidance?.x) * avoidanceWeight + finiteOrZero(input.evasion?.x) * evasionWeight;
  let desiredZ = baseZ * 1.15 + finiteOrZero(input.separation?.z) * separationWeight +
    finiteOrZero(input.avoidance?.z) * avoidanceWeight + finiteOrZero(input.evasion?.z) * evasionWeight;
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
  const previousX = finiteOrZero(input.previous?.x);
  const previousZ = finiteOrZero(input.previous?.z);
  const previousLength = Math.hypot(previousX, previousZ);
  if (previousLength < 1e-5) {
    out.x = desiredX;
    out.z = desiredZ;
    return out;
  }
  const dt = Math.max(0, Math.min(0.1, finiteOrZero(input.dt)));
  const response = Math.max(0.1, finiteOrZero(input.response ?? 7.5));
  const blend = 1 - Math.exp(-response * dt);
  const x = previousX / previousLength * (1 - blend) + desiredX * blend;
  const z = previousZ / previousLength * (1 - blend) + desiredZ * blend;
  const length = Math.hypot(x, z);
  if (length < 0.12) {
    out.x = desiredX;
    out.z = desiredZ;
    return out;
  }
  out.x = x / length;
  out.z = z / length;
  return out;
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
