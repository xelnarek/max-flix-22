import * as THREE from 'three';

interface CachedLimbRest {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationZ: number;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
}

interface CachedJointRest {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

/**
 * Rotate a mesh limb around its upper joint without changing the source model.
 * Rest data is cached once in userData; the per-frame path performs scalar math
 * only and creates no vectors, matrices, geometries or materials.
 */
export function setProceduralLimbPose(
  limb: THREE.Object3D | undefined | null,
  swingX: number,
  swingZ = 0,
): void {
  if (!limb) return;
  const data = limb.userData.proceduralLimbRest as CachedLimbRest | undefined;
  let rest = data;
  if (!rest) {
    let centerX = 0;
    let topY = 0.20;
    let centerZ = 0;
    const mesh = limb as THREE.Mesh;
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      if (bounds) {
        centerX = (bounds.min.x + bounds.max.x) * 0.5;
        topY = bounds.max.y;
        centerZ = (bounds.min.z + bounds.max.z) * 0.5;
      }
    }
    rest = {
      x: limb.position.x,
      y: limb.position.y,
      z: limb.position.z,
      rotationX: limb.rotation.x,
      rotationZ: limb.rotation.z,
      pivotX: limb.position.x + centerX,
      pivotY: limb.position.y + topY,
      pivotZ: limb.position.z + centerZ,
    };
    limb.userData.proceduralLimbRest = rest;
  }

  const offsetX = rest.x - rest.pivotX;
  const offsetY = rest.y - rest.pivotY;
  const offsetZ = rest.z - rest.pivotZ;
  const cosine = Math.cos(swingX);
  const sine = Math.sin(swingX);
  limb.position.set(
    rest.pivotX + offsetX,
    rest.pivotY + offsetY * cosine - offsetZ * sine,
    rest.pivotZ + offsetY * sine + offsetZ * cosine,
  );
  limb.rotation.x = rest.rotationX + swingX;
  limb.rotation.z = rest.rotationZ + swingZ;
}

/** Add a short reaction on top of the current locomotion/attack pose. */
export function addProceduralLimbPose(
  limb: THREE.Object3D | undefined | null,
  extraX: number,
  extraZ = 0,
): void {
  if (!limb) return;
  const rest = limb.userData.proceduralLimbRest as CachedLimbRest | undefined;
  if (!rest) {
    setProceduralLimbPose(limb, extraX, extraZ);
    return;
  }
  setProceduralLimbPose(
    limb,
    limb.rotation.x - rest.rotationX + extraX,
    limb.rotation.z - rest.rotationZ + extraZ,
  );
}

/** Front-loaded hit pulse: a quick recoil with a smooth, short recovery. */
export function getProceduralHitPulse(remainingSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(remainingSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const progress = THREE.MathUtils.clamp(1 - remainingSeconds / durationSeconds, 0, 1);
  const impact = Math.sin(Math.min(1, progress / 0.44) * Math.PI * 0.5);
  return impact * Math.pow(1 - progress, 0.65);
}

/** Apply an additive joint pose while preserving the factory-authored rest angle. */
export function setProceduralJointRotation(
  joint: THREE.Object3D | undefined | null,
  x = 0,
  y = 0,
  z = 0,
): void {
  if (!joint) return;
  const data = joint.userData.proceduralJointRest as CachedJointRest | undefined;
  const rest = data || {
    rotationX: joint.rotation.x,
    rotationY: joint.rotation.y,
    rotationZ: joint.rotation.z,
  };
  if (!data) joint.userData.proceduralJointRest = rest;
  joint.rotation.set(rest.rotationX + x, rest.rotationY + y, rest.rotationZ + z);
}
