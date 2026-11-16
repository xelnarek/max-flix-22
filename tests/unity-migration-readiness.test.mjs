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
  assert.match(output, /connected world generation/);
});

test('Unity Survival mega-map contract matches the live 240 by 80 metre topology', async () => {
  const [world, source, bootstrap, factory] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWorldLayout.cs'),
    read('../src/survivalWorldLayout.ts'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
  ]);
  for (const token of ['MinX = -120f', 'MaxX = 120f', 'MinZ = -40f', 'MaxZ = 40f']) {
    assert.ok(world.includes(token), 'missing world bound: ' + token);
  }
  for (const id of ['WarehouseB4', 'ContainerTerminal', 'ColdStorage', 'NightSorting']) {
    assert.ok(world.includes('WarehouseMapId.' + id));
  }
  assert.match(world, /BlendHalfWidth = 11f/);
  assert.match(world, /new SurvivalWorldTransition\("b4-to-port"/);
  assert.match(world, /new SurvivalWorldTransition\("port-to-cold"/);
  assert.match(world, /new SurvivalWorldTransition\("night-to-b4"/);
  assert.match(world, /new SurvivalWorldTransition\("cold-to-night"/);
  assert.match(world, /WarehouseMapId\.ColdStorage, 60f, 20f/);
  assert.match(world, /WarehouseMapId\.NightSorting, -60f, 20f/);
  assert.match(world, /WarehouseMapId\.ColdStorage, 60f, 20f,[\s\S]*?SurvivalBiomeEdge\.West \| SurvivalBiomeEdge\.North/);
  assert.match(world, /WarehouseMapId\.NightSorting, -60f, 20f,[\s\S]*?SurvivalBiomeEdge\.East \| SurvivalBiomeEdge\.North/);
  assert.match(world, /if \(south\) return east \? WarehouseMapId\.ColdStorage : WarehouseMapId\.NightSorting/);
  assert.match(world, /ColdStorage = east \* south/);
  assert.match(world, /NightSorting = \(1f - east\) \* south/);
  assert.match(source, /minX: -120,[\s\S]*?maxX: 120,[\s\S]*?minZ: -40,[\s\S]*?maxZ: 40/);
  assert.match(bootstrap, /WarehouseWorldFactory\.BuildUnifiedSurvivalWorld\(\)/);
  assert.match(factory, /foreach \(SurvivalBiomeZone zone in SurvivalWorldLayout\.Zones\)/);
  assert.match(factory, /segment\.transform\.localPosition = new Vector3\(zone\.Center\.x, 0f, zone\.Center\.y\)/);
  assert.match(factory, /segment\.transform\.localScale = new Vector3\(2\.4f, 1f, 0\.86f\)/);
  assert.match(factory, /CreateUnifiedSurvivalPerimeter\(baseMap\)/);
  assert.match(factory, /BuildBiomeBlendTexture\(transition\)/);
  assert.match(factory, /GetBlendedFloorColor\(worldX, z\)/);
  assert.doesNotMatch(factory, /_layoutOffset/);
});

test('Unity Survival renders smooth seam textures and blends biome gameplay modifiers', async () => {
  const [factory, environment, waves, progression, catalog, sourceBlend] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalBiomeEnvironment.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameContentCatalog.cs'),
    read('../src/survivalWorldBlend.ts'),
  ]);
  assert.match(factory, /Texture2D BuildBiomeBlendTexture\(SurvivalWorldTransition transition\)/);
  assert.match(factory, /FilterMode\.Bilinear/);
  assert.match(factory, /SurvivalWorldLayout\.GetBlendWeights\(x, z\)/);
  assert.match(factory, /WorldTextures\.Add\(texture\)/);
  assert.match(environment, /SurvivalWorldLayout\.GetBlendWeights/);
  assert.match(environment, /_elapsedSinceRefresh/);
  assert.match(waves, /GetBlendedEnemyHealthMultiplier\(position\.x, position\.z\)/);
  assert.match(waves, /GetBlendedEnemySpeedMultiplier\(position\.x, position\.z\)/);
  assert.match(waves, /SurvivalWorldLayout\.ClampInside/);
  assert.match(progression, /GetBlendedXpMultiplier/);
  assert.match(catalog, /weights\.WarehouseB4/);
  assert.match(catalog, /weights\.ContainerTerminal/);
  assert.match(catalog, /weights\.ColdStorage/);
  assert.match(catalog, /weights\.NightSorting/);
  assert.match(sourceBlend, /SURVIVAL_WORLD_BLEND_HALF_WIDTH_METERS = 11/);
  assert.match(sourceBlend, /SURVIVAL_WORLD_BLEND_HALF_DEPTH_METERS = 11/);
});

test('Unity wave spawning skips obstructed positions instead of using an unsafe fallback', async () => {
  const director = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs');
  assert.match(director, /private bool TryGetSpawnPosition\(/);
  assert.match(director, /private static bool IsSpawnPositionClear\(/);
  assert.match(director, /clearanceFromPlayer/);
  assert.match(director, /Physics\.CheckSphere/);
  assert.match(director, /if \(SpawnEnemy\(kind, angle, radius\)\)/);
  assert.match(director, /_hordeSpawnTimer = 0\.20f/);
  assert.match(director, /BOSS CZEKA NA WOLNE MIEJSCE DO WEJŚCIA/);
  assert.doesNotMatch(director, /private Vector3 GetSpawnPosition\(/);
});

test('Every Unity Survival weapon evolution requires an obtainable and implemented passive', async () => {
  const [catalog, progression, weapons] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponCatalog.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs'),
  ]);
  const passiveBlock = catalog.match(/private static readonly string\[\] PassiveIds\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(passiveBlock, 'missing passive ID catalogue');
  const passiveIds = new Set([...passiveBlock[1].matchAll(/"([^"]+)"/g)].map(match => match[1]));
  const profiles = [...catalog.matchAll(/Make\(SurvivalWeaponKind\.([A-Za-z0-9_]+),[^\n]*,\s*"([a-z_]+)"\),?/g)];
  assert.equal(profiles.length, 12, 'all 12 weapons need an evolution passive');
  for (const [, weapon, passive] of profiles) {
    assert.ok(passiveIds.has(passive), weapon + ' evolution passive is not in PassiveIds: ' + passive);
    assert.ok(progression.includes('AddPassive(pool, "' + passive + '"'),
      weapon + ' evolution passive is not offered in drafts: ' + passive);
    assert.ok(
      progression.includes('case "' + passive + '":') || weapons.includes('case "' + passive + '":'),
      weapon + ' evolution passive has no effect handler: ' + passive
    );
  }
  assert.match(progression, /_healthRegenPerSecond/);
  assert.match(progression, /_coinMultiplier/);
});

test('Unity XP pool overflow merges all earned value without a small per-crystal cap', async () => {
  const progression = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs');
  assert.match(progression, /Math\.Min\(int\.MaxValue, \(long\)closest\.Value \+ value\)/);
  assert.doesNotMatch(progression, /Mathf\.Min\(40, closest\.Value \+ value\)/);
});

test('Unity run replacement restores quality synchronously before the old world is destroyed', async () => {
  const [factory, governor] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalPerformanceGovernor.cs'),
  ]);
  assert.match(factory, /governor\?\.Shutdown\(\)/);
  assert.match(governor, /public void Shutdown\(\)/);
  assert.match(governor, /_initialized = false/);
  assert.match(governor, /private void OnDestroy\(\)[\s\S]*?Shutdown\(\)/);
});

test('Unity Campaign final boss flags can only be earned inside the terminal boss arena', async () => {
  const [mission, factory] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CampaignMissionDirector.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
  ]);
  assert.match(mission, /FinalBossArenaStartX = 185f/);
  assert.match(mission, /x >= FinalBossArenaStartX && enemy\.Kind == EnemyKind\.Walczak/);
  assert.match(mission, /x >= FinalBossArenaStartX && enemy\.Kind == EnemyKind\.KingLeto/);
  assert.match(factory, /new Vector3\(191f, 0\.05f, 7f\)/);
  assert.match(factory, /new Vector3\(191f, 0\.05f, -7f\)/);
  assert.match(factory, /new Vector3\(176f, 0\.05f, 0f\)/);
});

test('Unity Campaign progress uses a namespaced versioned key and migrates the legacy spelling', async () => {
  const campaign = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CampaignMissionDirector.cs');
  assert.match(campaign, /paleciaki\.campaign\.maxUnlockedSector\.v1/);
  assert.match(campaign, /LegacyUnlockedSectorKey = "maxFlizUnlockedSector"/);
  assert.match(campaign, /PlayerPrefs\.HasKey\(UnlockedSectorKey\)/);
  assert.match(campaign, /PlayerPrefs\.SetInt\(UnlockedSectorKey, _maxUnlockedSector\)/);
});

test('Unity operator support AI ignores defeated and stale targets', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  assert.match(kit, /if \(enemy == null \|\| enemy\.IsDefeated\) continue/);
  assert.match(kit, /unit\.PounceTarget\.IsDefeated/);
});

test('Unity run teardown invalidates cached enemy instances before the next session', async () => {
  const [factory, enemy] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs'),
  ]);
  assert.match(factory, /EnemyAgent\.InvalidateSpatialCache\(\)/);
  assert.match(enemy, /public static void InvalidateSpatialCache\(\)/);
  assert.match(enemy, /SeparationBuckets\.Clear\(\)/);
  assert.match(enemy, /_nextSeparationRefreshTime = 0f/);
});

test('Unity run teardown clears persistent in-flight player and enemy projectiles', async () => {
  const [factory, playerShots, enemyShots] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatProjectile.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAttackProjectile.cs'),
  ]);
  assert.match(factory, /CombatProjectile\.ClearAllActive\(\)/);
  assert.match(factory, /EnemyAttackProjectile\.ClearAllActive\(\)/);
  assert.match(playerShots, /public static void ClearAllActive\(\)/);
  assert.match(playerShots, /projectile\.ReturnToPool\(\)/);
  assert.match(enemyShots, /public static void ClearAllActive\(\)/);
  assert.match(enemyShots, /projectile\.ReturnToPool\(\)/);
});

test('Unity operator support units are scoped to the active world and Piotr attack uses shared damage scaling', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  assert.match(kit, /root\.transform\.SetParent\(_player\.transform\.parent, true\)/);
  assert.match(kit, /CombatBalanceCatalog\.ScaleCharacterBasicAttackDamage\(1f, _profile\.BasicAttackDamageMultiplier\)/);
});

test('Unity Survival XP applies the position-based biome bonus exactly once', async () => {
  const [progression, catalog] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameContentCatalog.cs'),
  ]);
  assert.match(progression, /GetBlendedXpMultiplier\(/);
  assert.match(progression, /orb\.Value \* _xpGrowthMultiplier/);
  assert.doesNotMatch(progression, /orb\.Value \* mapXp/);
  assert.match(catalog, /GetBlendedXpMultiplier/);
});

test('Unity Survival weapon ricochets use the full mega-world bounds, not the old arena edge', async () => {
  const weapons = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs');
  assert.match(weapons, /SurvivalWorldLayout\.MinX \+ worldEdgeInset/);
  assert.match(weapons, /SurvivalWorldLayout\.MaxX - worldEdgeInset/);
  assert.match(weapons, /SurvivalWorldLayout\.MinZ \+ worldEdgeInset/);
  assert.match(weapons, /SurvivalWorldLayout\.MaxZ - worldEdgeInset/);
  assert.doesNotMatch(weapons, /Mathf\.Abs\(position\.z\) > 17\.5f/);
});

test('Unity enemy separation recovers from exact overlap with the player', async () => {
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(enemy, /playerDistance < playerClearance/);
  assert.match(enemy, /GetInstanceID\(\) < _target\.GetInstanceID\(\) \? Vector3\.right : Vector3\.left/);
});

test('Unity modal dialogs fit the safe area and stack buttons on narrow screens', async () => {
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  assert.match(hud, /overlayRect\.SetParent\(modalHost, false\)/);
  assert.match(hud, /modalHost\.rect\.width - 24f/);
  assert.match(hud, /modalHost\.rect\.height - 24f/);
  assert.match(hud, /if \(panelWidth < 560f\)/);
  assert.match(hud, /new Vector2\(buttonWidth, 48f\)/);
});

test('Unity procedural map geometry stays inside the intended 120 by 40 metre biome tiles', async () => {
  const [factory, world] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWorldLayout.cs'),
  ]);
  assert.match(factory, /segment\.transform\.localScale = new Vector3\(2\.4f, 1f, 0\.86f\)/);
  assert.match(factory, /float z = gate \* 14f/);
  assert.match(factory, /CreateMapLayout\(map, false\)/);
  assert.match(world, /BiomeHalfWidth = 60f/);
  assert.match(world, /BiomeHalfDepth = 20f/);
  assert.match(world, /ClampInside\(Vector3 position, float inset = 1\.5f\)/);
});

test('Unity weapon projectiles collide with environment before damaging enemies behind walls', async () => {
  const weapons = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs');
  assert.match(weapons, /RaycastHit\[\] _worldHitBuffer = new RaycastHit\[24\]/);
  assert.match(weapons, /Physics\.SphereCastNonAlloc\(/);
  assert.match(weapons, /GetComponentInParent<EnemyAgent>\(\) != null/);
  assert.match(weapons, /GetComponentInParent<PlayerController>\(\) != null/);
  assert.match(weapons, /worldHitDistance < firstEnemyDistance/);
  assert.match(weapons, /ApplyAreaDamage\(worldImpactPoint, shot\.AoeRadius/);
  assert.match(weapons, /firstEnemyDistance \+ 0\.08f/);
});

test('Unity Survival HUD shows and updates the live secret count without covering touch controls', async () => {
  const [hud, pickup] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalSecretPickup.cs'),
  ]);
  assert.match(hud, /SEKRETY  0\/20/);
  assert.match(hud, /public void SetSecretsCount\(int found, int total\)/);
  assert.match(hud, /secretRect\.anchorMin = secretRect\.anchorMax = new Vector2\(0\.5f, 0f\)/);
  assert.match(hud, /secretRect\.anchoredPosition = new Vector2\(0f, 12f\)/);
  assert.match(hud, /Sekrety odkryte: " \+ Mathf\.Clamp\(run\.SecretsFound, 0, 20\) \+ "\/20"/);
  assert.match(pickup, /GameSession\.Current\.SecretsFound = Mathf\.Clamp\(GameSession\.Current\.SecretsFound \+ 1, 0, 20\)/);
  assert.match(pickup, /hud\?\.SetSecretsCount\(GameSession\.Current\.SecretsFound, 20\)/);
});

test('Unity Survival game-over summary reports the number of discovered secrets', async () => {
  const [hud, domain] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs'),
  ]);
  assert.match(domain, /public int SecretsFound/);
  assert.match(hud, /string secretReport = run\.Mode == GameMode\.Survival/);
  assert.match(hud, /Sekrety odkryte: " \+ Mathf\.Clamp\(run\.SecretsFound, 0, 20\) \+ "\/20"/);
  assert.match(hud, /wave \+ secretReport \+ "\\nOperator:/);
});

test('Unity mega-world places all five secrets in each of the four biome coordinate frames', async () => {
  const [catalog, domain, factory, pickup] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameContentCatalog.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalSecretPickup.cs'),
  ]);
  assert.match(domain, /Necronomicon = 4/);
  const mapBlocks = [...catalog.matchAll(/Secrets = new\[\]\s*\{([\s\S]*?)\}/g)];
  assert.equal(mapBlocks.length, 4);
  for (const [index, block] of mapBlocks.entries())
    assert.equal((block[1].match(/Secret\("/g) || []).length, 5, 'biome ' + index + ' needs five secrets');
  assert.equal((catalog.match(/Secret\("necronomicon"/g) || []).length, 4);
  assert.match(factory, /foreach \(SurvivalSecretDefinition definition in map\.Secrets\)/);
  assert.match(factory, /zone\.Center\.x \+ definition\.Position\.x/);
  assert.match(factory, /zone\.Center\.y \+ definition\.Position\.y/);
  assert.match(factory, /CreateUnifiedSurvivalSecrets\(\)/);
  assert.match(pickup, /OnTriggerEnter\(Collider other\)/);
  assert.match(pickup, /paleciaki\.survival\.secret\.v1\./);
  assert.match(pickup, /GameSession\.Current\.SecretsFound = Mathf\.Clamp\(GameSession\.Current\.SecretsFound \+ 1, 0, 20\)/);
});

test('Unity Rabbit Hole and Necronomicon open separate touch-ready 2D encounters while Survival is paused', async () => {
  const [pickup, encounter] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalSecretPickup.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalSecretEncounterController.cs'),
  ]);
  assert.match(pickup, /SurvivalSecretEncounterController\.Open\(player, _definition\.Style\)/);
  assert.match(encounter, /public static void Open\(PlayerController player, SurvivalSecretStyle style\)/);
  assert.match(encounter, /GameSession\.SetState\(GameFlowState\.LevelUp\)/);
  assert.match(encounter, /Time\.timeScale = 0f/);
  assert.match(encounter, /private void UpdateRabbitHole\(float dt\)/);
  assert.match(encounter, /private void UpdateNecronomicon\(float dt\)/);
  assert.match(encounter, /private enum BossAttack \{ Slam, Lash, Grab \}/);
  assert.match(encounter, /private const float RabbitScale = 0\.64f/);
  assert.match(encounter, /_rabbitTime = 68f/);
  assert.match(encounter, /_rabbitLives = 3/);
  assert.match(encounter, /_rabbitCollected == 3/);
  assert.match(encounter, /_cthulhuBossHp = 180f/);
  assert.match(encounter, /_cthulhuBossOpen = 2\.15f/);
  assert.match(encounter, /GameSession\.Current\.Score \+= 6000/);
  assert.match(encounter, /_player\.IncreaseMaxHealth\(1\)/);
  assert.match(encounter, /CreateHoldButton/);
  assert.match(encounter, /Keyboard\.current/);
});

test('Unity player initialization clears stale damage, movement, jump and defeated state', async () => {
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  const initialize = player.slice(player.indexOf('public void Initialize('), player.indexOf('public void RequestJump()'));
  for (const token of [
    '_verticalSpeed = 0f',
    '_hitInvulnerabilityRemaining = 0f',
    '_incomingDamageRemainder = 0f',
    '_survivalMoveMultiplier = 1f',
    '_survivalDefenseMultiplier = 1f',
    '_survivalShieldCharges = 0',
    '_jumpRequested = false',
    '_airJumpUsed = false',
    '_attackRequested = false',
    '_abilityRequested = false',
    '_defeated = false',
    '_currentHealth = MaxHealth',
  ]) assert.ok(initialize.includes(token), 'missing player run-state reset: ' + token);
});

test('Unity enemy overkill clamps health to zero but records only actual remaining HP', async () => {
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(enemy, /float actualDamage = Mathf\.Min\(Mathf\.Max\(0f, _health\), balancedDamage\)/);
  assert.match(enemy, /_health = Mathf\.Max\(0f, _health - balancedDamage\)/);
  assert.match(enemy, /RecordWeaponDamage\(weaponSource\.Value, actualDamage\)/);
});

test('Unity enemy navigation includes conveyor belts that exceed the player step height', async () => {
  const [navigation, factory] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyNavigationWorld.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
  ]);
  assert.match(navigation, /value\.max\.y < 0\.35f/);
  assert.match(navigation, /value\.size\.y < 0\.35f/);
  assert.match(factory, /new Vector3\(3\.7f, 0\.48f, 28f\)/);
  assert.match(factory, /private static void CreateNightSortingLayout/);
});

test('Unity melee, ranged and charger attacks respect warehouse obstacle line of sight', async () => {
  const [navigation, enemy] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyNavigationWorld.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs'),
  ]);
  assert.match(navigation, /public static bool HasClearLineToTarget/);
  assert.match(navigation, /private bool HasClearPath/);
  assert.match(navigation, /_obstacleCells/);
  assert.match(enemy, /private bool HasClearAttackLine\(\)/);
  assert.match(enemy, /if \(!HasClearAttackLine\(\)\)/);
  assert.match(enemy, /clearAttackLine && _attackTimer <= 0f/);
  assert.match(enemy, /&& HasClearAttackLine\(\)/);
});

test('Unity navigation uses an 8 metre spatial broad phase instead of scanning every collider per actor', async () => {
  const navigation = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyNavigationWorld.cs');
  assert.match(navigation, /SpatialCellSize = 8f/);
  assert.match(navigation, /Dictionary<Vector2Int, List<int>> _obstacleCells/);
  assert.match(navigation, /_seenObstacleVersion\[i\] == _queryVersion/);
  assert.match(navigation, /_seenObstacleVersion\[index\] == _queryVersion/);
  assert.match(navigation, /RefreshObstacles\(\)/);
});

test('Unity enemy navigation snapshots world colliders and steers around expanded obstacles', async () => {
  const [navigation, enemy, factory, campaign] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyNavigationWorld.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CampaignMissionDirector.cs'),
  ]);
  assert.match(navigation, /GetComponentsInChildren<Collider>\(true\)/);
  assert.match(navigation, /collider\.isTrigger/);
  assert.match(navigation, /TryRayBoxEntry/);
  assert.match(navigation, /WaypointPadding/);
  assert.match(navigation, /GetInsideObstacleEscape/);
  assert.match(navigation, /DefaultLookAhead = 4\.2f/);
  assert.match(enemy, /EnemyNavigationWorld\.GetObstacleAvoidanceVector/);
  assert.match(enemy, /Vector3\.Dot\(direction, targetDirection\) > 0\.35f/);
  assert.match(factory, /navigation\.Initialize\(_worldRoot\)/);
  assert.match(campaign, /EnemyNavigationWorld\.RefreshActive\(\)/);
});

test('Unity virtual joystick keeps one touch pointer and ignores unrelated finger release', async () => {
  const joystick = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/VirtualJoystick.cs');
  assert.match(joystick, /private int _activePointerId = int\.MinValue/);
  assert.match(joystick, /if \(_activePointerId != int\.MinValue\) return/);
  assert.match(joystick, /_activePointerId = eventData\.pointerId/);
  assert.match(joystick, /if \(_activePointerId != eventData\.pointerId\) return/);
  assert.match(joystick, /_activePointerId = int\.MinValue/);
});

test('Unity UI always routes touch and pointer input through the New Input System', async () => {
  const [installer, menu, hud] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/UiEventSystemInstaller.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainMenuController.cs'),
    read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs'),
  ]);
  assert.match(installer, /GetComponent<InputSystemUIInputModule>/);
  assert.match(installer, /GetComponents<BaseInputModule>/);
  assert.match(installer, /module\.enabled = false/);
  assert.match(installer, /SingleMouseOrPenButMultiTouchAndTrack/);
  assert.match(menu, /UiEventSystemInstaller\.Ensure\(\)/);
  assert.match(hud, /UiEventSystemInstaller\.Ensure\(\)/);
});

test('Unity main menu sizes cards and footer inside narrow safe areas', async () => {
  const menu = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainMenuController.cs');
  assert.match(menu, /Screen\.safeArea\.width \/ canvasScale/);
  assert.match(menu, /Mathf\.Clamp\(safeWidth - 24f, 200f, 1120f\)/);
  assert.match(menu, /Mathf\.Clamp\(safeWidth - 24f, 200f, 560f\)/);
  assert.match(menu, /Screen\.safeArea\.width \/ scale \* 0\.89f - 36f/);
  assert.match(menu, /Mathf\.Max\(72f, innerWidth \/ columns\)/);
  assert.match(menu, /viewportBottom/);
  assert.match(menu, /compactScale/);
});

test('Unity project setup guards the known Android resume/back regression and enables paced frames', async () => {
  const [setup, readme] = await Promise.all([
    read('../unity/MaxFlixUnity/Assets/Editor/UnityProjectSetup.cs'),
    read('../unity/MaxFlixUnity/README.md'),
  ]);
  assert.match(setup, /PlayerSettings\.runInBackground = false/);
  assert.match(setup, /PlayerSettings\.Android\.predictiveBackSupport = false/);
  assert.match(setup, /PlayerSettings\.Android\.optimizedFramePacing = true/);
  assert.match(readme, /migration foundation/);
});

test('Unity production cutover remains blocked while the Three.js game stays production', async () => {
  const [plan, readme, workflow] = await Promise.all([
    read('../docs/UNITY_MIGRATION_PLAN.md'),
    read('../unity/MaxFlixUnity/README.md'),
    read('../.github/workflows/unity-validation.yml'),
  ]);
  assert.match(plan, /To nadal nie jest gotowa migracja produktu/);
  assert.match(plan, /240 × 80 m/);
  assert.match(readme, /current Three\.js game remains the production build/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\\s{2}push:/m);
  assert.doesNotMatch(workflow, /upload-google-play|deploy-pages/);
});
