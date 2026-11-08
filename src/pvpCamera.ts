export interface PvpCameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PvpCameraFrame {
  portrait: boolean;
  aspect: number;
  fov: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fitDistance: number;
  visibleWidth: number;
  requiredWidth: number;
}

export interface PvpCameraPlayerPoint {
  x: number;
  z: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function isPvpPortraitViewport(viewportWidth: number, viewportHeight: number): boolean {
  const width = Number.isFinite(viewportWidth) ? Math.max(1, viewportWidth) : 1;
  const height = Number.isFinite(viewportHeight) ? Math.max(1, viewportHeight) : 1;
  return width / height < 0.86;
}

/** Track both duelists: zoom toward close combat, widen naturally as they separate. */
export function calculatePvpCameraTrackingBounds(
  first: PvpCameraPlayerPoint,
  second: PvpCameraPlayerPoint,
  arena: PvpCameraBounds,
  portrait: boolean,
): PvpCameraBounds {
  const safeX1 = Number.isFinite(first.x) ? first.x : 0;
  const safeZ1 = Number.isFinite(first.z) ? first.z : 0;
  const safeX2 = Number.isFinite(second.x) ? second.x : 0;
  const safeZ2 = Number.isFinite(second.z) ? second.z : 0;
  const centerX = (safeX1 + safeX2) * 0.5;
  const centerZ = (safeZ1 + safeZ2) * 0.5;

  const horizontalSpan = portrait ? arena.maxZ - arena.minZ : arena.maxX - arena.minX;
  const verticalSpan = portrait ? arena.maxX - arena.minX : arena.maxZ - arena.minZ;
  const playerHorizontalSpan = portrait ? Math.abs(safeZ2 - safeZ1) : Math.abs(safeX2 - safeX1);
  const playerVerticalSpan = portrait ? Math.abs(safeX2 - safeX1) : Math.abs(safeZ2 - safeZ1);

  const horizontalPadding = portrait ? 5.8 : 6.6;
  const verticalPadding = portrait ? 6.6 : 5.8;
  const minHorizontalHalf = portrait ? 7.0 : 10.0;
  const minVerticalHalf = portrait ? 10.0 : 7.0;
  const maxHorizontalHalf = horizontalSpan * 0.5 + 1.5;
  const maxVerticalHalf = verticalSpan * 0.5 + 1.5;
  const horizontalHalf = clamp(playerHorizontalSpan * 0.5 + horizontalPadding, minHorizontalHalf, maxHorizontalHalf);
  const verticalHalf = clamp(playerVerticalSpan * 0.5 + verticalPadding, minVerticalHalf, maxVerticalHalf);

  return {
    minX: centerX - (portrait ? verticalHalf : horizontalHalf),
    maxX: centerX + (portrait ? verticalHalf : horizontalHalf),
    minZ: centerZ - (portrait ? horizontalHalf : verticalHalf),
    maxZ: centerZ + (portrait ? horizontalHalf : verticalHalf),
  };
}

/** Perspective fit includes both ground-plane depth and character height. */
export function calculatePvpCameraFrame(
  viewportWidth: number,
  viewportHeight: number,
  center: { x: number; z: number },
  bounds: PvpCameraBounds,
): PvpCameraFrame {
  const width = Number.isFinite(viewportWidth) ? Math.max(1, viewportWidth) : 1;
  const height = Number.isFinite(viewportHeight) ? Math.max(1, viewportHeight) : 1;
  const aspect = width / height;
  const portrait = isPvpPortraitViewport(width, height);
  const fov = portrait ? 68 : 56;
  const verticalFovRad = fov * Math.PI / 180;
  const halfHorizontalFov = Math.atan(Math.tan(verticalFovRad / 2) * aspect);
  const halfVerticalFov = verticalFovRad / 2;
  const halfWidth = Math.max(1, (portrait ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX) / 2);
  const halfHeight = Math.max(1, (portrait ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ) / 2);

  const elevation = (portrait ? 38 : 43) * Math.PI / 180;
  const verticalGroundProjection = halfHeight * Math.cos(elevation);
  const characterHeightProjection = 4.2 * Math.sin(elevation);
  const horizontalFitDistance = halfWidth / Math.max(0.02, Math.tan(halfHorizontalFov));
  const verticalFitDistance = (verticalGroundProjection + characterHeightProjection) /
    Math.max(0.02, Math.tan(halfVerticalFov));
  const fitDistance = Math.max(12, horizontalFitDistance, verticalFitDistance) * 1.12;
  const cameraHeight = fitDistance * Math.sin(elevation);
  const horizontalOffset = fitDistance * Math.cos(elevation);

  const cx = Number.isFinite(center.x) ? center.x : 0;
  const cz = Number.isFinite(center.z) ? center.z : 0;
  const target = { x: cx, y: 0.5, z: cz };
  const position = portrait
    ? { x: cx + horizontalOffset, y: target.y + cameraHeight, z: cz }
    : { x: cx, y: target.y + cameraHeight, z: cz + horizontalOffset };
  const visibleWidth = fitDistance * Math.tan(halfHorizontalFov) * 2;

  return { portrait, aspect, fov, position, target, fitDistance, visibleWidth, requiredWidth: halfWidth * 2 };
}
