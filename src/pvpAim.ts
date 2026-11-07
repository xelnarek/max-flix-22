export interface PvpAimDirection {
  x: number;
  z: number;
}

/** Values shorter than this are treated as a released/neutral stick. */
export const PVP_AIM_DEADZONE = 0.16;
export const DEFAULT_PVP_AIM_DIRECTION: Readonly<PvpAimDirection> = Object.freeze({ x: 0, z: 1 });

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function safePreviousDirection(previous: PvpAimDirection): PvpAimDirection {
  if (!finite(previous.x) || !finite(previous.z)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  const length = Math.hypot(previous.x, previous.z);
  if (length <= 1e-6) return { ...DEFAULT_PVP_AIM_DIRECTION };
  return { x: previous.x / length, z: previous.z / length };
}

/** True only when the player deliberately pushes the aim stick beyond its deadzone. */
export function isPvpAimInputActive(x: number, z: number, deadzone = PVP_AIM_DEADZONE): boolean {
  if (!finite(x) || !finite(z) || !finite(deadzone)) return false;
  return Math.hypot(x, z) >= Math.max(0, deadzone);
}

/** Converts a right-stick sample to a unit world direction. Neutral or invalid samples preserve the previous direction. */
export function normalizePvpAimDirection(
  x: number,
  z: number,
  previous: PvpAimDirection = DEFAULT_PVP_AIM_DIRECTION,
  deadzone = PVP_AIM_DEADZONE,
): PvpAimDirection {
  if (!isPvpAimInputActive(x, z, deadzone)) return safePreviousDirection(previous);
  const length = Math.hypot(x, z);
  if (!finite(length) || length <= 1e-6) return safePreviousDirection(previous);
  return { x: x / length, z: z / length };
}

/** Converts the game's forward-vector convention into the Three.js yaw angle. */
export function getPvpAimAngle(direction: PvpAimDirection): number {
  const safe = safePreviousDirection(direction);
  return Math.atan2(safe.x, safe.z);
}

export function pvpAimDirectionFromAngle(angle: number): PvpAimDirection {
  if (!finite(angle)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  return { x: Math.sin(angle), z: Math.cos(angle) };
}
