import * as THREE from 'three';
import { getB4VisualTexture } from './b4AssetPack.ts';

type ObstacleTextureKind = 'crate' | 'barrier' | 'wall';

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable for PvP textures');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Seam-friendly top-down concrete/steel floor with readable tile joints and hazard accents. */
export function createPvpFloorTexture(): THREE.Texture {
  // Same decoded industrial tile is shared by PvP and Survival, so both modes
  // keep identical material response and a consistent warehouse art direction.
  return getB4VisualTexture('floor');
}

/** Soft baked contact shadow used when mobile hardware disables shadow maps. */
export function createPvpContactShadowTexture(): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, size) => {
    const center = size * 0.5;
    const gradient = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.5);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.34)');
    gradient.addColorStop(0.48, 'rgba(0, 0, 0, 0.20)');
    gradient.addColorStop(0.82, 'rgba(0, 0, 0, 0.07)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

export function createPvpObstacleTexture(kind: ObstacleTextureKind): THREE.Texture {
  const packTexture = kind === 'crate'
    ? getB4VisualTexture('carton')
    : kind === 'barrier'
      ? getB4VisualTexture('hazard')
      : getB4VisualTexture('steel');
  return packTexture;
}


/**
 * Shared floor footprint for warehouse cover in both PvP and Survival.
 * Dimensions are the same world-space collision dimensions used by the arena.
 */
export function createArenaObstacleFootprint(
  width: number,
  depth: number,
  color: number,
  padding = 0.12,
): THREE.LineLoop {
  const safeWidth = Number.isFinite(width) ? Math.max(0.25, width) : 1;
  const safeDepth = Number.isFinite(depth) ? Math.max(0.25, depth) : 1;
  const safePadding = Number.isFinite(padding) ? Math.max(0, Math.min(0.5, padding)) : 0.12;
  const halfWidth = safeWidth * 0.5 + safePadding;
  const halfDepth = safeDepth * 0.5 + safePadding;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, halfDepth),
    new THREE.Vector3(-halfWidth, 0, halfDepth),
  ]);
  const footprint = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  footprint.position.y = 0.045;
  footprint.renderOrder = 3;
  footprint.frustumCulled = false;
  return footprint;
}
