import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalUpgradeRarityMeta,
  getSurvivalWeaponInitialLevel,
  getSurvivalWeaponUpgradeSteps,
  rollSurvivalUpgradeRarity,
} from '../src/survivalRarity.ts';

test('rarity thresholds are deterministic, ordered and bounded', () => {
  assert.equal(rollSurvivalUpgradeRarity(0.005, 1), 'legendary');
  assert.equal(rollSurvivalUpgradeRarity(0.05, 1), 'epic');
  assert.equal(rollSurvivalUpgradeRarity(0.20, 1), 'rare');
  assert.equal(rollSurvivalUpgradeRarity(0.90, 1), 'common');
  assert.equal(rollSurvivalUpgradeRarity(-1, 1), 'legendary');
  assert.equal(rollSurvivalUpgradeRarity(5, 1), 'common');
  assert.equal(rollSurvivalUpgradeRarity(Number.NaN, 1), 'common');
});

test('better rarities become modestly more likely later in a run', () => {
  assert.equal(rollSurvivalUpgradeRarity(0.09, 1), 'rare');
  assert.equal(rollSurvivalUpgradeRarity(0.09, 40), 'epic');
  assert.equal(rollSurvivalUpgradeRarity(0.02, 1), 'epic');
  assert.equal(rollSurvivalUpgradeRarity(0.02, 40), 'legendary');
});

test('rarity strength increases monotonically without changing base choices', () => {
  const common = getSurvivalUpgradeRarityMeta('common');
  const rare = getSurvivalUpgradeRarityMeta('rare');
  const epic = getSurvivalUpgradeRarityMeta('epic');
  const legendary = getSurvivalUpgradeRarityMeta('legendary');
  assert.equal(common.rarityLabel, 'ZWYKŁA');
  assert.ok(common.strengthMultiplier < rare.strengthMultiplier);
  assert.ok(rare.strengthMultiplier < epic.strengthMultiplier);
  assert.ok(epic.strengthMultiplier < legendary.strengthMultiplier);
});

test('high-rarity weapon offers grant bounded head starts', () => {
  assert.equal(getSurvivalWeaponInitialLevel('common'), 1);
  assert.equal(getSurvivalWeaponInitialLevel('rare'), 1);
  assert.equal(getSurvivalWeaponInitialLevel('epic'), 2);
  assert.equal(getSurvivalWeaponInitialLevel('legendary'), 3);
  assert.equal(getSurvivalWeaponUpgradeSteps('legendary'), 2);
  assert.equal(getSurvivalWeaponUpgradeSteps('epic'), 1);
});
