import type { EnemyIncomingProjectile } from './enemyTactics.ts';

interface IndexedProjectile extends EnemyIncomingProjectile {
  readonly mesh?: {
    readonly position?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  };
  readonly vel?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

/**
 * Reusable 2D broadphase for incoming player shots that enemy AI may dodge.
 * Queries are deliberately conservative: the search radius includes each
 * projectile's maximum indexed horizontal speed, the dodge look-ahead window,
 * and the time a handheld grid may have remained unchanged. The exact swept
 * trajectory and vertical checks remain in calculateEnemyProjectileDodge().
 */
export class EnemyProjectileThreatIndex<T extends IndexedProjectile = IndexedProjectile> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();
  private readonly bucketPool: T[][] = [];
  private readonly queryBuffer: T[] = [];
  private nextReusableBucket = 0;
  private maxHorizontalSpeed = 0;
  private indexedCount = 0;

  constructor(cellSize = 5) {
    this.cellSize = Number.isFinite(cellSize) ? Math.max(1, cellSize) : 5;
  }

  get size(): number {
    return this.indexedCount;
  }

  get maxIndexedHorizontalSpeed(): number {
    return this.maxHorizontalSpeed;
  }

  rebuild(projectiles: readonly T[]): void {
    this.bucketPool.length = 0;
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.bucketPool.push(bucket);
    }
    this.cells.clear();
    this.nextReusableBucket = 0;
    this.maxHorizontalSpeed = 0;
    this.indexedCount = 0;

    for (const projectile of projectiles) {
      const position = projectile.mesh?.position;
      const velocity = projectile.vel;
      if (
        projectile.orbiting || !position || !velocity ||
        ![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)
      ) continue;

      const speed = Math.hypot(velocity.x, velocity.z);
      // The exact dodge solver ignores slower horizontal shots, so keep them
      // out of the grid rather than widening every query for inert objects.
      if (speed < 2.5) continue;

      const cellX = Math.floor(position.x / this.cellSize);
      const cellZ = Math.floor(position.z / this.cellSize);
      const key = this.cellKey(cellX, cellZ);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = this.bucketPool[this.nextReusableBucket++] ?? [];
        this.cells.set(key, bucket);
      }
      bucket.push(projectile);
      this.maxHorizontalSpeed = Math.max(this.maxHorizontalSpeed, speed);
      this.indexedCount++;
    }
  }

  /**
   * Return only projectiles whose swept broadphase could reach this actor.
   * The extra staleness window accounts for movement since the last rebuild.
   * The returned array is shared scratch and must be consumed synchronously.
   */
  query(
    x: number,
    z: number,
    lookAheadSeconds = 0.72,
    collisionRadius = 1.02,
    stalenessSeconds = 0.04,
  ): readonly T[] {
    this.queryBuffer.length = 0;
    if (
      ![x, z, lookAheadSeconds, collisionRadius, stalenessSeconds].every(Number.isFinite) ||
      this.maxHorizontalSpeed <= 0 || this.cells.size === 0
    ) return this.queryBuffer;

    const lookAhead = Math.max(0, Math.min(1.0, lookAheadSeconds));
    const radius = Math.max(0.2, Math.min(2.5, collisionRadius));
    const stale = Math.max(0, Math.min(0.25, stalenessSeconds));
    const queryRadius = radius + this.maxHorizontalSpeed * (lookAhead + stale);
    const minCellX = Math.floor((x - queryRadius) / this.cellSize);
    const maxCellX = Math.floor((x + queryRadius) / this.cellSize);
    const minCellZ = Math.floor((z - queryRadius) / this.cellSize);
    const maxCellZ = Math.floor((z + queryRadius) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
        const bucket = this.cells.get(this.cellKey(cellX, cellZ));
        if (bucket) {
          for (const projectile of bucket) this.queryBuffer.push(projectile);
        }
      }
    }
    return this.queryBuffer;
  }

  // Pack signed grid coordinates into one numeric key. Arena coordinates are
  // well inside the exact integer range, so Map lookups avoid per-query strings.
  private cellKey(cellX: number, cellZ: number): number {
    return cellX * 0x100000000 + (cellZ >>> 0);
  }
}
