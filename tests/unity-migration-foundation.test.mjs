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
  assert.match(manifest, /com\.unity\.ugui": "2\.6\.0"/);
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

test('Unity combat projectile visuals use shared materials and property blocks', async () => {
  const projectile = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatProjectile.cs');
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  assert.match(projectile, /private static Material _sharedMaterial/);
  assert.ok(projectile.includes("_renderer.SetPropertyBlock(_propertyBlock)"));
  assert.ok(projectile.includes("_renderer.sharedMaterial = _sharedMaterial"));
  assert.match(kit, /SupportMaterials/);
  assert.ok(!kit.includes("Material material = new Material(shader)"));
});


test('Unity domain catalog preserves the exact legacy content IDs and four Survival map modifiers', async () => {
  const [domain, catalog] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameContentCatalog.cs'),
  ]);
  for (const enemy of [
    'Customer', 'Walczak', 'Forklift', 'Architect', 'Inspector', 'AgvRobot',
    'Handlowiec', 'Monter', 'PiorunDrone', 'EliteWalczakGuard', 'Kurier',
    'ItalianVendor', 'CrazyStacker', 'KingLeto', 'PanRoman', 'Serwisant',
    'BosmanKrakow', 'ZombieWorker', 'Pomazaniec', 'Sebix',
    'MutantGammaForklift', 'RadioactivePip', 'CyberSalesman',
  ]) assert.ok(domain.includes(enemy), 'missing original enemy ID: ' + enemy);

  for (const item of ['Grout', 'TileBox', 'Coffee', 'VipItem', 'Espresso', 'Magnet', 'GoldenCutter', 'KfcBucket', 'Carrara', 'EasterEgg'])
    assert.ok(domain.includes(item), 'missing collectible ID: ' + item);
  for (const item of ['Hardhat', 'VibramBoots', 'OrderMagnet', 'EspressoBoost', 'GoldenPaleciak', 'StretchArmor', 'AttackHaste', 'ArcDrone', 'XpSurge', 'DamageWard', 'ForkliftHorn', 'NightShiftEspresso', 'GoldenWz', 'PalletGuard'])
    assert.ok(domain.includes(item), 'missing perk ID: ' + item);
  for (const weapon of ['PalletCannon', 'DiamondSaw', 'GlueMine', 'KfcBomber', 'PiorunDrone', 'ForkliftBolter', 'ScannerPulse', 'OrbitBlades', 'CalacattaShards', 'SteamBomb', 'ForkliftHorn', 'WzBoomerang'])
    assert.ok(domain.includes(weapon), 'missing Survival weapon ID: ' + weapon);

  for (const map of ['WarehouseB4', 'ContainerTerminal', 'ColdStorage', 'NightSorting'])
    assert.match(domain, new RegExp(map + '\\s*='));
  assert.doesNotMatch(domain, /OniricDream\\s*=/, 'Oniryczny sen is a secret side-mode, not a fifth Survival map');

  assert.match(catalog, /EnemyHealthMultiplier = 0\.94f/);
  assert.match(catalog, /EnemySpeedMultiplier = 1\.08f/);
  assert.match(catalog, /XpMultiplier = 1\.12f/);
  assert.match(catalog, /EnemyHealthMultiplier = 1\.12f/);
  assert.match(catalog, /EnemySpeedMultiplier = 0\.90f/);
  assert.match(catalog, /XpMultiplier = 1\.15f/);
  assert.equal((catalog.match(/Secret\("oniric_dream"/g) || []).length, 4);
  assert.equal((catalog.match(/\{\s*SurvivalWeaponKind\.[A-Za-z]+,\s*Weapon\(/g) || []).length, 12);
  assert.equal((catalog.match(/SurvivalWeaponKind\./g) || []).length, 25);
});

test('Unity setup creates URP, configures WebGPU with WebGL2 fallback and enables the New Input System', async () => {
  const setup = await read('../unity/MaxFlixUnity/Assets/Editor/UnityProjectSetup.cs');
  assert.match(setup, /UniversalRenderPipelineAsset/);
  assert.match(setup, /GraphicsSettings\.defaultRenderPipeline = pipeline/);
  assert.match(setup, /GraphicsDeviceType\.WebGPU/);
  assert.match(setup, /GraphicsDeviceType\.OpenGLES3/);
  assert.match(setup, /NewInputSystemBackend = 1/);
  assert.match(setup, /activeInputHandler\.intValue = NewInputSystemBackend/);
});
