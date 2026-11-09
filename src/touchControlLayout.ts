export type TouchControlMode = 'survival' | 'pvp';

export interface TouchControlRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TouchControlGeometry {
  joystickZone: TouchControlRect;
  joystickMaxVisualRight: number;
  actionDock: TouchControlRect;
  fireControl?: TouchControlRect;
  horizontalGapToActions: number;
  fireGapToActions: number | null;
}

const finiteOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const makeRect = (left: number, top: number, width: number, height: number): TouchControlRect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

/**
 * Describes the final two-thumb layout used by the mobile HUD.
 *
 * The movement hit-zone and its largest possible stick footprint are reserved
 * on the left. Action buttons form a vertical dock in portrait and a short
 * horizontal dock in compact landscape. PvP fire stays above the left stick.
 */
export function calculateTouchControlGeometry(input: {
  viewportWidth: number;
  viewportHeight: number;
  mode: TouchControlMode;
  safeLeft?: number;
  safeRight?: number;
  safeBottom?: number;
  actionButtonSize?: number;
  actionGap?: number;
  joystickSize?: number;
  fireButtonSize?: number;
}): TouchControlGeometry {
  const width = Math.max(1, finiteOr(input.viewportWidth, 1));
  const height = Math.max(1, finiteOr(input.viewportHeight, 1));
  const safeLeft = Math.max(0, finiteOr(input.safeLeft, 8));
  const safeRight = Math.max(0, finiteOr(input.safeRight, 12));
  const safeBottom = Math.max(0, finiteOr(input.safeBottom, 12));
  const actionButtonSize = clamp(finiteOr(input.actionButtonSize, width * 0.15), 54, 68);
  const actionGap = clamp(finiteOr(input.actionGap, 8), 4, 12);
  const joystickSize = clamp(finiteOr(input.joystickSize, width * 0.36), 126, 148);
  const joystickZoneWidth = Math.min(
    width * (input.mode === 'pvp' ? 0.46 : 0.48),
    input.mode === 'pvp' ? 300 : 320,
  );
  const joystickZoneHeight = Math.min(height * 0.54, 440);
  const joystickZoneTop = Math.max(0, height - safeBottom - joystickZoneHeight);
  const joystickZone = makeRect(safeLeft, joystickZoneTop, joystickZoneWidth, joystickZoneHeight);
  const joystickMaxVisualRight = safeLeft + joystickZoneWidth + joystickSize * 0.5;

  // Survival uses ability, jump and dash. PvP uses ability and dash; its
  // dedicated timed shot is measured independently below.
  const actionCount = input.mode === 'pvp' ? 2 : 3;
  const actionBottom = Math.max(0, height - safeBottom - 18);
  // Short landscape screens have very little vertical room below the HUD.
  // Lay the buttons side-by-side there; portrait keeps the compact vertical
  // thumb stack. This also creates a clean bottom band below the Survival HUD.
  const compactLandscape = height <= 430 && width >= height * 1.35;
  const actionWidth = compactLandscape
    ? actionCount * actionButtonSize + (actionCount - 1) * actionGap
    : actionButtonSize;
  const actionHeight = compactLandscape
    ? actionButtonSize
    : actionCount * actionButtonSize + (actionCount - 1) * actionGap;
  const actionDock = makeRect(
    Math.max(0, width - safeRight - actionWidth),
    Math.max(0, actionBottom - actionHeight),
    Math.min(actionWidth, width),
    Math.min(actionHeight, height),
  );

  const fireButtonSize = clamp(
    finiteOr(input.fireButtonSize, height <= 430 ? 68 : 78),
    60,
    88,
  );
  const idleFireTop = compactLandscape
    ? Math.max(0, height - Math.max(170, safeBottom + 160) - fireButtonSize)
    : Math.max(0, joystickZoneTop - fireButtonSize - 10);
  const fireControl = input.mode === 'pvp'
    ? makeRect(
        0,
        idleFireTop,
        Math.min(fireButtonSize, width),
        Math.min(fireButtonSize, height),
      )
    : undefined;
  const fireRight = input.mode === 'pvp' ? joystickZoneWidth + fireButtonSize * 0.5 : null;

  return {
    joystickZone,
    joystickMaxVisualRight,
    actionDock,
    ...(fireControl ? { fireControl } : {}),
    horizontalGapToActions: actionDock.left - joystickMaxVisualRight,
    fireGapToActions: fireRight === null ? null : actionDock.left - fireRight,
  };
}

/** Keep the live stick footprint inside its left-side touch lane. In PvP the
 * extra vertical clearance reserves the full fire-button circle below the HUD. */
export function clampTouchJoystickOrigin(input: {
  viewportWidth: number;
  viewportHeight: number;
  mode: TouchControlMode;
  touchX: number;
  touchY: number;
  safeLeft?: number;
  safeBottom?: number;
  joystickSize?: number;
  fireButtonSize?: number;
  fireGap?: number;
  topHudClearance?: number;
  reserveFireButton?: boolean;
}): { x: number; y: number } {
  const geometry = calculateTouchControlGeometry(input);
  const width = Math.max(1, finiteOr(input.viewportWidth, 1));
  const height = Math.max(1, finiteOr(input.viewportHeight, 1));
  const safeLeft = Math.max(0, finiteOr(input.safeLeft, 0));
  const safeBottom = Math.max(0, finiteOr(input.safeBottom, 12));
  const joystickSize = clamp(finiteOr(input.joystickSize, width * 0.36), 126, 148);
  const radius = joystickSize * 0.5;
  const fireButtonSize = clamp(finiteOr(input.fireButtonSize, height <= 430 ? 68 : 78), 60, 88);
  const fireGap = Math.max(0, finiteOr(input.fireGap, 10));
  const topHudClearance = Math.max(0, finiteOr(input.topHudClearance, 84));
  const reserveFireButton = input.reserveFireButton ?? input.mode === 'pvp';
  const minimumCenterY = reserveFireButton
    ? Math.max(
        geometry.joystickZone.top + radius,
        topHudClearance + fireButtonSize + fireGap + radius,
      )
    : geometry.joystickZone.top + radius;
  const maximumCenterY = Math.max(
    minimumCenterY,
    height - safeBottom - radius - 18,
  );

  const maxCenterX = Math.max(
    geometry.joystickZone.left,
    Math.min(
      geometry.joystickZone.right,
      geometry.actionDock.left - radius - 8,
    ),
  );

  return {
    x: clamp(
      finiteOr(input.touchX, geometry.joystickZone.left),
      geometry.joystickZone.left,
      maxCenterX,
    ),
    y: clamp(
      finiteOr(input.touchY, minimumCenterY),
      minimumCenterY,
      maximumCenterY,
    ),
  };
}
