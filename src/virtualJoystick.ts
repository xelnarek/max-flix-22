export interface VirtualJoystickInput {
  x: number;
  y: number;
}

/**
 * Convert a screen-space finger drag into a normalized radial input vector.
 * A small dead zone prevents touch jitter around the resting point.
 */
export function calculateVirtualJoystickInput(
  deltaX: number,
  deltaY: number,
  maxRadius: number,
  deadZone = 0.06,
): VirtualJoystickInput {
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    !Number.isFinite(maxRadius) ||
    maxRadius <= 0
  ) {
    return { x: 0, y: 0 };
  }

  const distance = Math.hypot(deltaX, deltaY);
  const normalizedDistance = Math.min(1, distance / maxRadius);
  const radialDeadZone = Math.max(0, Math.min(0.25, deadZone));
  if (normalizedDistance <= radialDeadZone || distance === 0) {
    return { x: 0, y: 0 };
  }

  // Remap the remaining travel to the full 0..1 range so the dead zone
  // does not reduce the maximum running speed.
  const magnitude = (normalizedDistance - radialDeadZone) / (1 - radialDeadZone);
  const scale = magnitude / distance;
  return {
    x: Math.max(-1, Math.min(1, deltaX * scale)),
    y: Math.max(-1, Math.min(1, deltaY * scale)),
  };
}
