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
  assert.match(bootstrap, /GameSession\.Begin\(StartupMode, StartupOperator, StartupMap\)/);
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
