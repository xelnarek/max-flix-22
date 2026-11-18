import * as THREE from 'three';

function isSharedGeometry(object: THREE.Object3D): boolean {
  return object.userData.gobkitSharedGeometry === true ||
    object.userData.makeHumanSharedGeometry === true ||
    object.userData.actorLodSharedGeometry === true;
}

function isSharedMaterial(material: THREE.Material): boolean {
  return material.userData.gobkitSharedMaterial === true ||
    material.userData.makeHumanShared === true ||
    material.userData.actorLodSharedMaterial === true;
}

/**
 * Dispose only resources owned by one actor instance.
 *
 * Imported Gobkit rigs share immutable geometry between SkeletonUtils clones;
 * role-kit templates also share their merged geometry/material. Disposing those
 * from a single dead enemy invalidates every surviving clone that uses them.
 */
export function disposeActorOwnedRenderResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    const isRenderable = object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points;
    if (isRenderable) {
      const renderable = object as THREE.Mesh | THREE.Line | THREE.Points;
      if (!isSharedGeometry(object) && renderable.geometry) {
        geometries.add(renderable.geometry);
      }
      const attached = renderable.material;
      const attachedMaterials = Array.isArray(attached) ? attached : [attached];
      for (const material of attachedMaterials) {
        if (material && !isSharedMaterial(material)) materials.add(material);
      }
      return;
    }

    if (object instanceof THREE.Sprite && !isSharedMaterial(object.material)) {
      materials.add(object.material);
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
