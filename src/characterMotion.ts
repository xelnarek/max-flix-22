import type { CharacterId } from './types.ts';

export interface CharacterMotionProfile {
  gaitFrequency: number; stride: number; armSwing: number; bodyBob: number;
  runLean: number; lateralSway: number; idleRate: number; idleBob: number;
  idleSway: number; jumpArmLift: number; jumpKneeTuck: number; jumpLean: number;
  toolSwing: number; toolRoll: number;
}

/** Five distinct gait, posture, idle and airborne poses, measured in radians. */
export const CHARACTER_MOTION_PROFILES: Readonly<Record<CharacterId, CharacterMotionProfile>> = Object.freeze({
  marcin: Object.freeze({ gaitFrequency: 11.5, stride: 0.46, armSwing: 0.28, bodyBob: 0.018, runLean: 0.025, lateralSway: 0.006, idleRate: 1.05, idleBob: 0.007, idleSway: 0.005, jumpArmLift: 0.18, jumpKneeTuck: 0.12, jumpLean: 0.015, toolSwing: 0.055, toolRoll: 0.018 }),
  grzesiek: Object.freeze({ gaitFrequency: 10.0, stride: 0.78, armSwing: 0.48, bodyBob: 0.045, runLean: 0.072, lateralSway: 0.026, idleRate: 0.78, idleBob: 0.016, idleSway: 0.014, jumpArmLift: 0.34, jumpKneeTuck: 0.38, jumpLean: 0.06, toolSwing: 0.18, toolRoll: 0.055 }),
  dawid: Object.freeze({ gaitFrequency: 16.8, stride: 0.88, armSwing: 0.56, bodyBob: 0.064, runLean: 0.012, lateralSway: 0.018, idleRate: 1.75, idleBob: 0.021, idleSway: 0.012, jumpArmLift: 0.55, jumpKneeTuck: 0.62, jumpLean: -0.025, toolSwing: 0.26, toolRoll: 0.08 }),
  mateusz: Object.freeze({ gaitFrequency: 20.2, stride: 0.48, armSwing: 0.78, bodyBob: 0.032, runLean: 0.19, lateralSway: 0.017, idleRate: 2.35, idleBob: 0.01, idleSway: 0.024, jumpArmLift: 0.37, jumpKneeTuck: 0.30, jumpLean: 0.15, toolSwing: 0.16, toolRoll: 0.09 }),
  piotr: Object.freeze({ gaitFrequency: 12.4, stride: 0.58, armSwing: 0.40, bodyBob: 0.027, runLean: 0.035, lateralSway: 0.012, idleRate: 0.72, idleBob: 0.007, idleSway: 0.009, jumpArmLift: 0.28, jumpKneeTuck: 0.22, jumpLean: 0.025, toolSwing: 0.30, toolRoll: 0.10 }),
});

export function getCharacterMotionProfile(characterId: CharacterId): CharacterMotionProfile {
  return CHARACTER_MOTION_PROFILES[characterId] ?? CHARACTER_MOTION_PROFILES.marcin;
}
