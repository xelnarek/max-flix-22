import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { disposeActorOwnedRenderResources } from '../src/actorResourceDisposal.ts';

function countDispose(resource) {
  let calls = 0;
  resource.dispose = () => { calls++; };
  return () => calls;
}

test('actor cleanup disposes owned geometry once but preserves geometry shared by rig clones', () => {
  const root = new THREE.Group();
  const sharedGeometry = new THREE.BoxGeometry();
  const localGeometry = new THREE.SphereGeometry();
  const sharedGeometryDisposals = countDispose(sharedGeometry);
  const localGeometryDisposals = countDispose(localGeometry);
  const sharedRigMaterial = new THREE.MeshStandardMaterial();
  const localMaterial = new THREE.MeshStandardMaterial();
  sharedRigMaterial.userData.gobkitSharedMaterial = true;
  const sharedRigMaterialDisposals = countDispose(sharedRigMaterial);
  const localMaterialDisposals = countDispose(localMaterial);

  const cloneA = new THREE.Mesh(sharedGeometry, sharedRigMaterial);
  const cloneB = new THREE.Mesh(sharedGeometry, sharedRigMaterial);
  cloneA.userData.gobkitSharedGeometry = true;
  cloneB.userData.gobkitSharedGeometry = true;
  const localA = new THREE.Mesh(localGeometry, localMaterial);
  const localB = new THREE.Mesh(localGeometry, localMaterial);
  root.add(cloneA, cloneB, localA, localB);

  disposeActorOwnedRenderResources(root);

  assert.equal(sharedGeometryDisposals(), 0, 'a dead clone must not invalidate shared rig geometry');
  assert.equal(sharedRigMaterialDisposals(), 0, 'a dead clone must not dispose shared role-kit materials');
  assert.equal(localGeometryDisposals(), 1, 'reused instance geometry should be released only once');
  assert.equal(localMaterialDisposals(), 1, 'reused instance materials should be released only once');
});

test('actor cleanup preserves MakeHuman shared resources and still releases private materials', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  const geometryDisposals = countDispose(geometry);
  const sharedMaterial = new THREE.MeshStandardMaterial();
  const privateMaterial = new THREE.MeshStandardMaterial();
  sharedMaterial.userData.makeHumanShared = true;
  const sharedMaterialDisposals = countDispose(sharedMaterial);
  const privateMaterialDisposals = countDispose(privateMaterial);

  const sharedPart = new THREE.Mesh(geometry, sharedMaterial);
  sharedPart.userData.makeHumanSharedGeometry = true;
  root.add(sharedPart, new THREE.Mesh(new THREE.BoxGeometry(), privateMaterial));

  disposeActorOwnedRenderResources(root);

  assert.equal(geometryDisposals(), 0);
  assert.equal(sharedMaterialDisposals(), 0);
  assert.equal(privateMaterialDisposals(), 1);
});

test('actor-owned resource disposal preserves shared visual-LOD geometry and material', async () => {
  const THREE = await import('three');
  const { disposeActorOwnedRenderResources } = await import('../src/actorResourceDisposal.ts');
  const root = new THREE.Group();
  const sharedGeometry = new THREE.BoxGeometry();
  const sharedMaterial = new THREE.MeshStandardMaterial();
  sharedGeometry.userData.actorLodSharedGeometry = true;
  sharedMaterial.userData.actorLodSharedMaterial = true;
  let sharedGeometryDisposed = false;
  let sharedMaterialDisposed = false;
  sharedGeometry.addEventListener('dispose', () => { sharedGeometryDisposed = true; });
  sharedMaterial.addEventListener('dispose', () => { sharedMaterialDisposed = true; });
  const sharedMesh = new THREE.Mesh(sharedGeometry, sharedMaterial);
  sharedMesh.userData.actorLodSharedGeometry = true;
  sharedMesh.add(new THREE.Group());
  root.add(sharedMesh);
  disposeActorOwnedRenderResources(root);
  assert.equal(sharedGeometryDisposed, false);
  assert.equal(sharedMaterialDisposed, false);
  sharedGeometry.dispose();
  sharedMaterial.dispose();
});
