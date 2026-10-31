import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_ATTACK_COOLDOWN_SECONDS,
  SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS,
  SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS,
  SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR,
  SURVIVAL_WEAPON_UNLOCK_SECONDS,
  getAbilityCooldownSeconds,
  getBaseAttackCooldownSeconds,
  getSurvivalWeaponReloadSeconds,
  getWeaponRecoveryAfterUpgrade,
} from '../src/combatBalance.ts';

const characters = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

test('campaign basic attacks use deliberate character-specific recovery windows', () => {
  for (const character of characters) {
    const cooldown = getBaseAttackCooldownSeconds(character, 'campaign');
    assert.ok(cooldown >= 1.05 && cooldown <= 1.25, character + ': ' + cooldown);
  }
  assert.equal(new Set(Object.values(CAMPAIGN_ATTACK_COOLDOWN_SECONDS)).size, 5);
});

test('Survival basic attack timing remains separate from campaign balancing', () => {
  for (const character of characters) {
    assert.equal(getBaseAttackCooldownSeconds(character, 'survival'), SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS);
  }
});

test('ability cooldown scaling is consistent across both game modes', () => {
  assert.equal(getAbilityCooldownSeconds(12, 'campaign'), 15);
  assert.equal(getAbilityCooldownSeconds(12, 'survival'), 24);
  assert.equal(getAbilityCooldownSeconds(Number.NaN, 'campaign'), 0);
});

test('weapon reload improves gradually without the previous large late-level reduction', () => {
  const base = 10;
  assert.equal(getSurvivalWeaponReloadSeconds(base, 1), 10);
  assert.equal(getSurvivalWeaponReloadSeconds(base, 5), 8.8);
  assert.equal(getSurvivalWeaponReloadSeconds(base, 5, true), 7.92);
  assert.ok(getSurvivalWeaponReloadSeconds(base, 5, true) > base * 0.78 * 0.82);
});

test('weapon upgrades and evolution cannot instantly discharge a ready weapon', () => {
  assert.equal(SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR, 0.75);
  assert.equal(getWeaponRecoveryAfterUpgrade(0, 10), 3.5);
  assert.equal(getWeaponRecoveryAfterUpgrade(4, 10), 4);
  assert.equal(getWeaponRecoveryAfterUpgrade(6, 10), 6);
});

test('weapon unlocks start after two minutes and advance in controlled 90-second steps', () => {
  const times = Object.values(SURVIVAL_WEAPON_UNLOCK_SECONDS);
  assert.equal(times[0], 120);
  assert.equal(times[times.length - 1], 1110);
  for (let i = 1; i < times.length; i++) assert.equal(times[i] - times[i - 1], 90);
  assert.equal(SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS, 1.05);
});
