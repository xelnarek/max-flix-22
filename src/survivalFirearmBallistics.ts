/**
 * Deterministic shared ballistics used by PvE and the authoritative PvP room.
 * Heights are world-space metres; gravity is a positive downward acceleration.
 */
export function evaluateBallisticHeight(
  initialHeight: number,
  initialVerticalVelocity: number,
  gravity: number,
  elapsedSeconds: number,
): number {
  const h = Number.isFinite(initialHeight) ? initialHeight : 0;
  const v = Number.isFinite(initialVerticalVelocity) ? initialVerticalVelocity : 0;
  const g = Number.isFinite(gravity) ? Math.max(0, gravity) : 0;
  const t = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  return h + v * t - 0.5 * g * t * t;
}

export function getBallisticGroundContactTime(
  initialHeight: number,
  initialVerticalVelocity: number,
  gravity: number,
  groundHeight = 0.14,
): number | null {
  const h = Number.isFinite(initialHeight) ? initialHeight : 0;
  const v = Number.isFinite(initialVerticalVelocity) ? initialVerticalVelocity : 0;
  const g = Number.isFinite(gravity) ? Math.max(0, gravity) : 0;
  const ground = Number.isFinite(groundHeight) ? groundHeight : 0.14;
  if (h <= ground) return 0;
  if (g <= 0) return null;
  const discriminant = v * v + 2 * g * (h - ground);
  if (discriminant < 0) return null;
  const time = (v + Math.sqrt(discriminant)) / g;
  return Number.isFinite(time) && time >= 0 ? time : null;
}
