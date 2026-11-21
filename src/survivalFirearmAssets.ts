import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type SurvivalFirearmAssetArchetype =
  | 'pistol'
  | 'smg'
  | 'rifle'
  | 'shotgun'
  | 'heavy-rifle'
  | 'rocket'
  | 'plasma'
  | 'gauss'
  | 'grenade';

export interface SurvivalFirearmAssetDefinition {
  readonly file: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly label: string;
  readonly maxDimension: number;
  readonly license: 'CC0-1.0';
  readonly animated: boolean;
}

/**
 * Curated models are intentionally small, self-contained GLBs.
 * Minigun and flamethrower remain on the bespoke procedural builder: no external
 * model in the selected sets matched their rotary barrel / fuel-tank silhouette.
 */
export const SURVIVAL_FIREARM_ASSETS: Readonly<
  Record<SurvivalFirearmAssetArchetype, SurvivalFirearmAssetDefinition>
> = Object.freeze({
  pistol: {
    file: 'pistol.glb',
    sourceId: 'fps-compact-pistol-19430',
    sourceUrl: 'https://cdn.3dassets.dev/assets/19430/v1/model.glb',
    label: 'Compact pistol · FPS Guns and Shooting Range',
    maxDimension: 0.62,
    license: 'CC0-1.0',
    animated: true,
  },
  smg: {
    file: 'smg.glb',
    sourceId: 'fps-compact-smg-19433',
    sourceUrl: 'https://cdn.3dassets.dev/assets/19433/v1/model.glb',
    label: 'Compact submachine gun · FPS Guns and Shooting Range',
    maxDimension: 0.84,
    license: 'CC0-1.0',
    animated: true,
  },
  rifle: {
    file: 'rifle.glb',
    sourceId: 'fps-assault-carbine-19436',
    sourceUrl: 'https://cdn.3dassets.dev/assets/19436/v1/model.glb',
    label: 'Assault carbine · FPS Guns and Shooting Range',
    maxDimension: 0.96,
    license: 'CC0-1.0',
    animated: true,
  },
  shotgun: {
    file: 'shotgun.glb',
    sourceId: 'fps-pump-shotgun-19439',
    sourceUrl: 'https://cdn.3dassets.dev/assets/19439/v1/model.glb',
    label: 'Pump shotgun · FPS Guns and Shooting Range',
    maxDimension: 0.98,
    license: 'CC0-1.0',
    animated: true,
  },
  'heavy-rifle': {
    file: 'heavy-rifle.glb',
    sourceId: 'fps-battle-rifle-19437',
    sourceUrl: 'https://cdn.3dassets.dev/assets/19437/v1/model.glb',
    label: 'Battle rifle · FPS Guns and Shooting Range',
    maxDimension: 1.04,
    license: 'CC0-1.0',
    animated: true,
  },
  rocket: {
    file: 'rocket.glb',
    sourceId: 'arena-rocket-launcher-23139',
    sourceUrl: 'https://cdn.3dassets.dev/assets/23139/v1/model.glb',
    label: 'Rocket Launcher Pickup · Arena Shooter Map Kit',
    maxDimension: 0.98,
    license: 'CC0-1.0',
    animated: false,
  },
  plasma: {
    file: 'plasma.glb',
    sourceId: 'arena-plasma-gun-23143',
    sourceUrl: 'https://cdn.3dassets.dev/assets/23143/v1/model.glb',
    label: 'Plasma Gun Pickup · Arena Shooter Map Kit',
    maxDimension: 0.92,
    license: 'CC0-1.0',
    animated: false,
  },
  gauss: {
    file: 'gauss.glb',
    sourceId: 'arena-rail-gun-23142',
    sourceUrl: 'https://cdn.3dassets.dev/assets/23142/v1/model.glb',
    label: 'Rail Gun Pickup · Arena Shooter Map Kit',
    maxDimension: 1.08,
    license: 'CC0-1.0',
    animated: false,
  },
  grenade: {
    file: 'grenade.glb',
    sourceId: 'arena-grenade-launcher-23140',
    sourceUrl: 'https://cdn.3dassets.dev/assets/23140/v1/model.glb',
    label: 'Grenade Launcher Pickup · Arena Shooter Map Kit',
    maxDimension: 0.94,
    license: 'CC0-1.0',
    animated: false,
  },
});

export interface LoadedSurvivalFirearmAsset {
  readonly model: THREE.Group;
  readonly animations: readonly THREE.AnimationClip[];
  readonly sourceId: string;
}

type LoadedGltf = Awaited<ReturnType<GLTFLoader['loadAsync']>>;
const loader = new GLTFLoader();
const sourceCache = new Map<string, Promise<LoadedGltf | null>>();

function getSource(definition: SurvivalFirearmAssetDefinition): Promise<LoadedGltf | null> {
  let pending = sourceCache.get(definition.sourceId);
  if (!pending) {
    pending = (async () => {
      if (typeof document === 'undefined') return null;
      const url = new URL('assets/survival-firearms/' + definition.file, document.baseURI).href;
      try {
        return await loader.loadAsync(url);
      } catch (error) {
        // Keep the procedural weapon visible when dev mode is offline or an asset is missing.
        console.warn('[Firearm assets] External model unavailable; keeping procedural model:', definition.sourceId, error);
        sourceCache.delete(definition.sourceId);
        return null;
      }
    })();
    sourceCache.set(definition.sourceId, pending);
  }
  return pending;
}

function cloneWeaponScene(source: THREE.Object3D): THREE.Group {
  const clone = source.clone(true) as THREE.Group;
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    const cloneMaterial = (material: THREE.Material): THREE.Material => material.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
  });
  return clone;
}

/** Each caller receives owned geometries/materials; immutable GLTF source data stays cached. */
export async function loadSurvivalFirearmModelAsset(
  archetype: string,
): Promise<LoadedSurvivalFirearmAsset | null> {
  if (!Object.prototype.hasOwnProperty.call(SURVIVAL_FIREARM_ASSETS, archetype)) return null;
  const definition = SURVIVAL_FIREARM_ASSETS[archetype as SurvivalFirearmAssetArchetype];
  const gltf = await getSource(definition);
  if (!gltf) return null;
  return {
    model: cloneWeaponScene(gltf.scene),
    animations: gltf.animations.map((clip) => clip.clone()),
    sourceId: definition.sourceId,
  };
}
