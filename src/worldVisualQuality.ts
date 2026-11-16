import { getSurvivalMapDefinition, SURVIVAL_MAP_IDS, type SurvivalMapId } from './survivalMaps.ts';
import type { SurvivalWorldBiomeBlendWeights } from './survivalWorldBlend.ts';

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
    ambientColor: 0xdde7ef, ambientIntensity: 0.86,
    hemisphereSkyColor: 0xb6d8ec, hemisphereGroundColor: 0x2b3d4c, hemisphereIntensity: 1.20,
    directionalColor: 0xffe4c4, directionalIntensity: 2.42,
    rimColor: 0x62c6e8, rimIntensity: 1.02,
    fogColor: 0x101b27, fogNear: 50, fogFar: 132,
    environmentIntensity: 0.46, exposure: 1.00,
  },
  container_terminal: {
    ambientColor: 0xd5e1eb, ambientIntensity: 0.86,
    hemisphereSkyColor: 0x9fc9e4, hemisphereGroundColor: 0x263747, hemisphereIntensity: 1.18,
    directionalColor: 0xffd8b0, directionalIntensity: 2.34,
    rimColor: 0xf3a15f, rimIntensity: 1.10,
    fogColor: 0x172536, fogNear: 58, fogFar: 146,
    environmentIntensity: 0.47, exposure: 1.00,
  },
  cold_storage: {
    ambientColor: 0xc8e5f3, ambientIntensity: 0.88,
    hemisphereSkyColor: 0x91cbe9, hemisphereGroundColor: 0x1b3a50, hemisphereIntensity: 1.22,
    directionalColor: 0xd8f1ff, directionalIntensity: 2.24,
    rimColor: 0x63d8ed, rimIntensity: 1.16,
    fogColor: 0x0a2638, fogNear: 44, fogFar: 112,
    environmentIntensity: 0.50, exposure: 1.00,
  },
  night_sorting: {
    ambientColor: 0xd8c9e8, ambientIntensity: 0.86,
    hemisphereSkyColor: 0xa99acb, hemisphereGroundColor: 0x211b37, hemisphereIntensity: 1.12,
    directionalColor: 0xffc8df, directionalIntensity: 2.22,
    rimColor: 0xe879c8, rimIntensity: 1.18,
    fogColor: 0x17132b, fogNear: 42, fogFar: 108,
    environmentIntensity: 0.40, exposure: 1.00,
  },
};

const CAMPAIGN_LIGHTING_PROFILES: Readonly<Record<1 | 2 | 3 | 4, WorldLightingProfile>> = {
  1: {
    ambientColor: 0xcbdde9, ambientIntensity: 0.90,
    hemisphereSkyColor: 0xa9cedf, hemisphereGroundColor: 0x36475d, hemisphereIntensity: 1.25,
    directionalColor: 0xe8d7c1, directionalIntensity: 2.46,
    rimColor: 0x78b9c8, rimIntensity: 1.12,
    fogColor: 0x15283a, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.52, exposure: 1.00,
  },
  2: {
    ambientColor: 0xe7d8c5, ambientIntensity: 0.90,
    hemisphereSkyColor: 0xe0c7a6, hemisphereGroundColor: 0x514638, hemisphereIntensity: 1.23,
    directionalColor: 0xe7c39f, directionalIntensity: 2.48,
    rimColor: 0xd7a452, rimIntensity: 1.20,
    fogColor: 0x302a26, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.54, exposure: 1.00,
  },
  3: {
    ambientColor: 0xc9e1e8, ambientIntensity: 0.89,
    hemisphereSkyColor: 0x9dcbd9, hemisphereGroundColor: 0x314858, hemisphereIntensity: 1.24,
    directionalColor: 0xc7e0e8, directionalIntensity: 2.45,
    rimColor: 0x78b9c8, rimIntensity: 1.18,
    fogColor: 0x132e3a, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.54, exposure: 1.00,
  },
  4: {
    ambientColor: 0xcbd9eb, ambientIntensity: 0.88,
    hemisphereSkyColor: 0x9db9df, hemisphereGroundColor: 0x2b3b54, hemisphereIntensity: 1.20,
    directionalColor: 0xc9d9eb, directionalIntensity: 2.40,
    rimColor: 0x82a9d1, rimIntensity: 1.12,
    fogColor: 0x15253c, fogNear: 34, fogFar: 125,
    environmentIntensity: 0.52, exposure: 1.00,
  },
};

export const PVP_LIGHTING_PROFILE: WorldLightingProfile & { backgroundColor: number } = {
  ambientColor: 0xcbdce9, ambientIntensity: 0.86,
  hemisphereSkyColor: 0x91bddc, hemisphereGroundColor: 0x15283a, hemisphereIntensity: 1.22,
  directionalColor: 0xe9d0b5, directionalIntensity: 2.48,
  rimColor: 0x78b9c8, rimIntensity: 1.34,
  fogColor: 0x0d1c2b, fogNear: 58, fogFar: 148,
  environmentIntensity: 0.44, exposure: 1.00,
  backgroundColor: 0x08121e,
};

const SURVIVAL_SURFACE_PROFILES: Readonly<Record<SurvivalMapId, SurvivalSurfaceProfile>> = {
  warehouse_b4: {
    floorRoughness: 0.86, floorMetalness: 0.035,
    wallRoughness: 0.74, wallMetalness: 0.28,
    trimRoughness: 0.48, trimMetalness: 0.24, trimEmissiveIntensity: 0.08,
    palletColor: 0x76513a, crateColors: [0x526274, 0x98652e, 0x394b5e],
    barrierRoughness: 0.72, barrierMetalness: 0.12,
  },
  container_terminal: {
    floorRoughness: 0.88, floorMetalness: 0.045,
    wallRoughness: 0.66, wallMetalness: 0.42,
    trimRoughness: 0.42, trimMetalness: 0.36, trimEmissiveIntensity: 0.14,
    palletColor: 0x795034, crateColors: [0x61778a, 0xa66a3c, 0x40566b],
    barrierRoughness: 0.68, barrierMetalness: 0.22,
  },
  cold_storage: {
    floorRoughness: 0.90, floorMetalness: 0.045,
    wallRoughness: 0.56, wallMetalness: 0.34,
    trimRoughness: 0.36, trimMetalness: 0.28, trimEmissiveIntensity: 0.18,
    palletColor: 0x7894a3, crateColors: [0x9cbac7, 0x708c9a, 0x526f7e],
    barrierRoughness: 0.64, barrierMetalness: 0.16,
  },
  night_sorting: {
    floorRoughness: 0.92, floorMetalness: 0.055,
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


type SurvivalLightingColorKey =
  | 'ambientColor' | 'hemisphereSkyColor' | 'hemisphereGroundColor'
  | 'directionalColor' | 'rimColor' | 'fogColor';

function srgbChannelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
function linearChannelToSrgb(channel: number): number {
  const value = Math.max(0, channel);
  return 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);
}

/** Weighted colour blend in linear-light space avoids dark seams between palettes. */
function blendSurvivalHexColor(weights: SurvivalWorldBiomeBlendWeights, key: SurvivalLightingColorKey): number {
  const channels = [0, 0, 0];
  for (const mapId of SURVIVAL_MAP_IDS) {
    const hex = SURVIVAL_LIGHTING_PROFILES[mapId][key];
    const weight = weights[mapId];
    channels[0] += srgbChannelToLinear((hex >> 16) & 255) * weight;
    channels[1] += srgbChannelToLinear((hex >> 8) & 255) * weight;
    channels[2] += srgbChannelToLinear(hex & 255) * weight;
  }
  return (Math.round(linearChannelToSrgb(channels[0])) << 16)
    | (Math.round(linearChannelToSrgb(channels[1])) << 8)
    | Math.round(linearChannelToSrgb(channels[2]));
}
function blendSurvivalScalar(
  weights: SurvivalWorldBiomeBlendWeights,
  key: Exclude<keyof WorldLightingProfile, SurvivalLightingColorKey>,
): number {
  return SURVIVAL_MAP_IDS.reduce((sum, id) => sum + SURVIVAL_LIGHTING_PROFILES[id][key] * weights[id], 0);
}

/** Lighting target at a world coordinate, including two-way and four-way overlaps. */
export function getSurvivalWorldLightingProfile(weights: SurvivalWorldBiomeBlendWeights): WorldLightingProfile {
  return {
    ambientColor: blendSurvivalHexColor(weights, 'ambientColor'),
    ambientIntensity: blendSurvivalScalar(weights, 'ambientIntensity'),
    hemisphereSkyColor: blendSurvivalHexColor(weights, 'hemisphereSkyColor'),
    hemisphereGroundColor: blendSurvivalHexColor(weights, 'hemisphereGroundColor'),
    hemisphereIntensity: blendSurvivalScalar(weights, 'hemisphereIntensity'),
    directionalColor: blendSurvivalHexColor(weights, 'directionalColor'),
    directionalIntensity: blendSurvivalScalar(weights, 'directionalIntensity'),
    rimColor: blendSurvivalHexColor(weights, 'rimColor'),
    rimIntensity: blendSurvivalScalar(weights, 'rimIntensity'),
    fogColor: blendSurvivalHexColor(weights, 'fogColor'),
    fogNear: blendSurvivalScalar(weights, 'fogNear'),
    fogFar: blendSurvivalScalar(weights, 'fogFar'),
    environmentIntensity: blendSurvivalScalar(weights, 'environmentIntensity'),
    exposure: blendSurvivalScalar(weights, 'exposure'),
  };
}

/** Background is mixed with the same bilinear weights as world lighting. */
export function getSurvivalWorldBackgroundColor(weights: SurvivalWorldBiomeBlendWeights): number {
  const channels = [0, 0, 0];
  for (const mapId of SURVIVAL_MAP_IDS) {
    const hex = getSurvivalMapDefinition(mapId).backgroundColor;
    const weight = weights[mapId];
    channels[0] += srgbChannelToLinear((hex >> 16) & 255) * weight;
    channels[1] += srgbChannelToLinear((hex >> 8) & 255) * weight;
    channels[2] += srgbChannelToLinear(hex & 255) * weight;
  }
  return (Math.round(linearChannelToSrgb(channels[0])) << 16)
    | (Math.round(linearChannelToSrgb(channels[1])) << 8)
    | Math.round(linearChannelToSrgb(channels[2]));
}


/** World-space floor albedo, mixed in linear light to avoid pale/white transition bands. */
export function getSurvivalWorldFloorColor(weights: SurvivalWorldBiomeBlendWeights): number {
  const channels = [0, 0, 0];
  for (const mapId of SURVIVAL_MAP_IDS) {
    const hex = getSurvivalMapDefinition(mapId).floorColor;
    const weight = weights[mapId];
    channels[0] += srgbChannelToLinear((hex >> 16) & 255) * weight;
    channels[1] += srgbChannelToLinear((hex >> 8) & 255) * weight;
    channels[2] += srgbChannelToLinear(hex & 255) * weight;
  }
  return (Math.round(linearChannelToSrgb(channels[0])) << 16)
    | (Math.round(linearChannelToSrgb(channels[1])) << 8)
    | Math.round(linearChannelToSrgb(channels[2]));
}
