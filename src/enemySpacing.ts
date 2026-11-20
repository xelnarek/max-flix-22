export interface EnemySpacingActor {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly state?: string;
  readonly type?: string;
  readonly collisionRadius?: number;
  readonly y?: number;
  /** Remaining visible death-animation time; corpses reserve space until removed. */
  readonly deathVisualTimer?: number;
}

export interface MutableEnemySpacingActor extends EnemySpacingActor {
  x: number;
  z: number;
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
  minimumDistance: number,
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
  out: HorizontalVector = { x: 0, z: 0 },
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

  out.x = x;
  out.z = z;
  return out;
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
      if ((actor.state === "defeated" && !(Number.isFinite(actor.deathVisualTimer) && (actor.deathVisualTimer as number) > 0)) || !Number.isFinite(actor.x) || !Number.isFinite(actor.z)) continue;
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
      if ((actor.state === "defeated" && !(Number.isFinite(actor.deathVisualTimer) && (actor.deathVisualTimer as number) > 0)) || !Number.isFinite(actor.x) || !Number.isFinite(actor.z)) continue;
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

/** Horizontal body radii in world metres for the visible gameplay silhouette. */
const ENEMY_BODY_RADII: Readonly<Record<string, number>> = Object.freeze({
  customer: 0.58, walczak: 1.02, forklift: 1.18, architect: 0.56,
  inspector: 0.59, agv_robot: 0.74, handlowiec: 0.58, monter: 0.60,
  piorun_dron: 0.46, elite_walczak_guard: 0.72, kurier: 0.60,
  'przedstawiciel_włoski': 0.59, sztaplar_szalony: 0.68, krol_leto: 1.08,
  pan_roman: 0.65, serwisant: 0.58, bosman_krakow: 0.86,
  zombie_pracownik: 0.64, pomazaniec: 0.78, sebix_m: 0.74,
  mutant_gamma_forklift: 1.08, radioactive_pip: 0.66, cyber_salesman: 0.70,
});

export const MAX_ENEMY_BODY_RADIUS = 1.45;

/** Resolve a safe gameplay radius, optionally refined from a fitted rig. */
export function getEnemyCollisionRadius(type: string, measuredRadius?: number): number {
  const base = ENEMY_BODY_RADII[type] ?? 0.60;
  if (!Number.isFinite(measuredRadius)) return base;
  const measured = Math.max(0.42, Math.min(MAX_ENEMY_BODY_RADIUS, measuredRadius as number));
  // Preserve the fitted rig's measured footprint. The old +22% archetype cap
  // discarded large GLB silhouettes and spawned-size multipliers, so visible
  // shoulders, armour and wide bodies could overlap despite a successful solve.
  return Math.max(base * 0.82, measured);
}

/**
 * Final deterministic crowd collision pass. Tactical steering still controls
 * formation and grouping; this resolves actual body footprints after movement.
 */
export function resolveEnemyCrowdOverlaps<T extends MutableEnemySpacingActor>(
  actors: readonly T[],
  spatialIndex: EnemySpatialIndex<T>,
  bounds: HorizontalArenaBounds,
  clearance = 0.16,
  passes = 2,
  maximumCorrectionPerPass = 0.52,
): number {
  if (![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)) return 0;
  const safeClearance = Number.isFinite(clearance) ? Math.max(0.06, Math.min(0.5, clearance)) : 0.16;
  const safePasses = Number.isFinite(passes) ? Math.max(1, Math.min(16, Math.floor(passes))) : 2;
  const maxCorrection = Number.isFinite(maximumCorrectionPerPass)
    ? Math.max(0.08, Math.min(1.2, maximumCorrectionPerPass))
    : 0.52;
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minZ = Math.min(bounds.minZ, bounds.maxZ);
  const maxZ = Math.max(bounds.minZ, bounds.maxZ);
  let correctedPairs = 0;

  for (let pass = 0; pass < safePasses; pass++) {
    // Refresh between passes so crossing a grid cell cannot hide a contact.
    spatialIndex.rebuild(actors);
    for (const self of actors) {
      if (self.state === 'defeated' || !Number.isFinite(self.x) || !Number.isFinite(self.z)) continue;
      const selfRadius = getEnemyCollisionRadius(self.type ?? '', self.collisionRadius);
      const nearby = spatialIndex.query(
        self.x,
        self.z,
        selfRadius + MAX_ENEMY_BODY_RADIUS + safeClearance + maxCorrection,
      );

      for (const other of nearby) {
        if (other.id <= self.id || other.state === 'defeated') continue;
        if (![other.x, other.z].every(Number.isFinite)) continue;
        // Drones and ground enemies may pass above/below one another.
        if (Number.isFinite(self.y) && Number.isFinite(other.y) &&
            Math.abs((self.y as number) - (other.y as number)) >= 1.15) continue;

        const otherRadius = getEnemyCollisionRadius(other.type ?? '', other.collisionRadius);
        const minimumDistance = selfRadius + otherRadius + safeClearance;
        let dx = self.x - other.x;
        let dz = self.z - other.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= minimumDistance * minimumDistance) continue;

        let distance = Math.sqrt(distanceSquared);
        if (distance < 1e-5) {
          const angle = stablePairAngle(self.id, other.id);
          const sign = self.id < other.id ? 1 : -1;
          dx = Math.cos(angle) * sign;
          dz = Math.sin(angle) * sign;
          distance = 0;
        } else {
          dx /= distance;
          dz /= distance;
        }

        const penetration = minimumDistance - distance;
        const correction = Math.min(maxCorrection, penetration * 0.9);
        const selfMass = selfRadius * selfRadius;
        const otherMass = otherRadius * otherRadius;
        const totalMass = Math.max(1e-5, selfMass + otherMass);
        // The smaller body yields more; large bosses and vehicles stay planted.
        const selfShare = otherMass / totalMass;
        const otherShare = otherIsActiveCorpse ? 0 : selfMass / totalMass;
        const selfInset = Math.min(selfRadius * 0.72, (maxX - minX) * 0.25, (maxZ - minZ) * 0.25);
        const otherInset = Math.min(otherRadius * 0.72, (maxX - minX) * 0.25, (maxZ - minZ) * 0.25);

        self.x = Math.max(minX + selfInset, Math.min(maxX - selfInset, self.x + dx * correction * selfShare));
        self.z = Math.max(minZ + selfInset, Math.min(maxZ - selfInset, self.z + dz * correction * selfShare));
        other.x = Math.max(minX + otherInset, Math.min(maxX - otherInset, other.x - dx * correction * otherShare));
        other.z = Math.max(minZ + otherInset, Math.min(maxZ - otherInset, other.z - dz * correction * otherShare));
        correctedPairs++;
      }
    }
  }
  return correctedPairs;
}

