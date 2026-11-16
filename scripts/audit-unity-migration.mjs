import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

function fail(message) {
  console.error('[Unity migration audit] FAIL: ' + message);
  process.exitCode = 1;
}

function enumMembers(source, enumName) {
  const block = source.match(new RegExp('public\\s+enum\\s+' + enumName + '\\s*\\{([\\s\\S]*?)\\}'));
  if (!block) throw new Error('Missing C# enum ' + enumName);
  return [...block[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*\d+/gm)].map((match) => match[1]);
}

function typeUnionMembers(source, typeName) {
  const block = source.match(new RegExp('export\\s+type\\s+' + typeName + '\\s*=([\\s\\S]*?);'));
  if (!block) throw new Error('Missing TypeScript union ' + typeName);
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function sourceMapFloor(source, mapId) {
  const block = source.match(new RegExp('\\b' + mapId + ':\\s*\\{([\\s\\S]*?)\\n  \\},'));
  const value = block?.[1].match(/floorColor:\s*(0x[0-9a-f]+)/i)?.[1];
  if (!value) throw new Error('Missing source floor colour for ' + mapId);
  return value.toLowerCase();
}

function unityMapFloor(source, enumId) {
  const marker = 'WarehouseMapId.' + enumId + ',';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Missing Unity map ' + enumId);
  const block = source.slice(start, start + 1800);
  const value = block.match(/FloorColor\s*=\s*Hex\((0x[0-9a-f]+)\)/i)?.[1];
  if (!value) throw new Error('Missing Unity floor colour for ' + enumId);
  return value.toLowerCase();
}

try {
  const [
    version,
    manifestText,
    setup,
    domain,
    enemyCatalog,
    weaponCatalog,
    contentCatalog,
    sourceTypes,
    sourceCharacters,
    sourceMaps,
    worldLayout,
    worldFactory,
    bootstrap,
    biomeEnvironment,
    waveDirector,
    progressionController,
    unityWorkflow,
    unityReadme,
  ] = await Promise.all([
    read('unity/MaxFlixUnity/ProjectSettings/ProjectVersion.txt'),
    read('unity/MaxFlixUnity/Packages/manifest.json'),
    read('unity/MaxFlixUnity/Assets/Editor/UnityProjectSetup.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyArchetypeCatalog.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponCatalog.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/GameContentCatalog.cs'),
    read('src/types.ts'),
    read('src/characters.ts'),
    read('src/survivalMaps.ts'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWorldLayout.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalBiomeEnvironment.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs'),
    read('unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs'),
    read('.github/workflows/unity-validation.yml'),
    read('unity/MaxFlixUnity/README.md'),
  ]);

  const manifest = JSON.parse(manifestText);
  const packages = manifest.dependencies ?? {};
  if (!version.includes('m_EditorVersion: 6000.6.8f1')) fail('Unity Editor must be pinned to 6000.6.8f1.');
  for (const [name, expected] of [
    ['com.unity.render-pipelines.universal', '17.5.0'],
    ['com.unity.ugui', '2.6.0'],
    ['com.unity.inputsystem', '1.20.1'],
    ['com.unity.cloud.gltfast', '6.20.0'],
  ]) {
    if (packages[name] !== expected) fail('Unexpected Unity package version for ' + name + ': ' + packages[name]);
  }

  const operatorIds = typeUnionMembers(sourceTypes, 'CharacterId');
  const unityOperatorIds = enumMembers(domain, 'OperatorId');
  if (operatorIds.length !== 5 || unityOperatorIds.length !== 5) fail('Expected five stable operators on both sides.');
  if (operatorIds.some((id) => !sourceCharacters.includes('  ' + id + ': {'))) fail('A CharacterId has no source character definition.');

  const enemyIds = typeUnionMembers(sourceTypes, 'EnemyType');
  const unityEnemyIds = enumMembers(domain, 'EnemyKind');
  if (enemyIds.length !== 23 || unityEnemyIds.length !== 23) fail('Expected 23 stable enemy IDs on both sides.');

  const perkIds = typeUnionMembers(sourceTypes, 'PerkType');
  const unityPerkIds = enumMembers(domain, 'PerkKind');
  if (perkIds.length !== 15 || unityPerkIds.length !== 15) fail('Expected 15 stable perk IDs on both sides.');

  const sourceMapMatch = sourceMaps.match(/SURVIVAL_MAP_IDS[\s\S]*?=\s*\[([\s\S]*?)\]/);
  const sourceMapIds = sourceMapMatch
    ? [...sourceMapMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
    : [];
  const unityMapIds = enumMembers(domain, 'WarehouseMapId');
  if (sourceMapIds.length !== 4 || unityMapIds.length !== 4) fail('Expected four map IDs on both sides.');

  const unityWeaponIds = enumMembers(domain, 'SurvivalWeaponKind');
  const weaponEntries = [...weaponCatalog.matchAll(/Make\(SurvivalWeaponKind\./g)].length;
  const contentWeaponEntries = [...contentCatalog.matchAll(/Weapon\(SurvivalWeaponKind\./g)].length;
  if (unityWeaponIds.length !== 12 || weaponEntries !== 12 || contentWeaponEntries !== 12) {
    fail('Unity must define all 12 stable weapon IDs in both catalogs.');
  }

  const mapPairs = [
    ['warehouse_b4', 'WarehouseB4'],
    ['container_terminal', 'ContainerTerminal'],
    ['cold_storage', 'ColdStorage'],
    ['night_sorting', 'NightSorting'],
  ];
  for (const [sourceId, unityId] of mapPairs) {
    const sourceColor = sourceMapFloor(sourceMaps, sourceId);
    const unityColor = unityMapFloor(contentCatalog, unityId);
    if (sourceColor !== unityColor) fail('Floor palette drift for ' + sourceId + ': source ' + sourceColor + ', Unity ' + unityColor + '.');
  }

  const expectedWorldTokens = [
    'MinX = -120f',
    'MaxX = 120f',
    'MinZ = -40f',
    'MaxZ = 40f',
    'BlendHalfWidth = 11f',
    'LoadingApron',
    'ColdAirlock',
    'ScannerTransfer',
    'FrozenConveyor',
  ];
  for (const token of expectedWorldTokens) {
    if (!worldLayout.includes(token)) fail('Unity mega-world contract is missing ' + token + '.');
  }
  if ((worldLayout.match(/new SurvivalBiomeZone\(/g) || []).length !== 4) fail('Unity mega-world must define four biome zones.');
  if ((worldLayout.match(/new SurvivalWorldTransition\(/g) || []).length !== 4) fail('Unity mega-world must define four biome transitions.');
  for (const token of [
    'WarehouseMapId.ColdStorage, 60f, 20f',
    'WarehouseMapId.NightSorting, -60f, 20f',
    'SurvivalBiomeEdge.West | SurvivalBiomeEdge.North',
    'SurvivalBiomeEdge.East | SurvivalBiomeEdge.North',
    'if (south) return east ? WarehouseMapId.ColdStorage : WarehouseMapId.NightSorting;',
    'ColdStorage = east * south',
    'NightSorting = (1f - east) * south',
    '"port-to-cold"',
    '"night-to-b4"',
  ]) {
    if (!worldLayout.includes(token)) fail('Unity mega-world quadrant/transition mapping drifted: ' + token);
  }

  for (const token of [
    'PlayerSettings.runInBackground = false',
    'PlayerSettings.Android.predictiveBackSupport = false',
    'PlayerSettings.Android.optimizedFramePacing = true',
    'AndroidApiLevel36',
    'AndroidArchitecture.ARM64',
    'GraphicsDeviceType.WebGPU',
    'GraphicsDeviceType.OpenGLES3',
  ]) {
    if (!setup.includes(token)) fail('Unity project setup is missing safety/configuration token: ' + token);
  }

  if (!unityWorkflow.includes('workflow_dispatch:')) fail('Unity Player workflow must stay manually dispatched until cutover is approved.');
  if (/^\s{2}push:/m.test(unityWorkflow)) fail('Unity builds must stay manual-only until activation credentials are configured.');
  for (const secret of ['UNITY_LICENSE', 'UNITY_EMAIL', 'UNITY_PASSWORD']) {
    if (!unityWorkflow.includes('secrets.' + secret)) fail('Unity build must remain license-gated by ' + secret + '.');
  }
  if (unityWorkflow.includes('upload-google-play') || unityWorkflow.includes('deploy-pages')) {
    fail('Unity workflow must not publish to Google Play or GitHub Pages automatically.');
  }

  if (!bootstrap.includes('WarehouseWorldFactory.BuildUnifiedSurvivalWorld()')) {
    fail('MainGameBootstrap must start Survival in the connected mega-world.');
  }
  for (const token of [
    'public static PlayerController BuildUnifiedSurvivalWorld()',
    'foreach (SurvivalBiomeZone zone in SurvivalWorldLayout.Zones)',
    'segment.transform.localPosition = new Vector3(zone.Center.x, 0f, zone.Center.y)',
    'segment.transform.localScale = new Vector3(2.4f, 1f, 0.86f)',
    'CreateUnifiedSurvivalFloors()',
    'CreateUnifiedSurvivalTransitions()',
    'CreateUnifiedSurvivalPerimeter(baseMap)',
    'BuildBiomeBlendTexture(transition)',
    'GetBlendedFloorColor(worldX, z)',
    'transform.localPosition = position',
  ]) {
    if (!worldFactory.includes(token)) fail('Connected Survival world factory is missing required implementation: ' + token);
  }
  for (const token of [
    'GetBlendedEnemyHealthMultiplier(position.x, position.z)',
    'GetBlendedEnemySpeedMultiplier(position.x, position.z)',
    'SurvivalWorldLayout.ClampInside',
  ]) {
    if (!waveDirector.includes(token)) fail('Survival spawn director is missing world-aware logic: ' + token);
  }
  if (!progressionController.includes('GetBlendedXpMultiplier')) {
    fail('Survival XP must use the biome blend field instead of switching abruptly at a seam.');
  }
  for (const token of [
    'SurvivalWorldLayout.GetBlendWeights',
    'RefreshIntervalSeconds',
    'RenderSettings.fogColor',
  ]) {
    if (!biomeEnvironment.includes(token)) fail('Biome ambience controller is missing continuous visual blending: ' + token);
  }
  for (const token of [
    'GetBlendedEnemyHealthMultiplier',
    'GetBlendedEnemySpeedMultiplier',
    'GetBlendedXpMultiplier',
    'weights.WarehouseB4',
    'weights.ContainerTerminal',
    'weights.ColdStorage',
    'weights.NightSorting',
  ]) {
    if (!contentCatalog.includes(token)) fail('Game content catalog is missing weighted biome modifier blending: ' + token);
  }
  if (!unityReadme.includes('BuildUnifiedSurvivalWorld')) {
    fail('Unity README must describe the connected Survival mega-world implementation.');
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log('[Unity migration audit] PASS: editor/package pins, source IDs, floor palettes, connected world generation, weighted biome modifiers and release safety gates are consistent.');
  console.log('[Unity migration audit] CUTOVER BLOCKER: Unity Editor compilation/playtesting, rig attachment/retargeting, PvP, account/cloud services, ads/UMP, full secrets/events and device QA are still required.');
} catch (error) {
  fail(String(error));
}

if (process.exitCode) process.exit(process.exitCode);
