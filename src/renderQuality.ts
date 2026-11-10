/**
 * Avoid rebuilding the WebGL drawing buffer for insignificant float noise,
 * but allow every intentional 0.1 quality tier to take effect. The previous
 * 0.12 threshold silently skipped the 0.9 tier on common mobile DPR caps.
 */
export function shouldApplyPixelRatioChange(
  currentPixelRatio: number,
  targetPixelRatio: number,
  minDifference = 0.035
): boolean {
  if (!Number.isFinite(currentPixelRatio) || !Number.isFinite(targetPixelRatio)) return false;
  const threshold = Number.isFinite(minDifference) ? Math.max(0, minDifference) : 0.035;
  return Math.abs(currentPixelRatio - targetPixelRatio) >= threshold;
}

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

export type AdaptiveEffectsTier = 0 | 1 | 2;

/**
 * CPU-side mobile fallback tiers.
 * Tier 1 trims crowd/particle pressure; tier 2 is a stronger rescue profile.
 * Performance drops take effect immediately, while recovery requires a stable
 * window and happens one tier at a time to avoid visual and spawn-rate pulsing.
 */
export function getAdaptiveEffectsTier(
  fps: number,
  isMobile: boolean,
  currentTier: AdaptiveEffectsTier = 0,
  stableRecoveryMs = 0,
): AdaptiveEffectsTier {
  const current: AdaptiveEffectsTier = currentTier === 2 ? 2 : currentTier === 1 ? 1 : 0;
  if (!isMobile) return 0;
  if (!Number.isFinite(fps) || fps <= 0) return current;

  if (fps < 32) return 2;
  if (fps < 43) return current === 2 ? 2 : 1;

  if (current === 2) {
    if (fps < 47 || stableRecoveryMs < 10000) return 2;
    return 1;
  }
  if (current === 1) {
    if (fps < 54 || stableRecoveryMs < 8000) return 1;
    return 0;
  }
  return 0;
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

/** Hardware hints choose safe defaults; measured FPS remains the final authority. */
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
      pixelRatioCap: 1.08,
      survivalPixelRatioCap: 0.94,
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
      // Higher-density 1.5K/AMOLED phones retain more native detail; measured FPS
      // still steps down when a large Survival wave saturates the GPU.
      pixelRatioCap: 1.78,
      survivalPixelRatioCap: 1.44,
      shadowsEnabled: false,
      softShadows: false,
      // Reserve selective bloom for phones with strong CPU/GPU headroom.
      bloomEnabled: true,
    };
  }

  return {
    tier: 'mobile-balanced',
    pixelRatioCap: 1.36,
    survivalPixelRatioCap: 1.16,
    shadowsEnabled: false,
    softShadows: false,
    bloomEnabled: false,
  };
}
