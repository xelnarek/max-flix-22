import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Unity combat kit has individual primary attack paths for all five legacy operators', async () => {
  const kit = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/OperatorCombatKit.cs');
  for (const id of ['Marcin', 'Grzesiek', 'Dawid', 'Mateusz', 'Piotr']) {
    assert.match(kit, new RegExp('case OperatorId\\.' + id + ':'));
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
