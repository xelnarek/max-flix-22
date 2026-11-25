import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const roleKits = await readFile(new URL('../src/enemyRoleKits.ts', import.meta.url), 'utf8');
const warehouseAssets = await readFile(new URL('../src/warehouseAssets.ts', import.meta.url), 'utf8');

test('enemy role kits use the refined visual version and role-detail pass', () => {
  assert.match(roleKits, /roleKitVersion=3/);
  assert.match(roleKits, /Universal visual refinement/);
  assert.match(roleKits, /Compact shoulder colour marker/);
});

test('operator meshes do not retain legacy held props beneath the shared firearm system', () => {
  assert.match(warehouseAssets, /Retired held props \(dumbbell, stretch roll, taser and ratchet wrench\) are removed/);
  assert.match(warehouseAssets, /legacyHeldPropsRemoved = true/);
});
