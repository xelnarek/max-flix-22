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
