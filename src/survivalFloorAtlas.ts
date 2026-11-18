import * as THREE from 'three';
import { getSurvivalWorldBiomeBlendAtPosition } from './survivalWorldBlend.ts';
import { SURVIVAL_MAP_IDS, type SurvivalMapId } from './survivalMaps.ts';
import { SURVIVAL_WORLD_BOUNDS } from './survivalWorldLayout.ts';

type Rgb = readonly [number, number, number];

const FLOOR_BASE: Readonly<Record<SurvivalMapId, Rgb>> = Object.freeze({
  warehouse_b4: [78, 75, 68],
  container_terminal: [67, 69, 66],
  cold_storage: [59, 79, 88],
  night_sorting: [58, 52, 69],
});

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function srgbToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel: number): number {
  const value = Math.max(0, channel);
  return 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function hashCell(x: number, z: number): number {
  let value = Math.imul(Math.floor(x * 374761393) ^ Math.floor(z * 668265263) ^ 0x51ed270b, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 2246822519);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

/** Low-amplitude continuous noise; unlike per-pixel random noise it remains stable across tile boundaries. */
function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hashCell(ix, iz);
  const b = hashCell(ix + 1, iz);
  const c = hashCell(ix, iz + 1);
  const d = hashCell(ix + 1, iz + 1);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return (top + (bottom - top) * sz) * 2 - 1;
}

function softBand(distance: number, halfWidth: number, feather: number): number {
  const safeDistance = Math.max(0, Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY);
  const start = Math.max(0, halfWidth);
  const end = start + Math.max(0.001, feather);
  const t = Math.max(0, Math.min(1, (safeDistance - start) / (end - start)));
  return 1 - t * t * (3 - 2 * t);
}

function getBiomeFloorColor(mapId: SurvivalMapId, x: number, z: number): number {
  const base = FLOOR_BASE[mapId];
  const grain = valueNoise(x * 0.78, z * 0.78) * 3.2
    + valueNoise(x * 2.4 + 17, z * 2.4 - 9) * 1.4;
  let red = base[0] + grain;
  let green = base[1] + grain;
  let blue = base[2] + grain;
  const centre = mapId === 'warehouse_b4'
    ? { x: -60, z: -20 }
    : mapId === 'container_terminal'
      ? { x: 60, z: -20 }
      : mapId === 'cold_storage'
        ? { x: 60, z: 20 }
        : { x: -60, z: 20 };
  const localX = x - centre.x;
  const localZ = z - centre.z;

  if (mapId === 'warehouse_b4') {
    // Worn concrete: broad slab joints, tyre rub and old oil marks.
    const slabX = positiveMod(x + 240, 4.2);
    const slabZ = positiveMod(z + 240, 4.2);
    const joint = Math.min(slabX, 4.2 - slabX, slabZ, 4.2 - slabZ);
    const jointShade = joint < 0.045 ? -7 : joint < 0.10 ? -2.5 : 0;
    const tyreRub = Math.sin((x + z * 0.38) * 0.21) * 1.25;
    const oil = valueNoise(x * 0.22 - 31, z * 0.22 + 8) > 0.72 ? -3.2 : 0;
    const dockLane = softBand(Math.abs(Math.abs(localZ) - 14.9), 0.16, 0.18)
      * (positiveMod(localX + 60, 7.2) < 4.4 ? 1 : 0);
    const hazardBand = softBand(Math.abs(Math.abs(localZ) - 17.25), 0.11, 0.16);
    const hazardDash = positiveMod(localX + 60, 1.55) < 0.78 ? 1 : 0;
    const hazardPaint = hazardBand * hazardDash;
    red += jointShade + tyreRub + oil + 1.2 + dockLane * 15 + hazardPaint * 10;
    green += jointShade + tyreRub + oil + dockLane * 11 + hazardPaint * 7;
    blue += jointShade + tyreRub + oil - 1.4 - dockLane * 2 - hazardPaint * 2;
  } else if (mapId === 'container_terminal') {
    // Dark asphalt with faded loading lanes and aggregate patches.
    const laneDistance = Math.min(Math.abs(z + 30), Math.abs(z + 10));
    const dashedLane = positiveMod(x + 120, 10.5) < 5.8;
    const paint = laneDistance < 0.075 && dashedLane ? 1 : 0;
    const aggregate = valueNoise(x * 1.55 + 42, z * 1.55 - 4);
    const crack = Math.abs(Math.sin(x * 0.83 + Math.sin(z * 0.37) * 0.8));
    const crackShade = crack < 0.035 ? -4 : 0;
    const containerLane = softBand(Math.abs(Math.abs(localZ) - 12.7), 0.16, 0.18)
      * (positiveMod(localX + 60, 9.4) < 5.8 ? 1 : 0);
    const dockStopLine = softBand(Math.abs(Math.abs(localX) - 48), 0.12, 0.12);
    red += crackShade + aggregate * 2.0 + paint * 5.0 + containerLane * 17 + dockStopLine * 9;
    green += crackShade + aggregate * 2.0 + paint * 3.8 + containerLane * 12 + dockStopLine * 8;
    blue += crackShade + aggregate * 1.8 + paint * 0.8 - containerLane * 2 + dockStopLine * 5;
  } else if (mapId === 'cold_storage') {
    // Blue-grey sealed concrete with fine frost fractures, never a white floor.
    const panelX = positiveMod(x + 240, 8.0);
    const panelZ = positiveMod(z + 240, 6.5);
    const panelJoint = Math.min(panelX, 8.0 - panelX, panelZ, 6.5 - panelZ);
    const frostLine = Math.abs(Math.sin(x * 0.68 + Math.sin(z * 0.51) * 0.42));
    const frost = frostLine < 0.032 ? 1 : 0;
    const seam = panelJoint < 0.035 ? -4.5 : 0;
    const freezerLaneDistance = Math.min(...[-30, -10, 10, 30].map((laneX) => Math.abs(localX - laneX)));
    const freezerLane = softBand(freezerLaneDistance, 0.13, 0.20);
    const frostRail = softBand(Math.abs(Math.abs(localZ) - 16.2), 0.10, 0.16);
    red += seam + frost * 2.0 + freezerLane * 6 + frostRail * 3;
    green += seam + frost * 7.0 + freezerLane * 15 + frostRail * 10;
    blue += seam + frost * 9.0 + freezerLane * 22 + frostRail * 19;
  } else {
    // Graphite rubber floor with subdued scan grooves and violet signal reflections.
    const groove = positiveMod(z + 40, 3.6);
    const grooveShade = groove < 0.055 || groove > 3.545 ? -4.0 : 0;
    const scan = positiveMod(localX + 60, 13.5) < 0.13 && positiveMod(localZ + 20, 9) < 4.2 ? 1 : 0;
    const scanPhase = positiveMod(localZ + 18, 4.5);
    const scanDistance = Math.min(scanPhase, 4.5 - scanPhase);
    const scannerTrack = softBand(scanDistance, 0.11, 0.14);
    const scannerDash = positiveMod(localX + 60, 18) < 10 ? 1 : 0;
    const scanPaint = scannerTrack * scannerDash;
    const wear = Math.sin(localZ * 1.18 + Math.sin(localX * 0.13)) * 1.35;
    red += grooveShade + wear + scan * 4.5 + scanPaint * 16;
    green += grooveShade + wear - scan * 0.6 - scanPaint * 3;
    blue += grooveShade + wear + scan * 5.0 + scanPaint * 21;
  }

  return (clampByte(red) << 16) | (clampByte(green) << 8) | clampByte(blue);
}

export interface SurvivalFloorAtlasSample {
  color: number;
  alpha: number;
}

/**
 * Samples the continuous 240 × 80 m floor atlas in world coordinates.
 * Every surface detail is weighted by the same bilinear biome blend as the
 * world lighting and combat modifiers, including the four-way centre seam.
 */
export function getSurvivalFloorAtlasSample(x: number, z: number): SurvivalFloorAtlasSample {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z) ? z : 0;
  const blend = getSurvivalWorldBiomeBlendAtPosition(safeX, safeZ);
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const mapId of SURVIVAL_MAP_IDS) {
    const color = getBiomeFloorColor(mapId, safeX, safeZ);
    const weight = blend.weights[mapId];
    red += srgbToLinear((color >> 16) & 255) * weight;
    green += srgbToLinear((color >> 8) & 255) * weight;
    blue += srgbToLinear(color & 255) * weight;
  }

  const packed = (clampByte(linearToSrgb(red)) << 16)
    | (clampByte(linearToSrgb(green)) << 8)
    | clampByte(linearToSrgb(blue));
  return {
    color: packed,
    // A slightly stronger blend near borders masks the former per-arena tint seam.
    alpha: Math.max(0, Math.min(0.76, 0.68 + blend.blendAmount * 0.08)),
  };
}

/**
 * Creates one world-space texture spanning all four connected Survival sectors.
 * Each biome now has a legible painted floor language: B4 dock bays and hazard
 * striping, port traffic lanes, cold-room frost rails, and night-sorter scan
 * tracks. Markings are sampled in local biome space and blended continuously
 * at the same boundaries as the underlying material and lighting.
 */
export function createSurvivalFloorAtlasTexture(width: number, height: number): THREE.CanvasTexture | null {
  const safeWidth = Math.max(32, Math.min(2048, Math.floor(Number.isFinite(width) ? width : 1024)));
  const safeHeight = Math.max(32, Math.min(1024, Math.floor(Number.isFinite(height) ? height : 342)));
  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(safeWidth, safeHeight);
  const worldWidth = SURVIVAL_WORLD_BOUNDS.maxX - SURVIVAL_WORLD_BOUNDS.minX;
  const worldDepth = SURVIVAL_WORLD_BOUNDS.maxZ - SURVIVAL_WORLD_BOUNDS.minZ;
  for (let py = 0; py < safeHeight; py++) {
    const z = SURVIVAL_WORLD_BOUNDS.minZ + (py / Math.max(1, safeHeight - 1)) * worldDepth;
    for (let px = 0; px < safeWidth; px++) {
      const x = SURVIVAL_WORLD_BOUNDS.minX + (px / Math.max(1, safeWidth - 1)) * worldWidth;
      const sample = getSurvivalFloorAtlasSample(x, z);
      const offset = (py * safeWidth + px) * 4;
      image.data[offset] = (sample.color >> 16) & 255;
      image.data[offset + 1] = (sample.color >> 8) & 255;
      image.data[offset + 2] = sample.color & 255;
      image.data[offset + 3] = Math.round(sample.alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'survival-connected-four-biome-floor-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
