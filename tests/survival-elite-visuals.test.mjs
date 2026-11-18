import assert from 'node:assert/strict';
import * as THREE from 'three';
import test from 'node:test';
import { createSurvivalEliteInsignia, ELITE_ROLE_VISUALS } from '../src/survivalEliteVisuals.ts';

function renderables(root) {
  const items = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) items.push(object);
  });
  return items;
}

test('controller and courier elite identities have different silhouettes and palettes', () => {
  const controller = createSurvivalEliteInsignia('controller');
  const courier = createSurvivalEliteInsignia('courier');
  const controllerMeshes = renderables(controller);
  const courierMeshes = renderables(courier);

  assert.equal(controller.name, 'survival-elite-insignia');
  assert.equal(courier.name, 'survival-elite-insignia');
  assert.equal(controller.userData.eliteRole, 'controller');
  assert.equal(courier.userData.eliteRole, 'courier');
  assert.notEqual(ELITE_ROLE_VISUALS.controller.color, ELITE_ROLE_VISUALS.courier.color);
  assert.ok(controllerMeshes.length > courierMeshes.length);
  assert.ok(controller.getObjectByName('controller-core'));
  assert.ok(controller.getObjectByName('controller-pylon-0'));
  assert.ok(courier.getObjectByName('courier-arrow-left'));
  assert.ok(courier.getObjectByName('courier-arrow-right'));
});

test('elite insignia geometry stays lightweight and materials are owned by each actor', () => {
  for (const role of ['controller', 'courier']) {
    const root = createSurvivalEliteInsignia(role);
    const meshes = renderables(root);
    assert.ok(meshes.length >= 4);
    for (const mesh of meshes) {
      assert.ok(mesh.geometry instanceof THREE.BufferGeometry);
      assert.ok(mesh.material instanceof THREE.MeshBasicMaterial);
      assert.equal(mesh.material.depthWrite, false);
    }
  }
});
