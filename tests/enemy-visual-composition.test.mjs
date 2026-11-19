import assert from 'node:assert/strict';
import * as THREE from 'three';
import test from 'node:test';
import { removeLegacyEnemyBodyVisuals } from '../src/enemyVisualComposition.ts';

function createMesh(name = 'mesh') {
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return { mesh, geometry, material };
}

test('successful rig replacement removes the old procedural body instead of leaving it hidden in the actor tree', () => {
  const actor = new THREE.Group();
  const legacyBody = new THREE.Group();
  legacyBody.name = 'legacy-procedural-enemy';
  const body = createMesh('old-body');
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
    new THREE.LineBasicMaterial(),
  );
  legacyBody.add(body.mesh, outline);
  actor.add(legacyBody);

  const overlay = new THREE.Group();
  overlay.name = 'enemy-health-overlay';
  const hp = createMesh('health-bar');
  overlay.add(hp.mesh);
  actor.add(overlay);

  const fullRig = new THREE.Group();
  fullRig.name = 'gobkit-enemy-new-rig';
  fullRig.userData.actorVisualRoot = true;
  const newBody = createMesh('new-body');
  fullRig.add(newBody.mesh);
  actor.add(fullRig);

  let bodyGeometryDisposed = false;
  body.geometry.addEventListener('dispose', () => { bodyGeometryDisposed = true; });
  const removed = removeLegacyEnemyBodyVisuals(actor, [overlay]);

  assert.equal(removed, 1);
  assert.equal(legacyBody.parent, null, 'the old procedural root must leave the live scene graph');
  assert.equal(bodyGeometryDisposed, true, 'old fallback geometry is released after removal');
  assert.equal(overlay.parent, actor, 'health overlays must remain attached');
  assert.equal(hp.mesh.visible, true);
  assert.equal(fullRig.parent, actor, 'the newly loaded rig must remain attached');
  assert.equal(fullRig.visible, true);
  assert.equal(newBody.mesh.visible, true);
});

test('a preserved overlay nested inside an old model container is extracted from the body cleanup', () => {
  const actor = new THREE.Group();
  const legacyContainer = new THREE.Group();
  const body = createMesh('legacy-body');
  const overlay = new THREE.Group();
  overlay.name = 'nested-telegraph-overlay';
  const marker = createMesh('telegraph-marker');
  overlay.add(marker.mesh);
  legacyContainer.add(body.mesh, overlay);
  actor.add(legacyContainer);

  removeLegacyEnemyBodyVisuals(actor, [overlay, marker.mesh]);

  assert.equal(legacyContainer.parent, null, 'empty legacy model hierarchy must leave the live actor');
  assert.equal(body.mesh.parent, legacyContainer, 'the old subtree is detached with its discarded parent');
  assert.equal(overlay.parent, actor, 'nested telegraph must be lifted out before the legacy hierarchy is removed');
  assert.equal(marker.mesh.parent, overlay);
  assert.equal(marker.mesh.visible, true);
});

test('shared GLB geometry and materials are not disposed when legacy wrappers are removed', () => {
  const actor = new THREE.Group();
  const legacy = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.gobkitSharedGeometry = true;
  material.userData.gobkitSharedMaterial = true;
  let geometryDisposed = false;
  let materialDisposed = false;
  geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  material.addEventListener('dispose', () => { materialDisposed = true; });
  legacy.add(mesh);
  actor.add(legacy);

  removeLegacyEnemyBodyVisuals(actor);

  assert.equal(legacy.parent, null);
  assert.equal(geometryDisposed, false);
  assert.equal(materialDisposed, false);
});

test('enemy HUD, telegraphs, proxy and active rig remain separate from the discarded fallback', () => {
  const actor = new THREE.Group();
  const oldBody = new THREE.Group();
  oldBody.add(createMesh('legacy-operator-model').mesh);
  const health = createMesh('enemy-hp').mesh;
  const rangedTelegraph = createMesh('ranged-windup').mesh;
  const meleeTelegraph = createMesh('melee-windup').mesh;
  const proxy = new THREE.Group();
  proxy.userData.actorLodProxy = true;
  const fullRig = new THREE.Group();
  fullRig.userData.actorVisualRoot = true;
  actor.add(oldBody, health, rangedTelegraph, meleeTelegraph, proxy, fullRig);

  removeLegacyEnemyBodyVisuals(actor, [health, rangedTelegraph, meleeTelegraph]);

  assert.equal(oldBody.parent, null);
  for (const item of [health, rangedTelegraph, meleeTelegraph, proxy, fullRig]) {
    assert.equal(item.parent, actor);
  }
  assert.equal(health.visible, true);
  assert.equal(rangedTelegraph.visible, true);
  assert.equal(meleeTelegraph.visible, true);
});


test('both imported enemy rig paths remove the full procedural body and retire old model-only appendages', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  const attachBlocks = [
    ['private async attachMakeHumanEnemyModel', 'private async attachGobkitOperatorModel'],
    ['private async attachGobkitEnemyModel', 'private updateGobkitAnimations'],
  ];
  for (const [startMarker, endMarker] of attachBlocks) {
    const start = game.indexOf(startMarker);
    const end = game.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, 'expected enemy model attachment path');
    const block = game.slice(start, end);
    assert.match(block, /removeLegacyEnemyBodyVisuals\(mesh as THREE\.Group, overlays\)/);
    assert.match(block, /enemy\.propeller = undefined/);
    assert.match(block, /enemy\.bikeWheels = undefined/);
    const overlayStart = block.indexOf('const overlays = [');
    const overlayEnd = block.indexOf('].filter', overlayStart);
    const overlayList = block.slice(overlayStart, overlayEnd);
    assert.doesNotMatch(overlayList, /enemy\.propeller|bikeWheels/,
      'obsolete model appendages must not be carried into the imported rig');
  }
});


test('health-bar fill remains inside its preserved parent when both are listed', () => {
  const actor = new THREE.Group();
  const legacyBody = new THREE.Group();
  const body = createMesh('legacy-enemy-body');
  const hpBar = new THREE.Group();
  hpBar.name = 'enemy-health-bar';
  hpBar.position.set(0, 1.7, 0);
  const background = createMesh('hp-background');
  const fill = createMesh('hp-fill');
  hpBar.add(background.mesh, fill.mesh);
  legacyBody.add(body.mesh, hpBar);
  actor.add(legacyBody);

  removeLegacyEnemyBodyVisuals(actor, [hpBar, fill.mesh]);

  assert.equal(legacyBody.parent, null, 'old body hierarchy is removed');
  assert.equal(hpBar.parent, actor, 'the complete health bar is kept as one overlay root');
  assert.equal(background.mesh.parent, hpBar);
  assert.equal(fill.mesh.parent, hpBar, 'the fill remains aligned inside its background');
  assert.equal(fill.mesh.visible, true);
});
