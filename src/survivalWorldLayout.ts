import type { SurvivalMapId } from './survivalMaps.ts';

export interface SurvivalWorldOpenEdges { west: boolean; east: boolean; north: boolean; south: boolean; }
export interface SurvivalWorldBiomeLayout { id: SurvivalMapId; centerX: number; centerZ: number; openEdges: SurvivalWorldOpenEdges; }
export interface SurvivalWorldTransition { id: string; from: SurvivalMapId; to: SurvivalMapId; axis: 'x' | 'z'; centerX: number; centerZ: number; openingWidth: number; }

/** Four existing 120 x 40 m arenas tile one connected 240 x 80 m world. */
export const SURVIVAL_WORLD_BIOMES: readonly SurvivalWorldBiomeLayout[] = [
  { id: 'warehouse_b4', centerX: -60, centerZ: -20, openEdges: { west: false, east: true, north: false, south: true } },
  { id: 'container_terminal', centerX: 60, centerZ: -20, openEdges: { west: true, east: false, north: false, south: true } },
  { id: 'cold_storage', centerX: 60, centerZ: 20, openEdges: { west: true, east: false, north: true, south: false } },
  { id: 'night_sorting', centerX: -60, centerZ: 20, openEdges: { west: false, east: true, north: true, south: false } },
] as const;

export const SURVIVAL_WORLD_BOUNDS = { minX: -120, maxX: 120, minZ: -40, maxZ: 40 } as const;
export const SURVIVAL_WORLD_WIDTH = SURVIVAL_WORLD_BOUNDS.maxX - SURVIVAL_WORLD_BOUNDS.minX;
export const SURVIVAL_WORLD_DEPTH = SURVIVAL_WORLD_BOUNDS.maxZ - SURVIVAL_WORLD_BOUNDS.minZ;
export const SURVIVAL_WORLD_START_BIOME: SurvivalMapId = 'warehouse_b4';
export const SURVIVAL_WORLD_BIOME_HYSTERESIS_METERS = 4;

export const SURVIVAL_WORLD_TRANSITIONS: readonly SurvivalWorldTransition[] = [
  { id: 'b4-to-port', from: 'warehouse_b4', to: 'container_terminal', axis: 'x', centerX: 0, centerZ: -20, openingWidth: 26 },
  { id: 'port-to-cold', from: 'container_terminal', to: 'cold_storage', axis: 'z', centerX: 60, centerZ: 0, openingWidth: 36 },
  { id: 'cold-to-night', from: 'cold_storage', to: 'night_sorting', axis: 'x', centerX: 0, centerZ: 20, openingWidth: 26 },
  { id: 'night-to-b4', from: 'night_sorting', to: 'warehouse_b4', axis: 'z', centerX: -60, centerZ: 0, openingWidth: 36 },
];

export function getSurvivalWorldBiome(mapId: SurvivalMapId): SurvivalWorldBiomeLayout {
  return SURVIVAL_WORLD_BIOMES.find((biome) => biome.id === mapId) ?? SURVIVAL_WORLD_BIOMES[0];
}

/** Four-metre hysteresis prevents rapid lighting/modifier swaps on portal thresholds. */
export function getSurvivalBiomeIdAtPosition(
  x: number,
  z: number,
  currentId: SurvivalMapId = SURVIVAL_WORLD_START_BIOME,
): SurvivalMapId {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return currentId;
  const h = SURVIVAL_WORLD_BIOME_HYSTERESIS_METERS;
  const remains =
    (currentId === 'warehouse_b4' && x < h && z < h) ||
    (currentId === 'container_terminal' && x > -h && z < h) ||
    (currentId === 'cold_storage' && x > -h && z > -h) ||
    (currentId === 'night_sorting' && x < h && z > -h);
  if (remains) return currentId;
  if (x >= 0 && z < 0) return 'container_terminal';
  if (x >= 0 && z >= 0) return 'cold_storage';
  if (x < 0 && z >= 0) return 'night_sorting';
  return 'warehouse_b4';
}
