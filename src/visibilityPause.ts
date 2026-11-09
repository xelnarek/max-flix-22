/**
 * Decide whether a live run must be paused when the page becomes hidden.
 * A visibility pause is intentionally sticky: returning to the app does not
 * resume combat until the player explicitly presses the Resume button.
 */
export type VisibilityPauseAction = 'pause' | 'none';

export function getVisibilityPauseAction(
  documentHidden: boolean,
  gameState: string,
): VisibilityPauseAction {
  if (documentHidden && gameState === 'playing') return 'pause';
  return 'none';
}
