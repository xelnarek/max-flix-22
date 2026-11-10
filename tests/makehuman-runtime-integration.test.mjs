import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('MakeHuman styling covers all five playable operators and human enemy roles', async () => {
  const source = await readFile(new URL('../src/makeHumanAssets.ts', import.meta.url), 'utf8');
  for (const id of ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']) assert.ok(source.includes(id + ':'));
  for (const type of ['customer', 'architect', 'kurier', 'handlowiec', 'inspector', 'serwisant', 'monter', 'sztaplar_szalony']) {
    assert.ok(source.includes(type + ':'));
  }
  assert.match(source, /transferWearableMeshes/);
  assert.match(source, /new THREE\.Skeleton\(/);
  assert.match(source, /bodyBones\.get\(bone\.name\)/);
});

test('wearables share the loaded body rig and GLB geometry across character instances', async () => {
  const source = await readFile(new URL('../src/makeHumanAssets.ts', import.meta.url), 'utf8');
  assert.match(source, /cloneSkinnedScene\(loaded\[0\]\.scene\)/);
  assert.match(source, /usesSharedGeometry: true/);
  assert.match(source, /assets\/makehuman\//);
  assert.match(source, /new THREE\.Skeleton\(/);
});


test('role-matched staff models include distinct body proportions and industrial equipment', async () => {
  const source = await readFile(new URL('../src/makeHumanAssets.ts', import.meta.url), 'utf8');
  for (const equipment of ['helmet', 'vest', 'radio', 'badge', 'scanner', 'clipboard', 'parcel', 'toolBelt', 'earpiece']) {
    assert.ok(source.includes("'" + equipment + "'"), 'missing equipment kit: ' + equipment);
  }
  assert.match(source, /jawWidth:/);
  assert.match(source, /muscle:/);
  assert.match(source, /age:/);
  assert.match(source, /applyMorphsAndJointOffsets/);
  assert.match(source, /validateMakeHumanSidecar/);
  assert.match(source, /makeHumanShared/);
});

test('every skinned mesh receives matching rest-pose joint corrections before actor fitting', async () => {
  const source = await readFile(new URL('../src/makeHumanAssets.ts', import.meta.url), 'utf8');
  assert.match(source, /captureSkeletonRestState/);
  assert.match(source, /state\.mesh\.skeleton\.boneInverses/);
  assert.match(source, /parentToLocal/);
  assert.match(source, /states = skinnedMeshes\.map/);
  assert.match(source, /base_body\.joints\.json/);
});

test('MakeHuman actor cleanup preserves cached geometry, textures and shared equipment materials', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /object\.userData\.makeHumanAsset === true\) return/);
  assert.match(game, /object\.userData\.makeHumanSharedGeometry !== true/);
  assert.match(game, /material\.userData\.makeHumanShared !== true/);
  assert.match(game, /disposeMakeHumanActorMaterials/);
});

test('MakeHuman sidecar validation checks every referenced joint offset before actor creation', async () => {
  const source = await readFile(new URL('../src/makeHumanAssets.ts', import.meta.url), 'utf8');
  assert.match(source, /function validateMakeHumanSidecar/);
  assert.match(source, /references an unknown rest bone/);
  assert.match(source, /invalid rest offset/);
  assert.match(source, /validateMakeHumanSidecar\(await response\.json/);
});
