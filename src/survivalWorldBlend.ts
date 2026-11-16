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

function createBlend(eastFactor: number, southFactor: number, xBoundaryInfluence: number, zBoundaryInfluence: number): SurvivalWorldBiomeBlend {
  const weights: Record<SurvivalMapId, number> = {
    warehouse_b4: (1 - eastFactor) * (1 - southFactor),
    container_terminal: eastFactor * (1 - southFactor),
    cold_storage: eastFactor * southFactor,
    night_sorting: (1 - eastFactor) * southFactor,
  };
  const total = MAP_ORDER.reduce((sum, id) => sum + weights[id], 0);
  if (total > 0 && Math.abs(total - 1) > 1e-9) {
    for (const id of MAP_ORDER) weights[id] /= total;
  }
  let dominantBiomeId = MAP_ORDER[0];
  for (const id of MAP_ORDER.slice(1)) {
    if (weights[id] > weights[dominantBiomeId]) dominantBiomeId = id;
  }
  const blendAmount = clamp01(1 - Math.max(...MAP_ORDER.map((id) => weights[id])));
  const nearX = xBoundaryInfluence > 0.015;
  const nearZ = zBoundaryInfluence > 0.015;
  const boundaryKind: SurvivalWorldBoundaryKind = nearX && nearZ
    ? 'four-way'
    : nearX
      ? 'x-seam'
      : nearZ
        ? 'z-seam'
        : 'interior';
  return {
    weights, eastFactor, southFactor, xBoundaryInfluence, zBoundaryInfluence,
    junctionInfluence: xBoundaryInfluence * zBoundaryInfluence,
    blendAmount, dominantBiomeId, boundaryKind, isBlending: blendAmount > 1e-4,
  };
}

/**
 * Spatially blend four rectangular biomes instead of switching ambience at a
 * single coordinate. The 22 m transition bands match the rendered floor overlays.
 * Bilinear blending makes the central intersection a genuine four-way overlap.
 */
export function getSurvivalWorldBiomeBlendAtPosition(x: number, z: number): SurvivalWorldBiomeBlend {
  const safeX = Number.isFinite(x) ? x : -SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS * 2;
  const safeZ = Number.isFinite(z) ? z : -SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS * 2;
  const eastFactor = smoothstep(-SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS, SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS, safeX);
  const southFactor = smoothstep(-SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS, SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS, safeZ);
  const xBoundaryInfluence = 1 - smoothstep(0, SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS, Math.abs(safeX));
  const zBoundaryInfluence = 1 - smoothstep(0, SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS, Math.abs(safeZ));
  return createBlend(eastFactor, southFactor, xBoundaryInfluence, zBoundaryInfluence);
}
