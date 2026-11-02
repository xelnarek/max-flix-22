export interface EnemySpacingActor {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly state?: string;
}

export interface HorizontalVector {
  x: number;
  z: number;
}

const DEFAULT_ENEMY_SPACING = 2.6;
const MAX_SEPARATION_MAGNITUDE = 1.65;

function stablePairAngle(firstId: string, secondId: string): number {
  const pair = firstId < secondId ? firstId + "|" + secondId : secondId + "|" + firstId;
  let hash = 2166136261;
  for (let index = 0; index < pair.length; index++) {
    hash = Math.imul(hash ^ pair.charCodeAt(index), 16777619);
  }
  return ((hash >>> 0) / 0x100000000) * Math.PI * 2;
}

/**
 * Returns a bounded repulsion vector for an enemy that is too close to another
 * live enemy. Coincident actors receive a stable, opposite direction based on
 * their IDs; they no longer remain stacked because a zero-distance vector was
 * previously ignored by the steering code.
 */
export function calculateEnemySeparationVector(
  self: EnemySpacingActor,
  others: readonly EnemySpacingActor[],
  desiredSpacing = DEFAULT_ENEMY_SPACING,
): HorizontalVector {
  const radius = Number.isFinite(desiredSpacing)
    ? Math.max(0.1, desiredSpacing)
    : DEFAULT_ENEMY_SPACING;
  const radiusSquared = radius * radius;
  let x = 0;
  let z = 0;

  for (const other of others) {
    if (other.id === self.id || other.state === "defeated") continue;
    if (!Number.isFinite(other.x) || !Number.isFinite(other.z)) continue;

    let dx = self.x - other.x;
    let dz = self.z - other.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared >= radiusSquared) continue;

    let distance = Math.sqrt(distanceSquared);
    if (distance < 0.0001) {
      const angle = stablePairAngle(self.id, other.id);
      const direction = self.id < other.id ? 1 : -1;
      dx = Math.cos(angle) * direction;
      dz = Math.sin(angle) * direction;
      distance = 0;
    } else {
      dx /= distance;
      dz /= distance;
    }

    const safeDistance = Math.max(0.35, distance);
    const force = (radius - distance) / (radius * safeDistance);
    x += dx * force;
    z += dz * force;
  }

  const magnitude = Math.hypot(x, z);
  if (magnitude > MAX_SEPARATION_MAGNITUDE) {
    const scale = MAX_SEPARATION_MAGNITUDE / magnitude;
    x *= scale;
    z *= scale;
  }

  return { x, z };
}

/**
 * Chooses the first spawn candidate with enough room from live actors. If the
 * sampled perimeter is crowded, returns the candidate with the greatest
 * distance to its nearest neighbour instead of returning a random pile-up.
 */
export function chooseSpacedSpawnPoint(
  candidates: readonly HorizontalVector[],
  occupied: readonly EnemySpacingActor[],
  minimumDistance = 3.2,
): HorizontalVector | null {
  const safeMinimum = Number.isFinite(minimumDistance) ? Math.max(0, minimumDistance) : 3.2;
  const minimumSquared = safeMinimum * safeMinimum;
  let best: HorizontalVector | null = null;
  let bestNearestSquared = -1;

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) continue;

    let nearestSquared = Number.POSITIVE_INFINITY;
    for (const actor of occupied) {
      if (actor.state === "defeated" || !Number.isFinite(actor.x) || !Number.isFinite(actor.z)) continue;
      const dx = candidate.x - actor.x;
      const dz = candidate.z - actor.z;
      nearestSquared = Math.min(nearestSquared, dx * dx + dz * dz);
    }

    if (nearestSquared >= minimumSquared) return { x: candidate.x, z: candidate.z };
    if (nearestSquared > bestNearestSquared) {
      bestNearestSquared = nearestSquared;
      best = { x: candidate.x, z: candidate.z };
    }
  }

  return best;
}
