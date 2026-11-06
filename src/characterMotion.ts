import type { CharacterId } from './types.ts';

export interface CharacterMotionProfile {
  gaitFrequency: number;
  stride: number;
  armSwing: number;
  bodyBob: number;
  runLean: number;
  lateralSway: number;
  idleRate: number;
  idleBob: number;
  idleSway: number;
  jumpArmLift: number;
  jumpKneeTuck: number;
  jumpLean: number;
  toolSwing: number;
  toolRoll: number;
  groundAcceleration: number;
  groundBraking: number;
  airControl: number;
  airBraking: number;
  riseGravityMultiplier: number;
  fallGravityMultiplier: number;
  jumpStretchY: number;
  doubleJumpStretchY: number;
  landingSquashY: number;
}

/** Five distinct movement signatures: gait, handling, jump arc and landing. */
export const CHARACTER_MOTION_PROFILES: Readonly<Record<CharacterId, CharacterMotionProfile>> = Object.freeze({
  marcin: Object.freeze({
    gaitFrequency: 11.5, stride: 0.46, armSwing: 0.28, bodyBob: 0.018, runLean: 0.025, lateralSway: 0.006,
    idleRate: 1.05, idleBob: 0.007, idleSway: 0.005, jumpArmLift: 0.18, jumpKneeTuck: 0.12, jumpLean: 0.015,
    toolSwing: 0.055, toolRoll: 0.018, groundAcceleration: 10.0, groundBraking: 13.5, airControl: 7.5,
    airBraking: 5.5, riseGravityMultiplier: 1.04, fallGravityMultiplier: 1.13,
    jumpStretchY: 1.22, doubleJumpStretchY: 1.25, landingSquashY: 0.80,
  }),
  grzesiek: Object.freeze({
    gaitFrequency: 10.0, stride: 0.78, armSwing: 0.48, bodyBob: 0.045, runLean: 0.072, lateralSway: 0.026,
    idleRate: 0.78, idleBob: 0.016, idleSway: 0.014, jumpArmLift: 0.34, jumpKneeTuck: 0.38, jumpLean: 0.06,
    toolSwing: 0.18, toolRoll: 0.055, groundAcceleration: 8.5, groundBraking: 10.5, airControl: 6.0,
    airBraking: 4.8, riseGravityMultiplier: 1.12, fallGravityMultiplier: 1.22,
    jumpStretchY: 1.14, doubleJumpStretchY: 1.18, landingSquashY: 0.72,
  }),
  dawid: Object.freeze({
    gaitFrequency: 16.8, stride: 0.88, armSwing: 0.56, bodyBob: 0.064, runLean: 0.012, lateralSway: 0.018,
    idleRate: 1.75, idleBob: 0.021, idleSway: 0.012, jumpArmLift: 0.55, jumpKneeTuck: 0.62, jumpLean: -0.025,
    toolSwing: 0.26, toolRoll: 0.08, groundAcceleration: 15.5, groundBraking: 18.0, airControl: 19.0,
    airBraking: 16.0, riseGravityMultiplier: 0.82, fallGravityMultiplier: 0.90,
    jumpStretchY: 1.34, doubleJumpStretchY: 1.40, landingSquashY: 0.94,
  }),
  mateusz: Object.freeze({
    gaitFrequency: 20.2, stride: 0.48, armSwing: 0.78, bodyBob: 0.032, runLean: 0.19, lateralSway: 0.017,
    idleRate: 2.35, idleBob: 0.01, idleSway: 0.024, jumpArmLift: 0.37, jumpKneeTuck: 0.30, jumpLean: 0.15,
    toolSwing: 0.16, toolRoll: 0.09, groundAcceleration: 21.0, groundBraking: 22.0, airControl: 14.0,
    airBraking: 12.0, riseGravityMultiplier: 0.94, fallGravityMultiplier: 1.02,
    jumpStretchY: 1.24, doubleJumpStretchY: 1.28, landingSquashY: 0.90,
  }),
  piotr: Object.freeze({
    gaitFrequency: 12.4, stride: 0.58, armSwing: 0.40, bodyBob: 0.027, runLean: 0.035, lateralSway: 0.012,
    idleRate: 0.72, idleBob: 0.007, idleSway: 0.009, jumpArmLift: 0.28, jumpKneeTuck: 0.22, jumpLean: 0.025,
    toolSwing: 0.30, toolRoll: 0.10, groundAcceleration: 13.0, groundBraking: 15.0, airControl: 12.5,
    airBraking: 10.5, riseGravityMultiplier: 0.98, fallGravityMultiplier: 1.06,
    jumpStretchY: 1.25, doubleJumpStretchY: 1.34, landingSquashY: 0.82,
  }),
});

export function getCharacterMotionProfile(characterId: CharacterId): CharacterMotionProfile {
  return CHARACTER_MOTION_PROFILES[characterId] ?? CHARACTER_MOTION_PROFILES.marcin;
}
