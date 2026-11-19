import * as THREE from 'three';

export type CrimsonTextureId =
  | 'b4Concrete'
  | 'portAsphalt'
  | 'coldStorage'
  | 'nightRubber'
  | 'containerSteel'
  | 'rustedSteel'
  | 'palletTimber'
  | 'hazardChevron';

const TEXTURE_PATHS: Readonly<Record<CrimsonTextureId, string>> = Object.freeze({
  b4Concrete: 'assets/crimson-textures/floors/b4-worn-concrete.svg',
  portAsphalt: 'assets/crimson-textures/floors/port-asphalt.svg',
  coldStorage: 'assets/crimson-textures/floors/cold-storage-sealed.svg',
  nightRubber: 'assets/crimson-textures/floors/night-sorter-rubber.svg',
  containerSteel: 'assets/crimson-textures/props/container-corrugated-steel.svg',
  rustedSteel: 'assets/crimson-textures/props/rusted-steel-plate.svg',
  palletTimber: 'assets/crimson-textures/props/pallet-timber.svg',
  hazardChevron: 'assets/crimson-textures/props/hazard-chevron.svg',
});

const loader = new THREE.TextureLoader();
const cache = new Map<CrimsonTextureId, Promise<THREE.Texture>>();

/**
 * Loads one of the additive Crimson material textures.
 * Color artwork is sRGB; SVG surfaces repeat without seams by design.
 */
export function loadCrimsonTexture(
  id: CrimsonTextureId,
  repeatX = 1,
  repeatY = 1,
): Promise<THREE.Texture> {
  let pending = cache.get(id);
  if (!pending) {
    const url = new URL(TEXTURE_PATHS[id], document.baseURI).href;
    pending = loader.loadAsync(url).then((texture) => {
      texture.name = 'max-flix-crimson-' + id;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      return texture;
    }).catch((error: unknown) => {
      cache.delete(id);
      throw error;
    });
    cache.set(id, pending);
  }
  return pending.then((texture) => {
    texture.repeat.set(
      Math.max(0.25, Number.isFinite(repeatX) ? repeatX : 1),
      Math.max(0.25, Number.isFinite(repeatY) ? repeatY : 1),
    );
    texture.needsUpdate = true;
    return texture;
  });
}

/**
 * Applies a Crimson albedo texture to a standard material without blocking
 * the first playable frame. A later request for another id wins safely.
 */
export function applyCrimsonTexture(
  material: THREE.MeshStandardMaterial,
  id: CrimsonTextureId,
  repeatX = 1,
  repeatY = 1,
  roughness = 0.82,
): void {
  material.userData.crimsonTextureId = id;
  void loadCrimsonTexture(id, repeatX, repeatY).then((texture) => {
    if (material.userData.crimsonTextureId !== id) return;
    material.map = texture;
    material.roughness = Math.max(0.05, Math.min(1, Number.isFinite(roughness) ? roughness : 0.82));
    material.needsUpdate = true;
  }).catch((error: unknown) => {
    console.warn('[Crimson Texture Pack] Keeping fallback material for ' + id + ':', error);
  });
}
