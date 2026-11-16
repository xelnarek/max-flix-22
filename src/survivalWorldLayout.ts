import type { SurvivalMapId } from './survivalMaps.ts';

export interface SurvivalWorldOpenEdges { west: boolean; east: boolean; north: boolean; south: boolean; }
export interface SurvivalWorldBiomeLayout { id: SurvivalMapId; centerX: number; centerZ: number; openEdges: SurvivalWorldOpenEdges; }
export interface SurvivalWorldTransition { id: string; from: SurvivalMapId; to: SurvivalMapId; axis: 'x' | 'z'; centerX: number; centerZ: number; markerSpan: number; }

export interface SurvivalWorldTransitionFootprint { bandWidth: number; bandDepth: number; seamWidth: number; seamDepth: number; }

/** Blend each shared biome edge across its full length, not only through the old central doorway. */
export function getSurvivalWorldTransitionFootprint(transition: SurvivalWorldTransition): SurvivalWorldTransitionFootprint {
  const blendWidth = 22;
  return transition.axis === 'x'
    ? { bandWidth: blendWidth, bandDepth: SURVIVAL_WORLD_BIOME_HALF_DEPTH * 2, seamWidth: 1.25, seamDepth: SURVIVAL_WORLD_BIOME_HALF_DEPTH * 2 }
    : { bandWidth: SURVIVAL_WORLD_BIOME_HALF_WIDTH * 2, bandDepth: blendWidth, seamWidth: SURVIVAL_WORLD_BIOME_HALF_WIDTH * 2, seamDepth: 1.25 };
}

/** True when the source biome lies on the negative X/Z side of the seam texture. */
export function isSurvivalWorldTransitionFromNegativeSide(transition: SurvivalWorldTransition): boolean {
  const from = getSurvivalWorldBiome(transition.from);
  const to = getSurvivalWorldBiome(transition.to);
  return transition.axis === 'x' ? to.centerX > from.centerX : to.centerZ > from.centerZ;
}

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
export const SURVIVAL_WORLD_BIOME_HALF_WIDTH = 60;
export const SURVIVAL_WORLD_BIOME_HALF_DEPTH = 20;

export interface SurvivalWorldBiomeBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** World-space bounds for one authored 120 x 40 m sector. */
export function getSurvivalWorldBiomeBounds(mapId: SurvivalMapId): SurvivalWorldBiomeBounds {
  const biome = getSurvivalWorldBiome(mapId);
  return {
    minX: biome.centerX - SURVIVAL_WORLD_BIOME_HALF_WIDTH,
    maxX: biome.centerX + SURVIVAL_WORLD_BIOME_HALF_WIDTH,
    minZ: biome.centerZ - SURVIVAL_WORLD_BIOME_HALF_DEPTH,
    maxZ: biome.centerZ + SURVIVAL_WORLD_BIOME_HALF_DEPTH,
  };
}

/** Strict quadrant identity for actors; player-only hysteresis is separate. */
export function getSurvivalWorldBiomeIdAtPosition(
  x: number,
  z: number,
  fallback: SurvivalMapId = SURVIVAL_WORLD_START_BIOME,
): SurvivalMapId {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return fallback;
  if (x >= 0 && z < 0) return 'container_terminal';
  if (x >= 0 && z >= 0) return 'cold_storage';
  if (x < 0 && z >= 0) return 'night_sorting';
  return 'warehouse_b4';
}

export interface SurvivalWorldRouteStep {
  from: SurvivalMapId;
  to: SurvivalMapId;
  transition: SurvivalWorldTransition;
}

const survivalWorldRouteCache = new Map<string, readonly SurvivalWorldRouteStep[]>();

/** Shortest route through the four reciprocal, bidirectional sector portals. */
export function getSurvivalWorldRoute(
  from: SurvivalMapId,
  to: SurvivalMapId,
): readonly SurvivalWorldRouteStep[] {
  if (from === to) return [];
  const key = from + '>' + to;
  const cached = survivalWorldRouteCache.get(key);
  if (cached) return cached;

  const queue: SurvivalMapId[] = [from];
  const visited = new Set<SurvivalMapId>([from]);
  const previous = new Map<SurvivalMapId, SurvivalWorldRouteStep>();

  while (queue.length > 0 && !visited.has(to)) {
    const current = queue.shift()!;
    for (const transition of SURVIVAL_WORLD_TRANSITIONS) {
      const next = transition.from === current
        ? transition.to
        : transition.to === current
          ? transition.from
          : null;
      if (!next || visited.has(next)) continue;
      visited.add(next);
      previous.set(next, { from: current, to: next, transition });
      queue.push(next);
    }
  }

  const route: SurvivalWorldRouteStep[] = [];
  let cursor = to;
  while (cursor !== from) {
    const step = previous.get(cursor);
    if (!step) {
      const empty: readonly SurvivalWorldRouteStep[] = [];
      survivalWorldRouteCache.set(key, empty);
      return empty;
    }
    route.unshift(step);
    cursor = step.from;
  }
  const result = Object.freeze(route.slice());
  survivalWorldRouteCache.set(key, result);
  return result;
}

/** Safe intermediate target a few metres beyond the first open portal. */
export function getSurvivalWorldWaypoint(
  from: SurvivalMapId,
  to: SurvivalMapId,
  inset = SURVIVAL_WORLD_BIOME_HYSTERESIS_METERS + 3,
  currentPosition?: { x: number; z: number },
): { x: number; z: number } | null {
  const step = getSurvivalWorldRoute(from, to)[0];
  if (!step) return null;
  const { transition } = step;
  const fromBiome = getSurvivalWorldBiome(step.from);
  const toBiome = getSurvivalWorldBiome(step.to);
  const directionX = Math.sign(toBiome.centerX - fromBiome.centerX);
  const directionZ = Math.sign(toBiome.centerZ - fromBiome.centerZ);
  const distance = Math.max(5, inset);
  if (transition.axis === 'x') {
    const minZ = transition.centerZ - SURVIVAL_WORLD_BIOME_HALF_DEPTH + 2;
    const maxZ = transition.centerZ + SURVIVAL_WORLD_BIOME_HALF_DEPTH - 2;
    const crossingZ = currentPosition && Number.isFinite(currentPosition.z)
      ? Math.min(maxZ, Math.max(minZ, currentPosition.z))
      : transition.centerZ;
    return { x: transition.centerX + directionX * distance, z: crossingZ };
  }
  const minX = transition.centerX - SURVIVAL_WORLD_BIOME_HALF_WIDTH + 2;
  const maxX = transition.centerX + SURVIVAL_WORLD_BIOME_HALF_WIDTH - 2;
  const crossingX = currentPosition && Number.isFinite(currentPosition.x)
    ? Math.min(maxX, Math.max(minX, currentPosition.x))
    : transition.centerX;
  return { x: crossingX, z: transition.centerZ + directionZ * distance };
}

export const SURVIVAL_WORLD_TRANSITIONS: readonly SurvivalWorldTransition[] = [
  { id: 'b4-to-port', from: 'warehouse_b4', to: 'container_terminal', axis: 'x', centerX: 0, centerZ: -20, markerSpan: 26 },
  { id: 'port-to-cold', from: 'container_terminal', to: 'cold_storage', axis: 'z', centerX: 60, centerZ: 0, markerSpan: 36 },
  { id: 'cold-to-night', from: 'cold_storage', to: 'night_sorting', axis: 'x', centerX: 0, centerZ: 20, markerSpan: 26 },
  { id: 'night-to-b4', from: 'night_sorting', to: 'warehouse_b4', axis: 'z', centerX: -60, centerZ: 0, markerSpan: 36 },
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
