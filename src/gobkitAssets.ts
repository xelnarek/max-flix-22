import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';
import type { CharacterId, EnemyType } from './types.ts';

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

export const ENEMY_GOBKIT_MODELS: Readonly<Partial<Record<EnemyType, GobkitModelId>>> = Object.freeze({
  customer: 'shoplifter',
  architect: 'officemanager',
  kurier: 'foodcourier',
  handlowiec: 'salesrep',
  inspector: 'hazmattech',
  serwisant: 'forcibleentryfirefighter',
  monter: 'forcibleentryfirefighter',
  zombie_pracownik: 'stitchedbrute',
  sztaplar_szalony: 'baggagehandler',
  elite_walczak_guard: 'securityguard',
  mutant_gamma_forklift: 'bloodironjuggernaut',
  radioactive_pip: 'nightwitch',
  cyber_salesman: 'androidcommander',
  walczak: 'werewolfcaptain',
  krol_leto: 'bloodironjuggernaut',
  bosman_krakow: 'bloodirongrunt',
});

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
  // Geometry/material instances are local to this actor so normal despawn and
  // character-switch cleanup cannot invalidate a different copy's rig. Texture
  // maps stay shared through the cached GLTF to keep GPU memory predictable.
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
    object.userData.gobkitAsset = true;
  });
  return root;
}

/** Normalize mixed source heights to a stable world-space scale and ground origin. */
export function fitGobkitModel(root: THREE.Group, targetHeight: number, maxAnisotropy = 1): void {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.01) {
    root.scale.setScalar(1);
    return;
  }

  const target = THREE.MathUtils.clamp(Number.isFinite(targetHeight) ? targetHeight : 1.55, 0.8, 2.5);
  const scale = target / size.y;
  const center = bounds.getCenter(new THREE.Vector3());
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap'];
    const anisotropy = THREE.MathUtils.clamp(
      Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1,
      1,
      16,
    );
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
        material.envMapIntensity = Math.min(1.2, material.envMapIntensity || 1);
        for (const slot of textureSlots) {
          const texture = (material as unknown as Record<string, unknown>)[slot];
          if (texture instanceof THREE.Texture && texture.anisotropy < anisotropy) {
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
          }
        }
        material.needsUpdate = true;
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
