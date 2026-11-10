import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';
import type { CharacterId, EnemyType } from './types.ts';

export type MakeHumanStyleId =
  | 'manager' | 'fireChief' | 'stockClerk' | 'baggageHandler' | 'security'
  | 'casual' | 'office' | 'courier' | 'inspector' | 'technician' | 'warehouse';

interface MakeHumanStyle {
  top: 'shirt' | 'tshirt' | 'jacket' | 'hoodie';
  footwear: 'shoes' | 'boots';
  hair: 'short02' | 'short04' | 'bob02';
  colors: { skin: string; top: string; bottom: string; footwear: string; hair: string };
}

const STYLES: Readonly<Record<MakeHumanStyleId, MakeHumanStyle>> = Object.freeze({
  manager: { top: 'shirt', footwear: 'boots', hair: 'short02', colors: { skin: '#b98769', top: '#293b4d', bottom: '#35404b', footwear: '#252b32', hair: '#2a211e' } },
  fireChief: { top: 'jacket', footwear: 'boots', hair: 'short02', colors: { skin: '#c18f70', top: '#28533d', bottom: '#303d48', footwear: '#1f292d', hair: '#30241f' } },
  stockClerk: { top: 'tshirt', footwear: 'shoes', hair: 'short04', colors: { skin: '#c99b7d', top: '#315c87', bottom: '#34465a', footwear: '#30363d', hair: '#332720' } },
  baggageHandler: { top: 'hoodie', footwear: 'boots', hair: 'short02', colors: { skin: '#bb8e70', top: '#59664b', bottom: '#303b46', footwear: '#242c30', hair: '#29221e' } },
  security: { top: 'jacket', footwear: 'boots', hair: 'short04', colors: { skin: '#c39a7c', top: '#252e3b', bottom: '#252f3d', footwear: '#171e26', hair: '#211d1b' } },
  casual: { top: 'tshirt', footwear: 'shoes', hair: 'bob02', colors: { skin: '#c69a7d', top: '#77736a', bottom: '#414b59', footwear: '#343a40', hair: '#382a24' } },
  office: { top: 'shirt', footwear: 'shoes', hair: 'short04', colors: { skin: '#c49b7e', top: '#555e69', bottom: '#3a4653', footwear: '#242b31', hair: '#28221e' } },
  courier: { top: 'hoodie', footwear: 'boots', hair: 'short02', colors: { skin: '#b98568', top: '#9a562f', bottom: '#35404c', footwear: '#242a30', hair: '#30241e' } },
  inspector: { top: 'jacket', footwear: 'boots', hair: 'short02', colors: { skin: '#c69a7b', top: '#ad852c', bottom: '#303c49', footwear: '#292d32', hair: '#332720' } },
  technician: { top: 'hoodie', footwear: 'boots', hair: 'short04', colors: { skin: '#b98a6c', top: '#4f5962', bottom: '#343e49', footwear: '#242a2e', hair: '#27211d' } },
  warehouse: { top: 'tshirt', footwear: 'boots', hair: 'short02', colors: { skin: '#c19273', top: '#536052', bottom: '#344251', footwear: '#202830', hair: '#2c241e' } },
});

export const MAKEHUMAN_OPERATOR_STYLES: Readonly<Record<CharacterId, MakeHumanStyleId>> = Object.freeze({
  marcin: 'manager',
  grzesiek: 'fireChief',
  dawid: 'stockClerk',
  mateusz: 'baggageHandler',
  piotr: 'security',
});

export const MAKEHUMAN_ENEMY_STYLES: Readonly<Partial<Record<EnemyType, MakeHumanStyleId>>> = Object.freeze({
  customer: 'casual',
  architect: 'office',
  kurier: 'courier',
  handlowiec: 'office',
  inspector: 'inspector',
  serwisant: 'technician',
  monter: 'technician',
  sztaplar_szalony: 'warehouse',
});

export interface MakeHumanActorVisual {
  root: THREE.Group;
  clips: THREE.AnimationClip[];
  style: MakeHumanStyleId;
  usesSharedGeometry: true;
}

type LoadedGltf = Awaited<ReturnType<GLTFLoader['loadAsync']>>;
const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<LoadedGltf>>();

function assetFilename(part: string): string {
  if (part === 'body') return 'base_body_anim.glb';
  if (['shirt', 'tshirt', 'hoodie', 'jacket', 'jeans', 'shoes', 'boots'].includes(part)) return 'clothing_' + part + '.glb';
  if (['short02', 'short04', 'bob02'].includes(part)) return 'hair_' + part + '.glb';
  throw new Error('Unknown MakeHuman asset part: ' + part);
}

function loadAsset(part: string): Promise<LoadedGltf> {
  const filename = assetFilename(part);
  let pending = modelCache.get(filename);
  if (!pending) {
    const url = new URL('assets/makehuman/' + filename, document.baseURI).href;
    pending = loader.loadAsync(url).catch((error: unknown) => {
      modelCache.delete(filename);
      throw error;
    });
    modelCache.set(filename, pending);
  }
  return pending;
}

function cloneActorMaterials(root: THREE.Object3D, tint: string, role: string, tintSkinOnly = false): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const cloned = source.map((entry) => {
      const material = entry.clone();
      const name = material.name.toLowerCase();
      const colorMaterial = material as THREE.Material & { color?: THREE.Color; roughness?: number };
      if (!tintSkinOnly || name.includes('skin') || name.includes('body')) colorMaterial.color?.set(tint);
      if (typeof colorMaterial.roughness === 'number') colorMaterial.roughness = Math.max(0.58, colorMaterial.roughness);
      material.userData.makeHumanPart = role;
      material.needsUpdate = true;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          value.anisotropy = Math.max(value.anisotropy, 4);
          value.needsUpdate = true;
        }
      }
      return material;
    });
    object.material = Array.isArray(object.material) ? cloned : cloned[0];
    object.userData.makeHumanAsset = true;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function getBodySkeleton(root: THREE.Object3D): THREE.Skeleton {
  let skeleton: THREE.Skeleton | null = null;
  root.traverse((object) => {
    if (!skeleton && object instanceof THREE.SkinnedMesh) skeleton = object.skeleton;
  });
  if (!skeleton) throw new Error('MakeHuman base GLB does not contain a skinned mesh.');
  return skeleton;
}

function transferWearableMeshes(
  bodyRoot: THREE.Group,
  sourceGltf: LoadedGltf,
  bodySkeleton: THREE.Skeleton,
  tint: string,
  role: string,
): void {
  const partRoot = cloneSkinnedScene(sourceGltf.scene) as THREE.Group;
  partRoot.updateMatrixWorld(true);
  const inversePartRoot = partRoot.matrixWorld.clone().invert();
  const bodyBones = new Map(bodySkeleton.bones.map((bone) => [bone.name, bone]));
  const bodyHead = bodyBones.get('head');
  const meshes: THREE.Mesh[] = [];
  partRoot.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });

  let transferred = 0;
  for (const mesh of meshes) {
    const sourceMatrix = mesh.matrixWorld.clone();
    let target: THREE.Object3D = bodyRoot;
    let relativeMatrix = inversePartRoot.clone().multiply(sourceMatrix);

    if (mesh instanceof THREE.SkinnedMesh) {
      const mappedBones = mesh.skeleton.bones.map((bone) => {
        const mapped = bodyBones.get(bone.name);
        if (!mapped) throw new Error('MakeHuman wearable uses an unknown bone: ' + bone.name);
        return mapped;
      });
      const sharedSkeleton = new THREE.Skeleton(
        mappedBones,
        mesh.skeleton.boneInverses.map((matrix) => matrix.clone()),
      );
      mesh.bind(sharedSkeleton, mesh.bindMatrix.clone());
    } else {
      let ancestor = mesh.parent;
      while (ancestor && ancestor !== partRoot && ancestor.name.toLowerCase() !== 'head') ancestor = ancestor.parent;
      if (ancestor?.name.toLowerCase() === 'head' && bodyHead) {
        relativeMatrix = ancestor.matrixWorld.clone().invert().multiply(sourceMatrix);
        target = bodyHead;
      }
    }

    mesh.removeFromParent();
    target.add(mesh);
    relativeMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);

    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sourceMaterials.map((source) => {
      const material = source.clone();
      const colorMaterial = material as THREE.Material & { color?: THREE.Color; roughness?: number };
      colorMaterial.color?.set(tint);
      if (typeof colorMaterial.roughness === 'number') colorMaterial.roughness = Math.max(0.62, colorMaterial.roughness);
      material.userData.makeHumanPart = role;
      material.needsUpdate = true;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          value.anisotropy = Math.max(value.anisotropy, 4);
          value.needsUpdate = true;
        }
      }
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.userData.makeHumanAsset = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    transferred++;
  }
  if (!transferred) throw new Error('MakeHuman wearable contains no transferable mesh: ' + role);
}

export async function createMakeHumanActor(styleId: MakeHumanStyleId, targetHeight = 1.54): Promise<MakeHumanActorVisual> {
  const style = STYLES[styleId];
  if (!style) throw new Error('Unknown MakeHuman style: ' + styleId);
  const partIds = ['body', style.top, 'jeans', style.footwear, style.hair];
  const loaded = await Promise.all(partIds.map((part) => loadAsset(part)));
  const root = cloneSkinnedScene(loaded[0].scene) as THREE.Group;
  root.name = 'makehuman-' + styleId;
  const bodySkeleton = getBodySkeleton(root);
  cloneActorMaterials(root, style.colors.skin, 'body', true);

  for (let index = 1; index < loaded.length; index++) {
    const part = partIds[index];
    const role = part === style.top ? 'top' : part === 'jeans' ? 'bottom' : part === style.footwear ? 'footwear' : 'hair';
    const tint = role === 'top' ? style.colors.top
      : role === 'bottom' ? style.colors.bottom
        : role === 'footwear' ? style.colors.footwear : style.colors.hair;
    transferWearableMeshes(root, loaded[index], bodySkeleton, tint, role);
  }

  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.8) throw new Error('MakeHuman actor has invalid world bounds.');
  const target = THREE.MathUtils.clamp(Number.isFinite(targetHeight) ? targetHeight : 1.54, 1.25, 2.05);
  const scale = target / size.y;
  const center = bounds.getCenter(new THREE.Vector3());
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);
  return { root, clips: loaded[0].animations, style: styleId, usesSharedGeometry: true };
}
