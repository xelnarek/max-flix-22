import type { CharacterId } from './types.ts';

export interface CharacterAttackMotionProfile {
  durationSeconds: number;
  rightArmX: number;
  leftArmX: number;
  rightArmZ: number;
  leftArmZ: number;
  torsoPitch: number;
  torsoTwist: number;
  headDip: number;
  toolPitch: number;
  toolRoll: number;
}

/** Five distinct attack silhouettes, tuned to the weapon held by each operator. */
export const CHARACTER_ATTACK_MOTION_PROFILES: Readonly<Record<CharacterId, CharacterAttackMotionProfile>> = {
  marcin: { durationSeconds: 0.32, rightArmX: -1.42, leftArmX: -0.34, rightArmZ: -0.23, leftArmZ: 0.10, torsoPitch: 0.055, torsoTwist: -0.075, headDip: 0.035, toolPitch: 0.18, toolRoll: 0.035 },
  grzesiek: { durationSeconds: 0.46, rightArmX: -2.05, leftArmX: -1.72, rightArmZ: -0.56, leftArmZ: 0.52, torsoPitch: 0.18, torsoTwist: 0.015, headDip: 0.12, toolPitch: 0.38, toolRoll: 0.06 },
  dawid: { durationSeconds: 0.36, rightArmX: -1.95, leftArmX: 0.42, rightArmZ: -0.68, leftArmZ: 0.24, torsoPitch: 0.025, torsoTwist: 0.18, headDip: -0.06, toolPitch: 0.43, toolRoll: 0.085 },
  mateusz: { durationSeconds: 0.20, rightArmX: -1.16, leftArmX: -0.96, rightArmZ: -0.16, leftArmZ: 0.16, torsoPitch: 0.16, torsoTwist: 0.015, headDip: -0.025, toolPitch: 0.12, toolRoll: 0.10 },
  piotr: { durationSeconds: 0.38, rightArmX: -2.18, leftArmX: 0.31, rightArmZ: -0.39, leftArmZ: 0.15, torsoPitch: 0.075, torsoTwist: -0.22, headDip: 0.09, toolPitch: 0.46, toolRoll: 0.12 },
};

export function getCharacterAttackMotionProfile(id: CharacterId): CharacterAttackMotionProfile {
  return CHARACTER_ATTACK_MOTION_PROFILES[id] ?? CHARACTER_ATTACK_MOTION_PROFILES.marcin;
}

export function getAttackPoseStrength(progress: number): number {
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (t <= 0 || t >= 1) return 0;

  // A short anticipation, decisive contact frame and damped follow-through
  // read better than a single symmetrical sine wave at the game's isometric scale.
  const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
  const smoothStep = (value: number) => value * value * (3 - 2 * value);
  if (t < 0.18) return 0.12 * easeOutCubic(t / 0.18);
  if (t < 0.52) return Math.min(1, 0.12 + 0.92 * easeOutCubic((t - 0.18) / 0.34));
  if (t < 0.70) return 1 - 0.10 * smoothStep((t - 0.52) / 0.18);
  return 0.90 * (1 - smoothStep((t - 0.70) / 0.30));
}
