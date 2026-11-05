import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalBossRewardOptions } from '../src/survivalBossRewards.ts';

test('boss rewards are three unique legendary choices', () => {
  const options = createSurvivalBossRewardOptions();
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((option) => option.id)).size, 3);
  assert.deepEqual(options.map((option) => option.id), [
    'boss_damage_core',
    'boss_weapon_overdrive',
    'boss_bulwark',
  ]);
  for (const option of options) {
    assert.equal(option.rarity, 'legendary');
    assert.equal(option.rarityLabel, 'LEGENDARNA');
    assert.equal(option.strengthMultiplier, 1.75);
  }
});

test('boss reward can unlock a new weapon at legendary level three', () => {
  const options = createSurvivalBossRewardOptions({
    kind: 'unlock',
    id: 'diamond_saw',
    name: 'Tarcza diamentowa',
    icon: '💿',
  });
  assert.equal(options[1].id, 'weapon_unlock:diamond_saw');
  assert.match(options[1].title, /TARCZA DIAMENTOWA/);
  assert.match(options[1].description, /3\/5/);
});

test('boss reward advances an owned weapon by two levels, capped at five', () => {
  const options = createSurvivalBossRewardOptions({
    kind: 'upgrade',
    id: 'diamond_saw',
    name: 'Tarcza diamentowa',
    icon: '💿',
    currentLevel: 3,
  });
  assert.equal(options[1].id, 'weapon_upgrade:diamond_saw');
  assert.match(options[1].title, /POZIOM 5/);
  assert.match(options[1].description, /3 → 5\/5/);
});

test('boss reward has a useful fallback when every weapon is maxed', () => {
  const options = createSurvivalBossRewardOptions();
  assert.equal(options[1].id, 'boss_weapon_overdrive');
  assert.match(options[1].description, /8% szybciej/);
});
