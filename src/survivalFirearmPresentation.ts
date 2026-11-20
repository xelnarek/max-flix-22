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
    projectileStyle: 'pistol-slug', projectileLength: 0.22, projectileWidth: 0.035,
    trailIntervalSeconds: 0.20, trailParticleSize: 0.018, muzzleParticles: 3, muzzleSpread: 0.22, impactParticles: 4,
    recoilDepth: 0.085, recoilPitch: 0.18, recoilSettleSeconds: 0.18,
    magazineDrop: 0.34, boltTravel: -0.11, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  smg: {
    projectileStyle: 'compact-tracer', projectileLength: 0.15, projectileWidth: 0.026,
    trailIntervalSeconds: 0.18, trailParticleSize: 0.014, muzzleParticles: 2, muzzleSpread: 0.30, impactParticles: 3,
    recoilDepth: 0.052, recoilPitch: 0.12, recoilSettleSeconds: 0.14,
    magazineDrop: 0.40, boltTravel: -0.085, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  rifle: {
    projectileStyle: 'rifle-tracer', projectileLength: 0.27, projectileWidth: 0.032,
    trailIntervalSeconds: 0.17, trailParticleSize: 0.017, muzzleParticles: 4, muzzleSpread: 0.18, impactParticles: 5,
    recoilDepth: 0.075, recoilPitch: 0.15, recoilSettleSeconds: 0.18,
    magazineDrop: 0.44, boltTravel: -0.12, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  shotgun: {
    projectileStyle: 'buckshot', projectileLength: 0.075, projectileWidth: 0.064,
    trailIntervalSeconds: 0.24, trailParticleSize: 0.024, muzzleParticles: 8, muzzleSpread: 0.54, impactParticles: 11,
    recoilDepth: 0.17, recoilPitch: 0.34, recoilSettleSeconds: 0.28,
    magazineDrop: 0, boltTravel: 0, pumpTravel: -0.26, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  'heavy-rifle': {
    projectileStyle: 'heavy-slug', projectileLength: 0.48, projectileWidth: 0.052,
    trailIntervalSeconds: 0.20, trailParticleSize: 0.022, muzzleParticles: 6, muzzleSpread: 0.12, impactParticles: 8,
    recoilDepth: 0.20, recoilPitch: 0.36, recoilSettleSeconds: 0.27,
    magazineDrop: 0.48, boltTravel: -0.17, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  minigun: {
    projectileStyle: 'rotary-tracer', projectileLength: 0.13, projectileWidth: 0.023,
    trailIntervalSeconds: 0.16, trailParticleSize: 0.014, muzzleParticles: 2, muzzleSpread: 0.38, impactParticles: 4,
    recoilDepth: 0.046, recoilPitch: 0.09, recoilSettleSeconds: 0.13,
    magazineDrop: 0.24, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: true,
  },
  rocket: {
    projectileStyle: 'rocket', projectileLength: 0.48, projectileWidth: 0.15,
    trailIntervalSeconds: 0.085, trailParticleSize: 0.065, muzzleParticles: 9, muzzleSpread: 0.26, impactParticles: 20,
    recoilDepth: 0.24, recoilPitch: 0.40, recoilSettleSeconds: 0.32,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0.34, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  flame: {
    projectileStyle: 'flame', projectileLength: 0.24, projectileWidth: 0.11,
    trailIntervalSeconds: 0.065, trailParticleSize: 0.046, muzzleParticles: 7, muzzleSpread: 0.62, impactParticles: 8,
    recoilDepth: 0.062, recoilPitch: 0.13, recoilSettleSeconds: 0.16,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0.82, energyCellDrop: 0, rotorBrake: false,
  },
  plasma: {
    projectileStyle: 'plasma', projectileLength: 0.20, projectileWidth: 0.14,
    trailIntervalSeconds: 0.095, trailParticleSize: 0.052, muzzleParticles: 7, muzzleSpread: 0.22, impactParticles: 13,
    recoilDepth: 0.11, recoilPitch: 0.20, recoilSettleSeconds: 0.22,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0.28, rotorBrake: false,
  },
  grenade: {
    projectileStyle: 'grenade-ballistic', projectileLength: 0.34, projectileWidth: 0.12,
    trailIntervalSeconds: 0.095, trailParticleSize: 0.038, muzzleParticles: 6, muzzleSpread: 0.18, impactParticles: 24,
    recoilDepth: 0.23, recoilPitch: 0.39, recoilSettleSeconds: 0.30,
    magazineDrop: 0, boltTravel: -0.13, pumpTravel: 0, rocketCellTravel: 0.26, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  gauss: {
    projectileStyle: 'gauss-lance', projectileLength: 0.78, projectileWidth: 0.048,
    trailIntervalSeconds: 0.06, trailParticleSize: 0.032, muzzleParticles: 10, muzzleSpread: 0.08, impactParticles: 15,
    recoilDepth: 0.22, recoilPitch: 0.38, recoilSettleSeconds: 0.30,
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
