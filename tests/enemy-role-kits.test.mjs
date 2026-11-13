import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENEMY_ROLE_KIT_TYPES, createEnemyRoleKit } from '../src/enemyRoleKits.ts';
import { ENEMY_VISUAL_PROFILES } from '../src/enemyVisualProfiles.ts';

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
