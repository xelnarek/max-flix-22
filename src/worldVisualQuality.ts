import type { SurvivalMapId } from './survivalMaps.ts';

export interface WorldLightingProfile {
  ambientColor: number;
  ambientIntensity: number;
  hemisphereSkyColor: number;
  hemisphereGroundColor: number;
  hemisphereIntensity: number;
  directionalColor: number;
  directionalIntensity: number;
  rimColor: number;
  rimIntensity: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  environmentIntensity: number;
  exposure: number;
}

export interface SurvivalSurfaceProfile {
  floorRoughness: number;
  floorMetalness: number;
  wallRoughness: number;
  wallMetalness: number;
  trimRoughness: number;
  trimMetalness: number;
  trimEmissiveIntensity: number;
  palletColor: number;
  crateColors: readonly [number, number, number];
  barrierRoughness: number;
  barrierMetalness: number;
}

/** Four restrained lighting moods: readable silhouettes first, atmosphere second. */
const SURVIVAL_LIGHTING_PROFILES: Readonly<Record<SurvivalMapId, WorldLightingProfile>> = {
  warehouse_b4: {
    ambientColor: 0xdde7ef, ambientIntensity: 0.92,
    hemisphereSkyColor: 0xb6d8ec, hemisphereGroundColor: 0x2b3d4c, hemisphereIntensity: 1.34,
    directionalColor: 0xffe4c4, directionalIntensity: 2.72,
    rimColor: 0x62c6e8, rimIntensity: 1.16,
    fogColor: 0x101b27, fogNear: 50, fogFar: 132,
    environmentIntensity: 0.48, exposure: 1.07,
  },
  container_terminal: {
    ambientColor: 0xd5e1eb, ambientIntensity: 0.94,
    hemisphereSkyColor: 0x9fc9e4, hemisphereGroundColor: 0x263747, hemisphereIntensity: 1.30,
    directionalColor: 0xffd8b0, directionalIntensity: 2.62,
    rimColor: 0xf3a15f, rimIntensity: 1.28,
    fogColor: 0x172536, fogNear: 58, fogFar: 146,
    environmentIntensity: 0.50, exposure: 1.08,
  },
  cold_storage: {
    ambientColor: 0xc8e5f3, ambientIntensity: 0.98,
    hemisphereSkyColor: 0x91cbe9, hemisphereGroundColor: 0x1b3a50, hemisphereIntensity: 1.34,
    directionalColor: 0xd8f1ff, directionalIntensity: 2.46,
    rimColor: 0x63d8ed, rimIntensity: 1.34,
    fogColor: 0x0a2638, fogNear: 44, fogFar: 112,
    environmentIntensity: 0.54, exposure: 1.06,
  },
  night_sorting: {
    ambientColor: 0xd8c9e8, ambientIntensity: 0.90,
    hemisphereSkyColor: 0xa99acb, hemisphereGroundColor: 0x211b37, hemisphereIntensity: 1.23,
    directionalColor: 0xffc8df, directionalIntensity: 2.34,
    rimColor: 0xe879c8, rimIntensity: 1.42,
    fogColor: 0x17132b, fogNear: 42, fogFar: 108,
    environmentIntensity: 0.42, exposure: 1.07,
  },
};

const CAMPAIGN_LIGHTING_PROFILES: Readonly<Record<1 | 2 | 3 | 4, WorldLightingProfile>> = {
  1: {
    ambientColor: 0xdeefff, ambientIntensity: 0.98,
    hemisphereSkyColor: 0xb6e4ff, hemisphereGroundColor: 0x36475d, hemisphereIntensity: 1.40,
    directionalColor: 0xffedda, directionalIntensity: 2.85,
    rimColor: 0x7dd3fc, rimIntensity: 1.25,
    fogColor: 0x15283a, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.52, exposure: 1.08,
  },
  2: {
    ambientColor: 0xfff0de, ambientIntensity: 0.98,
    hemisphereSkyColor: 0xffe3bd, hemisphereGroundColor: 0x514638, hemisphereIntensity: 1.36,
    directionalColor: 0xffd7ae, directionalIntensity: 2.92,
    rimColor: 0xffd08a, rimIntensity: 1.35,
    fogColor: 0x302a26, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.54, exposure: 1.08,
  },
  3: {
    ambientColor: 0xddf5ff, ambientIntensity: 0.96,
    hemisphereSkyColor: 0xa2daef, hemisphereGroundColor: 0x314858, hemisphereIntensity: 1.38,
    directionalColor: 0xd7f4ff, directionalIntensity: 2.78,
    rimColor: 0x56d5e2, rimIntensity: 1.40,
    fogColor: 0x132e3a, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.54, exposure: 1.08,
  },
  4: {
    ambientColor: 0xdcebff, ambientIntensity: 0.94,
    hemisphereSkyColor: 0xa6cffd, hemisphereGroundColor: 0x2b3b54, hemisphereIntensity: 1.32,
    directionalColor: 0xdceaff, directionalIntensity: 2.72,
    rimColor: 0x7db7ff, rimIntensity: 1.35,
    fogColor: 0x15253c, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.52, exposure: 1.08,
  },
};

export const PVP_LIGHTING_PROFILE: WorldLightingProfile & { backgroundColor: number } = {
  ambientColor: 0xcbdce9, ambientIntensity: 0.86,
  hemisphereSkyColor: 0x91bddc, hemisphereGroundColor: 0x15283a, hemisphereIntensity: 1.22,
  directionalColor: 0xffdfbd, directionalIntensity: 2.68,
  rimColor: 0x55c5ed, rimIntensity: 1.58,
  fogColor: 0x0d1c2b, fogNear: 58, fogFar: 148,
  environmentIntensity: 0.44, exposure: 1.04,
  backgroundColor: 0x08121e,
};

const SURVIVAL_SURFACE_PROFILES: Readonly<Record<SurvivalMapId, SurvivalSurfaceProfile>> = {
  warehouse_b4: {
    floorRoughness: 0.66, floorMetalness: 0.12,
    wallRoughness: 0.74, wallMetalness: 0.28,
    trimRoughness: 0.48, trimMetalness: 0.24, trimEmissiveIntensity: 0.08,
    palletColor: 0x76513a, crateColors: [0x526274, 0x98652e, 0x394b5e],
    barrierRoughness: 0.72, barrierMetalness: 0.12,
  },
  container_terminal: {
    floorRoughness: 0.74, floorMetalness: 0.22,
    wallRoughness: 0.66, wallMetalness: 0.42,
    trimRoughness: 0.42, trimMetalness: 0.36, trimEmissiveIntensity: 0.14,
    palletColor: 0x795034, crateColors: [0x61778a, 0xa66a3c, 0x40566b],
    barrierRoughness: 0.68, barrierMetalness: 0.22,
  },
  cold_storage: {
    floorRoughness: 0.48, floorMetalness: 0.22,
    wallRoughness: 0.56, wallMetalness: 0.34,
    trimRoughness: 0.36, trimMetalness: 0.28, trimEmissiveIntensity: 0.18,
    palletColor: 0x7894a3, crateColors: [0x9cbac7, 0x708c9a, 0x526f7e],
    barrierRoughness: 0.64, barrierMetalness: 0.16,
  },
  night_sorting: {
    floorRoughness: 0.54, floorMetalness: 0.34,
    wallRoughness: 0.64, wallMetalness: 0.44,
    trimRoughness: 0.34, trimMetalness: 0.42, trimEmissiveIntensity: 0.22,
    palletColor: 0x533d60, crateColors: [0x50456e, 0x784a65, 0x343550],
    barrierRoughness: 0.62, barrierMetalness: 0.22,
  },
};

export function getSurvivalLightingProfile(mapId: SurvivalMapId): WorldLightingProfile {
  return SURVIVAL_LIGHTING_PROFILES[mapId] ?? SURVIVAL_LIGHTING_PROFILES.warehouse_b4;
}

export function getCampaignLightingProfile(sector: number): WorldLightingProfile {
  const safeSector = Number.isFinite(sector) ? Math.trunc(sector) : 1;
  return CAMPAIGN_LIGHTING_PROFILES[safeSector as 1 | 2 | 3 | 4] ?? CAMPAIGN_LIGHTING_PROFILES[1];
}

export function getSurvivalSurfaceProfile(mapId: SurvivalMapId): SurvivalSurfaceProfile {
  return SURVIVAL_SURFACE_PROFILES[mapId] ?? SURVIVAL_SURFACE_PROFILES.warehouse_b4;
}
