import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';
import type { CharacterId, EnemyType } from './types.ts';
import { ENEMY_VISUAL_PROFILES } from './enemyVisualProfiles.ts';

export type GobkitModelId =
  | 'storemanager' | 'firechief' | 'stockclerk' | 'baggagehandler' | 'securityguard'
  | 'foodcourier' | 'shoplifter' | 'salesrep' | 'officemanager' | 'hazmattech'
  | 'stitchedbrute' | 'bloodironjuggernaut' | 'nightwitch' | 'androidcommander'
  | 'werewolfcaptain' | 'forcibleentryfirefighter' | 'bloodirongrunt';

export const GOBKIT_MODEL_FILES: Readonly<Record<GobkitModelId, string>> = Object.freeze({
  storemanager: 'storemanager.glb',
  firechief: 'firechief.glb',
  stockclerk: 'stockclerk.glb',
  baggagehandler: 'baggagehandler.glb',
  securityguard: 'securityguard.glb',
  foodcourier: 'foodcourier.glb',
  shoplifter: 'shoplifter.glb',
  salesrep: 'salesrep.glb',
  officemanager: 'officemanager.glb',
  hazmattech: 'hazmattech.glb',
  stitchedbrute: 'stitchedbrute.glb',
  bloodironjuggernaut: 'bloodironjuggernaut.glb',
  nightwitch: 'nightwitch.glb',
  androidcommander: 'androidcommander.glb',
  werewolfcaptain: 'werewolfcaptain.glb',
  forcibleentryfirefighter: 'forcibleentryfirefighter.glb',
  bloodirongrunt: 'bloodirongrunt.glb',
});

export const CHARACTER_GOBKIT_MODELS: Readonly<Record<CharacterId, GobkitModelId>> = Object.freeze({
  marcin: 'storemanager',
  grzesiek: 'firechief',
  dawid: 'stockclerk',
  mateusz: 'baggagehandler',
  piotr: 'securityguard',
});

/**
 * Every humanoid/creature enemy profile points at a locally bundled, animated
 * CC0 Gobkit rig. Articulated bone-mounted kits in enemyRoleKits.ts preserve each enemy's
 * identity (architect, BHP, courier, supplier, installer, boss, undead, etc.).
 * Only purpose-built vehicles, the AGV/drone and the bicycle rider keep bespoke
 * non-humanoid meshes from warehouseAssets.ts.
 */
const enemyGobkitModelEntries = Object.entries(ENEMY_VISUAL_PROFILES)
  .flatMap(([enemyType, profile]) => profile.gobkitModel
    ? [[enemyType, profile.gobkitModel] as const]
    : []);

export const ENEMY_GOBKIT_MODELS: Readonly<Partial<Record<EnemyType, GobkitModelId>>> = Object.freeze(
  Object.fromEntries(enemyGobkitModelEntries) as Partial<Record<EnemyType, GobkitModelId>>,
);

type LoadedGobkitModel = Awaited<ReturnType<GLTFLoader['loadAsync']>>;
const loader = new GLTFLoader();
const modelCache = new Map<GobkitModelId, Promise<LoadedGobkitModel>>();

/** Loads a model once; every runtime instance is then cloned with its skeleton intact. */
export function loadGobkitModel(id: GobkitModelId): Promise<LoadedGobkitModel> {
  let pending = modelCache.get(id);
  if (!pending) {
    const url = new URL('assets/gobkit/' + GOBKIT_MODEL_FILES[id], document.baseURI).href;
    pending = loader.loadAsync(url).catch((error: unknown) => {
      modelCache.delete(id);
      throw error;
    });
    modelCache.set(id, pending);
  }
  return pending;
}

export function cloneGobkitModel(gltf: LoadedGobkitModel): THREE.Group {
  const root = cloneSkinnedScene(gltf.scene) as THREE.Group;
  // Skeletons and scene nodes are unique per actor. Immutable geometry,
  // textures and base materials stay shared; role equipment and hit effects
  // use their own materials and therefore remain actor-specific.
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.userData.gobkitAsset = true;
    object.userData.gobkitSharedGeometry = true;
    const markShared = (material: THREE.Material): THREE.Material => {
      material.userData.gobkitSharedMaterial = true;
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(markShared)
      : markShared(object.material);
  });
  return root;
}

/** Normalize mixed source heights to a stable world-space scale and ground origin. */
interface GobkitFitBounds {
  readonly minY: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly height: number;
}

const fitBoundsCache = new WeakMap<THREE.Object3D, GobkitFitBounds>();

/** Normalize mixed source heights; source bounds are cached once per loaded GLB. */
export function fitGobkitModel(
  root: THREE.Group,
  targetHeight: number,
  maxAnisotropy = 1,
  boundsSource: THREE.Object3D = root,
): void {
  boundsSource.updateMatrixWorld(true);
  let fitBounds = fitBoundsCache.get(boundsSource);
  if (!fitBounds) {
    const bounds = new THREE.Box3().setFromObject(boundsSource);
    const size = bounds.getSize(new THREE.Vector3());
    if (Number.isFinite(size.y) && size.y >= 0.01) {
      const center = bounds.getCenter(new THREE.Vector3());
      fitBounds = {
        minY: bounds.min.y,
        centerX: center.x,
        centerZ: center.z,
        height: size.y,
      };
      fitBoundsCache.set(boundsSource, fitBounds);
    }
  }

  if (!fitBounds) {
    root.scale.setScalar(1);
    return;
  }

  const target = THREE.MathUtils.clamp(Number.isFinite(targetHeight) ? targetHeight : 1.55, 0.8, 2.5);
  const scale = target / fitBounds.height;
  root.scale.setScalar(scale);
  root.position.set(
    -fitBounds.centerX * scale,
    -fitBounds.minY * scale,
    -fitBounds.centerZ * scale,
  );
  root.updateMatrixWorld(true);

  const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap'];
  const anisotropy = THREE.MathUtils.clamp(
    Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1,
    1,
    16,
  );
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) continue;
      // Shared source materials must not be flagged for shader recompilation
      // every time another horde actor is fitted.
      if (material.userData.gobkitFitConfigured !== true) {
        material.envMapIntensity = Math.min(1.2, material.envMapIntensity || 1);
        material.needsUpdate = true;
        material.userData.gobkitFitConfigured = true;
      }
      for (const slot of textureSlots) {
        const texture = (material as unknown as Record<string, unknown>)[slot];
        if (texture instanceof THREE.Texture && texture.anisotropy < anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
    }
  });
}

export function getGobkitClip(
  gltf: LoadedGobkitModel,
  clipName: 'Idle' | 'Walk' | 'Run' | 'Death' | 'Hit' | 'Attack' | 'Special',
): THREE.AnimationClip | undefined {
  return THREE.AnimationClip.findByName(gltf.animations, clipName) || undefined;
}
