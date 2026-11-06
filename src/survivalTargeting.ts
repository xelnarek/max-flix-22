export interface SurvivalTargetCandidate {
  id: string;
  type: string;
  x: number;
  z: number;
  state: string;
  maxHp?: number;
  alerted?: boolean;
  chargeTimer?: number;
  mesh?: { visible?: boolean } | null;
}

export interface SurvivalTargetSelection<T extends SurvivalTargetCandidate> {
  target: T;
  distance: number;
  score: number;
}

const MAJOR_BOSS_TYPES = new Set(['walczak', 'krol_leto', 'bosman_krakow', 'sebix_m']);
const ELITE_TYPES = new Set(['elite_walczak_guard', 'sztaplar_szalony', 'pan_roman', 'agv_robot', 'piorun_dron']);

function finite(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Choose an auto-fire target by tactical value, not just distance.
 * Bosses, charging threats and enemies already pressuring the operator get a
 * bounded preference; a distant boss never outranks a nearby immediate threat.
 */
export function selectSurvivalAutoTarget<T extends SurvivalTargetCandidate>(
  enemies: readonly T[],
  playerX: number,
  playerZ: number,
  maxRange: number
): SurvivalTargetSelection<T> | null {
  if (!finite(playerX) || !finite(playerZ) || !finite(maxRange) || maxRange <= 0) return null;

  let best: SurvivalTargetSelection<T> | null = null;
  for (const enemy of enemies) {
    if (
      enemy.state === 'defeated' ||
      enemy.mesh?.visible === false ||
      !finite(enemy.x) ||
      !finite(enemy.z)
    ) continue;

    const dx = enemy.x - playerX;
    const dz = enemy.z - playerZ;
    const distance = Math.hypot(dx, dz);
    if (!finite(distance) || distance > maxRange) continue;

    const playerThreatDistance = distance;
    const isBoss = MAJOR_BOSS_TYPES.has(enemy.type);
    const isElite = ELITE_TYPES.has(enemy.type) || (finite(enemy.maxHp ?? 0) && (enemy.maxHp ?? 0) >= 12);
    const isCharging = finite(enemy.chargeTimer ?? 0) && (enemy.chargeTimer ?? 0) > 0;
    const priority = (isBoss ? 4.2 : 0) +
      (isElite ? 2.1 : 0) +
      (isCharging ? 1.7 : 0) +
      (playerThreatDistance <= 5.5 ? 1.1 : 0) +
      (enemy.alerted ? 0.25 : 0);
    const score = distance - priority;

    if (
      best === null ||
      score < best.score ||
      (score === best.score && distance < best.distance)
    ) {
      best = { target: enemy, distance, score };
    }
  }
  return best;
}
