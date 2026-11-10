import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';
import type { CharacterId, EnemyType } from './types.ts';

export type MakeHumanStyleId =
  | 'manager' | 'fireChief' | 'stockClerk' | 'baggageHandler' | 'security'
  | 'casual' | 'office' | 'sales' | 'courier' | 'inspector' | 'technician' | 'warehouse';

type EquipmentId = 'helmet' | 'vest' | 'radio' | 'badge' | 'scanner' | 'clipboard' | 'parcel' | 'toolBelt' | 'earpiece';

interface MakeHumanStyle {
  top: 'shirt' | 'tshirt' | 'jacket' | 'hoodie';
  footwear: 'shoes' | 'boots';
  hair: 'short02' | 'short04' | 'bob02';
  colors: { skin: string; top: string; bottom: string; footwear: string; hair: string };
  morphs: Readonly<Record<string, number>>;
  equipment: readonly EquipmentId[];
  helmetColor?: 'yellow' | 'orange' | 'green';
}

const STYLES: Readonly<Record<MakeHumanStyleId, MakeHumanStyle>> = Object.freeze({
  manager: {
    top: 'shirt', footwear: 'boots', hair: 'short02',
    colors: { skin: '#b98769', top: '#293b4d', bottom: '#35404b', footwear: '#252b32', hair: '#2a211e' },
    morphs: { gender: 1, age: 0.24, weight: 0.15, muscle: 0.10, proportions: 0.18, jawWidth: 0.18, cheekbones: 0.08, noseWidth: 0.04 },
    equipment: ['badge', 'radio', 'clipboard'],
  },
  fireChief: {
    top: 'jacket', footwear: 'boots', hair: 'short02',
    colors: { skin: '#c18f70', top: '#28533d', bottom: '#303d48', footwear: '#1f292d', hair: '#30241f' },
    morphs: { gender: 1, age: 0.05, weight: 0.20, muscle: 0.82, proportions: 0.24, jawWidth: 0.16, chin: 0.12 },
    equipment: ['helmet', 'vest', 'radio', 'toolBelt'],
    helmetColor: 'green',
  },
  stockClerk: {
    top: 'tshirt', footwear: 'shoes', hair: 'short04',
    colors: { skin: '#c99b7d', top: '#315c87', bottom: '#34465a', footwear: '#30363d', hair: '#332720' },
    morphs: { gender: 1, age: -0.02, weight: -0.18, muscle: -0.05, height: 0.08, noseWidth: -0.12, cheekbones: 0.10 },
    equipment: ['vest', 'radio', 'scanner', 'badge'],
  },
  baggageHandler: {
    top: 'hoodie', footwear: 'boots', hair: 'short02',
    colors: { skin: '#bb8e70', top: '#59664b', bottom: '#303b46', footwear: '#242c30', hair: '#29221e' },
    morphs: { gender: 1, age: 0.04, weight: 0.10, muscle: 0.18, height: 0.18, jawWidth: 0.06 },
    equipment: ['helmet', 'vest', 'radio', 'toolBelt'],
    helmetColor: 'yellow',
  },
  security: {
    top: 'jacket', footwear: 'boots', hair: 'short04',
    colors: { skin: '#c39a7c', top: '#252e3b', bottom: '#252f3d', footwear: '#171e26', hair: '#211d1b' },
    morphs: { gender: 1, age: 0.31, weight: 0.06, muscle: 0.18, jawWidth: 0.17, chin: 0.12, eyeTilt: -0.08 },
    equipment: ['badge', 'radio', 'earpiece', 'toolBelt'],
  },
  casual: {
    top: 'tshirt', footwear: 'shoes', hair: 'bob02',
    colors: { skin: '#c69a7d', top: '#77736a', bottom: '#414b59', footwear: '#343a40', hair: '#382a24' },
    morphs: { gender: 1, age: -0.04, weight: 0.02, muscle: -0.08, proportions: -0.10, noseLength: 0.08 },
    equipment: [],
  },
  office: {
    top: 'shirt', footwear: 'shoes', hair: 'short04',
    colors: { skin: '#c49b7e', top: '#555e69', bottom: '#3a4653', footwear: '#242b31', hair: '#28221e' },
    morphs: { gender: 1, age: 0.16, weight: -0.02, muscle: -0.08, jawWidth: -0.10, noseWidth: 0.08, forehead: 0.08 },
    equipment: ['badge'],
  },
  sales: {
    top: 'shirt', footwear: 'shoes', hair: 'bob02',
    colors: { skin: '#bd9275', top: '#5a3447', bottom: '#303b49', footwear: '#252b31', hair: '#39261f' },
    morphs: { gender: 1, age: 0.08, weight: 0.04, muscle: -0.10, cheekbones: 0.14, lips: 0.08, eyeSize: 0.06 },
    equipment: ['badge'],
  },
  courier: {
    top: 'hoodie', footwear: 'boots', hair: 'short02',
    colors: { skin: '#b98568', top: '#9a562f', bottom: '#35404c', footwear: '#242a30', hair: '#30241e' },
    morphs: { gender: 1, age: 0.02, weight: -0.12, muscle: 0.08, height: 0.16, jawWidth: 0.04 },
    equipment: ['parcel', 'radio'],
  },
  inspector: {
    top: 'jacket', footwear: 'boots', hair: 'short02',
    colors: { skin: '#c69a7b', top: '#ad852c', bottom: '#303c49', footwear: '#292d32', hair: '#332720' },
    morphs: { gender: 1, age: 0.14, weight: 0.10, muscle: 0.08, jawWidth: 0.08, noseWidth: 0.05 },
    equipment: ['helmet', 'vest', 'radio', 'clipboard', 'badge'],
    helmetColor: 'orange',
  },
  technician: {
    top: 'hoodie', footwear: 'boots', hair: 'short04',
    colors: { skin: '#b98a6c', top: '#4f5962', bottom: '#343e49', footwear: '#242a2e', hair: '#27211d' },
    morphs: { gender: 1, age: 0.06, weight: 0.02, muscle: 0.16, proportions: 0.12, chin: 0.08 },
    equipment: ['helmet', 'radio', 'toolBelt'],
    helmetColor: 'yellow',
  },
  warehouse: {
    top: 'tshirt', footwear: 'boots', hair: 'short02',
    colors: { skin: '#c19273', top: '#536052', bottom: '#344251', footwear: '#202830', hair: '#2c241e' },
    morphs: { gender: 1, age: 0.10, weight: 0.06, muscle: 0.14, height: 0.08 },
    equipment: ['vest', 'radio', 'toolBelt'],
  },
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
  handlowiec: 'sales',
  inspector: 'inspector',
  serwisant: 'technician',
  monter: 'warehouse',
  sztaplar_szalony: 'warehouse',
});

export interface MakeHumanActorVisual {
  root: THREE.Group;
  clips: THREE.AnimationClip[];
  style: MakeHumanStyleId;
  usesSharedGeometry: true;
}

type LoadedGltf = Awaited<ReturnType<GLTFLoader['loadAsync']>>;
interface JointSidecar {
  bones: Record<string, [number, number, number]>;
  morphs: Record<string, Record<string, [number, number, number]>>;
}
interface SkeletonRestState {
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  boneIndices: Map<THREE.Object3D, number>;
  restPositions: THREE.Vector3[];
  rootSpaceMatrices: THREE.Matrix4[];
  rootSpaceInverse: THREE.Matrix4[];
  originalInverses: THREE.Matrix4[];
  parentToLocal: THREE.Matrix4[];
}

const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<LoadedGltf>>();
let jointsPromise: Promise<JointSidecar> | null = null;

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

function validateMakeHumanSidecar(sidecar: JointSidecar): JointSidecar {
  const boneNames = Object.keys(sidecar?.bones || {});
  const morphNames = Object.keys(sidecar?.morphs || {});
  if (boneNames.length < 50 || morphNames.length < 50) {
    throw new Error('MakeHuman joint sidecar does not contain the complete 53-bone / morph-offset set.');
  }
  for (const name of ['Root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'thigh_l', 'calf_l', 'foot_l']) {
    const point = sidecar.bones[name];
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) {
      throw new Error('MakeHuman joint sidecar has an invalid rest position: ' + name);
    }
  }
  const knownBones = new Set(boneNames);
  for (const [morphName, offsets] of Object.entries(sidecar.morphs)) {
    if (!offsets || typeof offsets !== 'object') throw new Error('Invalid MakeHuman morph offsets: ' + morphName);
    for (const [boneName, offset] of Object.entries(offsets)) {
      if (!knownBones.has(boneName)) throw new Error('Morph ' + morphName + ' references an unknown rest bone: ' + boneName);
      if (!Array.isArray(offset) || offset.length !== 3 || !offset.every(Number.isFinite)) {
        throw new Error('Morph ' + morphName + ' has an invalid rest offset for ' + boneName);
      }
    }
  }
  return sidecar;
}

function loadJointSidecar(): Promise<JointSidecar> {
  if (!jointsPromise) {
    const url = new URL('assets/makehuman/base_body.joints.json', document.baseURI).href;
    jointsPromise = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error('MakeHuman joint sidecar HTTP ' + response.status);
      return validateMakeHumanSidecar(await response.json() as JointSidecar);
    }).catch((error: unknown) => {
      jointsPromise = null;
      throw error;
    });
  }
  return jointsPromise;
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

function buildMorphInfluences(style: MakeHumanStyle, sidecar: JointSidecar): Record<string, number> {
  const values = style.morphs;
  const controls: Array<[string, string, string, number]> = [
    ['gender', 'gender_female', 'gender_male', 1],
    ['age', 'age_child', 'age_old', 1],
    ['height', 'height_short', 'height_tall', 0.45],
    ['weight', 'weight_min', 'weight_max', 1],
    ['muscle', 'muscle_min', 'muscle_max', 1],
    ['proportions', 'proportions_uncommon', 'proportions_ideal', 1],
    ['noseWidth', 'face_nose_width_decr', 'face_nose_width_incr', 1],
    ['noseLength', 'face_nose_length_decr', 'face_nose_length_incr', 1],
    ['jawWidth', 'face_jaw_width_decr', 'face_jaw_width_incr', 1],
    ['chin', 'face_chin_decr', 'face_chin_incr', 1],
    ['cheekbones', 'face_cheekbones_decr', 'face_cheekbones_incr', 1],
    ['eyeSize', 'face_eye_size_decr', 'face_eye_size_incr', 0.7],
    ['eyeTilt', 'face_eye_tilt_decr', 'face_eye_tilt_incr', 1],
    ['forehead', 'face_forehead_decr', 'face_forehead_incr', 0.6],
    ['lips', 'face_lips_decr', 'face_lips_incr', 1],
  ];
  const influences: Record<string, number> = {};
  for (const [id, negative, positive, scale] of controls) {
    const value = THREE.MathUtils.clamp(Number(values[id] ?? (id === 'gender' ? 1 : 0)), -1, 1);
    influences[negative] = value < 0 ? -value * scale : 0;
    influences[positive] = value > 0 ? value * scale : 0;
  }
  // Corrective shape targets are the product of the two source slider influences.
  for (const name of Object.keys(sidecar.morphs)) {
    if (!name.startsWith('corr_')) continue;
    const [first, second] = name.slice(5).split('__');
    if (first && second) influences[name] = (influences[first] || 0) * (influences[second] || 0);
  }
  return influences;
}

function captureSkeletonRestState(mesh: THREE.SkinnedMesh, root: THREE.Object3D): SkeletonRestState {
  const skeleton = mesh.skeleton;
  const rootInverse = root.matrixWorld.clone().invert();
  const bones = skeleton.bones;
  const rootSpaceMatrices = bones.map((bone) => rootInverse.clone().multiply(bone.matrixWorld));
  const rootSpaceInverse = rootSpaceMatrices.map((matrix) => matrix.clone().invert());
  const parentToLocal = bones.map((bone) => {
    if (!bone.parent) return new THREE.Matrix4();
    const parentSpace = rootInverse.clone().multiply(bone.parent.matrixWorld);
    parentSpace.setPosition(0, 0, 0);
    return parentSpace.invert();
  });
  return {
    mesh,
    bones,
    boneIndices: new Map(bones.map((bone, index) => [bone, index])),
    restPositions: bones.map((bone) => bone.position.clone()),
    rootSpaceMatrices,
    rootSpaceInverse,
    originalInverses: skeleton.boneInverses.map((matrix) => matrix.clone()),
    parentToLocal,
  };
}

function applyMorphsAndJointOffsets(root: THREE.Group, sidecar: JointSidecar, influences: Record<string, number>): void {
  root.updateMatrixWorld(true);
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    skinnedMeshes.push(object);
    const dictionary = object.morphTargetDictionary;
    const values = object.morphTargetInfluences;
    if (!dictionary || !values) return;
    for (const [name, weight] of Object.entries(influences)) {
      const index = dictionary[name];
      if (index !== undefined) values[index] = weight;
    }
  });
  if (!skinnedMeshes.length) throw new Error('MakeHuman base character has no skinned meshes.');
  // Capture every mesh's bind/rest state before moving any shared bone.
  const states = skinnedMeshes.map((mesh) => captureSkeletonRestState(mesh, root));
  const deltas = states.map((state) => {
    const result = state.bones.map(() => new THREE.Vector3());
    for (const [morph, weight] of Object.entries(influences)) {
      if (!weight) continue;
      const offsets = sidecar.morphs[morph];
      if (!offsets) continue;
      for (const [boneName, offset] of Object.entries(offsets)) {
        const index = state.bones.findIndex((bone) => bone.name === boneName);
        if (index >= 0) result[index].addScaledVector(new THREE.Vector3(offset[0], offset[1], offset[2]), weight);
      }
    }
    return result;
  });

  // Every mesh uses the same body bones; writing from captured rest values avoids cumulative offsets.
  for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
    const state = states[stateIndex];
    const delta = deltas[stateIndex];
    for (let index = 0; index < state.bones.length; index++) {
      const bone = state.bones[index];
      const parentIndex = state.boneIndices.get(bone.parent || root);
      const localDelta = delta[index].clone();
      if (parentIndex !== undefined) localDelta.sub(delta[parentIndex]);
      localDelta.applyMatrix4(state.parentToLocal[index]);
      bone.position.copy(state.restPositions[index]).add(localDelta);
    }
  }

  root.updateMatrixWorld(true);
  // Rebase each mesh's own bind matrices to the same deformed rest skeleton.
  for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
    const state = states[stateIndex];
    const delta = deltas[stateIndex];
    for (let index = 0; index < state.bones.length; index++) {
      const offset = delta[index];
      const translation = new THREE.Matrix4().makeTranslation(-offset.x, -offset.y, -offset.z);
      const rebased = state.rootSpaceInverse[index].clone()
        .multiply(translation)
        .multiply(state.rootSpaceMatrices[index])
        .multiply(state.originalInverses[index]);
      state.mesh.skeleton.boneInverses[index].copy(rebased);
    }
  }
}

const SHARED_ACCESSORY_MATERIALS = (() => {
  const make = (name: string, color: number, roughness: number, metalness = 0) => {
    const material = new THREE.MeshStandardMaterial({ name, color, roughness, metalness });
    material.userData.makeHumanShared = true;
    return material;
  };
  return {
    helmetYellow: make('B4 helmet safety yellow', 0xf0bf37, 0.46),
    helmetOrange: make('B4 helmet safety orange', 0xe47b27, 0.48),
    helmetGreen: make('B4 helmet rescue green', 0x285842, 0.46),
    charcoal: make('B4 equipment charcoal polymer', 0x202b35, 0.72),
    steel: make('B4 equipment brushed steel', 0x8998a4, 0.34, 0.68),
    hiVis: make('B4 high visibility fabric', 0xd5c42a, 0.78),
    hiVisOrange: make('B4 high visibility orange', 0xe78b2b, 0.72),
    reflective: make('B4 reflective silver tape', 0xd2dfdf, 0.28, 0.22),
    badge: make('B4 staff identification card', 0x173953, 0.5, 0.15),
    badgeGold: make('B4 staff badge trim', 0xd8ad52, 0.32, 0.35),
    scanner: make('B4 barcode scanner polymer', 0x1c2731, 0.54, 0.16),
    scannerRed: make('B4 scanner laser window', 0xc94a35, 0.3, 0.12),
    clipboard: make('B4 clipboard graphite', 0x38434c, 0.56, 0.2),
    paper: make('B4 clipboard paper', 0xd9d7cc, 0.86),
    parcel: make('B4 shipping carton', 0x9a7550, 0.92),
    parcelTape: make('B4 carton tape', 0xcbb485, 0.82),
    parcelLabel: make('B4 carton label', 0xd7dbe0, 0.82),
    earpiece: make('B4 security earpiece', 0x111c26, 0.36, 0.26),
  };
})();

const SHARED_ACCESSORY_GEOMETRIES = {
  helmetCrown: new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  helmetBrim: new THREE.CylinderGeometry(0.158, 0.158, 0.018, 18),
  helmetStripe: new THREE.BoxGeometry(0.034, 0.012, 0.012),
  vestStrap: new THREE.BoxGeometry(0.042, 0.31, 0.016),
  vestBand: new THREE.BoxGeometry(0.34, 0.024, 0.014),
  badgeCard: new THREE.BoxGeometry(0.071, 0.096, 0.014),
  badgeLine: new THREE.BoxGeometry(0.044, 0.012, 0.006),
  radioBody: new THREE.BoxGeometry(0.062, 0.112, 0.034),
  radioGrille: new THREE.BoxGeometry(0.039, 0.036, 0.006),
  radioAntenna: new THREE.CylinderGeometry(0.003, 0.004, 0.072, 5),
  scannerBody: new THREE.BoxGeometry(0.052, 0.132, 0.044),
  scannerLens: new THREE.BoxGeometry(0.03, 0.018, 0.008),
  clipboardBoard: new THREE.BoxGeometry(0.16, 0.22, 0.014),
  clipboardSheet: new THREE.BoxGeometry(0.135, 0.178, 0.006),
  toolBelt: new THREE.TorusGeometry(0.164, 0.015, 6, 22),
  toolPouch: new THREE.BoxGeometry(0.082, 0.096, 0.052),
  parcelBox: new THREE.BoxGeometry(0.24, 0.27, 0.17),
  parcelTape: new THREE.BoxGeometry(0.25, 0.017, 0.18),
  parcelLabel: new THREE.BoxGeometry(0.078, 0.07, 0.008),
  earpieceLoop: new THREE.TorusGeometry(0.026, 0.0045, 5, 12),
  earpiecePod: new THREE.SphereGeometry(0.018, 8, 6),
};

function addSharedAccessory(
  root: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  rotation = new THREE.Euler(),
  parentBone?: string,
  rootSpace = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'makehuman-equipment-' + name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.makeHumanAsset = true;
  mesh.userData.makeHumanSharedGeometry = true;
  const parent = parentBone ? root.getObjectByName(parentBone) : null;

  if (parent && rootSpace) {
    // Convert the authored bind-pose root transform into bone-local space once.
    // Helmet, vest, radio, badge and carried parcels then follow skeletal motion.
    root.updateMatrixWorld(true);
    const parentInRoot = root.matrixWorld.clone().invert().multiply(parent.matrixWorld);
    const rootTransform = new THREE.Matrix4().compose(
      position,
      new THREE.Quaternion().setFromEuler(rotation),
      new THREE.Vector3(1, 1, 1),
    );
    parentInRoot.invert().multiply(rootTransform).decompose(mesh.position, mesh.quaternion, mesh.scale);
  } else {
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
  }

  (parent || root).add(mesh);
  return mesh;
}

function addRoleEquipment(root: THREE.Group, style: MakeHumanStyle): void {
  root.updateMatrixWorld(true);
  const equipment = new Set(style.equipment);
  const geo = SHARED_ACCESSORY_GEOMETRIES;
  const mat = SHARED_ACCESSORY_MATERIALS;
  if (equipment.has('helmet')) {
    const helmetMaterial = style.helmetColor === 'orange' ? mat.helmetOrange
      : style.helmetColor === 'green' ? mat.helmetGreen : mat.helmetYellow;
    addSharedAccessory(root, 'helmet-dome', geo.helmetCrown, helmetMaterial, new THREE.Vector3(0, 1.64, 0.035), new THREE.Euler(), 'head', true);
    addSharedAccessory(root, 'helmet-brim', geo.helmetBrim, helmetMaterial, new THREE.Vector3(0, 1.64, 0.035), new THREE.Euler(), 'head', true);
    addSharedAccessory(root, 'helmet-front-mark', geo.helmetStripe, mat.reflective, new THREE.Vector3(0, 1.737, 0.152), new THREE.Euler(), 'head', true);
  }
  if (equipment.has('vest')) {
    const vestMaterial = style.helmetColor === 'orange' ? mat.hiVisOrange : mat.hiVis;
    for (const side of [-1, 1]) {
      addSharedAccessory(root, 'vest-strap-' + side, geo.vestStrap, vestMaterial,
        new THREE.Vector3(side * 0.094, 1.195, 0.115), new THREE.Euler(0, 0, side * 0.24), 'spine_02', true);
      addSharedAccessory(root, 'vest-reflective-strap-' + side, geo.vestStrap, mat.reflective,
        new THREE.Vector3(side * 0.094, 1.195, 0.126), new THREE.Euler(0, 0, side * 0.24), 'spine_02', true).scale.set(0.42, 1, 1);
    }
    addSharedAccessory(root, 'vest-chest-band', geo.vestBand, mat.reflective, new THREE.Vector3(0, 1.135, 0.124), new THREE.Euler(), 'spine_02', true);
    addSharedAccessory(root, 'vest-waist-band', geo.vestBand, mat.reflective, new THREE.Vector3(0, 1.01, 0.116), new THREE.Euler(), 'spine_02', true);
  }
  if (equipment.has('radio')) {
    addSharedAccessory(root, 'radio-body', geo.radioBody, mat.charcoal, new THREE.Vector3(0.17, 1.30, 0.095), new THREE.Euler(), 'spine_02', true);
    addSharedAccessory(root, 'radio-grille', geo.radioGrille, mat.steel, new THREE.Vector3(0.17, 1.285, 0.116), new THREE.Euler(), 'spine_02', true);
    addSharedAccessory(root, 'radio-antenna', geo.radioAntenna, mat.charcoal, new THREE.Vector3(0.19, 1.395, 0.09), new THREE.Euler(0, 0, -0.16), 'spine_02', true);
  }
  if (equipment.has('badge')) {
    addSharedAccessory(root, 'staff-badge', geo.badgeCard, mat.badge, new THREE.Vector3(-0.105, 1.175, 0.132), new THREE.Euler(), 'spine_02', true);
    addSharedAccessory(root, 'staff-badge-line', geo.badgeLine, mat.badgeGold, new THREE.Vector3(-0.105, 1.198, 0.142), new THREE.Euler(), 'spine_02', true);
  }
  if (equipment.has('scanner')) {
    addSharedAccessory(root, 'hand-scanner', geo.scannerBody, mat.scanner,
      new THREE.Vector3(0.006, -0.045, 0.048), new THREE.Euler(0.16, 0.02, -0.10), 'hand_r');
    addSharedAccessory(root, 'scanner-laser', geo.scannerLens, mat.scannerRed,
      new THREE.Vector3(0.006, 0.023, 0.073), new THREE.Euler(0, 0, 0), 'hand_r');
  }
  if (equipment.has('clipboard')) {
    addSharedAccessory(root, 'clipboard-board', geo.clipboardBoard, mat.clipboard,
      new THREE.Vector3(0.035, -0.06, 0.052), new THREE.Euler(0.16, 0.04, 0.16), 'hand_l');
    addSharedAccessory(root, 'clipboard-sheet', geo.clipboardSheet, mat.paper,
      new THREE.Vector3(0.035, -0.048, 0.062), new THREE.Euler(0.16, 0.04, 0.16), 'hand_l');
  }
  if (equipment.has('parcel')) {
    addSharedAccessory(root, 'courier-parcel', geo.parcelBox, mat.parcel, new THREE.Vector3(0, 1.19, -0.16), new THREE.Euler(), 'spine_02', true);
    addSharedAccessory(root, 'courier-parcel-tape', geo.parcelTape, mat.parcelTape, new THREE.Vector3(0, 1.19, -0.16), new THREE.Euler(), 'spine_02', true);
    addSharedAccessory(root, 'courier-parcel-label', geo.parcelLabel, mat.parcelLabel, new THREE.Vector3(0, 1.20, -0.071), new THREE.Euler(), 'spine_02', true);
  }
  if (equipment.has('toolBelt')) {
    addSharedAccessory(root, 'tool-belt-loop', geo.toolBelt, mat.charcoal,
      new THREE.Vector3(0, 0.885, 0.012), new THREE.Euler(Math.PI / 2, 0, 0), 'pelvis', true);
    addSharedAccessory(root, 'tool-pouch-left', geo.toolPouch, mat.charcoal, new THREE.Vector3(0.16, 0.88, 0.068), new THREE.Euler(), 'pelvis', true);
    addSharedAccessory(root, 'tool-pouch-right', geo.toolPouch, mat.charcoal, new THREE.Vector3(-0.16, 0.88, 0.068), new THREE.Euler(), 'pelvis', true);
  }
  if (equipment.has('earpiece')) {
    addSharedAccessory(root, 'security-earpiece-loop', geo.earpieceLoop, mat.earpiece,
      new THREE.Vector3(0.115, 0.015, 0.035), new THREE.Euler(Math.PI / 2, 0, 0), 'head');
    addSharedAccessory(root, 'security-earpiece-pod', geo.earpiecePod, mat.charcoal,
      new THREE.Vector3(0.13, -0.005, 0.078), new THREE.Euler(), 'head');
  }
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
  const [loaded, sidecar] = await Promise.all([
    Promise.all(partIds.map((part) => loadAsset(part))),
    loadJointSidecar(),
  ]);
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

  const morphInfluences = buildMorphInfluences(style, sidecar);
  applyMorphsAndJointOffsets(root, sidecar, morphInfluences);
  root.updateMatrixWorld(true);

  // Normalize from the character's body bounds only. Helmets, parcels, radios and
  // other role equipment are added afterwards so equipped operators keep the same
  // body height instead of being silently scaled down by a tall accessory.
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.8) throw new Error('MakeHuman actor has invalid world bounds.');
  const target = THREE.MathUtils.clamp(Number.isFinite(targetHeight) ? targetHeight : 1.54, 1.25, 2.05);
  const scale = target / size.y;
  const center = bounds.getCenter(new THREE.Vector3());
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);

  // Equipment attaches in the fitted actor's root/bone space and therefore follows
  // the same rig, but does not participate in the body-height normalization above.
  addRoleEquipment(root, style);
  root.updateMatrixWorld(true);
  return { root, clips: loaded[0].animations, style: styleId, usesSharedGeometry: true };
}
