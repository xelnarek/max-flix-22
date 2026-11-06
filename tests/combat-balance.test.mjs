import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_ATTACK_COOLDOWN_SECONDS,
  PRIMARY_ATTACK_ORIGIN_OFFSET_METERS,
  PRIMARY_ATTACK_RANGE_METERS,
  PIOTR_BOOMERANG_OUTBOUND_LIFETIME_FRACTION,
  SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS,
  SURVIVAL_AUTO_AIM_RANGE_METERS,
  SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS,
  SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR,
  SURVIVAL_WEAPON_UNLOCK_SECONDS,
  getAbilityCooldownSeconds,
  getBaseAttackCooldownSeconds,
  getPiotrBoomerangMaxLifeSeconds,
  getPrimaryAttackLifetimeSeconds,
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

test('Survival basic attacks recover quickly while preserving role-based cadence', () => {
  const cooldowns = characters.map((character) => getBaseAttackCooldownSeconds(character, 'survival'));
  for (const character of characters) {
    assert.equal(getBaseAttackCooldownSeconds(character, 'survival'), SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS[character]);
    assert.ok(SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS[character] >= 1.9);
    assert.ok(SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS[character] <= 2.4);
  }
  assert.equal(new Set(cooldowns).size, characters.length);
  assert.equal(SURVIVAL_AUTO_AIM_RANGE_METERS, 22);
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
  assert.ok(Math.abs(getSurvivalWeaponReloadSeconds(base, 5, true) - 7.92) < 1e-9);
  assert.ok(getSurvivalWeaponReloadSeconds(base, 5, true) > base * 0.78 * 0.82);
});

test('weapon upgrades and evolution cannot instantly discharge a ready weapon', () => {
  assert.equal(SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR, 0.75);
  assert.equal(getWeaponRecoveryAfterUpgrade(0, 10), 3.5);
  assert.equal(getWeaponRecoveryAfterUpgrade(4, 10), 4);
  assert.equal(getWeaponRecoveryAfterUpgrade(6, 10), 6);
});

test('all twelve Survival weapons become draft-eligible in five minutes', () => {
  const times = Object.values(SURVIVAL_WEAPON_UNLOCK_SECONDS);
  assert.equal(times.length, 12);
  assert.equal(times[0], 30);
  assert.equal(times[times.length - 1], 305);
  for (let i = 1; i < times.length; i++) assert.equal(times[i] - times[i - 1], 25);
  assert.equal(SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS, 1.05);
});


test('primary operator attacks have deliberate 25–27 metre effective reach', () => {
  assert.deepEqual(PRIMARY_ATTACK_RANGE_METERS, {
    marcin: 25,
    grzesiek: 25,
    dawid: 26,
    mateusz: 27,
    piotr: 25,
  });
  for (const character of characters) {
    const speed = 14.2;
    const lifetime = getPrimaryAttackLifetimeSeconds(character, speed);
    const effectiveReach = lifetime * speed + PRIMARY_ATTACK_ORIGIN_OFFSET_METERS;
    assert.ok(Math.abs(effectiveReach - PRIMARY_ATTACK_RANGE_METERS[character]) < 1e-9, character);
  }
});

test('Piotr boomerang reaches its outbound target before beginning its return', () => {
  const speed = 22.5;
  const maxLife = getPiotrBoomerangMaxLifeSeconds(speed);
  const outboundReach =
    maxLife * PIOTR_BOOMERANG_OUTBOUND_LIFETIME_FRACTION * speed +
    PRIMARY_ATTACK_ORIGIN_OFFSET_METERS;
  assert.ok(Math.abs(outboundReach - PRIMARY_ATTACK_RANGE_METERS.piotr) < 1e-9);
  assert.ok(maxLife > 1.9);
});
