import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENEMY_ROLE_KIT_TYPES, createEnemyRoleKit } from '../src/enemyRoleKits.ts';
import { ENEMY_VISUAL_PROFILES } from '../src/enemyVisualProfiles.ts';
import {
  applyEnemyRoleAnatomy,
  applyEnemyRoleSecondaryMotion,
  clearEnemyRoleSecondaryMotion,
  getEnemyAnatomyProfile,
} from '../src/enemyAnimationPolish.ts';

function makeRig() {
  const root = new THREE.Group();
  const bones = new Map();
  for (const name of ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine2', 'mixamorigHead', 'mixamorigRightArm']) {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
    bones.set(name, bone);
  }
  return { root, bones };
}

function geometrySignature(root) {
  const counts = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.actorRoleSilhouette === true) {
      counts.push(object.geometry.getAttribute('position').count);
    }
  });
  return counts.sort((a, b) => a - b).join(',');
}

test('all 19 humanoid and creature enemy roles have a dedicated authored geometry kit', () => {
  const expected = Object.keys(ENEMY_VISUAL_PROFILES)
    .filter((type) => !['forklift', 'agv_robot', 'piorun_dron', 'pomazaniec'].includes(type))
    .sort();
  assert.deepEqual([...ENEMY_ROLE_KIT_TYPES].sort(), expected);
});

test('role kits change body proportions and props, not just material colours', () => {
  const signatures = new Set();
  for (const type of ENEMY_ROLE_KIT_TYPES) {
    const { root } = makeRig();
    const handle = createEnemyRoleKit(type, root);
    assert.ok(handle, 'missing role kit: ' + type);
    assert.equal(handle.visible, false);
    signatures.add(geometrySignature(root));
  }
  assert.ok(signatures.size >= 16, 'enemy silhouettes must have materially different geometry signatures');
});

test('helmet, torso, arm equipment, back gear and footwear attach to animated rig bones', () => {
  const { root, bones } = makeRig();
  createEnemyRoleKit('inspector', root);
  const head = bones.get('mixamorigHead');
  const chest = bones.get('mixamorigSpine2');
  const arm = bones.get('mixamorigRightArm');
  const hips = bones.get('mixamorigHips');
  assert.ok(head.children.some((child) => child.name === 'role-kit-head'));
  assert.ok(chest.children.some((child) => child.name === 'role-kit-torso'));
  assert.ok(chest.children.some((child) => child.name === 'role-kit-back'));
  assert.ok(arm.children.some((child) => child.name === 'role-kit-rightArm'));
  assert.ok(hips.children.some((child) => child.name === 'role-kit-legs'));
});

test('role-kit geometry and materials are shared and do not cast extra crowd shadows', () => {
  const first = makeRig();
  const second = makeRig();
  createEnemyRoleKit('zombie_pracownik', first.root);
  createEnemyRoleKit('zombie_pracownik', second.root);
  const collect = (root) => {
    const meshes = [];
    root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.actorRoleSilhouette === true) meshes.push(object);
    });
    return meshes;
  };
  const a = collect(first.root);
  const b = collect(second.root);
  assert.ok(a.length >= 4 && a.length <= 5);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].geometry, b[i].geometry);
    assert.equal(a[i].material, b[i].material);
    assert.equal(a[i].castShadow, false);
    assert.equal(a[i].receiveShadow, false);
    assert.equal(a[i].userData.gobkitSharedGeometry, true);
  }
});

test('humanoid rig attachments follow the corresponding skeleton joints', () => {
  const { root, bones } = makeRig();
  createEnemyRoleKit('architect', root);
  const headPart = bones.get('mixamorigHead').children.find((child) => child.name === 'role-kit-head');
  root.updateMatrixWorld(true);
  const before = headPart.getWorldQuaternion(new THREE.Quaternion()).clone();
  bones.get('mixamorigHead').rotation.y = 0.65;
  root.updateMatrixWorld(true);
  const after = headPart.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(before.angleTo(after) > 0.25);
});

test('enemy anatomy alters cloned rig proportions once without mutating other archetypes', () => {
  const brute = makeRig();
  const architect = makeRig();
  const bruteHead = brute.bones.get('mixamorigHead');
  const architectHead = architect.bones.get('mixamorigHead');
  const bruteChest = brute.bones.get('mixamorigSpine2');
  const architectChest = architect.bones.get('mixamorigSpine2');
  assert.equal(applyEnemyRoleAnatomy(brute.root, 'walczak'), true);
  assert.equal(applyEnemyRoleAnatomy(brute.root, 'walczak'), false,
    'anatomy must never compound when a model attach pass repeats');
  assert.equal(applyEnemyRoleAnatomy(architect.root, 'architect'), true);
  assert.ok(bruteHead.scale.x > architectHead.scale.x);
  assert.ok(bruteChest.scale.x > architectChest.scale.x);
  assert.ok(getEnemyAnatomyProfile('walczak').shoulderWidth >
    getEnemyAnatomyProfile('architect').shoulderWidth);
});

test('zombie anatomy is deliberately asymmetric rather than a mirrored human rig', () => {
  const { root, bones } = makeRig();
  assert.equal(applyEnemyRoleAnatomy(root, 'zombie_pracownik'), true);
  const rightArm = bones.get('mixamorigRightArm');
  assert.ok(rightArm.scale.x > 1);
  assert.ok(getEnemyAnatomyProfile('zombie_pracownik').leftArmScale < 1);
  assert.ok(getEnemyAnatomyProfile('zombie_pracownik').rightArmScale > 1);
});

test('secondary role motion animates idle and locomotion but never overlays attacks or death', () => {
  const { root, bones } = makeRig();
  const head = bones.get('mixamorigHead');
  const spine = bones.get('mixamorigSpine');
  const startHead = head.quaternion.clone();
  let phase = applyEnemyRoleSecondaryMotion(root, 'zombie_pracownik', 0, 0.05, 2.0, 'Walk');
  assert.ok(phase > 0);
  assert.ok(head.quaternion.angleTo(startHead) > 0.001);
  const afterWalk = head.quaternion.clone();
  clearEnemyRoleSecondaryMotion(root);
  assert.ok(head.quaternion.angleTo(startHead) < 1e-7,
    'the additive role pose must be exactly reversible before the next mixer tick');
  const beforeAttack = head.quaternion.clone();
  phase = applyEnemyRoleSecondaryMotion(root, 'zombie_pracownik', phase, 0.05, 0, 'Attack');
  assert.ok(head.quaternion.angleTo(beforeAttack) < 1e-8,
    'one-shot combat pose must not be overwritten by the secondary gait');
  const beforeIdle = spine.quaternion.clone();
  applyEnemyRoleSecondaryMotion(root, 'architect', 0.2, 0.05, 0, 'Idle');
  assert.ok(spine.quaternion.angleTo(beforeIdle) > 0.0001,
    'idle stance should retain low-amplitude breathing/weight shifts');
});

test('all non-vehicle humanoid archetypes have anatomical tuning', () => {
  for (const type of ENEMY_ROLE_KIT_TYPES) {
    assert.ok(getEnemyAnatomyProfile(type), 'missing anatomy profile for ' + type);
  }
});
