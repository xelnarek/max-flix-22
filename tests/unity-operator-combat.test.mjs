import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Unity combat kit has individual primary attack paths for all five legacy operators', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  for (const id of ['Marcin', 'Grzesiek', 'Dawid', 'Mateusz', 'Piotr']) {
    assert.match(kit, new RegExp('case OperatorId\.' + id + ':'));
  }
  assert.match(kit, /_primaryCount % 3/);
  assert.match(kit, /_mateuszHitCount % 9/);
  assert.match(kit, /returnToOwner/);
  assert.match(kit, /_shieldRemaining = 3\.5f/);
});

test('Unity operator abilities preserve source cooldown and mode-specific summon durations', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  const catalog = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCatalog.cs');
  for (const cooldown of ['17.0f', '12.0f', '13.0f', '16.0f', '16.5f']) {
    assert.ok(catalog.includes('AbilityCooldownSeconds = ' + cooldown), 'missing cooldown ' + cooldown);
  }
  assert.match(kit, /mode == GameMode\.Survival \? 6f : 8f/);
  assert.match(kit, /mode == GameMode\.Survival \? 6\.5f : 9\.5f/);
  assert.match(kit, /DamageNearbyEnemies\(5\.2f, 3f/);
  assert.match(kit, /for \(int i = -2; i <= 2; i\+\+\)/);
  assert.match(kit, /SpawnSupport\(SupportStyle\.Capybara, i, 8\.5f/);
});

test('Mateusz Speedrun passive counts confirmed hits rather than projectiles fired', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  const projectile = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatProjectile.cs');
  const mateuszAttack = kit.slice(kit.indexOf('case OperatorId.Mateusz:'), kit.indexOf('case OperatorId.Piotr:'));
  const hitHandler = kit.slice(kit.indexOf('public void OnPrimaryHit()'), kit.indexOf('public bool TryActivateAbility('));
  assert.match(mateuszAttack, /false, 1\.4f, true/);
  assert.doesNotMatch(mateuszAttack, /_mateuszHitCount\+\+/);
  assert.match(hitHandler, /_mateuszHitCount\+\+/);
  assert.match(player, /public void RecordPrimaryHit\(\)/);
  assert.match(projectile, /_ownerPlayer\.RecordPrimaryHit\(\)/);
  assert.match(projectile, /_countsForMateuszPassive/);
});

test('Unity projectiles implement piercing, return path and on-hit status effects', async () => {
  const projectile = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatProjectile.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(projectile, /_pierceRemaining/);
  assert.match(projectile, /BeginReturn\(\)/);
  assert.match(projectile, /_hitTargets/);
  assert.match(projectile, /ApplyCombatHit\(_damage/);
  assert.match(enemy, /_stunRemaining/);
  assert.match(enemy, /_slowMultiplier/);
  assert.match(enemy, /_knockbackVelocity/);
});

test('Unity player supports the ability key, touch request and Piotr double jump', async () => {
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  assert.match(player, /public void RequestAbility\(\)/);
  assert.match(player, /keyboard\.eKey\.wasPressedThisFrame/);
  assert.match(player, /_combatKit\?\.TryActivateAbility/);
  assert.match(player, /_profile\.Id == OperatorId\.Piotr && !_airJumpUsed/);
  assert.match(player, /_combatKit\.MovementMultiplier/);
});

test('Unity HUD exposes a separate special-ability button and cooldown state', async () => {
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  assert.match(hud, /player\.RequestAbility/);
  assert.match(hud, /SetAbilityState\(float remaining, float maximum\)/);
  assert.match(hud, /SPECJALNA\\nGOTOWA/);
  assert.match(hud, /new Vector2\(-390f, 105f\)/);
  assert.match(hud, /_abilityButton\.interactable = ready/);
});

test('Unity CombatBalanceCatalog preserves legacy attack cadence and Survival scaling', async () => {
  const balance = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatBalanceCatalog.cs');
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  for (const value of ['2.10f', '2.28f', '2.08f', '2.00f', '2.34f']) assert.ok(balance.includes(value));
  for (const value of ['1.05f', '1.22f', '1.14f', '1.10f', '1.25f']) assert.ok(balance.includes(value));
  assert.match(balance, /SurvivalOutgoingDamageMultiplier = 0\.62f/);
  assert.match(balance, /SurvivalIncomingDamageMultiplier = 1\.30f/);
  assert.match(balance, /SurvivalHitInvulnerabilitySeconds = 0\.78f/);
  assert.match(balance, /mode == GameMode\.Survival \? 2f : 1\.25f/);
  assert.match(player, /GetPrimaryAttackCooldown\(_profile\.Id, currentMode\)/);
  assert.match(player, /ScaleIncomingDamage\(amount, currentMode\)/);
  assert.match(player, /SurvivalHitInvulnerabilitySeconds/);
  assert.match(enemy, /ScaleOutgoingDamage\(damage, mode\)/);
  assert.match(kit, /GetAbilityCooldown\(_profile\.AbilityCooldownSeconds, mode\)/);
  assert.match(kit, /_hud\.SetAbilityState\(_abilityCooldownRemaining, _abilityCooldownDuration\)/);
});


test('Unity character damage uses the source rounding bounds and fractional armor remainder', async () => {
  const balance = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatBalanceCatalog.cs');
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  assert.match(balance, /ScaleCharacterBasicAttackDamage/);
  assert.match(balance, /Clamp\(multiplier, 0\.5f, 1\.8f\)/);
  assert.match(balance, /Round\(safeDamage \* safeMultiplier \* 10f\) \/ 10f/);
  assert.match(player, /_incomingDamageRemainder/);
  assert.match(player, /Mathf\.Floor\(accumulatedDamage \+ 1e-6f\)/);
  assert.match(player, /_incomingDamageRemainder = Mathf\.Max\(0f, accumulatedDamage - wholeDamage\)/);
});


test('Unity enemy catalog preserves all 23 legacy IDs and the Survival unlock roster', async () => {
  const catalog = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyArchetypeCatalog.cs');
  const domain = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs');
  const enemyKinds = domain.slice(domain.indexOf('public enum EnemyKind'), domain.indexOf('[Serializable]', domain.indexOf('public enum EnemyKind')));
  assert.equal((catalog.match(/Make\(EnemyKind\./g) || []).length, 23);
  for (const id of [
    'Customer', 'Walczak', 'Forklift', 'Architect', 'Inspector', 'AgvRobot',
    'Handlowiec', 'Monter', 'PiorunDrone', 'EliteWalczakGuard', 'Kurier',
    'ItalianVendor', 'CrazyStacker', 'KingLeto', 'PanRoman', 'Serwisant',
    'BosmanKrakow', 'ZombieWorker', 'Pomazaniec', 'Sebix',
    'MutantGammaForklift', 'RadioactivePip', 'CyberSalesman'
  ]) {
    assert.match(enemyKinds, new RegExp(id));
    assert.match(catalog, new RegExp('EnemyKind\.' + id));
  }
  assert.match(catalog, /MinimumSurvivalElapsedSeconds/);
  assert.match(catalog, /GetSurvivalEligible/);
  assert.match(catalog, /ChooseSurvivalSpawnType/);
  assert.match(catalog, /MinimumSurvivalWave/);
  assert.match(catalog, /EnemyKind\.ZombieWorker, EnemyKind\.Kurier, EnemyKind\.CrazyStacker/);
  const roster = catalog.match(/private static readonly EnemyKind\[\] SurvivalRoster\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(roster, 'missing Survival roster block');
  assert.equal((roster[1].match(/EnemyKind\./g) || []).length, 17);
  for (const sourceUnlock of ['MinimumSurvivalWave = minWave', 'MinimumSurvivalElapsedSeconds = minElapsed', 'SurvivalSpawnWeight = spawnWeight']) {
    assert.ok(catalog.includes(sourceUnlock));
  }
});

test('Unity enemy AI has separated melee, ranged, support, charger and boss phases', async () => {
  const agent = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  const projectile = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAttackProjectile.cs');
  const factory = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs');
  for (const style of ['MeleeChaser', 'PatrolRammer', 'Ranged', 'Support', 'Charger', 'Boss']) {
    assert.match(agent, new RegExp('EnemyBehaviorStyle\.' + style));
  }
  assert.match(agent, /TickRanged/);
  assert.match(agent, /TickSupport/);
  assert.match(agent, /TickCharge/);
  assert.match(agent, /_phaseTwoMoveMultiplier/);
  assert.match(agent, /GrantSupportShield/);
  assert.match(agent, /FireRangedAttack/);
  assert.match(projectile, /player\.ApplyDamage\(_damage\)/);
  assert.match(factory, /agent\.Initialize\(player, kind, healthMultiplier, speedMultiplier, abilityRateMultiplier\)/);
  assert.match(factory, /AGV sensor rail/);
  assert.match(factory, /Inspector visor/);
});


test('Unity Survival difficulty curve, horde profile and performance caps match legacy rules', async () => {
  const difficulty = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalDifficultyCatalog.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  const director = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs');
  assert.match(difficulty, /1\.28f \+ Mathf\.Min\(2\.1f, waveIndex \* 0\.085f\)/);
  assert.match(difficulty, /1f \+ Mathf\.Min\(0\.55f, waveIndex \* 0\.018f\)/);
  assert.match(difficulty, /Mathf\.Max\(3f, 5\.5f - waveIndex \* 0\.11f\)/);
  assert.match(difficulty, /Mathf\.Min\(6, Mathf\.FloorToInt\(waveIndex \/ 3f\)\)/);
  assert.match(difficulty, /1\.10f \+ Mathf\.Min\(0\.60f, waveIndex \* 0\.02f\)/);
  assert.match(difficulty, /return tier >= 2 \? 13 : tier == 1 \? 16 : 18/);
  assert.match(difficulty, /return 34/);
  assert.match(difficulty, /EnemyCount = isMobile \? 12 : 16/);
  assert.match(difficulty, /DurationSeconds = 18f/);
  assert.match(difficulty, /SpawnIntervalSeconds = 0\.48f/);
  assert.match(difficulty, /InitialRadius = 13\.4f/);
  assert.match(difficulty, /FinalRadius = 6\.8f/);
  assert.match(director, /WaveDurationSeconds = 60f/);
  assert.match(director, /FirstHordeAtSeconds = 90f/);
  assert.match(director, /BossCadenceSeconds = 300f/);
  assert.match(director, /_bossWarningRemaining = 6f/);
  assert.match(director, /ChooseSurvivalSpawnType/);
  assert.match(director, /DrawHordeRing/);
  assert.match(enemy, /_maxHealth = Mathf\.Max\(1f, _profile\.BaseHealth \* Mathf\.Clamp\(healthMultiplier/);
  assert.match(enemy, /_moveSpeed = _profile\.MoveSpeed \* safeSpeedMultiplier/);
  assert.match(enemy, /_attackTimer = _attackInterval \/ _abilityRateMultiplier/);
});

test('Unity runtime can be initialized in Survival through a mode/map/operator handoff', async () => {
  const bootstrap = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs');
  const factory = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs');
  assert.match(bootstrap, /ConfigureNextRun\(GameMode mode, OperatorId operatorId, WarehouseMapId mapId\)/);
  assert.match(bootstrap, /GameSession\.Begin\(mode, operatorId, mapId\)/);
  assert.match(bootstrap, /WarehouseWorldFactory\.BuildB4Slice\(\)/);
  assert.match(factory, /GameSession\.Current\.Mode == GameMode\.Survival/);
  assert.match(factory, /root\.AddComponent<SurvivalWaveDirector>\(\)/);
});


test('Dawid stretch passive actually fires a three-projectile fan and his five-plate ability can ricochet', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  const projectile = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/CombatProjectile.cs');
  const attack = kit.slice(kit.indexOf('case OperatorId.Dawid:'), kit.indexOf('case OperatorId.Mateusz:'));
  const ability = kit.slice(kit.indexOf('case OperatorId.Dawid:', kit.indexOf('public bool TryActivateAbility')), kit.indexOf('case OperatorId.Mateusz:', kit.indexOf('public bool TryActivateAbility')));
  assert.match(attack, /for \(int i = -1; i <= 1; i\+\+\)/);
  assert.match(attack, /i \* 12f/);
  assert.match(ability, /false, 3\.2f, false, 2/);
  assert.match(kit, /int ricochets = 0/);
  assert.match(projectile, /_ricochetsRemaining/);
  assert.match(projectile, /Vector3\.Reflect/);
});


test('Unity front end starts only implemented modes and selects operator plus one of four maps', async () => {
  const menu = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainMenuController.cs');
  const bootstrap = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs');
  const catalog = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameContentCatalog.cs');
  assert.match(menu, /GameMode\.Survival/);
  assert.match(menu, /GameMode\.Campaign/);
  assert.match(menu, /GameMode\.PvP/);
  assert.match(menu, /null, false, _modeButtons/);
  assert.match(menu, /OperatorCatalog\.All/);
  assert.match(menu, /Enum\.GetValues\(typeof\(WarehouseMapId\)\)/);
  assert.match(menu, /ScrollRect/);
  assert.match(menu, /Screen\.height > Screen\.width/);
  assert.match(menu, /StartRun\(_selectedMode, _selectedOperator, _selectedMap\)/);
  assert.match(bootstrap, /StartupMode \{ get; private set; \} = GameMode\.Survival/);
  assert.match(bootstrap, /MainMenuController\.Create\(this, StartupMode, StartupOperator, StartupMap\)/);
  assert.match(bootstrap, /if \(mode == GameMode\.PvP\) return/);
  assert.equal((catalog.match(/WarehouseMapId\.(WarehouseB4|ContainerTerminal|ColdStorage|NightSorting),\s*new SurvivalMapProfile/g) || []).length, 4);
});

test('selected Survival map changes environment art and applies its health/speed modifiers', async () => {
  const factory = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs');
  const director = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs');
  assert.match(factory, /GameContentCatalog\.GetMap\(GameSession\.Current\.SelectedMap\)/);
  assert.match(factory, /CreateLighting\(map\)/);
  assert.match(factory, /CreateFloor\(map\)/);
  assert.match(factory, /CreateMapSetDressing\(map\)/);
  assert.match(factory, /Port container/);
  assert.match(factory, /Refrigeration condenser/);
  assert.match(factory, /Night conveyor belt/);
  assert.match(director, /_mapProfile = GameContentCatalog\.GetMap/);
  assert.match(director, /profile\.EnemyHealthMultiplier \*= _mapProfile\.EnemyHealthMultiplier/);
  assert.match(director, /profile\.EnemySpeedMultiplier \*= _mapProfile\.EnemySpeedMultiplier/);
  assert.match(director, /GetDifficultyProfile\(_currentWave\)/);
});

test('Unity HUD provides a real pause/resume, game-over summary, retry and return-to-menu flow', async () => {
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  const bootstrap = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs');
  assert.match(hud, /GameFlowState\.Paused/);
  assert.match(hud, /Time\.timeScale = 0f/);
  assert.match(hud, /ResumeGame/);
  assert.match(hud, /keyboard\.escapeKey\.wasPressedThisFrame/);
  assert.match(hud, /PresentGameOver/);
  assert.match(hud, /Najdalsza fala/);
  assert.match(hud, /RetryRun/);
  assert.match(hud, /ReturnToMenu/);
  assert.match(bootstrap, /RestartLastRun/);
  assert.match(bootstrap, /ReturnToMainMenu/);
  assert.match(bootstrap, /WarehouseWorldFactory\.DestroyCurrentWorld/);
});

test('Unity main-menu and HUD restart paths clear the previous world and reset time scale', async () => {
  const bootstrap = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs');
  const factory = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs');
  assert.match(bootstrap, /Time\.timeScale = 1f/);
  assert.match(bootstrap, /WarehouseWorldFactory\.DestroyCurrentWorld\(\)/);
  assert.match(bootstrap, /Destroy\(_menu\.gameObject\)/);
  assert.match(factory, /public static void DestroyCurrentWorld\(\)/);
  assert.match(factory, /_worldRoot = null/);
});


test('Unity Survival weapon catalog defines all twelve timed unlocks, rarities and reload progression', async () => {
  const catalog = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponCatalog.cs');
  const domain = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs');
  const weaponEnum = domain.slice(domain.indexOf('public enum SurvivalWeaponKind'), domain.indexOf('public enum EnemyKind'));
  const roster = catalog.match(/private static readonly SurvivalWeaponProfile\[\] Profiles\s*=\s*\{([\s\S]*?)\n        \};/);
  assert.ok(roster, 'missing Survival weapon profile table');
  assert.equal((roster[1].match(/Make\(SurvivalWeaponKind\./g) || []).length, 12);
  for (const id of [
    'PalletCannon', 'DiamondSaw', 'GlueMine', 'KfcBomber', 'PiorunDrone',
    'ForkliftBolter', 'ScannerPulse', 'OrbitBlades', 'CalacattaShards',
    'SteamBomb', 'ForkliftHorn', 'WzBoomerang'
  ]) assert.match(weaponEnum, new RegExp(id + '\\s*='));
  for (const unlock of ['30f', '55f', '80f', '105f', '130f', '155f', '180f', '205f', '230f', '255f', '280f', '305f'])
    assert.ok(roster[1].includes(unlock), 'missing weapon unlock time ' + unlock);
  assert.match(catalog, /GetReloadSeconds/);
  assert.match(catalog, /GetDispatchInterval\(\) \{ return 1\.05f; \}/);
  assert.match(catalog, /GetInitialLevel/);
  assert.match(catalog, /GetUpgradeSteps/);
  assert.match(catalog, /GetPromotionRarityFloor/);
  assert.match(catalog, /GetRarityStrength/);
  assert.match(catalog, /GetXpRequirement/);
  assert.match(catalog, /GetRankName/);
});

test('Unity Survival weapon behaviors use pooled shots, homing, orbiting, ricochet, AOE and return paths', async () => {
  const weapons = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(weapons, /PoolPerShapeLimit = 28/);
  assert.match(weapons, /_sharedMaterial/);
  assert.match(weapons, /_enemyRefreshRemaining = 0\.22f/);
  for (const id of [
    'PalletCannon', 'DiamondSaw', 'GlueMine', 'KfcBomber', 'PiorunDrone',
    'ForkliftBolter', 'ScannerPulse', 'OrbitBlades', 'CalacattaShards',
    'SteamBomb', 'ForkliftHorn', 'WzBoomerang'
  ]) assert.match(weapons, new RegExp('SurvivalWeaponKind\\.' + id));
  assert.match(weapons, /shot\.Homing/);
  assert.match(weapons, /shot\.Orbiting/);
  assert.match(weapons, /shot\.Returning/);
  assert.match(weapons, /RicochetsRemaining/);
  assert.match(weapons, /ApplyAreaDamage/);
  assert.match(weapons, /HitTargets/);
  assert.match(weapons, /enemy\.ApplyWeaponHit/);
  assert.match(enemy, /ApplyWeaponHit/);
});

test('Unity XP progression has pooled crystals, map XP scaling, level-up drafts and non-empty fallbacks', async () => {
  const progression = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs');
  const player = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/PlayerController.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(progression, /_orbPool\.Count >= 48/);
  assert.match(progression, /Life = 32f/);
  assert.match(progression, /1\.6f \* _magnetMultiplier/);
  assert.match(progression, /map\.XpMultiplier/);
  assert.match(progression, /GetXpRequirement\(_level\)/);
  assert.match(progression, /GameFlowState\.LevelUp/);
  assert.match(progression, /Time\.timeScale = 0f/);
  assert.match(progression, /SurvivalUpgradeCatalog|SurvivalWeaponCatalog\.RollRarity/);
  assert.match(progression, /AddFallbackCard/);
  assert.match(progression, /fallback_repair/);
  assert.match(progression, /fallback_credits/);
  assert.match(progression, /fallback_overdrive/);
  assert.match(progression, /wasBossReward/);
  assert.match(progression, /Text description = CreateText\(rect, card\.Description,[\s\S]*?Vector2\.zero, 17, TextAnchor\.MiddleCenter/);
  assert.match(player, /SetSurvivalMoveMultiplier/);
  assert.match(player, /IncreaseMaxHealth/);
  assert.match(player, /GrantSurvivalShield/);
  assert.match(enemy, /progression\?\.OnEnemyDefeated\(this\)/);
});

test('Unity Survival damage ledger reports only applied HP damage by operator and named weapon', async () => {
  const tracker = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalDamageTracker.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  const weapons = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs');
  const domain = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs');
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  assert.match(tracker, /RecordWeaponDamage/);
  assert.match(tracker, /RecordOperatorDamage/);
  assert.match(enemy, /float actualDamage = Mathf\.Min\(_health, balancedDamage\)/);
  assert.match(tracker, /BuildSummary\(int maximumLines = 5\)/);
  assert.match(enemy, /SurvivalDamageTracker\.RecordWeaponDamage\(weaponSource\.Value, actualDamage\)/);
  assert.match(enemy, /SurvivalDamageTracker\.RecordOperatorDamage\(actualDamage\)/);
  assert.match(weapons, /ApplyWeaponHit/);
  assert.match(domain, /SurvivalDamageTracker\.Reset\(\)/);
  assert.match(hud, /SurvivalDamageTracker\.BuildSummary\(5\)/);
  assert.match(hud, /OBRAŻENIA WG ŹRÓDŁA/);
});


test('Unity Survival damage report attributes effective damage and displays percentages at game over', async () => {
  const tracker = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalDamageTracker.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  const weapons = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs');
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  const session = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/GameDomain.cs');
  assert.match(tracker, /RecordWeaponDamage/);
  assert.match(tracker, /RecordOperatorDamage/);
  assert.match(tracker, /rows\[i\]\.Value \/ _totalDamage \* 100f/);
  assert.match(tracker, /BuildSummary\(int maximumLines = 5\)/);
  assert.match(enemy, /float actualDamage = Mathf\.Min\(_health, balancedDamage\)/);
  assert.match(enemy, /SurvivalDamageTracker\.RecordWeaponDamage\(weaponSource\.Value, actualDamage\)/);
  assert.match(enemy, /SurvivalDamageTracker\.RecordOperatorDamage\(actualDamage\)/);
  assert.match(weapons, /ApplyWeaponHit/);
  assert.match(weapons, /shot\.WeaponId/);
  assert.match(session, /if \(mode == GameMode\.Survival\) SurvivalDamageTracker\.Reset\(\)/);
  assert.match(hud, /SurvivalDamageTracker\.BuildSummary\(5\)/);
  assert.match(hud, /OBRAŻENIA WG ŹRÓDŁA/);
  assert.match(hud, /Bossowie:/);
});

test('Unity late-run upgrade fallback always has three real effects when the normal pool is empty', async () => {
  const progression = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs');
  const weapons = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWeaponController.cs');
  assert.match(progression, /fallback_repair/);
  assert.match(progression, /fallback_credits/);
  assert.match(progression, /fallback_overdrive/);
  assert.match(progression, /_player\.RestoreHealth\(2f\)/);
  assert.match(progression, /GameSession\.Current\.Coins \+= 25/);
  assert.match(progression, /_weapons\.GrantOverdrive\(12f, 1\.25f, 0\.82f\)/);
  assert.match(weapons, /public void GrantOverdrive\(float duration, float damageMultiplier, float reloadMultiplier\)/);
  assert.match(weapons, /_overdriveRemaining/);
  assert.match(weapons, /_overdriveDamageMultiplier/);
  assert.match(weapons, /_overdriveReloadMultiplier/);
});

test('Unity Survival draft is responsive, has a valid text factory call, and blocks reroll during boss rewards', async () => {
  const progression = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs');
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  assert.match(progression, /Text description = CreateText\(rect, card\.Description,[\s\S]*?Vector2\.zero, 17, TextAnchor\.MiddleCenter/);
  assert.match(progression, /bool canReroll = _rerolls > 0 && !_isBossReward/);
  assert.match(progression, /portrait \? 1 : Mathf\.Min\(3/);
  assert.match(progression, /Mathf\.Clamp\(availableHeight \/ Mathf\.Max\(1, _currentCards\.Count\), 108f, 154f\)/);
  assert.match(progression, /GameFlowState\.LevelUp/);
  assert.match(hud, /GameFlowState\.Paused/);
  assert.match(hud, /GameFlowState\.GameOver/);
});


test('Unity Survival world attaches and initializes wave director, pooled weapons and XP progression', async () => {
  const factory = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/WarehouseWorldFactory.cs');
  const bootstrap = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainGameBootstrap.cs');
  const enemy = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(factory, /root\.AddComponent<SurvivalWeaponController>\(\)/);
  assert.match(factory, /root\.AddComponent<SurvivalProgressionController>\(\)/);
  assert.match(factory, /root\.AddComponent<SurvivalWaveDirector>\(\)/);
  assert.match(factory, /SpawnSurvivalEnemy/);
  assert.match(bootstrap, /GetComponentInParent<SurvivalWeaponController>\(\)/);
  assert.match(bootstrap, /GetComponentInParent<SurvivalProgressionController>\(\)/);
  assert.match(bootstrap, /weaponController\.Initialize\(player, _hud, progressionController\)/);
  assert.match(bootstrap, /progressionController\.Initialize\(player, _hud, weaponController\)/);
  assert.match(enemy, /GetComponentInParent<SurvivalProgressionController>\(\)/);
});


test('Unity Survival director matches rare Sebix and Bosman encounters plus an evenly spaced contracting horde', async () => {
  const director = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs');
  const encounters = director.slice(director.indexOf('private void SpawnRegularSurvivalEnemy'), director.indexOf('private bool HasActiveEnemyKind'));
  assert.match(encounters, /_currentWave >= 8/);
  assert.match(encounters, /Random\.value < 0\.065f/);
  assert.match(encounters, /EnemyKind\.Sebix/);
  assert.match(encounters, /_currentWave >= 6/);
  assert.match(encounters, /Random\.value < 0\.04f/);
  assert.match(encounters, /EnemyKind\.BosmanKrakow/);
  assert.match(director, /HasActiveEnemyKind\(EnemyKind\.Sebix\)/);
  assert.match(director, /HasActiveEnemyKind\(EnemyKind\.BosmanKrakow\)/);
  assert.match(director, /_hordeStartAngle/);
  assert.match(director, /_hordeSpawned \/ \(float\)Mathf\.Max\(1, _hordeProfile\.EnemyCount\)/);
  assert.match(director, /SurvivalHordeCatalog\.GetContractingRadius/);
});

test('Unity enemy AI separates nearby enemies and preserves clearance around the player', async () => {
  const agent = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/EnemyAgent.cs');
  assert.match(agent, /_separationCache/);
  assert.match(agent, /_nextSeparationRefreshTime = Time\.time \+ 0\.16f/);
  assert.match(agent, /ApplySeparation\(deltaTime\)/);
  assert.match(agent, /desiredDistance = \(_profile != null && _profile\.IsBoss \? 1\.48f : 1\.12f\)/);
  assert.match(agent, /const float playerClearance = 1\.15f/);
  assert.match(agent, /Vector3\.ClampMagnitude\(force \* 3\.4f, 3\.8f\)/);
});

test('Unity only opens legendary boss rewards for the three rotating major Survival bosses', async () => {
  const progression = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalProgressionController.cs');
  const encounters = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/SurvivalWaveDirector.cs');
  const rewardCondition = progression.slice(progression.indexOf('bool majorBoss'), progression.indexOf('OpenBossReward();') + 20);
  assert.match(rewardCondition, /EnemyKind\.Walczak/);
  assert.match(rewardCondition, /EnemyKind\.KingLeto/);
  assert.match(rewardCondition, /EnemyKind\.BosmanKrakow/);
  assert.doesNotMatch(rewardCondition, /EnemyKind\.Sebix/);
  assert.match(encounters, /GetBossKind/);
  assert.match(encounters, /cycle === 1|cycle/);
});
