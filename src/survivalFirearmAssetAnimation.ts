export type SurvivalFirearmAssetAnimationPhase =
  | 'idle'
  | 'reload-open'
  | 'reload-close'
  | 'fire-open'
  | 'fire-close';

/**
 * Resolve the rigid GLB clips used by each weapon action.
 * Magazine and folding-stock clips target separate pivots in the SMG/rifle assets,
 * so both can play together during a reload without competing for the same tracks.
 */
export function getSurvivalFirearmAssetAnimationClips(
  archetype: string,
  phase: SurvivalFirearmAssetAnimationPhase,
): readonly string[] {
  if (phase === 'idle') return [];

  if (archetype === 'shotgun') {
    return phase.endsWith('open') ? ['open'] : ['close'];
  }

  if (archetype === 'pistol') {
    switch (phase) {
      case 'reload-open': return ['magazine-open', 'slide-open'];
      case 'reload-close': return ['magazine-close', 'slide-close'];
      case 'fire-open': return ['slide-open'];
      case 'fire-close': return ['slide-close'];
      default: return [];
    }
  }

  if (archetype === 'smg' || archetype === 'rifle' || archetype === 'heavy-rifle') {
    switch (phase) {
      case 'reload-open': return ['magazine-open', 'stock-open'];
      case 'reload-close': return ['magazine-close', 'stock-close'];
      default: return [];
    }
  }

  return [];
}

export interface SurvivalFirearmAssetAnimationTiming {
  /** Clip-local time at which playback should begin for the current phase. */
  readonly timeSeconds: number;
  /** Playback multiplier that makes the remaining clip fit the remaining phase. */
  readonly timeScale: number;
}

/**
 * Synchronize a GLB clip to a normalized action phase and its real-world duration.
 * This lets authored reload/slide animations finish exactly at the game-state
 * transition instead of depending on the artist's original clip playback speed.
 */
export function getSurvivalFirearmAssetAnimationTiming(
  clipDurationSeconds: number,
  phaseProgress: number,
  phaseDurationSeconds: number,
): SurvivalFirearmAssetAnimationTiming | null {
  if (
    !Number.isFinite(clipDurationSeconds) ||
    !Number.isFinite(phaseProgress) ||
    !Number.isFinite(phaseDurationSeconds) ||
    clipDurationSeconds <= 0 ||
    phaseDurationSeconds <= 0
  ) return null;

  const progress = Math.max(0, Math.min(1, phaseProgress));
  return {
    timeSeconds: clipDurationSeconds * progress,
    timeScale: clipDurationSeconds / phaseDurationSeconds,
  };
}
