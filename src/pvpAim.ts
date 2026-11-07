export interface PvpAimDirection {
  x: number;
  z: number;
}

export const PVP_AIM_DEADZONE = 0.16;
/** Direction can be adjusted gently before the player crosses the fire threshold. */
export const PVP_AIM_DIRECTION_DEADZONE = 0.06;
/** Separate press/release thresholds prevent firing from flickering around the stick centre. */
export const PVP_AIM_FIRE_START_DEADZONE = 0.16;
export const PVP_AIM_FIRE_STOP_DEADZONE = 0.09;
export const DEFAULT_PVP_AIM_DIRECTION: Readonly<PvpAimDirection> = Object.freeze({ x: 0, z: 1 });

function finite(value: number): boolean { return Number.isFinite(value); }

function safePreviousDirection(previous: PvpAimDirection): PvpAimDirection {
  if (!finite(previous.x) || !finite(previous.z)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  const length = Math.hypot(previous.x, previous.z);
  if (length <= 1e-6) return { ...DEFAULT_PVP_AIM_DIRECTION };
  return { x: previous.x / length, z: previous.z / length };
}

export function isPvpAimInputActive(x: number, z: number, deadzone = PVP_AIM_DEADZONE): boolean {
  return finite(x) && finite(z) && finite(deadzone) && Math.hypot(x, z) >= Math.max(0, deadzone);
}

/** Hysteresis keeps the right-stick trigger stable while the thumb jitters near centre. */
export function shouldPvpAimFire(x: number, z: number, currentlyFiring: boolean): boolean {
  const threshold = currentlyFiring ? PVP_AIM_FIRE_STOP_DEADZONE : PVP_AIM_FIRE_START_DEADZONE;
  return isPvpAimInputActive(x, z, threshold);
}

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

export function getPvpAimAngle(direction: PvpAimDirection): number {
  const safe = safePreviousDirection(direction);
  return Math.atan2(safe.x, safe.z);
}

export function pvpAimDirectionFromAngle(angle: number): PvpAimDirection {
  if (!finite(angle)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  return { x: Math.sin(angle), z: Math.cos(angle) };
}
