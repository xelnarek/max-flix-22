export function shouldEnableSelectiveBloom(
  fps: number,
  isMobile: boolean,
  currentlyEnabled: boolean
): boolean {
  if (!Number.isFinite(fps) || fps <= 0) return false;

  const enableAt = isMobile ? 55 : 48;
  const disableBelow = isMobile ? 47 : 39;
  return currentlyEnabled ? fps >= disableBelow : fps >= enableAt;
}
