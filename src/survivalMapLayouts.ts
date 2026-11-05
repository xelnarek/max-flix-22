export type SurvivalMapLayoutId = 'warehouse_b4' | 'container_terminal' | 'cold_storage' | 'night_sorting';

export interface SurvivalMapRouteFeature {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  accent: number;
  kind: 'pallet_stack' | 'container_stack' | 'cold_compressor' | 'sorter_belt';
}

/**
 * Combat-route dressing is intentionally different per arena. These are
 * physical, low-profile cover pieces, not palette swaps; the central sightline
 * stays open and every footprint is kept inside the playable bounds.
 */
export const SURVIVAL_MAP_LAYOUTS: Readonly<Record<SurvivalMapLayoutId, readonly SurvivalMapRouteFeature[]>> = {
  warehouse_b4: [
    { id: 'b4-west-pallets', x: -34, z: -4.5, width: 3.4, depth: 2.0, height: 1.45, accent: 0xf59e0b, kind: 'pallet_stack' },
    { id: 'b4-mid-rack', x: -12, z: 7.0, width: 4.2, depth: 1.8, height: 1.1, accent: 0xf59e0b, kind: 'pallet_stack' },
    { id: 'b4-east-pallets', x: 17, z: -7.5, width: 3.6, depth: 2.0, height: 1.55, accent: 0xf59e0b, kind: 'pallet_stack' },
    { id: 'b4-dock-load', x: 37, z: 5.5, width: 3.8, depth: 2.2, height: 1.25, accent: 0xf59e0b, kind: 'pallet_stack' },
  ],
  container_terminal: [
    { id: 'port-blue-stack', x: -8, z: -11.5, width: 4.2, depth: 2.5, height: 2.15, accent: 0x38bdf8, kind: 'container_stack' },
    { id: 'port-red-stack', x: 8, z: 11.5, width: 4.2, depth: 2.5, height: 2.15, accent: 0xfb923c, kind: 'container_stack' },
    { id: 'port-transfer', x: -8, z: 11.5, width: 3.2, depth: 2.0, height: 1.3, accent: 0xfbbf24, kind: 'container_stack' },
    { id: 'port-customs', x: 8, z: -11.5, width: 3.2, depth: 2.0, height: 1.3, accent: 0x34d399, kind: 'container_stack' },
  ],
  cold_storage: [
    { id: 'cold-west-unit', x: -25, z: -5.5, width: 3.0, depth: 2.4, height: 1.65, accent: 0x67e8f9, kind: 'cold_compressor' },
    { id: 'cold-mid-unit', x: -4, z: 11.5, width: 3.0, depth: 2.4, height: 1.65, accent: 0x67e8f9, kind: 'cold_compressor' },
    { id: 'cold-east-unit', x: 22, z: 5.5, width: 3.0, depth: 2.4, height: 1.65, accent: 0x67e8f9, kind: 'cold_compressor' },
    { id: 'cold-service-crate', x: 39, z: -11.5, width: 3.4, depth: 2.2, height: 1.15, accent: 0x22d3ee, kind: 'cold_compressor' },
  ],
  night_sorting: [
    { id: 'night-belt-west', x: -32, z: 0, width: 5.0, depth: 2.0, height: 0.82, accent: 0xf472b6, kind: 'sorter_belt' },
    { id: 'night-belt-mid', x: -5, z: -11.5, width: 5.0, depth: 2.0, height: 0.82, accent: 0xa78bfa, kind: 'sorter_belt' },
    { id: 'night-belt-east', x: 23, z: 0, width: 5.0, depth: 2.0, height: 0.82, accent: 0xf472b6, kind: 'sorter_belt' },
    { id: 'night-belt-south', x: 5, z: 11.5, width: 5.0, depth: 2.0, height: 0.82, accent: 0xa78bfa, kind: 'sorter_belt' },
  ],
};

export function getSurvivalMapRouteFeatures(mapId: SurvivalMapLayoutId): readonly SurvivalMapRouteFeature[] {
  return SURVIVAL_MAP_LAYOUTS[mapId] || SURVIVAL_MAP_LAYOUTS.warehouse_b4;
}
