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
 * Reusable broad-phase index for crowd steering. It reduces each enemy's
 * separation pass from scanning the full crowd to scanning nearby grid cells.
 * query() intentionally reuses one scratch array; callers must consume it
 * synchronously before issuing another query on this index.
 */
export class EnemySpatialIndex<T extends EnemySpacingActor = EnemySpacingActor> {
  private readonly cellSize: number;
  private readonly cells = new Map<string, T[]>();
  private readonly queryBuffer: T[] = [];

  constructor(cellSize = 4) {
    this.cellSize = Number.isFinite(cellSize) ? Math.max(1, cellSize) : 4;
  }

  rebuild(actors: readonly T[]): void {
    this.cells.clear();
    for (const actor of actors) {
      if (actor.state === "defeated" || !Number.isFinite(actor.x) || !Number.isFinite(actor.z)) continue;
      const cellX = Math.floor(actor.x / this.cellSize);
      const cellZ = Math.floor(actor.z / this.cellSize);
      const key = this.cellKey(cellX, cellZ);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = [];
        this.cells.set(key, bucket);
      }
      bucket.push(actor);
    }
  }

  query(x: number, z: number, radius: number): readonly T[] {
    this.queryBuffer.length = 0;
    if (![x, z, radius].every(Number.isFinite)) return this.queryBuffer;

    const safeRadius = Math.max(0, radius);
    const minCellX = Math.floor((x - safeRadius) / this.cellSize);
    const maxCellX = Math.floor((x + safeRadius) / this.cellSize);
    const minCellZ = Math.floor((z - safeRadius) / this.cellSize);
    const maxCellZ = Math.floor((z + safeRadius) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
        const bucket = this.cells.get(this.cellKey(cellX, cellZ));
        if (bucket) this.queryBuffer.push(...bucket);
      }
    }

    return this.queryBuffer;
  }

  private cellKey(cellX: number, cellZ: number): string {
    return cellX + "," + cellZ;
  }
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
