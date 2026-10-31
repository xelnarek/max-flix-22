export interface HordeRingPoint {
  x: number;
  z: number;
  angle: number;
}

export interface SurvivalHordeSettings {
  enemyCount: number;
  durationSeconds: number;
  spawnIntervalSeconds: number;
  initialRadius: number;
  finalRadius: number;
}

/** A contained, short event keeps the ring readable on mobile and desktop. */
export function getSurvivalHordeSettings(isMobile: boolean): SurvivalHordeSettings {
  return {
    enemyCount: isMobile ? 12 : 16,
    durationSeconds: 18,
    spawnIntervalSeconds: 0.48,
    initialRadius: 13.4,
    finalRadius: 6.8,
  };
}

/** Evenly distributes each horde member around a shared perimeter. */
export function getHordeRingPoint(
  index: number,
  total: number,
  centerX: number,
  centerZ: number,
  radius: number,
  startAngle = 0,
): HordeRingPoint {
  const safeTotal = Math.max(1, Math.floor(Number.isFinite(total) ? total : 1));
  const safeIndex = Number.isFinite(index) ? index : 0;
  const angle = startAngle + (safeIndex / safeTotal) * Math.PI * 2;
  const safeRadius = Math.max(0, Number.isFinite(radius) ? radius : 0);
  return {
    x: centerX + Math.cos(angle) * safeRadius,
    z: centerZ + Math.sin(angle) * safeRadius,
    angle,
  };
}

/** Smoothly closes the warning ring without a visible step between frames. */
export function getHordeRingRadius(progress: number, initialRadius: number, finalRadius: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const eased = t * t * (3 - 2 * t);
  const start = Math.max(0, Number.isFinite(initialRadius) ? initialRadius : 0);
  const end = Math.max(0, Number.isFinite(finalRadius) ? finalRadius : 0);
  return start + (end - start) * eased;
}
