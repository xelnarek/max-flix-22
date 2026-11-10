export type MakeHumanLocomotionAction =
  | 'Idle'
  | 'Walk'
  | 'Run'
  | 'WalkBackward'
  | 'StrafeLeft'
  | 'StrafeRight'
  | 'Fall';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

/**
 * Select an authored clip from movement in the actor's local frame.
 * MakeHuman's canonical rig uses +Z forward and +X for its left strafe clip.
 */
export function chooseMakeHumanLocomotion(
  localVelocityX: number,
  localVelocityZ: number,
  airborne = false,
): MakeHumanLocomotionAction {
  if (airborne) return 'Fall';
  const speed = Math.hypot(localVelocityX, localVelocityZ);
  if (speed < 0.16) return 'Idle';

  const lateral = Math.abs(localVelocityX);
  const forward = Math.abs(localVelocityZ);
  if (lateral > Math.max(0.22, forward * 1.18)) {
    return localVelocityX > 0 ? 'StrafeLeft' : 'StrafeRight';
  }
  if (localVelocityZ < -0.18) return 'WalkBackward';
  if (localVelocityZ > 0.18 && speed >= 4.65) return 'Run';
  return 'Walk';
}

const REFERENCE_SPEED: Readonly<Record<string, number>> = Object.freeze({
  Walk: 1.3032,
  Run: 2.9141,
  WalkBackward: 0.87,
  StrafeLeft: 0.45,
  StrafeRight: 0.45,
});

/** True only for velocity-driven clips; one-shot clip timing is set by the combat/jump controller. */
export function isMakeHumanVelocityAction(action: string): boolean {
  return action === 'Walk' || action === 'Run' ||
    action === 'WalkBackward' || action === 'StrafeLeft' || action === 'StrafeRight';
}

/** Scale authored cadence to in-game movement without allowing extreme foot-cycle rates. */
export function getMakeHumanPlaybackRate(action: string, speed: number): number {
  const reference = REFERENCE_SPEED[action];
  if (!reference || !Number.isFinite(speed) || speed <= 0) return 1;
  return clamp(speed / reference, 0.72, 2.25);
}
