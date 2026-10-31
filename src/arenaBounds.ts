export interface HorizontalArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ClampedHorizontalPosition {
  x: number;
  z: number;
  constrainedX: boolean;
  constrainedZ: boolean;
}

/**
 * Clamp an entity's ground-plane position while optionally keeping its radius
 * away from arena walls. Invalid coordinates recover to the arena centre so a
 * single NaN cannot poison the game loop or camera transforms.
 */
export function clampHorizontalPosition(
  x: number,
  z: number,
  bounds: HorizontalArenaBounds,
  inset = 0
): ClampedHorizontalPosition {
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minZ = Math.min(bounds.minZ, bounds.maxZ);
  const maxZ = Math.max(bounds.minZ, bounds.maxZ);
  const safeInset = Math.max(0, Number.isFinite(inset) ? inset : 0);
  const insetX = Math.min(safeInset, (maxX - minX) / 2);
  const insetZ = Math.min(safeInset, (maxZ - minZ) / 2);
  const lowerX = minX + insetX;
  const upperX = maxX - insetX;
  const lowerZ = minZ + insetZ;
  const upperZ = maxZ - insetZ;
  const safeX = Number.isFinite(x) ? x : (lowerX + upperX) / 2;
  const safeZ = Number.isFinite(z) ? z : (lowerZ + upperZ) / 2;
  const clampedX = Math.min(upperX, Math.max(lowerX, safeX));
  const clampedZ = Math.min(upperZ, Math.max(lowerZ, safeZ));

  return {
    x: clampedX,
    z: clampedZ,
    constrainedX: !Number.isFinite(x) || clampedX !== x,
    constrainedZ: !Number.isFinite(z) || clampedZ !== z,
  };
}
