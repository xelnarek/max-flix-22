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
  ENEMY_ROLE_MOTION_ACCENTS,
  getEnemyCombatMotionProfile,
  getEnemyCombatMotionEnvelope,
} from '../src/enemyAnimationPolish.ts';

function makeRig() {
  const root = new THREE.Group();
  const bones = new Map();
  for (const name of ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine2', 'mixamorigHead', 'mixamorigNeck', 'mixamorigRightArm', 'mixamorigLeftForeArm', 'mixamorigRightForeArm', 'mixamorigLeftLowerLeg', 'mixamorigRightLowerLeg']) {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
    bones.set(name, bone);
  }
  return { root, bones };
}

function collectSilhouetteMeshes(root) {
  const meshes = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.actorRoleSilhouette === true) {
      meshes.push(object);
    }
  });
  return meshes;
}

test('all 19 humanoid and creature enemy roles are listed without attaching extra blocky kit geometry', () => {
  const expected = Object.keys(ENEMY_VISUAL_PROFILES)
    .filter((type) => !['forklift', 'agv_robot', 'piorun_dron', 'pomazaniec', 'wkurzona_zona', 'kluska_piekielna'].includes(type))
    .sort();
  assert.deepEqual([...ENEMY_ROLE_KIT_TYPES].sort(), expected);
  for (const type of ENEMY_ROLE_KIT_TYPES) {
    const { root } = makeRig();
    const handle = createEnemyRoleKit(type, root);
    assert.equal(handle, null);
    assert.equal(root.userData.enemyRoleKit, type);
    assert.equal(root.userData.roleKitVersion, 0);
    assert.equal(collectSilhouetteMeshes(root).length, 0);
  }
});

test('createEnemyRoleKit strips any stray blocky actorRoleSilhouette overlays from an enemy rig', () => {
  const { root, bones } = makeRig();
  const strayHeadProp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  strayHeadProp.userData.actorRoleSilhouette = true;
  bones.get('mixamorigHead').add(strayHeadProp);
  const strayChestProp = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial());
  strayChestProp.userData.actorRoleSilhouette = true;
  bones.get('mixamorigSpine2').add(strayChestProp);

  const handle = createEnemyRoleKit('inspector', root);
  assert.equal(handle, null);
  assert.equal(collectSilhouetteMeshes(root).length, 0);
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
  assert.ok(head.quaternion.angleTo(beforeAttack) > 0.001,
    'the additive attack brace should complement, not replace, the source attack clip');
  clearEnemyRoleSecondaryMotion(root);
  assert.ok(head.quaternion.angleTo(beforeAttack) < 1e-7,
    'the attack accent must be exactly reversible before the next mixer tick');
  const beforeIdle = spine.quaternion.clone();
  applyEnemyRoleSecondaryMotion(root, 'architect', 0.2, 0.05, 0, 'Idle');
  assert.ok(spine.quaternion.angleTo(beforeIdle) > 0.0001,
    'idle stance should retain low-amplitude breathing/weight shifts');
});


test('role anatomy also scales neck, forearms, hips and calves when the imported rig exposes them', () => {
  const { root, bones } = makeRig();
  assert.equal(applyEnemyRoleAnatomy(root, 'monter'), true);
  assert.ok(bones.get('mixamorigNeck').scale.x > 1);
  assert.ok(bones.get('mixamorigLeftForeArm').scale.x > 1);
  assert.ok(bones.get('mixamorigRightForeArm').scale.x > 1);
  assert.ok(bones.get('mixamorigLeftLowerLeg').scale.x > 1);
  assert.ok(bones.get('mixamorigHips').scale.x > 1);
  assert.equal(applyEnemyRoleAnatomy(root, 'monter'), false,
    'secondary anatomical proportions must never compound');
});

test('attack accents are synchronized to wind-up, contact and recovery clip phases', () => {
  const start = getEnemyCombatMotionEnvelope('Attack', 0);
  const windup = getEnemyCombatMotionEnvelope('Attack', 0.22);
  const contact = getEnemyCombatMotionEnvelope('Attack', 0.47);
  const recovery = getEnemyCombatMotionEnvelope('Attack', 0.78);
  const end = getEnemyCombatMotionEnvelope('Attack', 1);
  assert.equal(start.windup + start.impact + start.recovery, 0);
  assert.ok(windup.windup > 0.99 && windup.impact < 0.1);
  assert.ok(contact.impact > 0.99 && contact.windup < 0.1);
  assert.ok(recovery.recovery > 0.99 && recovery.impact < 0.1);
  assert.equal(end.windup + end.impact + end.recovery, 0);
  for (const envelope of [start, windup, contact, recovery, end]) {
    for (const value of Object.values(envelope)) assert.ok(value >= 0 && value <= 1);
  }
});

test('hit stagger decays into recovery instead of looping with the locomotion phase', () => {
  const early = getEnemyCombatMotionEnvelope('Hit', 0.05);
  const middle = getEnemyCombatMotionEnvelope('Hit', 0.5);
  const late = getEnemyCombatMotionEnvelope('Hit', 1);
  assert.ok(early.impact > middle.impact);
  assert.equal(late.impact, 0);
  assert.ok(late.recovery > middle.recovery);
});

test('all non-vehicle humanoid archetypes have anatomical tuning', () => {
  for (const type of ENEMY_ROLE_KIT_TYPES) {
    assert.ok(getEnemyAnatomyProfile(type), 'missing anatomy profile for ' + type);
  }
});


test('all humanoid enemy archetypes carry bounded and distinct role-motion accents', () => {
  const expected = Object.keys(ENEMY_VISUAL_PROFILES)
    .filter((type) => !['forklift', 'agv_robot', 'piorun_dron', 'pomazaniec', 'wkurzona_zona', 'kluska_piekielna'].includes(type))
    .sort();
  assert.deepEqual(Object.keys(ENEMY_ROLE_MOTION_ACCENTS).sort(), expected);
  const signatures = new Set();
  for (const [type, profile] of Object.entries(ENEMY_ROLE_MOTION_ACCENTS)) {
    signatures.add(JSON.stringify(profile));
    for (const value of Object.values(profile)) {
      assert.ok(Number.isFinite(value), type + ' motion value must be finite');
      assert.ok(Math.abs(value) <= 0.20, type + ' motion accent must remain controlled');
    }
  }
  assert.equal(signatures.size, expected.length, 'every role needs a distinct motion signature');
});

test('beast and hazmat archetypes no longer attach second blocky kit layers', () => {
  for (const type of ['walczak', 'mutant_gamma_forklift', 'radioactive_pip', 'architect']) {
    const { root } = makeRig();
    const kit = createEnemyRoleKit(type, root);
    assert.equal(kit, null);
    assert.equal(root.userData.enemyRoleKit, type);
    assert.equal(root.userData.roleKitVersion, 0);
  }
});

test('role accents measurably change head and torso motion for the same animation frame', () => {
  const customer = makeRig();
  const architect = makeRig();
  applyEnemyRoleSecondaryMotion(customer.root, 'customer', 0.45, 1 / 30, 0, 'Idle');
  applyEnemyRoleSecondaryMotion(architect.root, 'architect', 0.45, 1 / 30, 0, 'Idle');
  const customerHead = customer.bones.get('mixamorigHead').quaternion;
  const architectHead = architect.bones.get('mixamorigHead').quaternion;
  assert.ok(customerHead.angleTo(architectHead) > 0.02);
});


test('every animated enemy role has bounded wind-up, follow-through and hit-stagger accents', () => {
  const types = Object.keys(ENEMY_VISUAL_PROFILES).filter((type) =>
    !['forklift', 'agv_robot', 'piorun_dron', 'pomazaniec', 'wkurzona_zona', 'kluska_piekielna'].includes(type)
  );
  const profiles = types.map((type) => getEnemyCombatMotionProfile(type));
  assert.equal(profiles.length, 19);
  assert.ok(new Set(profiles.map((profile) => JSON.stringify(profile))).size >= 18);
  for (const profile of profiles) {
    assert.ok(profile.attackWindup >= 0.03 && profile.attackWindup <= 0.16);
    assert.ok(profile.attackFollowThrough >= 0.07 && profile.attackFollowThrough <= 0.21);
    assert.ok(profile.hitStagger >= 0.035 && profile.hitStagger <= 0.14);
  }
});
