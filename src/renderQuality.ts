/**
 * Small, monotonic quality tiers for adaptive WebGL drawing-buffer resolution.
 * Lowering resolution is immediate; recovering quality is deliberately slower
 * so a busy horde does not make the image pulse between sharp and soft.
 */
export function getAdaptiveRenderScale(
  fps: number,
  isMobile: boolean,
  currentScale = 1,
  stableRecoveryMs = 0
): number {
  const current = Math.max(0.72, Math.min(1, Number.isFinite(currentScale) ? currentScale : 1));
  if (!Number.isFinite(fps) || fps <= 0) return current;

  const desired = fps < 34 ? 0.72 : fps < 42 ? 0.8 : fps < 50 ? 0.9 : 1;
  if (desired < current) return desired;
  if (desired <= current) return current;

  const recoveryFloor = current < 0.76
    ? (isMobile ? 37 : 36)
    : current < 0.85
      ? (isMobile ? 45 : 43)
      : (isMobile ? 57 : 54);

  if (fps < recoveryFloor || stableRecoveryMs < 6000) return current;

  // Recover one tier at a time. Each tier needs its own stable window.
  const nextTier = current < 0.76 ? 0.8 : current < 0.85 ? 0.9 : 1;
  return Math.min(desired, nextTier);
}
