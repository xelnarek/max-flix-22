import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival anomaly RNG is wired into the real run director and announcements', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /createSurvivalAnomalyState\(\)/);
  assert.match(game, /advanceSurvivalAnomaly\(/);
  assert.match(game, /anomalyNeedsSelection \? Math\.random\(\) : 0\.5/);
  assert.match(game, /LOSOWE ZDARZENIE MAGAZYNOWE/);
  assert.match(game, /anomalyClock\.expired/);
});

test('anomalies alter enemy pressure, player movement, damage and combat recovery', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /getSurvivalAnomalyModifiers\(this\.survivalAnomaly\)\.enemyAbilityRateMultiplier/);
  assert.match(game, /getSurvivalAnomalyModifiers\(this\.survivalAnomaly\)\.playerDamageDealtMultiplier/);
  assert.match(game, /getSurvivalAnomalyModifiers\(this\.survivalAnomaly\)\.playerDamageTakenMultiplier/);
  assert.match(game, /getSurvivalAnomalyModifiers\(this\.survivalAnomaly\)\.playerMoveMultiplier/);
  assert.match(game, /anomalyModifiers\.spawnIntervalMultiplier/);
  assert.match(game, /anomalyModifiers\.enemyGroupSizeBonus/);
});

test('XP collection and level-up flow uses chance-based enemy drops and anomaly modifiers', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /rollSurvivalXpDrop\(\s*e\.type/);
  assert.match(game, /anomalyXp\.xpDropChanceMultiplier/);
  assert.match(game, /anomalyXp\.xpValueMultiplier/);
  assert.match(game, /anomalyXp\.xpPickupMultiplier/);
  assert.match(game, /if \(xpDrop\) this\.spawnSurvivalXpGem/);
});

test('operator skills are shorter in Survival while their role identity and Campaign durations are preserved', async () => {
  const game = await read('../src/game.ts');
  const balance = await read('../src/characterBalance.ts');
  assert.match(balance, /SURVIVAL_ABILITY_DURATION_MULTIPLIER = 0\.88/);
  assert.match(game, /const abilityDurationScale = this\.gameMode === 'survival'/);
  assert.match(game, /this\.spawnMarcinTank\(abilityDurationScale\)/);
  assert.match(game, /this\.spawnMateuszRivals\(abilityDurationScale\)/);
  assert.match(game, /this\.spawnMafiCapybaras\(abilityDamageMultiplier, abilityDurationScale\)/);
  assert.match(game, /const duration = \(this\.gameMode === 'survival' \? 6\.0 : 8\.0\) \* Math\.max\(0\.1, durationMultiplier\)/);
});

test('XP requirement progression rises materially above the old fast early thresholds', async () => {
  const progression = await read('../src/survivalProgression.ts');
  assert.match(progression, /if \(current === 1\) return 22/);
  assert.match(progression, /if \(current === 2\) return 30/);
  assert.match(progression, /16 \+ current \* 3\.3/);
});
