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

export interface HorizontalArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerSeparationResult extends HorizontalVector {
  corrected: boolean;
}

/**
 * Moves an enemy out of the player's horizontal model footprint without moving
 * the player. A deterministic direction handles perfectly coincident models,
 * and sampled alternatives keep the correction inside arena bounds when the
 * direct outward path points through a wall.
 */
export function resolveEnemyPlayerSeparation(
  enemy: EnemySpacingActor,
  player: HorizontalVector,
  minimumDistance = 1.25,
  bounds: HorizontalArenaBounds,
  inset = 0,
): PlayerSeparationResult {
  const unchanged = (): PlayerSeparationResult => ({
    x: enemy.x,
    z: enemy.z,
    corrected: false,
  });

  if (
    enemy.state === "defeated" ||
    ![enemy.x, enemy.z, player.x, player.z, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)
  ) {
    return unchanged();
  }

  const radius = Number.isFinite(minimumDistance) ? Math.max(0.1, minimumDistance) : 1.25;
  const dx = enemy.x - player.x;
  const dz = enemy.z - player.z;
  const currentDistance = Math.hypot(dx, dz);
  if (currentDistance >= radius - 1e-6) return unchanged();

  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minZ = Math.min(bounds.minZ, bounds.maxZ);
  const maxZ = Math.max(bounds.minZ, bounds.maxZ);
  const safeInset = Number.isFinite(inset) ? Math.max(0, inset) : 0;
  const insetX = Math.min(safeInset, (maxX - minX) / 2);
  const insetZ = Math.min(safeInset, (maxZ - minZ) / 2);
  const lowerX = minX + insetX;
  const upperX = maxX - insetX;
  const lowerZ = minZ + insetZ;
  const upperZ = maxZ - insetZ;

  const baseAngle = currentDistance > 1e-4
    ? Math.atan2(dz, dx)
    : stablePairAngle("player", enemy.id);
  const sampleCount = 64;
  let bestX = enemy.x;
  let bestZ = enemy.z;
  let bestAlignment = Number.NEGATIVE_INFINITY;
  let foundInBounds = false;

  for (let index = 0; index < sampleCount; index++) {
    const angle = baseAngle + (index / sampleCount) * Math.PI * 2;
    const candidateX = player.x + Math.cos(angle) * radius;
    const candidateZ = player.z + Math.sin(angle) * radius;
    if (
      candidateX < lowerX - 1e-6 || candidateX > upperX + 1e-6 ||
      candidateZ < lowerZ - 1e-6 || candidateZ > upperZ + 1e-6
    ) continue;

    const alignment = Math.cos(angle - baseAngle);
    if (!foundInBounds || alignment > bestAlignment) {
      foundInBounds = true;
      bestAlignment = alignment;
      bestX = candidateX;
      bestZ = candidateZ;
    }
  }

  if (!foundInBounds) {
    // Extremely narrow bounds can make the requested radius impossible.
    // In that case, choose the in-bounds point that maximizes actual clearance.
    let bestDistanceSquared = -1;
    for (let index = 0; index < sampleCount; index++) {
      const angle = baseAngle + (index / sampleCount) * Math.PI * 2;
      const candidateX = Math.max(lowerX, Math.min(upperX, player.x + Math.cos(angle) * radius));
      const candidateZ = Math.max(lowerZ, Math.min(upperZ, player.z + Math.sin(angle) * radius));
      const candidateDx = candidateX - player.x;
      const candidateDz = candidateZ - player.z;
      const distanceSquared = candidateDx * candidateDx + candidateDz * candidateDz;
      if (distanceSquared > bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestX = candidateX;
        bestZ = candidateZ;
      }
    }
  }

  return {
    x: bestX,
    z: bestZ,
    corrected: Math.hypot(bestX - enemy.x, bestZ - enemy.z) > 1e-6,
  };
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
  private readonly bucketPool: T[][] = [];
  private readonly queryBuffer: T[] = [];
  private nextReusableBucket = 0;

  constructor(cellSize = 4) {
    this.cellSize = Number.isFinite(cellSize) ? Math.max(1, cellSize) : 4;
  }

  rebuild(actors: readonly T[]): void {
    this.bucketPool.length = 0;
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.bucketPool.push(bucket);
    }
    this.cells.clear();
    this.nextReusableBucket = 0;

    for (const actor of actors) {
      if (actor.state === "defeated" || !Number.isFinite(actor.x) || !Number.isFinite(actor.z)) continue;
      const cellX = Math.floor(actor.x / this.cellSize);
      const cellZ = Math.floor(actor.z / this.cellSize);
      const key = this.cellKey(cellX, cellZ);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = this.bucketPool[this.nextReusableBucket++] ?? [];
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
        if (bucket) {
          for (const actor of bucket) this.queryBuffer.push(actor);
        }
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
