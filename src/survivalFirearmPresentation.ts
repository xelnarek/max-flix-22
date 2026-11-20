export type SurvivalFirearmPresentationArchetype =
  | 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle'
  | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade';

export type SurvivalFirearmProjectileStyle =
  | 'pistol-slug' | 'compact-tracer' | 'rifle-tracer' | 'buckshot'
  | 'heavy-slug' | 'rotary-tracer' | 'rocket' | 'flame' | 'plasma' | 'gauss-lance' | 'grenade-ballistic';

export interface SurvivalFirearmPresentationProfile {
  readonly projectileStyle: SurvivalFirearmProjectileStyle;
  readonly projectileLength: number;
  readonly projectileWidth: number;
  readonly trailIntervalSeconds: number;
  readonly trailParticleSize: number;
  readonly muzzleParticles: number;
  readonly muzzleSpread: number;
  readonly impactParticles: number;
  readonly recoilDepth: number;
  readonly recoilPitch: number;
  readonly recoilSettleSeconds: number;
  readonly magazineDrop: number;
  readonly boltTravel: number;
  readonly pumpTravel: number;
  readonly rocketCellTravel: number;
  readonly tankValveTurn: number;
  readonly energyCellDrop: number;
  readonly rotorBrake: boolean;
}

export const SURVIVAL_FIREARM_PRESENTATION: Readonly<Record<
  SurvivalFirearmPresentationArchetype,
  SurvivalFirearmPresentationProfile
>> = Object.freeze({
  pistol: {
    projectileStyle: 'pistol-slug', projectileLength: 0.27, projectileWidth: 0.045,
    trailIntervalSeconds: 0.22, trailParticleSize: 0.02, muzzleParticles: 4, muzzleSpread: 0.2, impactParticles: 6,
    recoilDepth: 0.1, recoilPitch: 0.2, recoilSettleSeconds: 0.21,
    magazineDrop: 0.34, boltTravel: -0.11, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  smg: {
    projectileStyle: 'compact-tracer', projectileLength: 0.14, projectileWidth: 0.022,
    trailIntervalSeconds: 0.14, trailParticleSize: 0.012, muzzleParticles: 3, muzzleSpread: 0.36, impactParticles: 4,
    recoilDepth: 0.06, recoilPitch: 0.14, recoilSettleSeconds: 0.17,
    magazineDrop: 0.40, boltTravel: -0.085, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  rifle: {
    projectileStyle: 'rifle-tracer', projectileLength: 0.33, projectileWidth: 0.034,
    trailIntervalSeconds: 0.18, trailParticleSize: 0.018, muzzleParticles: 5, muzzleSpread: 0.18, impactParticles: 7,
    recoilDepth: 0.085, recoilPitch: 0.18, recoilSettleSeconds: 0.21,
    magazineDrop: 0.44, boltTravel: -0.12, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  shotgun: {
    projectileStyle: 'buckshot', projectileLength: 0.095, projectileWidth: 0.078,
    trailIntervalSeconds: 0.25, trailParticleSize: 0.03, muzzleParticles: 10, muzzleSpread: 0.62, impactParticles: 14,
    recoilDepth: 0.2, recoilPitch: 0.4, recoilSettleSeconds: 0.34,
    magazineDrop: 0, boltTravel: 0, pumpTravel: -0.26, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  'heavy-rifle': {
    projectileStyle: 'heavy-slug', projectileLength: 0.58, projectileWidth: 0.065,
    trailIntervalSeconds: 0.23, trailParticleSize: 0.026, muzzleParticles: 7, muzzleSpread: 0.1, impactParticles: 11,
    recoilDepth: 0.23, recoilPitch: 0.42, recoilSettleSeconds: 0.33,
    magazineDrop: 0.48, boltTravel: -0.17, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  minigun: {
    projectileStyle: 'rotary-tracer', projectileLength: 0.105, projectileWidth: 0.019,
    trailIntervalSeconds: 0.12, trailParticleSize: 0.011, muzzleParticles: 3, muzzleSpread: 0.43, impactParticles: 5,
    recoilDepth: 0.055, recoilPitch: 0.12, recoilSettleSeconds: 0.16,
    magazineDrop: 0.24, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: true,
  },
  rocket: {
    projectileStyle: 'rocket', projectileLength: 0.62, projectileWidth: 0.18,
    trailIntervalSeconds: 0.075, trailParticleSize: 0.078, muzzleParticles: 12, muzzleSpread: 0.28, impactParticles: 26,
    recoilDepth: 0.26, recoilPitch: 0.45, recoilSettleSeconds: 0.36,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0.34, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  flame: {
    projectileStyle: 'flame', projectileLength: 0.32, projectileWidth: 0.13,
    trailIntervalSeconds: 0.065, trailParticleSize: 0.052, muzzleParticles: 9, muzzleSpread: 0.7, impactParticles: 12,
    recoilDepth: 0.07, recoilPitch: 0.15, recoilSettleSeconds: 0.19,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0.82, energyCellDrop: 0, rotorBrake: false,
  },
  plasma: {
    projectileStyle: 'plasma', projectileLength: 0.28, projectileWidth: 0.17,
    trailIntervalSeconds: 0.08, trailParticleSize: 0.06, muzzleParticles: 8, muzzleSpread: 0.24, impactParticles: 17,
    recoilDepth: 0.13, recoilPitch: 0.24, recoilSettleSeconds: 0.25,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0.28, rotorBrake: false,
  },
  grenade: {
    projectileStyle: 'grenade-ballistic', projectileLength: 0.42, projectileWidth: 0.15,
    trailIntervalSeconds: 0.085, trailParticleSize: 0.047, muzzleParticles: 8, muzzleSpread: 0.2, impactParticles: 28,
    recoilDepth: 0.25, recoilPitch: 0.43, recoilSettleSeconds: 0.34,
    magazineDrop: 0, boltTravel: -0.13, pumpTravel: 0, rocketCellTravel: 0.26, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  gauss: {
    projectileStyle: 'gauss-lance', projectileLength: 1, projectileWidth: 0.05,
    trailIntervalSeconds: 0.06, trailParticleSize: 0.042, muzzleParticles: 12, muzzleSpread: 0.07, impactParticles: 18,
    recoilDepth: 0.24, recoilPitch: 0.43, recoilSettleSeconds: 0.34,
    magazineDrop: 0, boltTravel: -0.18, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0.36, rotorBrake: false,
  },
});

export interface SurvivalFirearmReloadPose {
  readonly magazineOffsetY: number;
  readonly magazineVisible: boolean;
  readonly boltOffsetZ: number;
  readonly pumpOffsetZ: number;
  readonly rocketCellOffsetZ: number;
  readonly tankValveRotation: number;
  readonly energyCellOffsetY: number;
  readonly coilPulse: number;
  readonly rotorBrake: boolean;
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const smoothstep = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const cleanOffset = (value: number): number => Math.abs(value) < 1e-9 ? 0 : value;

export function getSurvivalFirearmReloadPose(
  archetype: SurvivalFirearmPresentationArchetype,
  progress: number,
): SurvivalFirearmReloadPose {
  const profile = SURVIVAL_FIREARM_PRESENTATION[archetype];
  const p = clamp01(progress);
  const eject = smoothstep(p / 0.25);
  const insert = smoothstep((p - 0.57) / 0.31);
  const magazineMotion = p < 0.57 ? eject : 1 - insert;
  const boltPhase = Math.sin(Math.PI * clamp01((p - 0.76) / 0.24));
  const pumpPhase = Math.sin(Math.PI * p);

  return {
    magazineOffsetY: cleanOffset(-profile.magazineDrop * magazineMotion),
    magazineVisible: profile.magazineDrop <= 0 || p < 0.28 || p > 0.58,
    boltOffsetZ: cleanOffset(profile.boltTravel * boltPhase),
    pumpOffsetZ: cleanOffset(profile.pumpTravel * pumpPhase),
    rocketCellOffsetZ: cleanOffset(profile.rocketCellTravel * magazineMotion),
    tankValveRotation: cleanOffset(profile.tankValveTurn * Math.sin(Math.PI * p)),
    energyCellOffsetY: cleanOffset(-profile.energyCellDrop * magazineMotion),
    coilPulse: Math.sin(Math.PI * p),
    rotorBrake: profile.rotorBrake && p > 0.1 && p < 0.9,
  };
}
