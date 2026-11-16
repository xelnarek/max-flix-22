import type { SurvivalMapId } from './survivalMaps.ts';

export type SurvivalBiomeEdge = 'west' | 'east' | 'north' | 'south';
export type SurvivalTransitionAxis = 'x' | 'z';

export interface SurvivalBiomeZone {
  mapId: SurvivalMapId;
  offsetX: number;
  offsetZ: number;
  openEdges: readonly SurvivalBiomeEdge[];
}

export interface SurvivalBiomeTransition {
  id: string;
  from: SurvivalMapId;
  to: SurvivalMapId;
  axis: SurvivalTransitionAxis;
  centerX: number;
  centerZ: number;
  width: number;
  length: number;
  kind: 'loading_apron' | 'cold_airlock' | 'scanner_transfer' | 'frozen_conveyor';
}

export const SURVIVAL_WORLD_BOUNDS = Object.freeze({
  minX: -119.5, maxX: 119.5, minZ: -39.5, maxZ: 39.5,
});

export const SURVIVAL_BIOME_ZONES: readonly SurvivalBiomeZone[] = Object.freeze([
  { mapId: 'warehouse_b4', offsetX: -60, offsetZ: -20, openEdges: ['east', 'south'] },
  { mapId: 'container_terminal', offsetX: 60, offsetZ: -20, openEdges: ['west', 'south'] },
  { mapId: 'cold_storage', offsetX: -60, offsetZ: 20, openEdges: ['east', 'north'] },
  { mapId: 'night_sorting', offsetX: 60, offsetZ: 20, openEdges: ['west', 'north'] },
]);

/** Four continuous transfer lanes join the shared edges; each lane is 18 m wide. */
export const SURVIVAL_WORLD_TRANSITIONS: readonly SurvivalBiomeTransition[] = Object.freeze([
  { id: 'b4-to-port', from: 'warehouse_b4', to: 'container_terminal', axis: 'x', centerX: 0, centerZ: -20, width: 18, length: 40, kind: 'loading_apron' },
  { id: 'b4-to-cold', from: 'warehouse_b4', to: 'cold_storage', axis: 'z', centerX: -60, centerZ: 0, width: 18, length: 120, kind: 'cold_airlock' },
  { id: 'port-to-night', from: 'container_terminal', to: 'night_sorting', axis: 'z', centerX: 60, centerZ: 0, width: 18, length: 120, kind: 'scanner_transfer' },
  { id: 'cold-to-night', from: 'cold_storage', to: 'night_sorting', axis: 'x', centerX: 0, centerZ: 20, width: 18, length: 40, kind: 'frozen_conveyor' },
]);

export const SURVIVAL_BIOME_BLEND_HALF_WIDTH = 9;

export function getSurvivalBiomeAtPosition(x: number, z: number): SurvivalMapId {
  const east = Number.isFinite(x) && x >= 0;
  const south = Number.isFinite(z) && z >= 0;
  return south ? (east ? 'night_sorting' : 'cold_storage') : (east ? 'container_terminal' : 'warehouse_b4');
}

function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Bilinear weights make lighting and fog blend continuously, including at the four-way junction. */
export function getSurvivalBiomeWeights(x: number, z: number): Readonly<Record<SurvivalMapId, number>> {
  const half = SURVIVAL_BIOME_BLEND_HALF_WIDTH;
  const east = smoothStep(((Number.isFinite(x) ? x : -half) + half) / (half * 2));
  const south = smoothStep(((Number.isFinite(z) ? z : -half) + half) / (half * 2));
  return {
    warehouse_b4: (1 - east) * (1 - south),
    container_terminal: east * (1 - south),
    cold_storage: (1 - east) * south,
    night_sorting: east * south,
  };
}
