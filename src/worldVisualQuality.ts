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

/** Four PBR-calibrated lighting moods: crisp key/rim separation, rich IBL, and atmospheric depth. */
const SURVIVAL_LIGHTING_PROFILES: Readonly<Record<SurvivalMapId, WorldLightingProfile>> = {
  warehouse_b4: {
    ambientColor: 0xdde7ef, ambientIntensity: 0.86,
    hemisphereSkyColor: 0xb6d8ec, hemisphereGroundColor: 0x223240, hemisphereIntensity: 1.24,
    directionalColor: 0xffe4c4, directionalIntensity: 2.95,
    rimColor: 0x62c6e8, rimIntensity: 1.36,
    fogColor: 0x0e1925, fogNear: 48, fogFar: 132,
    environmentIntensity: 0.58, exposure: 1.06,
  },
  container_terminal: {
    ambientColor: 0xd5e1eb, ambientIntensity: 0.86,
    hemisphereSkyColor: 0x9fc9e4, hemisphereGroundColor: 0x1f2e3c, hemisphereIntensity: 1.20,
    directionalColor: 0xffd8b0, directionalIntensity: 2.86,
    rimColor: 0xf3a15f, rimIntensity: 1.40,
    fogColor: 0x142233, fogNear: 56, fogFar: 146,
    environmentIntensity: 0.59, exposure: 1.06,
  },
  cold_storage: {
    ambientColor: 0xc8e5f3, ambientIntensity: 0.88,
    hemisphereSkyColor: 0x91cbe9, hemisphereGroundColor: 0x163146, hemisphereIntensity: 1.25,
    directionalColor: 0xd8f1ff, directionalIntensity: 2.78,
    rimColor: 0x63d8ed, rimIntensity: 1.44,
    fogColor: 0x092334, fogNear: 44, fogFar: 112,
    environmentIntensity: 0.60, exposure: 1.05,
  },
  night_sorting: {
    ambientColor: 0xd8c9e8, ambientIntensity: 0.85,
    hemisphereSkyColor: 0xa99acb, hemisphereGroundColor: 0x1a152e, hemisphereIntensity: 1.16,
    directionalColor: 0xffc8df, directionalIntensity: 2.74,
    rimColor: 0xe879c8, rimIntensity: 1.48,
    fogColor: 0x141028, fogNear: 42, fogFar: 108,
    environmentIntensity: 0.54, exposure: 1.08,
  },
};

const CAMPAIGN_LIGHTING_PROFILES: Readonly<Record<1 | 2 | 3 | 4, WorldLightingProfile>> = {
  1: {
    ambientColor: 0xcbdde9, ambientIntensity: 0.88,
    hemisphereSkyColor: 0xa9cedf, hemisphereGroundColor: 0x2b3c52, hemisphereIntensity: 1.28,
    directionalColor: 0xffe0bd, directionalIntensity: 2.92,
    rimColor: 0x68c6ef, rimIntensity: 1.38,
    fogColor: 0x112233, fogNear: 36, fogFar: 128,
    environmentIntensity: 0.58, exposure: 1.06,
  },
  2: {
    ambientColor: 0xe7d8c5, ambientIntensity: 0.88,
    hemisphereSkyColor: 0xe0c7a6, hemisphereGroundColor: 0x42382c, hemisphereIntensity: 1.24,
    directionalColor: 0xffcda0, directionalIntensity: 2.94,
    rimColor: 0xeba949, rimIntensity: 1.44,
    fogColor: 0x2a2420, fogNear: 36, fogFar: 128,
    environmentIntensity: 0.59, exposure: 1.06,
  },
  3: {
    ambientColor: 0xc9e1e8, ambientIntensity: 0.87,
    hemisphereSkyColor: 0x9dcbd9, hemisphereGroundColor: 0x253a48, hemisphereIntensity: 1.26,
    directionalColor: 0xcde8f2, directionalIntensity: 2.90,
    rimColor: 0x58cfe0, rimIntensity: 1.42,
    fogColor: 0x102834, fogNear: 36, fogFar: 128,
    environmentIntensity: 0.60, exposure: 1.05,
  },
  4: {
    ambientColor: 0xcbd9eb, ambientIntensity: 0.86,
    hemisphereSkyColor: 0x9db9df, hemisphereGroundColor: 0x203048, hemisphereIntensity: 1.22,
    directionalColor: 0xd4e2f7, directionalIntensity: 2.86,
    rimColor: 0x7cb8ef, rimIntensity: 1.40,
    fogColor: 0x122036, fogNear: 36, fogFar: 128,
    environmentIntensity: 0.57, exposure: 1.06,
  },
};

export const PVP_LIGHTING_PROFILE: WorldLightingProfile & { backgroundColor: number } = {
  ambientColor: 0xcbdce9, ambientIntensity: 0.84,
  hemisphereSkyColor: 0x91bddc, hemisphereGroundColor: 0x15283a, hemisphereIntensity: 1.24,
  directionalColor: 0xffd9b8, directionalIntensity: 2.85,
  rimColor: 0x55c5ed, rimIntensity: 1.52,
  fogColor: 0x0b1928, fogNear: 58, fogFar: 148,
  environmentIntensity: 0.58, exposure: 1.06,
  backgroundColor: 0x08121e,
};

const SURVIVAL_SURFACE_PROFILES: Readonly<Record<SurvivalMapId, SurvivalSurfaceProfile>> = {
  warehouse_b4: {
    floorRoughness: 0.48, floorMetalness: 0.08,
    wallRoughness: 0.56, wallMetalness: 0.34,
    trimRoughness: 0.30, trimMetalness: 0.42, trimEmissiveIntensity: 0.38,
    palletColor: 0x76513a, crateColors: [0x526274, 0x98652e, 0x394b5e],
    barrierRoughness: 0.44, barrierMetalness: 0.36,
  },
  container_terminal: {
    floorRoughness: 0.56, floorMetalness: 0.09,
    wallRoughness: 0.48, wallMetalness: 0.52,
    trimRoughness: 0.28, trimMetalness: 0.48, trimEmissiveIntensity: 0.44,
    palletColor: 0x795034, crateColors: [0x61778a, 0xa66a3c, 0x40566b],
    barrierRoughness: 0.40, barrierMetalness: 0.44,
  },
  cold_storage: {
    floorRoughness: 0.42, floorMetalness: 0.12,
    wallRoughness: 0.38, wallMetalness: 0.42,
    trimRoughness: 0.24, trimMetalness: 0.44, trimEmissiveIntensity: 0.48,
    palletColor: 0x7894a3, crateColors: [0x9cbac7, 0x708c9a, 0x526f7e],
    barrierRoughness: 0.36, barrierMetalness: 0.38,
  },
  night_sorting: {
    floorRoughness: 0.52, floorMetalness: 0.14,
    wallRoughness: 0.44, wallMetalness: 0.56,
    trimRoughness: 0.22, trimMetalness: 0.52, trimEmissiveIntensity: 0.54,
    palletColor: 0x533d60, crateColors: [0x50456e, 0x784a65, 0x343550],
    barrierRoughness: 0.34, barrierMetalness: 0.48,
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
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const mapId of SURVIVAL_MAP_IDS) {
    const hex = SURVIVAL_LIGHTING_PROFILES[mapId][key];
    const weight = weights[mapId];
    red += srgbChannelToLinear((hex >> 16) & 255) * weight;
    green += srgbChannelToLinear((hex >> 8) & 255) * weight;
    blue += srgbChannelToLinear(hex & 255) * weight;
  }
  return (Math.round(linearChannelToSrgb(red)) << 16)
    | (Math.round(linearChannelToSrgb(green)) << 8)
    | Math.round(linearChannelToSrgb(blue));
}
function blendSurvivalScalar(
  weights: SurvivalWorldBiomeBlendWeights,
  key: Exclude<keyof WorldLightingProfile, SurvivalLightingColorKey>,
): number {
  let total = 0;
  for (let index = 0; index < SURVIVAL_MAP_IDS.length; index++) {
    const id = SURVIVAL_MAP_IDS[index];
    total += SURVIVAL_LIGHTING_PROFILES[id][key] * weights[id];
  }
  return total;
}

/** Create an output profile once, then update it by reference in the frame loop. */
export function createWorldLightingProfileScratch(): WorldLightingProfile {
  return {
    ambientColor: 0,
    ambientIntensity: 0,
    hemisphereSkyColor: 0,
    hemisphereGroundColor: 0,
    hemisphereIntensity: 0,
    directionalColor: 0,
    directionalIntensity: 0,
    rimColor: 0,
    rimIntensity: 0,
    fogColor: 0,
    fogNear: 0,
    fogFar: 0,
    environmentIntensity: 0,
    exposure: 0,
  };
}

/** Fill an existing lighting profile; no result object or channel arrays are allocated. */
export function updateSurvivalWorldLightingProfile(
  weights: SurvivalWorldBiomeBlendWeights,
  out: WorldLightingProfile,
): WorldLightingProfile {
  out.ambientColor = blendSurvivalHexColor(weights, 'ambientColor');
  out.ambientIntensity = blendSurvivalScalar(weights, 'ambientIntensity');
  out.hemisphereSkyColor = blendSurvivalHexColor(weights, 'hemisphereSkyColor');
  out.hemisphereGroundColor = blendSurvivalHexColor(weights, 'hemisphereGroundColor');
  out.hemisphereIntensity = blendSurvivalScalar(weights, 'hemisphereIntensity');
  out.directionalColor = blendSurvivalHexColor(weights, 'directionalColor');
  out.directionalIntensity = blendSurvivalScalar(weights, 'directionalIntensity');
  out.rimColor = blendSurvivalHexColor(weights, 'rimColor');
  out.rimIntensity = blendSurvivalScalar(weights, 'rimIntensity');
  out.fogColor = blendSurvivalHexColor(weights, 'fogColor');
  out.fogNear = blendSurvivalScalar(weights, 'fogNear');
  out.fogFar = blendSurvivalScalar(weights, 'fogFar');
  out.environmentIntensity = blendSurvivalScalar(weights, 'environmentIntensity');
  out.exposure = blendSurvivalScalar(weights, 'exposure');
  return out;
}

/** Lighting target at a world coordinate, including two-way and four-way overlaps. */
export function getSurvivalWorldLightingProfile(weights: SurvivalWorldBiomeBlendWeights): WorldLightingProfile {
  return updateSurvivalWorldLightingProfile(weights, createWorldLightingProfileScratch());
}

/** Background is mixed with the same bilinear weights as world lighting. */
export function getSurvivalWorldBackgroundColor(weights: SurvivalWorldBiomeBlendWeights): number {
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const mapId of SURVIVAL_MAP_IDS) {
    const hex = getSurvivalMapDefinition(mapId).backgroundColor;
    const weight = weights[mapId];
    red += srgbChannelToLinear((hex >> 16) & 255) * weight;
    green += srgbChannelToLinear((hex >> 8) & 255) * weight;
    blue += srgbChannelToLinear(hex & 255) * weight;
  }
  return (Math.round(linearChannelToSrgb(red)) << 16)
    | (Math.round(linearChannelToSrgb(green)) << 8)
    | Math.round(linearChannelToSrgb(blue));
}


/** World-space floor albedo, mixed in linear light to avoid pale/white transition bands. */
export function getSurvivalWorldFloorColor(weights: SurvivalWorldBiomeBlendWeights): number {
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const mapId of SURVIVAL_MAP_IDS) {
    const hex = getSurvivalMapDefinition(mapId).floorColor;
    const weight = weights[mapId];
    red += srgbChannelToLinear((hex >> 16) & 255) * weight;
    green += srgbChannelToLinear((hex >> 8) & 255) * weight;
    blue += srgbChannelToLinear(hex & 255) * weight;
  }
  return (Math.round(linearChannelToSrgb(red)) << 16)
    | (Math.round(linearChannelToSrgb(green)) << 8)
    | Math.round(linearChannelToSrgb(blue));
}
