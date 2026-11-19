export type UiDensity = 'compact' | 'standard' | 'wide';

export interface UiViewportProfile {
  scale: number;
  fontScale: number;
  panelMaxWidth: number;
  density: UiDensity;
  landscapeTouch: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

/**
 * Produces one application-wide scale profile from the usable viewport.
 * The profile is applied to the menu, overlays, HUD and touch controls, not
 * only to the renderer or the title screen.
 */
export function calculateUiViewport(
  rawWidth: number,
  rawHeight: number,
  isTouch: boolean,
): UiViewportProfile {
  const width = Math.max(1, Math.round(Number.isFinite(rawWidth) ? rawWidth : 1));
  const height = Math.max(1, Math.round(Number.isFinite(rawHeight) ? rawHeight : 1));
  const landscapeTouch = isTouch && width > height;
  const referenceWidth = isTouch ? (landscapeTouch ? 820 : 390) : 1366;
  const referenceHeight = isTouch ? (landscapeTouch ? 390 : 820) : 768;
  const widthFit = width / referenceWidth;
  const heightFit = height / referenceHeight;
  const fit = Math.min(widthFit, heightFit);
  // Keep a small but usable minimum instead of allowing short windows to
  // collapse the interface. The same factor is used for type and geometry so
  // hit targets, text and panels remain proportionate across every screen.
  const scale = clamp(fit, 0.88, isTouch ? 1.10 : 1.12);
  const fontScale = scale;
  // Never force a 320px minimum on narrow phones: that creates horizontal overflow.
  const panelMaxWidth = Math.round(Math.max(1, Math.min(width - (isTouch ? 16 : 40), 1240)));

  const density: UiDensity =
    width < 380 || height < 640 || (landscapeTouch && height < 430)
      ? 'compact'
      : width >= 1440 && !isTouch
        ? 'wide'
        : 'standard';

  return { scale, fontScale, panelMaxWidth, density, landscapeTouch };
}

/**
 * Avoid showing touch-only controls in a narrow desktop window when a mouse
 * is the active pointer. Touch hardware and coarse-pointer devices still get
 * the controls at every viewport width.
 */
export function shouldShowTouchControls(
  visible: boolean,
  viewportWidth: number,
  touchCapable: boolean,
  finePointer: boolean,
): boolean {
  if (!visible) return false;
  const width = Math.max(1, Number.isFinite(viewportWidth) ? viewportWidth : 1);
  return touchCapable || (width <= 900 && !finePointer);
}
