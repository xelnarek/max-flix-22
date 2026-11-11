export function shouldEnableSelectiveBloom(
  fps: number,
  isMobile: boolean,
  currentlyEnabled: boolean,
  isSurvival = false
): boolean {
  if (!Number.isFinite(fps) || fps <= 0) return false;
  // Survival's dense actor/effect load takes priority over a second full scene
  // pass on phones. Native emissive materials still render in the base pass.
  if (isMobile && isSurvival) return false;

  // Survival has a denser simulation. Enable bloom only with stronger frame
  // headroom, then use a separate lower disable point to avoid visual pulsing.
  const enableAt = isSurvival
    ? (isMobile ? 58 : 54)
    : (isMobile ? 55 : 48);
  const disableBelow = isSurvival
    ? (isMobile ? 51 : 44)
    : (isMobile ? 47 : 39);
  return currentlyEnabled ? fps >= disableBelow : fps >= enableAt;
}
