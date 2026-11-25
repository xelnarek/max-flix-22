import type { EnemyType } from './types.ts';

export interface EnemyDeathMotionProfile {
  /** Total visible defeat animation time in seconds. */
  readonly duration: number;
  /** Local forward/backward fall around the X axis. */
  readonly fallX: number;
  /** Left/right body roll around the Z axis. */
  readonly rollZ: number;
  /** Vertical settle distance in world units. */
  readonly drop: number;
  /** Final vertical compression, kept subtle to preserve the model silhouette. */
  readonly squash: number;
}

export interface EnemyDeathMotionPose {
  rotationX: number;
  rotationZ: number;
  drop: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

const profile = (
  duration: number,
  fallX: number,
  rollZ: number,
  drop: number,
  squash: number,
): EnemyDeathMotionProfile => Object.freeze({ duration, fallX, rollZ, drop, squash });

/**
 * Defeat poses are animation-only and keyed by archetype. They never alter
 * enemy HP, damage, AI, collision or reward logic. Non-humanoid actors use
 * smaller shutdown/crash leans so they do not tip over like people.
 */
export const ENEMY_DEATH_MOTION_PROFILES: Readonly<Record<EnemyType, EnemyDeathMotionProfile>> = Object.freeze({
  customer: profile(0.78, 0.28, 0.48, 0.12, 0.15),
  walczak: profile(1.34, 0.74, 0.18, 0.25, 0.28),
  forklift: profile(0.96, 0.08, 0.24, 0.08, 0.10),
  architect: profile(0.92, 0.34, -0.34, 0.14, 0.12),
  inspector: profile(0.76, 0.42, 0.12, 0.16, 0.18),
  agv_robot: profile(0.64, 0.04, 0.25, 0.08, 0.20),
  handlowiec: profile(0.82, 0.32, 0.44, 0.12, 0.12),
  monter: profile(0.88, 0.50, -0.18, 0.16, 0.19),
  piorun_dron: profile(0.68, 0.06, 0.12, 0.04, 0.12),
  elite_walczak_guard: profile(1.18, 0.58, -0.40, 0.18, 0.23),
  kurier: profile(0.70, 0.18, -0.64, 0.10, 0.10),
  'przedstawiciel_włoski': profile(0.90, 0.25, 0.72, 0.10, 0.10),
  sztaplar_szalony: profile(1.12, 0.62, -0.20, 0.18, 0.24),
  krol_leto: profile(1.42, 0.82, 0.20, 0.27, 0.30),
  pan_roman: profile(0.82, 0.35, 0.48, 0.16, 0.14),
  serwisant: profile(0.72, 0.35, -0.18, 0.12, 0.12),
  bosman_krakow: profile(1.20, 0.56, 0.42, 0.19, 0.24),
  zombie_pracownik: profile(1.04, 0.22, 0.88, 0.20, 0.20),
  pomazaniec: profile(0.66, 0.28, 0.76, 0.12, 0.12),
  sebix_m: profile(1.02, 0.54, -0.58, 0.20, 0.22),
  mutant_gamma_forklift: profile(1.44, 0.84, 0.18, 0.28, 0.31),
  radioactive_pip: profile(0.90, 0.44, -0.38, 0.16, 0.17),
  cyber_salesman: profile(0.88, 0.18, 0.10, 0.12, 0.12),
  wkurzona_zona: profile(0.98, 0.46, 0.50, 0.16, 0.18),
  kluska_piekielna: profile(0.82, 0.24, 0.62, 0.10, 0.14),
});

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function getEnemyDeathMotionProfile(type: EnemyType): Readonly<EnemyDeathMotionProfile> {
  return ENEMY_DEATH_MOTION_PROFILES[type] ?? ENEMY_DEATH_MOTION_PROFILES.customer;
}

/** Calculate a bounded, deterministic pose for the fallback/procedural model. */
export function getEnemyDeathMotionPose(
  type: EnemyType,
  progress: number,
  side: -1 | 1 = 1,
): EnemyDeathMotionPose {
  const motion = getEnemyDeathMotionProfile(type);
  const t = clamp01(progress);
  const settle = smooth((t - 0.08) / 0.92);
  const anticipation = t < 0.12 ? Math.sin((t / 0.12) * Math.PI) * 0.045 : 0;
  const collapse = Math.sin(settle * Math.PI * 0.5);
  const compression = settle * motion.squash;

  return {
    rotationX: motion.fallX * collapse - anticipation,
    rotationZ: motion.rollZ * side * collapse,
    drop: settle > 0 ? -motion.drop * settle : 0,
    scaleX: 1 + compression * 0.22,
    scaleY: 1 - compression,
    scaleZ: 1 + compression * 0.22,
  };
}
