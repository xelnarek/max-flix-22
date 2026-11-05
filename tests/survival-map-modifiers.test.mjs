import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySurvivalMapCombatModifier,
  getSurvivalMapDefinition,
  SURVIVAL_MAP_IDS,
} from '../src/survivalMaps.ts';

test('warehouse B4 remains the neutral baseline', () => {
  assert.deepEqual(
    applySurvivalMapCombatModifier({ maxHp: 12, speed: 3.5 }, 'warehouse_b4'),
    { maxHp: 12, speed: 3.5, xpMultiplier: 1 },
  );
});

test('container terminal trades a little enemy durability for faster pressure and more XP', () => {
  const result = applySurvivalMapCombatModifier({ maxHp: 20, speed: 3 }, 'container_terminal');
  assert.deepEqual(result, { maxHp: 19, speed: 3.24, xpMultiplier: 1.12 });
  assert.match(getSurvivalMapDefinition('container_terminal').combatModifier.description, /8% szybciej/);
});

test('cold storage trades enemy speed for extra durability and the same XP bonus', () => {
  const result = applySurvivalMapCombatModifier({ maxHp: 20, speed: 3 }, 'cold_storage');
  assert.deepEqual(result, { maxHp: 23, speed: 2.7, xpMultiplier: 1.12 });
  assert.match(getSurvivalMapDefinition('cold_storage').combatModifier.description, /spowalnia przeciwników o 10%/);
});

test('every map defines a complete combat modifier and invalid stats remain finite', () => {
  for (const mapId of SURVIVAL_MAP_IDS) {
    const modifier = getSurvivalMapDefinition(mapId).combatModifier;
    assert.ok(modifier.title.length > 3);
    assert.ok(modifier.subtitle.length > 3);
    assert.ok(modifier.description.length > 10);
    const result = applySurvivalMapCombatModifier(
      { maxHp: Number.NaN, speed: Number.POSITIVE_INFINITY },
      mapId,
    );
    assert.ok(Number.isFinite(result.maxHp) && result.maxHp >= 1);
    assert.ok(Number.isFinite(result.speed) && result.speed >= 0.1);
    assert.ok(Number.isFinite(result.xpMultiplier) && result.xpMultiplier >= 1);
  }
});
