import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  addProceduralLimbPose,
  getProceduralHitPulse,
  setProceduralJointRotation,
  setProceduralLimbPose,
} from '../src/proceduralActorAnimation.ts';

test('procedural limb gait rotates around the upper joint and keeps the joint anchored', () => {
  const geometry = new THREE.BoxGeometry(0.18, 0.50, 0.18);
  const material = new THREE.MeshBasicMaterial();
  const limb = new THREE.Mesh(geometry, material);
  limb.position.set(0.12, 0.25, 0.04);
  limb.rotation.x = 0.08;
  limb.updateMatrixWorld(true);
  const pivot = new THREE.Vector3(0, 0.25, 0).applyMatrix4(limb.matrixWorld);

  setProceduralLimbPose(limb, 0.72, 0.10);
  limb.updateMatrixWorld(true);
  const posedPivot = new THREE.Vector3(0, 0.25, 0).applyMatrix4(limb.matrixWorld);
  assert.ok(posedPivot.distanceTo(pivot) < 1e-6, 'hip/shoulder pivot should remain fixed');
  assert.ok(Math.abs(limb.rotation.x - 0.80) < 1e-8);
  assert.ok(Math.abs(limb.rotation.z - 0.10) < 1e-8);

  setProceduralLimbPose(limb, 0, 0);
  assert.ok(Math.abs(limb.position.x - 0.12) < 1e-8);
  assert.ok(Math.abs(limb.position.y - 0.25) < 1e-8);
  assert.ok(Math.abs(limb.position.z - 0.04) < 1e-8);
  assert.ok(Math.abs(limb.rotation.x - 0.08) < 1e-8);
  geometry.dispose();
  material.dispose();
});

test('group-based operator shoulder and hip pivots stay at the authored group origin', () => {
  const pivot = new THREE.Group();
  pivot.position.set(-0.1, 0.35, 0);
  const limbMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.06, 0.24, 3, 8),
    new THREE.MeshBasicMaterial(),
  );
  limbMesh.position.y = -0.16;
  pivot.add(limbMesh);
  pivot.updateMatrixWorld(true);
  const origin = new THREE.Vector3(0, 0, 0).applyMatrix4(pivot.matrixWorld);

  setProceduralLimbPose(pivot, 0.68, -0.12);
  pivot.updateMatrixWorld(true);
  const posedOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(pivot.matrixWorld);
  assert.ok(posedOrigin.distanceTo(origin) < 1e-7, 'authored shoulder/hip origin must not drift');
  assert.ok(Math.abs(pivot.rotation.x - 0.68) < 1e-8);
  assert.ok(Math.abs(pivot.rotation.z + 0.12) < 1e-8);

  setProceduralLimbPose(pivot, 0, 0);
  assert.ok(Math.abs(pivot.position.x + 0.1) < 1e-8);
  assert.ok(Math.abs(pivot.position.y - 0.35) < 1e-8);
});

test('additive recoil preserves the current gait or attack pose without accumulating drift', () => {
  const limb = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.42, 0.14),
    new THREE.MeshBasicMaterial(),
  );
  limb.rotation.x = 0.03;
  setProceduralLimbPose(limb, -0.44, 0.06);
  addProceduralLimbPose(limb, 0.22, -0.02);
  assert.ok(Math.abs(limb.rotation.x - (-0.19)) < 1e-8);
  assert.ok(Math.abs(limb.rotation.z - 0.04) < 1e-8);
  setProceduralLimbPose(limb, 0.18, 0);
  assert.ok(Math.abs(limb.rotation.x - 0.21) < 1e-8,
    'the next frame starts from its authored rest pose, not the prior recoil');
});

test('hit pulse rises quickly and decays to zero at the end of the reaction', () => {
  assert.equal(getProceduralHitPulse(0.36, 0.36), 0);
  const early = getProceduralHitPulse(0.324, 0.36);
  const middle = getProceduralHitPulse(0.27, 0.36);
  const late = getProceduralHitPulse(0.02, 0.36);
  assert.ok(early > 0);
  assert.ok(middle > early);
  assert.ok(late < middle);
  assert.equal(getProceduralHitPulse(0, 0.36), 0);
  assert.equal(getProceduralHitPulse(0.2, 0), 0);
});

test('joint rotation offsets always return to their factory-authored rest angles', () => {
  const joint = new THREE.Group();
  joint.rotation.set(0.12, -0.08, 0.04);
  setProceduralJointRotation(joint, -0.3, 0.1, 0.02);
  assert.ok(Math.abs(joint.rotation.x + 0.18) < 1e-8);
  assert.ok(Math.abs(joint.rotation.y - 0.02) < 1e-8);
  setProceduralJointRotation(joint);
  assert.ok(Math.abs(joint.rotation.x - 0.12) < 1e-8);
  assert.ok(Math.abs(joint.rotation.y + 0.08) < 1e-8);
  assert.ok(Math.abs(joint.rotation.z - 0.04) < 1e-8);
});
