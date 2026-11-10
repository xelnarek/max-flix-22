import * as THREE from 'three';

interface PolyHavenMapFile { file: string; bytes: number; sha256: string; source: string }
interface PolyHavenAssetFiles { role: string; resolution: string; maps: { diffuse?: PolyHavenMapFile; normal?: PolyHavenMapFile; arm?: PolyHavenMapFile } }
interface PolyHavenManifest { assets: Record<string, PolyHavenAssetFiles> }

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, Promise<THREE.Texture>>();
let manifestPromise: Promise<PolyHavenManifest> | null = null;
const warnedAssets = new Set<string>();

function readManifest(): Promise<PolyHavenManifest> {
  if (!manifestPromise) {
    const url = new URL('assets/polyhaven/manifest.json', document.baseURI).href;
    manifestPromise = fetch(url).then((response) => {
      if (!response.ok) throw new Error('Poly Haven PBR manifest HTTP ' + response.status);
      return response.json() as Promise<PolyHavenManifest>;
    });
  }
  return manifestPromise;
}

function loadPbrTexture(file: string): Promise<THREE.Texture> {
  let pending = textureCache.get(file);
  if (!pending) {
    const url = new URL(file, document.baseURI).href;
    pending = textureLoader.loadAsync(url).catch((error: unknown) => {
      textureCache.delete(file);
      throw error;
    });
    textureCache.set(file, pending);
  }
  return pending;
}

/**
 * Replace a generated placeholder surface with real CC0 Poly Haven PBR maps.
 * Textures are cached for the app lifetime and shared by repeated rack/floor meshes.
 */
export function applyPolyHavenPbrMaps(
  material: THREE.MeshStandardMaterial,
  assetId: string,
  repeatX = 1,
  repeatY = 1,
  normalStrength = 0.55,
): void {
  material.userData.polyHavenAssetId = assetId;
  void readManifest().then(async (manifest) => {
    const files = manifest.assets?.[assetId];
    if (!files?.maps?.diffuse || !files.maps.normal || !files.maps.arm) {
      throw new Error('Missing required PBR maps for ' + assetId);
    }
    const [diffuse, normal, arm] = await Promise.all([
      loadPbrTexture(files.maps.diffuse.file),
      loadPbrTexture(files.maps.normal.file),
      loadPbrTexture(files.maps.arm.file),
    ]);
    if (material.userData.polyHavenAssetId !== assetId) return;

    const configure = (texture: THREE.Texture, colorSpace: THREE.ColorSpace) => {
      texture.colorSpace = colorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(Math.max(0.25, repeatX), Math.max(0.25, repeatY));
      texture.anisotropy = Math.max(texture.anisotropy, 4);
      texture.needsUpdate = true;
    };
    configure(diffuse, THREE.SRGBColorSpace);
    configure(normal, THREE.NoColorSpace);
    configure(arm, THREE.NoColorSpace);

    material.map = diffuse;
    material.normalMap = normal;
    material.normalScale.set(normalStrength, normalStrength);
    // Poly Haven's ARM texture packs AO in R, roughness in G and metalness in B.
    material.roughnessMap = arm;
    material.metalnessMap = arm;
    material.bumpMap = null;
    material.needsUpdate = true;
  }).catch((error: unknown) => {
    if (!warnedAssets.has(assetId)) {
      warnedAssets.add(assetId);
      console.warn('[PolyHaven] Using procedural fallback for ' + assetId + ':', error);
    }
  });
}
