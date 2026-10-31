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
 * Produces a stable UI density profile from the usable viewport.
 * It deliberately treats touch-landscape phones differently from desktop.
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
  const scale = clamp(fit, isTouch ? 0.82 : 0.84, isTouch ? 1.10 : 1.12);
  const fontScale = clamp(Math.sqrt(scale), 0.90, 1.08);
  const panelMaxWidth = Math.round(clamp(width - (isTouch ? 16 : 40), 320, 1240));

  const density: UiDensity =
    width < 380 || height < 640 || (landscapeTouch && height < 430)
      ? 'compact'
      : width >= 1440 && !isTouch
        ? 'wide'
        : 'standard';

  return { scale, fontScale, panelMaxWidth, density, landscapeTouch };
}
