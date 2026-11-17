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
  anticipationFraction:number;
  impactFraction:number;
  recoveryStartFraction:number;
  anticipationStrength:number;
  recoveryStrength:number;
}

/** Five distinct attack silhouettes, tuned to the weapon held by each operator. */
export const CHARACTER_ATTACK_MOTION_PROFILES: Readonly<Record<CharacterId, CharacterAttackMotionProfile>> = {
  marcin: { durationSeconds: 0.32, rightArmX: -1.42, leftArmX: -0.34, rightArmZ: -0.23, leftArmZ: 0.10, torsoPitch: 0.055, torsoTwist: -0.075, headDip: 0.035, toolPitch: 0.18, toolRoll: 0.035, anticipationFraction: 0.22, impactFraction: 0.52, recoveryStartFraction: 0.74, anticipationStrength: 0.10, recoveryStrength: 0.84 },
  grzesiek: { durationSeconds: 0.46, rightArmX: -2.05, leftArmX: -1.72, rightArmZ: -0.56, leftArmZ: 0.52, torsoPitch: 0.18, torsoTwist: 0.015, headDip: 0.12, toolPitch: 0.38, toolRoll: 0.06, anticipationFraction: 0.24, impactFraction: 0.48, recoveryStartFraction: 0.78, anticipationStrength: 0.18, recoveryStrength: 0.98 },
  dawid: { durationSeconds: 0.36, rightArmX: -1.95, leftArmX: 0.42, rightArmZ: -0.68, leftArmZ: 0.24, torsoPitch: 0.025, torsoTwist: 0.18, headDip: -0.06, toolPitch: 0.43, toolRoll: 0.085, anticipationFraction: 0.12, impactFraction: 0.34, recoveryStartFraction: 0.62, anticipationStrength: 0.08, recoveryStrength: 0.78 },
  mateusz: { durationSeconds: 0.20, rightArmX: -1.16, leftArmX: -0.96, rightArmZ: -0.16, leftArmZ: 0.16, torsoPitch: 0.16, torsoTwist: 0.015, headDip: -0.025, toolPitch: 0.12, toolRoll: 0.10, anticipationFraction: 0.08, impactFraction: 0.27, recoveryStartFraction: 0.50, anticipationStrength: 0.06, recoveryStrength: 0.70 },
  piotr: { durationSeconds: 0.38, rightArmX: -2.18, leftArmX: 0.31, rightArmZ: -0.39, leftArmZ: 0.15, torsoPitch: 0.075, torsoTwist: -0.22, headDip: 0.09, toolPitch: 0.46, toolRoll: 0.12, anticipationFraction: 0.19, impactFraction: 0.55, recoveryStartFraction: 0.82, anticipationStrength: 0.16, recoveryStrength: 0.96 },
};

export function getCharacterAttackMotionProfile(id: CharacterId): CharacterAttackMotionProfile {
  return CHARACTER_ATTACK_MOTION_PROFILES[id] ?? CHARACTER_ATTACK_MOTION_PROFILES.marcin;
}

export function getAttackPoseStrength(progress:number,profile?:Pick<CharacterAttackMotionProfile,'anticipationFraction'|'impactFraction'|'recoveryStartFraction'|'anticipationStrength'|'recoveryStrength'>):number{
 const t=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;if(t<=0||t>=1)return 0;
 const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v)),ease=(v:number)=>1-Math.pow(1-v,3),smooth=(v:number)=>v*v*(3-2*v);
 const anticipation=clamp(profile?.anticipationFraction??0.18,0.05,0.42),impact=clamp(profile?.impactFraction??0.52,anticipation+0.06,0.90),recoveryStart=clamp(profile?.recoveryStartFraction??0.70,impact+0.04,0.98),anticipationStrength=clamp(profile?.anticipationStrength??0.12,0,0.5),recoveryStrength=clamp(profile?.recoveryStrength??0.90,0.5,1.1);
 if(t<anticipation)return anticipationStrength*ease(t/anticipation);
 if(t<impact){const w=(t-anticipation)/(impact-anticipation);return anticipationStrength+(1-anticipationStrength)*ease(w);}
 if(t<recoveryStart){const h=(t-impact)/(recoveryStart-impact);return 1-0.10*smooth(h);}
 const r=(t-recoveryStart)/(1-recoveryStart);return recoveryStrength*(1-smooth(r));
}
