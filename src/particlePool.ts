import * as THREE from 'three';

export type ParticleShape = 'tetrahedron' | 'octahedron' | 'box' | 'flat-box' | 'sphere';

/**
 * Reuses short-lived combat fragments instead of allocating and disposing
 * geometry/material pairs for every impact. The pool has a hard upper bound.
 */
export class ParticleMeshPool {
  private readonly geometries: Record<ParticleShape, THREE.BufferGeometry>;
  private readonly allocated = new Set<THREE.Mesh>();
  private readonly available: THREE.Mesh[] = [];
  private disposed = false;

  constructor(private readonly maxMeshes = 75) {
    if (!Number.isInteger(maxMeshes) || maxMeshes < 1) {
      throw new RangeError('ParticleMeshPool maxMeshes must be a positive integer.');
    }

    this.geometries = {
      tetrahedron: new THREE.TetrahedronGeometry(1, 0),
      octahedron: new THREE.OctahedronGeometry(1, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
      'flat-box': new THREE.BoxGeometry(1, 1, 0.375),
      sphere: new THREE.SphereGeometry(1, 6, 6),
    };
  }

  get allocatedCount(): number {
    return this.allocated.size;
  }

  get availableCount(): number {
    return this.available.length;
  }

  acquire(
    shape: ParticleShape,
    color: THREE.ColorRepresentation,
    scale = 1,
    opacity = 0.96
  ): THREE.Mesh | null {
    if (this.disposed) return null;

    let mesh = this.available.pop();
    if (!mesh) {
      if (this.allocated.size >= this.maxMeshes) return null;

      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      });
      mesh = new THREE.Mesh(this.geometries[shape], material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.allocated.add(mesh);
    }

    mesh.geometry = this.geometries[shape];
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color);
    material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(Math.max(0.001, scale));
    mesh.visible = true;
    mesh.frustumCulled = true;
    return mesh;
  }

  release(mesh: THREE.Mesh): void {
    if (this.disposed || !this.allocated.has(mesh) || this.available.includes(mesh)) return;

    mesh.removeFromParent();
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(0);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0;
    this.available.push(mesh);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const mesh of this.allocated) {
      mesh.removeFromParent();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }

    for (const geometry of Object.values(this.geometries)) geometry.dispose();
    this.available.length = 0;
    this.allocated.clear();
  }
}
