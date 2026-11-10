import * as THREE from 'three';

interface CachedLimbRest {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  pivotLocalX: number;
  pivotLocalY: number;
  pivotLocalZ: number;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  pivotScratch: THREE.Vector3;
}

interface CachedJointRest {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

/**
 * Rotate a limb around its actual joint.
 * - THREE.Group rigs (the five original operators) are already authored with
 *   the shoulder/hip at the group's origin.
 * - A standalone Mesh pivots around the centre of its upper geometry bounds.
 *
 * The local pivot and one scratch vector are cached once per limb. The frame
 * update performs scalar math and mutates existing transforms only.
 */
export function setProceduralLimbPose(
  limb: THREE.Object3D | undefined | null,
  swingX: number,
  swingZ = 0,
): void {
  if (!limb) return;
  let rest = limb.userData.proceduralLimbRest as CachedLimbRest | undefined;
  if (!rest) {
    let pivotLocalX = 0;
    let pivotLocalY = 0;
    let pivotLocalZ = 0;

    const mesh = limb as THREE.Mesh;
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      if (bounds) {
        pivotLocalX = (bounds.min.x + bounds.max.x) * 0.5;
        pivotLocalY = bounds.max.y;
        pivotLocalZ = (bounds.min.z + bounds.max.z) * 0.5;
      }
    }

    // Store the joint in parent space using the authored rest orientation.
    // This prevents even a pre-rotated limb from drifting on its first pose.
    const pivotScratch = new THREE.Vector3(
      pivotLocalX * limb.scale.x,
      pivotLocalY * limb.scale.y,
      pivotLocalZ * limb.scale.z,
    ).applyEuler(limb.rotation);

    rest = {
      x: limb.position.x,
      y: limb.position.y,
      z: limb.position.z,
      rotationX: limb.rotation.x,
      rotationY: limb.rotation.y,
      rotationZ: limb.rotation.z,
      pivotLocalX,
      pivotLocalY,
      pivotLocalZ,
      pivotX: limb.position.x + pivotScratch.x,
      pivotY: limb.position.y + pivotScratch.y,
      pivotZ: limb.position.z + pivotScratch.z,
      pivotScratch: new THREE.Vector3(),
    };
    limb.userData.proceduralLimbRest = rest;
  }

  limb.rotation.set(
    rest.rotationX + swingX,
    rest.rotationY,
    rest.rotationZ + swingZ,
  );
  rest.pivotScratch
    .set(
      rest.pivotLocalX * limb.scale.x,
      rest.pivotLocalY * limb.scale.y,
      rest.pivotLocalZ * limb.scale.z,
    )
    .applyEuler(limb.rotation);
  limb.position.set(
    rest.pivotX - rest.pivotScratch.x,
    rest.pivotY - rest.pivotScratch.y,
    rest.pivotZ - rest.pivotScratch.z,
  );
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

/** Apply an additive joint pose while preserving the factory-authored rest angles. */
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
