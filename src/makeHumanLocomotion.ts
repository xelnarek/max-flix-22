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
  previousAction?: MakeHumanLocomotionAction,
): MakeHumanLocomotionAction {
  if (airborne) return 'Fall';
  const speed = Math.hypot(localVelocityX, localVelocityZ);
  // A small dead band prevents idle/walk and walk/run flicker at variable frame rates.
  if (speed < 0.13 || (previousAction === 'Idle' && speed < 0.20)) return 'Idle';

  const lateral = Math.abs(localVelocityX);
  const forward = Math.abs(localVelocityZ);
  const wasStrafing = previousAction === 'StrafeLeft' || previousAction === 'StrafeRight';
  const lateralThreshold = wasStrafing
    ? Math.max(0.17, forward * 1.04)
    : Math.max(0.22, forward * 1.18);
  if (lateral > lateralThreshold) {
    return localVelocityX > 0 ? 'StrafeLeft' : 'StrafeRight';
  }
  if (localVelocityZ < -0.18) return 'WalkBackward';
  const runThreshold = previousAction === 'Run' ? 4.15 : 4.65;
  if (localVelocityZ > 0.18 && speed >= runThreshold) return 'Run';
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
