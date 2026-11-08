import * as THREE from 'three';

const MATERIAL_TEXTURE_KEYS = [
  'map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'displacementMap',
  'emissiveMap', 'metalnessMap', 'roughnessMap', 'envMap', 'lightMap',
  'specularMap', 'gradientMap', 'matcap', 'clearcoatMap',
  'clearcoatRoughnessMap', 'clearcoatNormalMap', 'sheenColorMap',
  'sheenRoughnessMap', 'iridescenceMap', 'iridescenceThicknessMap',
  'transmissionMap', 'thicknessMap',
] as const;

function collectTextures(value: unknown, textures: Set<THREE.Texture>, visited: Set<object>): void {
  if (value instanceof THREE.Texture) {
    textures.add(value);
    return;
  }
  if (!value || typeof value !== 'object') return;

  const object = value as object;
  if (visited.has(object)) return;
  visited.add(object);

  if (Array.isArray(value)) {
    for (const item of value) collectTextures(item, textures, visited);
    return;
  }
  // Shader uniforms may wrap textures in nested { value } records.
  if ('value' in object) collectTextures((object as { value?: unknown }).value, textures, visited);
}

/**
 * Dispose an owned Three.js object subtree without double-disposing shared
 * geometries, materials, or textures. Use only for PvP-created objects; do not
 * pass shared character/assets roots here.
 */
export function disposePvpObjectTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (renderable.geometry instanceof THREE.BufferGeometry) geometries.add(renderable.geometry);

    const attachedMaterials = renderable.material
      ? (Array.isArray(renderable.material) ? renderable.material : [renderable.material])
      : [];
    for (const material of attachedMaterials) {
      if (!(material instanceof THREE.Material)) continue;
      materials.add(material);
      for (const key of MATERIAL_TEXTURE_KEYS) {
        const texture = (material as unknown as Record<string, unknown>)[key];
        collectTextures(texture, textures, new Set<object>());
      }
      if (material instanceof THREE.ShaderMaterial || material instanceof THREE.RawShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          collectTextures(uniform?.value, textures, new Set<object>());
        }
      }
    }
  });

  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
