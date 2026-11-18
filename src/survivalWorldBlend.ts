import type { SurvivalMapId } from './survivalMaps.ts';

export const SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS = 11;
export const SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS = 11;

export type SurvivalWorldBoundaryKind = 'interior' | 'x-seam' | 'z-seam' | 'four-way';
export type SurvivalWorldBiomeBlendWeights = Readonly<Record<SurvivalMapId, number>>;

export interface SurvivalWorldBiomeBlend {
  weights: SurvivalWorldBiomeBlendWeights;
  eastFactor: number;
  southFactor: number;
  xBoundaryInfluence: number;
  zBoundaryInfluence: number;
  junctionInfluence: number;
  blendAmount: number;
  dominantBiomeId: SurvivalMapId;
  boundaryKind: SurvivalWorldBoundaryKind;
  isBlending: boolean;
}

const MAP_ORDER: readonly SurvivalMapId[] = [
  'warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting',
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export type MutableSurvivalWorldBiomeBlend = Omit<SurvivalWorldBiomeBlend, 'weights'> & {
  weights: Record<SurvivalMapId, number>;
};

/** Create a reusable output object for the per-frame Survival lighting path. */
export function createSurvivalWorldBiomeBlendScratch(): MutableSurvivalWorldBiomeBlend {
  return {
    weights: {
      warehouse_b4: 1,
      container_terminal: 0,
      cold_storage: 0,
      night_sorting: 0,
    },
    eastFactor: 0,
    southFactor: 0,
    xBoundaryInfluence: 0,
    zBoundaryInfluence: 0,
    junctionInfluence: 0,
    blendAmount: 0,
    dominantBiomeId: MAP_ORDER[0],
    boundaryKind: 'interior',
    isBlending: false,
  };
}

function writeBlend(
  out: MutableSurvivalWorldBiomeBlend,
  eastFactor: number,
  southFactor: number,
  xBoundaryInfluence: number,
  zBoundaryInfluence: number,
): MutableSurvivalWorldBiomeBlend {
  const weights = out.weights;
  weights.warehouse_b4 = (1 - eastFactor) * (1 - southFactor);
  weights.container_terminal = eastFactor * (1 - southFactor);
  weights.cold_storage = eastFactor * southFactor;
  weights.night_sorting = (1 - eastFactor) * southFactor;

  const total = weights.warehouse_b4 + weights.container_terminal + weights.cold_storage + weights.night_sorting;
  if (total > 0 && Math.abs(total - 1) > 1e-9) {
    for (const id of MAP_ORDER) weights[id] /= total;
  }

  let dominantBiomeId = MAP_ORDER[0];
  let maximumWeight = weights[dominantBiomeId];
  for (let index = 1; index < MAP_ORDER.length; index++) {
    const id = MAP_ORDER[index];
    const weight = weights[id];
    if (weight > maximumWeight) {
      maximumWeight = weight;
      dominantBiomeId = id;
    }
  }

  const blendAmount = clamp01(1 - maximumWeight);
  const nearX = xBoundaryInfluence > 0.015;
  const nearZ = zBoundaryInfluence > 0.015;
  out.eastFactor = eastFactor;
  out.southFactor = southFactor;
  out.xBoundaryInfluence = xBoundaryInfluence;
  out.zBoundaryInfluence = zBoundaryInfluence;
  out.junctionInfluence = xBoundaryInfluence * zBoundaryInfluence;
  out.blendAmount = blendAmount;
  out.dominantBiomeId = dominantBiomeId;
  out.boundaryKind = nearX && nearZ ? 'four-way' : nearX ? 'x-seam' : nearZ ? 'z-seam' : 'interior';
  out.isBlending = blendAmount > 1e-4;
  return out;
}

/** Update a previously created biome blend result without allocating objects or arrays. */
export function updateSurvivalWorldBiomeBlendAtPosition(
  x: number,
  z: number,
  out: MutableSurvivalWorldBiomeBlend,
): MutableSurvivalWorldBiomeBlend {
  const safeX = Number.isFinite(x) ? x : -SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS * 2;
  const safeZ = Number.isFinite(z) ? z : -SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS * 2;
  const eastFactor = smoothstep(-SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS, SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS, safeX);
  const southFactor = smoothstep(-SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS, SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS, safeZ);
  const xBoundaryInfluence = 1 - smoothstep(0, SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS, Math.abs(safeX));
  const zBoundaryInfluence = 1 - smoothstep(0, SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS, Math.abs(safeZ));
  return writeBlend(out, eastFactor, southFactor, xBoundaryInfluence, zBoundaryInfluence);
}

/**
 * Spatially blend four rectangular biomes instead of switching ambience at a
 * single coordinate. Its 22 m overlap field drives the connected floor atlas and
 * world lighting; bilinear blending makes the centre a genuine four-way overlap.
 */
export function getSurvivalWorldBiomeBlendAtPosition(x: number, z: number): SurvivalWorldBiomeBlend {
  return updateSurvivalWorldBiomeBlendAtPosition(x, z, createSurvivalWorldBiomeBlendScratch());
}
