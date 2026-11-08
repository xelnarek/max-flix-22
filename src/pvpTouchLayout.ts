export interface PvpFireControlPositionInput {
  viewportWidth: number;
  viewportHeight: number;
  touchX: number;
  touchY: number;
  joystickRadius: number;
  fireControlSize?: number;
  gap?: number;
  safeMargin?: number;
}

export interface PvpFireControlPosition {
  /** Horizontal centre used by the fixed fire-control wrapper. */
  left: number;
  /** CSS bottom offset for the fixed fire-control wrapper. */
  bottom: number;
  /** Top edge, exposed to make viewport-boundary behaviour easy to verify. */
  top: number;
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Anchors the PvP fire control above the floating movement stick without
 * allowing it to be clipped by narrow, short, or fullscreen mobile viewports.
 * The joystick's movement origin remains the actual pointer-down coordinate;
 * only the independent fire button is clamped.
 */
export function calculatePvpFireControlPosition(
  input: PvpFireControlPositionInput,
): PvpFireControlPosition {
  const width = Math.max(1, finiteOr(input.viewportWidth, 1));
  const height = Math.max(1, finiteOr(input.viewportHeight, 1));
  const touchX = finiteOr(input.touchX, width * 0.5);
  const touchY = finiteOr(input.touchY, height * 0.75);
  const radius = Math.max(0, finiteOr(input.joystickRadius, 74));
  const size = Math.max(1, finiteOr(input.fireControlSize ?? 78, 78));
  const gap = Math.max(0, finiteOr(input.gap ?? 10, 10));
  const margin = Math.max(0, finiteOr(input.safeMargin ?? 12, 12));

  // When the viewport is narrower than the control plus both margins,
  // keep the button centred rather than producing an inverted clamp range.
  const minLeft = Math.min(width * 0.5, margin + size * 0.5);
  const maxLeft = Math.max(minLeft, width - margin - size * 0.5);
  const left = clamp(touchX, minLeft, maxLeft);

  const minTop = Math.min(height * 0.5, margin);
  const maxTop = Math.max(minTop, height - margin - size);
  const requestedTop = touchY - radius - gap - size;
  const top = clamp(requestedTop, minTop, maxTop);

  return {
    left,
    top,
    bottom: Math.max(0, height - top - size),
  };
}
