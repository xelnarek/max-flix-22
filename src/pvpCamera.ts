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

/**
 * Work out a perspective camera position that fits both arena axes.
 * In portrait the long X-axis becomes the vertical screen axis; in landscape
 * the long X-axis is horizontal. A 12% safety margin prevents edge clipping.
 */
export function calculatePvpCameraFrame(
  viewportWidth: number,
  viewportHeight: number,
  center: { x: number; z: number },
  bounds: PvpCameraBounds,
): PvpCameraFrame {
  const width = Number.isFinite(viewportWidth) ? Math.max(1, viewportWidth) : 1;
  const height = Number.isFinite(viewportHeight) ? Math.max(1, viewportHeight) : 1;
  const aspect = width / height;
  const portrait = aspect < 0.86;
  const fov = portrait ? 72 : 58;
  const verticalFovRad = fov * Math.PI / 180;
  const halfWidth = (portrait ? bounds.maxZ - bounds.minZ + 4 : bounds.maxX - bounds.minX + 4) / 2;
  const halfHeight = (portrait ? bounds.maxX - bounds.minX + 4 : bounds.maxZ - bounds.minZ + 4) / 2;
  const halfHorizontalFov = Math.atan(Math.tan(verticalFovRad / 2) * aspect);
  const horizontalFitDistance = halfWidth / Math.max(0.02, Math.tan(halfHorizontalFov));
  const verticalFitDistance = Math.sqrt(
    Math.max(0, halfHeight) * (portrait ? 27.5 : 24) /
    Math.max(0.02, Math.tan(verticalFovRad / 2)),
  );
  const fitDistance = Math.max(horizontalFitDistance, verticalFitDistance) * 1.12;
  const cameraHeight = portrait ? 27.5 : 24;
  const horizontalOffset = Math.sqrt(Math.max(4, fitDistance * fitDistance - cameraHeight * cameraHeight));
  const cx = Number.isFinite(center.x) ? center.x : 0;
  const cz = Number.isFinite(center.z) ? center.z : 0;
  const target = { x: cx, y: 0.5, z: cz };
  const position = portrait
    ? { x: cx + horizontalOffset, y: target.y + cameraHeight, z: cz }
    : { x: cx, y: target.y + cameraHeight, z: cz + horizontalOffset };
  const visibleWidth = fitDistance * Math.tan(halfHorizontalFov) * 2;
  return { portrait, aspect, fov, position, target, fitDistance, visibleWidth, requiredWidth: halfWidth * 2 };
}
