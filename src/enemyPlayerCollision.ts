import type { EnemyType } from './types.ts';

export interface EnemyContactBody {
  readonly id: string;
  readonly type: EnemyType | string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly state?: string;
}

export interface PlayerMovementContactResult {
  readonly x: number;
  readonly z: number;
  readonly collided: boolean;
  readonly normalX: number;
  readonly normalZ: number;
}

/** Model-to-model separation distance used consistently by AI and player movement. */
export function getEnemyPlayerContactDistance(type: EnemyType | string): number {
  if (['walczak', 'krol_leto', 'bosman_krakow', 'cthulhu', 'sebix_m'].includes(type)) {
    return type === 'sebix_m' ? 1.18 : 1.38;
  }
  if (['elite_walczak_guard', 'mutant_gamma_forklift', 'sztaplar_szalony', 'agv_robot'].includes(type)) return 1.12;
  return 0.98;
}

function stableNormal(id: string): { x: number; z: number } {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  const angle = ((hash >>> 0) / 0x100000000) * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

/**
 * Swept circle collision for a moving player against live enemy bodies.
 * The remainder of the movement is projected onto the contact tangent, so
 * holding a joystick against an enemy does not tunnel, vibrate, or completely
 * disable strafing. Jumping over actors remains possible via playerY filtering.
 */
export function resolvePlayerMovementAgainstEnemies(
  start: { x: number; z: number },
  desired: { x: number; z: number },
  playerY: number,
  enemies: readonly EnemyContactBody[],
  verticalClearance = 1.12,
): PlayerMovementContactResult {
  if (![start.x, start.z, desired.x, desired.z, playerY, verticalClearance].every(Number.isFinite)) {
    return { x: desired.x, z: desired.z, collided: false, normalX: 0, normalZ: 0 };
  }

  let x = desired.x;
  let z = desired.z;
  let collided = false;
  let normalX = 0;
  let normalZ = 0;
  const safeClearance = Math.max(0.4, verticalClearance);

  // Two stable passes resolve a player moving into a close pack without
  // allowing the result to oscillate between overlapping enemy circles.
  for (let pass = 0; pass < 2; pass++) {
    for (const enemy of enemies) {
      if (enemy.state === 'defeated' || ![enemy.x, enemy.y, enemy.z].every(Number.isFinite)) continue;
      if (Math.abs(playerY - enemy.y) >= safeClearance) continue;

      const radius = getEnemyPlayerContactDistance(enemy.type);
      const sx = start.x - enemy.x;
      const sz = start.z - enemy.z;
      const startDistanceSq = sx * sx + sz * sz;
      let nx = 0;
      let nz = 0;

      if (startDistanceSq < radius * radius) {
        const length = Math.sqrt(startDistanceSq);
        if (length > 1e-5) {
          nx = sx / length;
          nz = sz / length;
        } else {
          const stable = stableNormal(enemy.id);
          nx = stable.x;
          nz = stable.z;
        }
        // Only push an initially overlapping player far enough to leave the
        // exact collision radius, with a tiny tolerance against floating jitter.
        const endX = x - enemy.x;
        const endZ = z - enemy.z;
        const endProjection = endX * nx + endZ * nz;
        if (endX * endX + endZ * endZ >= radius * radius && endProjection >= radius) continue;
        // Preserve tangential movement when a previous frame ended a fraction
        // inside the radius due to floating-point tolerance. Dropping the
        // remainder here makes a player feel glued to an enemy flank.
        let slideX = x - start.x;
        let slideZ = z - start.z;
        const inward = slideX * nx + slideZ * nz;
        if (inward < 0) {
          slideX -= nx * inward;
          slideZ -= nz * inward;
        }
        x = enemy.x + nx * (radius + 0.012) + slideX;
        z = enemy.z + nz * (radius + 0.012) + slideZ;
      } else {
        const dx = x - start.x;
        const dz = z - start.z;
        const a = dx * dx + dz * dz;
        if (a < 1e-10) continue;
        const b = 2 * (sx * dx + sz * dz);
        const c = startDistanceSq - radius * radius;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) continue;
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t < 0 || t > 1) continue;
        const hitX = start.x + dx * t;
        const hitZ = start.z + dz * t;
        const hx = hitX - enemy.x;
        const hz = hitZ - enemy.z;
        const hitLength = Math.hypot(hx, hz);
        if (hitLength < 1e-5) continue;
        nx = hx / hitLength;
        nz = hz / hitLength;
        const remaining = 1 - t;
        let slideX = dx * remaining;
        let slideZ = dz * remaining;
        const inward = slideX * nx + slideZ * nz;
        if (inward < 0) {
          slideX -= nx * inward;
          slideZ -= nz * inward;
        }
        x = hitX + nx * 0.012 + slideX;
        z = hitZ + nz * 0.012 + slideZ;
      }

      collided = true;
      normalX = nx;
      normalZ = nz;
    }
  }

  return { x, z, collided, normalX, normalZ };
}
