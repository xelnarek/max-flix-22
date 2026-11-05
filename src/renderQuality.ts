/**
 * Small, monotonic quality tiers for adaptive WebGL drawing-buffer resolution.
 * Lowering resolution is immediate; recovering quality is deliberately slower
 * so a busy horde does not make the image pulse between sharp and soft.
 */
export function getAdaptiveRenderScale(
  fps: number,
  isMobile: boolean,
  currentScale = 1,
  stableRecoveryMs = 0,
  isSurvival = false
): number {
  const current = Math.max(0.72, Math.min(1, Number.isFinite(currentScale) ? currentScale : 1));
  if (!Number.isFinite(fps) || fps <= 0) return current;

  // Mobile Survival carries the largest simultaneous actor/effect load. Give it
  // earlier resolution relief than Campaign, while recovering only after a
  // longer stable window so the drawing buffer does not pulse during waves.
  const mobileSurvival = isMobile && isSurvival;
  const desired = mobileSurvival
    ? (fps < 40 ? 0.72 : fps < 48 ? 0.8 : fps < 56 ? 0.9 : 1)
    : (fps < 34 ? 0.72 : fps < 42 ? 0.8 : fps < 50 ? 0.9 : 1);
  if (desired < current) return desired;
  if (desired <= current) return current;

  const recoveryFloor = mobileSurvival
    ? (current < 0.76 ? 43 : current < 0.85 ? 51 : 59)
    : current < 0.76
      ? (isMobile ? 37 : 36)
      : current < 0.85
        ? (isMobile ? 45 : 43)
        : (isMobile ? 57 : 54);
  const recoveryWindow = mobileSurvival ? 8000 : 6000;
  if (fps < recoveryFloor || stableRecoveryMs < recoveryWindow) return current;

  // Recover one tier at a time. Each tier needs its own stable window.
  const nextTier = current < 0.76 ? 0.8 : current < 0.85 ? 0.9 : 1;
  return Math.min(desired, nextTier);
}


export type DeviceRenderTier = 'desktop' | 'mobile-low' | 'mobile-balanced' | 'mobile-high';

export interface DeviceRenderProfile {
  tier: DeviceRenderTier;
  pixelRatioCap: number;
  survivalPixelRatioCap: number;
  shadowsEnabled: boolean;
  softShadows: boolean;
  bloomEnabled: boolean;
}

/**
 * Conservative GPU profile for phones. Chrome's deviceMemory is deliberately
 * treated as a hint: missing values never force the low tier on their own.
 */
export function getDeviceRenderProfile(
  isMobile: boolean,
  deviceMemory?: number | null,
  hardwareConcurrency?: number | null
): DeviceRenderProfile {
  if (!isMobile) {
    return {
      tier: 'desktop',
      pixelRatioCap: 2,
      survivalPixelRatioCap: 2,
      shadowsEnabled: true,
      softShadows: true,
      bloomEnabled: true,
    };
  }

  const memoryKnown = Number.isFinite(deviceMemory) && (deviceMemory as number) > 0;
  const coresKnown = Number.isFinite(hardwareConcurrency) && (hardwareConcurrency as number) > 0;
  const lowMemory = memoryKnown && (deviceMemory as number) <= 4;
  const lowCpu = coresKnown && (hardwareConcurrency as number) <= 4;

  if (lowMemory || lowCpu) {
    return {
      tier: 'mobile-low',
      pixelRatioCap: 1.22,
      survivalPixelRatioCap: 1.08,
      shadowsEnabled: false,
      softShadows: false,
      bloomEnabled: false,
    };
  }

  const highMemory = memoryKnown && (deviceMemory as number) >= 8;
  const highCpu = coresKnown && (hardwareConcurrency as number) >= 8;
  if (highMemory && highCpu) {
    return {
      tier: 'mobile-high',
      pixelRatioCap: 1.65,
      survivalPixelRatioCap: 1.42,
      shadowsEnabled: true,
      softShadows: false,
      bloomEnabled: true,
    };
  }

  return {
    tier: 'mobile-balanced',
    pixelRatioCap: 1.42,
    survivalPixelRatioCap: 1.24,
    shadowsEnabled: true,
    softShadows: false,
    bloomEnabled: true,
  };
}
