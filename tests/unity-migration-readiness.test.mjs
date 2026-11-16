import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Unity migration audit passes the stable source-data and release-safety contracts', () => {
  const output = execFileSync(process.execPath, ['scripts/audit-unity-migration.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(output, /\[Unity migration audit\] PASS:/);
  assert.match(output, /CUTOVER BLOCKER/);
  assert.match(output, /four biome zones/);
});

test('Unity Survival mega-map contract matches the live 240 by 80 metre topology', async () => {
  const [world, source, bootstrap, factory] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWorldLayout.cs'),
    read('../src/survivalWorldLayout.ts'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
  ]);
  for (const token of ['MinX = -119.5f', 'MaxX = 119.5f', 'MinZ = -39.5f', 'MaxZ = 39.5f']) {
    assert.ok(world.includes(token), 'missing world bound: ' + token);
  }
  for (const id of ['WarehouseB4', 'ContainerTerminal', 'ColdStorage', 'NightSorting']) {
    assert.ok(world.includes('WarehouseMapId.' + id));
  }
  assert.match(world, /BlendHalfWidth = 9f/);
  assert.match(world, /new SurvivalWorldTransition\("b4-to-port"/);
  assert.match(world, /new SurvivalWorldTransition\("b4-to-cold"/);
  assert.match(world, /new SurvivalWorldTransition\("port-to-night"/);
  assert.match(world, /new SurvivalWorldTransition\("cold-to-night"/);
  assert.match(source, /minX: -119\.5,[\s\S]*?maxX: 119\.5,[\s\S]*?minZ: -39\.5,[\s\S]*?maxZ: 39\.5/);
  assert.match(bootstrap, /WarehouseWorldFactory\.BuildB4Slice\(\)/);
  assert.doesNotMatch(factory, /SurvivalWorldLayout\.Zones|BuildUnifiedSurvivalWorld/);
});

test('Unity project setup guards the known Android resume/back regression and enables paced frames', async () => {
  const [setup, readme] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Editor/UnityProjectSetup.cs'),
    read('../unity/MaxFlixUnity/README.md'),
  ]);
  assert.match(setup, /PlayerSettings\.runInBackground = false/);
  assert.match(setup, /PlayerSettings\.Android\.predictiveBackSupport = false/);
  assert.match(setup, /PlayerSettings\.Android\.optimizedFramePacing = true/);
  assert.match(readme, /Migration foundation/);
});

test('Unity production cutover remains blocked while the Three.js game stays production', async () => {
  const [plan, readme, workflow] = await Promise.all([
    read('../docs/UNITY_MIGRATION_PLAN.md'),
    read('../unity/MaxFlixUnity/README.md'),
    read('../.github/workflows/unity-validation.yml'),
  ]);
  assert.match(plan, /To nie jest jeszcze gotowa migracja produktu/);
  assert.match(plan, /240 × 80 m/);
  assert.match(readme, /current Three\.js game remains the production build/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /upload-google-play|deploy-pages/);
});
