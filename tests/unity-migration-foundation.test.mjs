import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Unity migration pins the supported 6.6.8 editor and package versions', async () => {
  const [version, manifest] = await Promise.all([
    read('../unity/MaxFlixUnity/ProjectSettings/ProjectVersion.txt'),
    read('../unity/MaxFlixUnity/Packages/manifest.json'),
  ]);
  assert.match(version, /m_EditorVersion: 6000\.6\.8f1/);
  assert.match(version, /237b6593792b/);
  assert.match(manifest, /com\.unity\.inputsystem/);
  assert.match(manifest, /1\.20\.1/);
  assert.match(manifest, /com\.unity\.render-pipelines\.universal/);
});

test('first Unity vertical slice preserves all five legacy operator IDs and their base combat stats', async () => {
  const [domain, operators] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCatalog.cs'),
  ]);
  for (const id of ['Marcin', 'Grzesiek', 'Dawid', 'Mateusz', 'Piotr']) {
    assert.ok(domain.includes(id), 'missing operator identity: ' + id);
    assert.ok(operators.includes('OperatorId.' + id), 'missing operator data: ' + id);
  }
  for (const mode of ['Campaign', 'Survival', 'PvP']) assert.ok(domain.includes(mode));
  for (const value of ['6.9f', '7.5f', '7.9f', '9.6f', '8.5f']) {
    assert.ok(operators.includes('MoveSpeed = ' + value), 'missing source move speed: ' + value);
  }
  for (const value of ['8.4f', '7.8f', '10.5f', '9.5f', '9.2f']) {
    assert.ok(operators.includes('JumpForce = ' + value), 'missing source jump profile: ' + value);
  }
});

test('Unity prototype contains bootstrap, an articulated operator rig, controls and combat feedback', async () => {
  const [bootstrap, world, player, enemy, hud, rig, safeArea, sceneInstaller] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorAnimationRig.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SafeAreaLayout.cs'),
    read('../unity/MaxFlixUnity/Assets/Editor/BootstrapSceneInstaller.cs'),
  ]);
  assert.match(bootstrap, /RuntimeInitializeOnLoadMethod/);
  assert.match(world, /CreateRackBay/);
  assert.match(world, /BuildOperatorVisual/);
  assert.match(world, /OperatorAnimationRig/);
  assert.match(player, /CharacterController/);
  assert.match(player, /FirePrimaryAttack/);
  assert.match(enemy, /ApplyDamage/);
  assert.match(hud, /VirtualJoystick/);
  assert.match(hud, /SKOK/);
  assert.match(hud, /ATAK/);
  assert.match(rig, /_leftHip/);
  assert.match(rig, /_rightShoulder|_rightArm/);
  assert.match(safeArea, /Screen\.safeArea/);
  assert.match(sceneInstaller, /EditorBuildSettings\.scenes/);
});

test('Unity migration is staged and does not replace the current production deployment', async () => {
  const [plan, readme, workflow] = await Promise.all([
    read('../docs/UNITY_MIGRATION_PLAN.md'),
    read('../unity/MaxFlixUnity/README.md'),
    read('../.github/workflows/deploy.yml'),
  ]);
  assert.match(plan, /Nie zastępujemy działającej gry Three\.js w miejscu/);
  assert.match(plan, /Kryteria zgodności przed wyłączeniem wersji Three\.js/);
  assert.match(readme, /prototype only/);
  assert.match(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /unity\/MaxFlixUnity/);
});


test('Unity gameplay and UI use the pinned New Input System without legacy Input calls', async () => {
  const [player, camera, hud, setup, readme] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CameraFollowRig.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs'),
    read('../unity/MaxFlixUnity/Assets/Editor/UnityProjectSetup.cs'),
    read('../unity/MaxFlixUnity/README.md'),
  ]);
  assert.match(player, /Keyboard\.current/);
  assert.match(player, /Gamepad\.current/);
  assert.match(camera, /Mouse\.current/);
  assert.match(hud, /InputSystemUIInputModule/);
  assert.match(hud, /SingleMouseOrPenButMultiTouchAndTrack/);
  assert.match(setup, /NewInputSystemBackend = 1/);
  assert.match(setup, /GraphicsDeviceType\.WebGPU/);
  assert.match(setup, /GraphicsDeviceType\.OpenGLES3/);
  assert.doesNotMatch(player, /Input\.GetKey|Input\.GetMouseButton/);
  assert.doesNotMatch(camera, /Input\.mouseScrollDelta/);
  assert.match(readme, /Configure URP and New Input System/);
});

test('Unity projectile visual uses a shared material and property block rather than allocating one material per shot', async () => {
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  assert.match(player, /private static Material _sharedProjectileMaterial/);
  assert.match(player, /renderer\.SetPropertyBlock\(_projectileProperties\)/);
  assert.doesNotMatch(player, /Material material = new Material\(shader\)/);
});
