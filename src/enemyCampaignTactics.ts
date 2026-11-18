import type { EnemyType } from './types.ts';

export interface CampaignEnemyFlankProfile {
  /** Lateral component blended into the pursuit direction at long range. */
  readonly lateralBias: number;
  /** Distance over which the side-entry bias fades before melee contact. */
  readonly fadeDistance: number;
}

export interface CampaignEnemyFlankVector {
  readonly x: number;
  readonly z: number;
  readonly bias: number;
}

/**
 * Only roles that benefit from a side entry receive a campaign flank profile.
 * Ranged specialists and vehicles keep their existing direct firing/charge lanes.
 */
const PROFILES: Readonly<Partial<Record<EnemyType, CampaignEnemyFlankProfile>>> = Object.freeze({
  kurier: { lateralBias: 0.76, fadeDistance: 7.8 },
  sebix_m: { lateralBias: 0.70, fadeDistance: 7.4 },
  zombie_pracownik: { lateralBias: 0.62, fadeDistance: 7.6 },
  sztaplar_szalony: { lateralBias: 0.38, fadeDistance: 7.0 },
  customer: { lateralBias: 0.32, fadeDistance: 6.4 },
  architect: { lateralBias: 0.24, fadeDistance: 6.2 },
  inspector: { lateralBias: 0.22, fadeDistance: 6.2 },
  monter: { lateralBias: 0.18, fadeDistance: 6.0 },
  radioactive_pip: { lateralBias: 0.28, fadeDistance: 6.8 },
  walczak: { lateralBias: 0.14, fadeDistance: 5.8 },
  krol_leto: { lateralBias: 0.12, fadeDistance: 5.8 },
  bosman_krakow: { lateralBias: 0.12, fadeDistance: 5.8 },
  elite_walczak_guard: { lateralBias: 0.12, fadeDistance: 5.8 },
  mutant_gamma_forklift: { lateralBias: 0.10, fadeDistance: 5.8 },
});

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function getCampaignEnemyFlankProfile(
  type: EnemyType,
): Readonly<CampaignEnemyFlankProfile> | null {
  return PROFILES[type] ?? null;
}

/** Stable per-enemy left/right assignment; never changes as the player moves. */
export function resolveCampaignEnemyFlankSide(enemyId: string): -1 | 1 {
  const id = typeof enemyId === 'string' ? enemyId : '';
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash & 1) === 0 ? -1 : 1;
}

/**
 * Blend a bounded lateral approach into the campaign pursuit vector.
 * The bias fades to zero before the existing contact band, so enemies do not
 * orbit at melee range or fight the body-overlap resolver.
 */
export function getCampaignEnemyFlankVector(
  type: EnemyType,
  dx: number,
  dz: number,
  distance: number,
  attackDistance: number,
  side: -1 | 1,
): CampaignEnemyFlankVector {
  const safeX = Number.isFinite(dx) ? dx : 0;
  const safeZ = Number.isFinite(dz) ? dz : 0;
  const length = Math.hypot(safeX, safeZ);
  if (length < 1e-5) return { x: 0, z: 0, bias: 0 };

  const profile = getCampaignEnemyFlankProfile(type);
  if (!profile) return { x: safeX, z: safeZ, bias: 0 };

  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : length;
  const safeAttackDistance = Number.isFinite(attackDistance) ? Math.max(0, attackDistance) : 1.1;
  const approachProgress = (safeDistance - safeAttackDistance - 0.35) / profile.fadeDistance;
  const bias = profile.lateralBias * smoothstep(approachProgress);
  if (bias <= 1e-5) return { x: safeX, z: safeZ, bias: 0 };

  const forwardX = safeX / length;
  const forwardZ = safeZ / length;
  const flankSide = side === -1 ? -1 : 1;
  const lateralX = -forwardZ * flankSide;
  const lateralZ = forwardX * flankSide;
  const mixedX = forwardX + lateralX * bias;
  const mixedZ = forwardZ + lateralZ * bias;
  const mixedLength = Math.hypot(mixedX, mixedZ);
  if (!Number.isFinite(mixedLength) || mixedLength < 1e-5) {
    return { x: forwardX, z: forwardZ, bias: 0 };
  }
  return { x: mixedX / mixedLength, z: mixedZ / mixedLength, bias };
}
