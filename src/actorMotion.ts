export type ActorLocomotionClip =
  | 'Walk'
  | 'Run'
  | 'WalkBackward'
  | 'StrafeLeft'
  | 'StrafeRight';

const TAU = Math.PI * 2;

const ENEMY_RIG_REFERENCE_SPEED: Readonly<Record<ActorLocomotionClip, number>> = Object.freeze({
  Walk: 2.45,
  Run: 5.25,
  WalkBackward: 1.85,
  StrafeLeft: 1.95,
  StrafeRight: 1.95,
});

/** Shortest-path angular damping, including the -PI / +PI wrap boundary. */
export function dampActorAngle(current: number, target: number, responsiveness: number, deltaSeconds: number): number {
  if (![current, target, responsiveness, deltaSeconds].every(Number.isFinite)) return Number.isFinite(current) ? current : 0;
  if (responsiveness <= 0 || deltaSeconds <= 0) return current;
  const delta = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (Math.abs(delta) < 1e-7) return target;
  return current + delta * (1 - Math.exp(-responsiveness * deltaSeconds));
}

/**
 * Distance-based mixer cadence. Nearby combat remains full-rate; distant visible
 * enemies use a bounded lower cadence while their accumulated time stays correct.
 */
export function getActorAnimationInterval(distance: number, handheld = false): number {
  if (!Number.isFinite(distance) || distance <= 9) return 0;
  if (distance <= 17) return handheld ? 1 / 30 : 1 / 45;
  return handheld ? 1 / 24 : 1 / 30;
}

/** Restrained cadence correction for imported enemy rigs; independent of AI speed. */
export function getEnemyRigPlaybackRate(action: string, speed: number): number {
  const reference = ENEMY_RIG_REFERENCE_SPEED[action as ActorLocomotionClip];
  if (!reference || !Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(1.45, Math.max(0.78, speed / reference));
}
