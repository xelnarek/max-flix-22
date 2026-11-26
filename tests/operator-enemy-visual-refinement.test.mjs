import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const roleKits = await readFile(new URL('../src/enemyRoleKits.ts', import.meta.url), 'utf8');
const warehouseAssets = await readFile(new URL('../src/warehouseAssets.ts', import.meta.url), 'utf8');

test('enemy role kits strip stale blocky overlays so each enemy renders a single cohesive 3D model', () => {
  assert.match(roleKits, /roleKitVersion = 0/);
  assert.match(roleKits, /single cohesive 3D model invariant/);
  assert.match(roleKits, /actorRoleSilhouette === true/);
});

test('operator meshes do not retain legacy held props beneath the shared firearm system', () => {
  assert.match(warehouseAssets, /Retired held props \(dumbbell, stretch roll, taser and ratchet wrench\) are removed/);
  assert.match(warehouseAssets, /legacyHeldPropsRemoved = true/);
});
