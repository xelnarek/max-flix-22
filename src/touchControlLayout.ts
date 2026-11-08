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
 * on the left. Action buttons are stacked at the far right. PvP's timed fire
 * button stays above the left stick and cannot enter the right action dock.
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
  const joystickZone = makeRect(safeLeft, joystickZoneTop, Math.max(0, joystickZoneWidth - safeLeft), joystickZoneHeight);
  const joystickMaxVisualRight = joystickZoneWidth + joystickSize * 0.5;

  // Survival uses ability, jump and dash. PvP uses ability and dash; its
  // dedicated timed shot is measured independently below.
  const actionCount = input.mode === 'pvp' ? 2 : 3;
  const actionHeight = actionCount * actionButtonSize + (actionCount - 1) * actionGap;
  const actionBottom = Math.max(0, height - safeBottom - 18);
  const actionDock = makeRect(
    Math.max(0, width - safeRight - actionButtonSize),
    Math.max(0, actionBottom - actionHeight),
    Math.min(actionButtonSize, width),
    Math.min(actionHeight, height),
  );

  const fireButtonSize = clamp(
    finiteOr(input.fireButtonSize, height <= 430 ? 68 : 78),
    60,
    88,
  );
  const fireControl = input.mode === 'pvp'
    ? makeRect(
        0,
        Math.max(0, joystickZoneTop - fireButtonSize - 10),
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
