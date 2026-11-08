/**
 * Decide whether the live game should pause or resume when page visibility changes.
 * Only a pause initiated by the visibility handler may be automatically undone.
 */
export type VisibilityPauseAction = 'pause' | 'resume' | 'none';

export function getVisibilityPauseAction(
  documentHidden: boolean,
  gameState: string,
  pausedByVisibility: boolean,
): VisibilityPauseAction {
  if (documentHidden && gameState === 'playing') return 'pause';
  if (!documentHidden && pausedByVisibility && gameState === 'paused') return 'resume';
  return 'none';
}
