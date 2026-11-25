export type SurvivalFirearmPresentationArchetype =
  | 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle'
  | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade';

export type SurvivalFirearmProjectileStyle =
  | 'pistol-slug' | 'compact-tracer' | 'rifle-tracer' | 'buckshot'
  | 'heavy-slug' | 'rotary-tracer' | 'rocket' | 'flame' | 'plasma' | 'gauss-lance' | 'grenade-ballistic';

export type SurvivalFirearmMuzzleStyle =
  | 'pistol-crack' | 'smg-stutter' | 'rifle-flash' | 'buckshot-fan'
  | 'heavy-charge' | 'rotary-strobe' | 'rocket-ignition' | 'flame-cone'
  | 'plasma-pulse' | 'grenade-launch' | 'gauss-discharge';

export type SurvivalFirearmTrailStyle =
  | 'warm-brass' | 'compact-dash' | 'copper-line' | 'pellet-glint'
  | 'heavy-streak' | 'rotary-dash' | 'exhaust-smoke' | 'ember-wake'
  | 'ion-residue' | 'smoke-fragment' | 'magnetic-lance';

export type SurvivalFirearmImpactStyle =
  | 'pin-spark' | 'micro-hit' | 'clean-punch' | 'buckshot-burst'
  | 'armor-punch' | 'rotary-chips' | 'pressure-blast' | 'ember-splash'
  | 'ion-bloom' | 'fragmentation-burst' | 'magnetic-punch';

export interface SurvivalFirearmPresentationProfile {
  readonly muzzleStyle: SurvivalFirearmMuzzleStyle;
  readonly trailStyle: SurvivalFirearmTrailStyle;
  readonly impactStyle: SurvivalFirearmImpactStyle;
  readonly muzzleForwardOffset: number;
  readonly muzzleFlashScale: number;
  readonly muzzleLifeSeconds: number;
  readonly trailOpacity: number;
  readonly trailLifeSeconds: number;
  readonly trailStretch: number;
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
    muzzleStyle: 'pistol-crack',
    trailStyle: 'warm-brass',
    impactStyle: 'pin-spark',
    muzzleForwardOffset: 0.78,
    muzzleFlashScale: 0.095,
    muzzleLifeSeconds: 0.095,
    trailOpacity: 0.78,
    trailLifeSeconds: 0.14,
    trailStretch: 2.3,
    projectileStyle: 'pistol-slug', projectileLength: 0.30, projectileWidth: 0.052,
    trailIntervalSeconds: 0.16, trailParticleSize: 0.022, muzzleParticles: 5, muzzleSpread: 0.22, impactParticles: 7,
    recoilDepth: 0.10, recoilPitch: 0.20, recoilSettleSeconds: 0.20,
    magazineDrop: 0.34, boltTravel: -0.11, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  smg: {
    muzzleStyle: 'smg-stutter',
    trailStyle: 'compact-dash',
    impactStyle: 'micro-hit',
    muzzleForwardOffset: 0.90,
    muzzleFlashScale: 0.078,
    muzzleLifeSeconds: 0.08,
    trailOpacity: 0.72,
    trailLifeSeconds: 0.12,
    trailStretch: 1.85,
    projectileStyle: 'compact-tracer', projectileLength: 0.20, projectileWidth: 0.030,
    trailIntervalSeconds: 0.12, trailParticleSize: 0.015, muzzleParticles: 4, muzzleSpread: 0.34, impactParticles: 5,
    recoilDepth: 0.055, recoilPitch: 0.13, recoilSettleSeconds: 0.15,
    magazineDrop: 0.40, boltTravel: -0.085, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  rifle: {
    muzzleStyle: 'rifle-flash',
    trailStyle: 'copper-line',
    impactStyle: 'clean-punch',
    muzzleForwardOffset: 1.06,
    muzzleFlashScale: 0.105,
    muzzleLifeSeconds: 0.105,
    trailOpacity: 0.84,
    trailLifeSeconds: 0.17,
    trailStretch: 3.1,
    projectileStyle: 'rifle-tracer', projectileLength: 0.38, projectileWidth: 0.042,
    trailIntervalSeconds: 0.14, trailParticleSize: 0.020, muzzleParticles: 6, muzzleSpread: 0.18, impactParticles: 8,
    recoilDepth: 0.085, recoilPitch: 0.17, recoilSettleSeconds: 0.19,
    magazineDrop: 0.44, boltTravel: -0.12, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  shotgun: {
    muzzleStyle: 'buckshot-fan',
    trailStyle: 'pellet-glint',
    impactStyle: 'buckshot-burst',
    muzzleForwardOffset: 1.04,
    muzzleFlashScale: 0.165,
    muzzleLifeSeconds: 0.15,
    trailOpacity: 0.88,
    trailLifeSeconds: 0.14,
    trailStretch: 1.15,
    projectileStyle: 'buckshot', projectileLength: 0.13, projectileWidth: 0.082,
    trailIntervalSeconds: 0.18, trailParticleSize: 0.032, muzzleParticles: 11, muzzleSpread: 0.62, impactParticles: 16,
    recoilDepth: 0.21, recoilPitch: 0.40, recoilSettleSeconds: 0.32,
    magazineDrop: 0, boltTravel: 0, pumpTravel: -0.26, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  'heavy-rifle': {
    muzzleStyle: 'heavy-charge',
    trailStyle: 'heavy-streak',
    impactStyle: 'armor-punch',
    muzzleForwardOffset: 1.24,
    muzzleFlashScale: 0.185,
    muzzleLifeSeconds: 0.155,
    trailOpacity: 0.94,
    trailLifeSeconds: 0.22,
    trailStretch: 4.1,
    projectileStyle: 'heavy-slug', projectileLength: 0.64, projectileWidth: 0.072,
    trailIntervalSeconds: 0.16, trailParticleSize: 0.028, muzzleParticles: 8, muzzleSpread: 0.11, impactParticles: 13,
    recoilDepth: 0.23, recoilPitch: 0.42, recoilSettleSeconds: 0.31,
    magazineDrop: 0.48, boltTravel: -0.17, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  minigun: {
    muzzleStyle: 'rotary-strobe',
    trailStyle: 'rotary-dash',
    impactStyle: 'rotary-chips',
    muzzleForwardOffset: 1.22,
    muzzleFlashScale: 0.076,
    muzzleLifeSeconds: 0.075,
    trailOpacity: 0.78,
    trailLifeSeconds: 0.11,
    trailStretch: 2.6,
    projectileStyle: 'rotary-tracer', projectileLength: 0.17, projectileWidth: 0.026,
    trailIntervalSeconds: 0.10, trailParticleSize: 0.014, muzzleParticles: 4, muzzleSpread: 0.43, impactParticles: 6,
    recoilDepth: 0.052, recoilPitch: 0.11, recoilSettleSeconds: 0.13,
    magazineDrop: 0.24, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: true,
  },
  rocket: {
    muzzleStyle: 'rocket-ignition',
    trailStyle: 'exhaust-smoke',
    impactStyle: 'pressure-blast',
    muzzleForwardOffset: 1.18,
    muzzleFlashScale: 0.25,
    muzzleLifeSeconds: 0.24,
    trailOpacity: 0.95,
    trailLifeSeconds: 0.34,
    trailStretch: 0.75,
    projectileStyle: 'rocket', projectileLength: 0.66, projectileWidth: 0.19,
    trailIntervalSeconds: 0.06, trailParticleSize: 0.082, muzzleParticles: 14, muzzleSpread: 0.28, impactParticles: 28,
    recoilDepth: 0.26, recoilPitch: 0.45, recoilSettleSeconds: 0.36,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0.34, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  flame: {
    muzzleStyle: 'flame-cone',
    trailStyle: 'ember-wake',
    impactStyle: 'ember-splash',
    muzzleForwardOffset: 1.02,
    muzzleFlashScale: 0.19,
    muzzleLifeSeconds: 0.18,
    trailOpacity: 0.84,
    trailLifeSeconds: 0.26,
    trailStretch: 0.85,
    projectileStyle: 'flame', projectileLength: 0.36, projectileWidth: 0.145,
    trailIntervalSeconds: 0.062, trailParticleSize: 0.056, muzzleParticles: 10, muzzleSpread: 0.72, impactParticles: 14,
    recoilDepth: 0.058, recoilPitch: 0.13, recoilSettleSeconds: 0.15,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0.82, energyCellDrop: 0, rotorBrake: false,
  },
  plasma: {
    muzzleStyle: 'plasma-pulse',
    trailStyle: 'ion-residue',
    impactStyle: 'ion-bloom',
    muzzleForwardOffset: 1.12,
    muzzleFlashScale: 0.175,
    muzzleLifeSeconds: 0.16,
    trailOpacity: 0.96,
    trailLifeSeconds: 0.22,
    trailStretch: 1.45,
    projectileStyle: 'plasma', projectileLength: 0.32, projectileWidth: 0.18,
    trailIntervalSeconds: 0.065, trailParticleSize: 0.064, muzzleParticles: 9, muzzleSpread: 0.24, impactParticles: 19,
    recoilDepth: 0.115, recoilPitch: 0.22, recoilSettleSeconds: 0.22,
    magazineDrop: 0, boltTravel: 0, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0.28, rotorBrake: false,
  },
  grenade: {
    muzzleStyle: 'grenade-launch',
    trailStyle: 'smoke-fragment',
    impactStyle: 'fragmentation-burst',
    muzzleForwardOffset: 1.00,
    muzzleFlashScale: 0.21,
    muzzleLifeSeconds: 0.21,
    trailOpacity: 0.82,
    trailLifeSeconds: 0.22,
    trailStretch: 0.9,
    projectileStyle: 'grenade-ballistic', projectileLength: 0.44, projectileWidth: 0.16,
    trailIntervalSeconds: 0.07, trailParticleSize: 0.05, muzzleParticles: 9, muzzleSpread: 0.22, impactParticles: 30,
    recoilDepth: 0.24, recoilPitch: 0.42, recoilSettleSeconds: 0.33,
    magazineDrop: 0, boltTravel: -0.13, pumpTravel: 0, rocketCellTravel: 0.26, tankValveTurn: 0, energyCellDrop: 0, rotorBrake: false,
  },
  gauss: {
    muzzleStyle: 'gauss-discharge',
    trailStyle: 'magnetic-lance',
    impactStyle: 'magnetic-punch',
    muzzleForwardOffset: 1.30,
    muzzleFlashScale: 0.22,
    muzzleLifeSeconds: 0.19,
    trailOpacity: 1,
    trailLifeSeconds: 0.28,
    trailStretch: 4.8,
    projectileStyle: 'gauss-lance', projectileLength: 1.15, projectileWidth: 0.058,
    trailIntervalSeconds: 0.061, trailParticleSize: 0.048, muzzleParticles: 14, muzzleSpread: 0.08, impactParticles: 20,
    recoilDepth: 0.24, recoilPitch: 0.43, recoilSettleSeconds: 0.32,
    magazineDrop: 0, boltTravel: -0.18, pumpTravel: 0, rocketCellTravel: 0, tankValveTurn: 0, energyCellDrop: 0.36, rotorBrake: false,
  },
});

export interface SurvivalFirearmCycleTiming {
  readonly peakProgress: number;
  readonly returnStartProgress: number;
}

/** Distinct firing cadence for each weapon mechanism. */
export const SURVIVAL_FIREARM_CYCLE_TIMING: Readonly<Record<
  SurvivalFirearmPresentationArchetype,
  SurvivalFirearmCycleTiming
>> = Object.freeze({
  pistol: { peakProgress: 0.16, returnStartProgress: 0.34 },
  smg: { peakProgress: 0.12, returnStartProgress: 0.29 },
  rifle: { peakProgress: 0.18, returnStartProgress: 0.36 },
  shotgun: { peakProgress: 0.24, returnStartProgress: 0.50 },
  'heavy-rifle': { peakProgress: 0.20, returnStartProgress: 0.41 },
  minigun: { peakProgress: 0.10, returnStartProgress: 0.82 },
  rocket: { peakProgress: 0.26, returnStartProgress: 0.54 },
  flame: { peakProgress: 0.15, returnStartProgress: 0.38 },
  plasma: { peakProgress: 0.22, returnStartProgress: 0.47 },
  gauss: { peakProgress: 0.30, returnStartProgress: 0.62 },
  grenade: { peakProgress: 0.25, returnStartProgress: 0.56 },
});

export interface SurvivalFirearmCyclePose {
  readonly boltOffsetZ: number;
  readonly pumpOffsetZ: number;
  readonly rocketCellOffsetZ: number;
  readonly tankValveRotation: number;
  readonly energyCellOffsetY: number;
  readonly coilPulse: number;
  readonly rotorSpin: number;
}

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

/** Asymmetric mechanism stroke: quick action, brief firing beat, then return. */
export function getSurvivalFirearmCyclePose(
  archetype: SurvivalFirearmPresentationArchetype,
  progress: number,
): SurvivalFirearmCyclePose {
  const p = clamp01(progress);
  const timing = SURVIVAL_FIREARM_CYCLE_TIMING[archetype];
  const stroke = p < timing.peakProgress
    ? smoothstep(p / timing.peakProgress)
    : p < timing.returnStartProgress
      ? 1
      : 1 - smoothstep((p - timing.returnStartProgress) / (1 - timing.returnStartProgress));
  const profile = SURVIVAL_FIREARM_PRESENTATION[archetype];
  return {
    boltOffsetZ: cleanOffset(profile.boltTravel * stroke),
    pumpOffsetZ: cleanOffset(profile.pumpTravel * stroke),
    rocketCellOffsetZ: cleanOffset(profile.rocketCellTravel * stroke),
    tankValveRotation: cleanOffset(profile.tankValveTurn * stroke * 0.35),
    energyCellOffsetY: cleanOffset(-profile.energyCellDrop * stroke * 0.45),
    coilPulse: cleanOffset(stroke),
    rotorSpin: profile.rotorBrake ? cleanOffset(stroke) : 0,
  };
}

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
