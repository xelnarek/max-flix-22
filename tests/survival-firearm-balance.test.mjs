import test from 'node:test';
import assert from 'node:assert/strict';
import { SURVIVAL_FIREARM_DEFS } from '../src/survivalFirearms.ts';
import { getSurvivalFirearmBalance } from '../src/survivalFirearmBalance.ts';

test('magazine-cycle DPS includes the full firing cadence and reload downtime', () => {
  const balance = getSurvivalFirearmBalance({
    damage: 10,
    pellets: 1,
    magazineSize: 4,
    fireIntervalSeconds: 1,
    reloadSeconds: 3,
  });
  assert.equal(balance.damagePerTrigger, 10);
  assert.equal(balance.magazineDamage, 40);
  assert.equal(balance.magazineCycleSeconds, 6);
  assert.equal(balance.sustainedDirectDps, 40 / 6);
});

test('reload shorter than the final shot cadence does not add fictitious downtime', () => {
  const balance = getSurvivalFirearmBalance({
    damage: 2,
    pellets: 1,
    magazineSize: 3,
    fireIntervalSeconds: 1.5,
    reloadSeconds: 0.5,
  });
  assert.equal(balance.magazineCycleSeconds, 4.5);
  assert.equal(balance.sustainedDirectDps, 6 / 4.5);
});

test('shotgun salvo and magazine metrics account for every pellet', () => {
  const balance = getSurvivalFirearmBalance(SURVIVAL_FIREARM_DEFS.shotgun_12g);
  assert.equal(balance.damagePerTrigger, 0.92 * 7);
  assert.equal(balance.magazineDamage, 0.92 * 7 * 8);
});

test('all catalogue profiles produce finite, positive balance metrics', () => {
  for (const firearm of Object.values(SURVIVAL_FIREARM_DEFS)) {
    const balance = getSurvivalFirearmBalance(firearm);
    assert.ok(Number.isFinite(balance.damagePerTrigger) && balance.damagePerTrigger > 0);
    assert.ok(Number.isFinite(balance.magazineDamage) && balance.magazineDamage > 0);
    assert.ok(Number.isFinite(balance.magazineCycleSeconds) && balance.magazineCycleSeconds > 0);
    assert.ok(Number.isFinite(balance.sustainedDirectDps) && balance.sustainedDirectDps > 0);
  }
});

test('malformed numeric values are safely bounded instead of producing NaN or Infinity', () => {
  const balance = getSurvivalFirearmBalance({
    damage: Number.NaN,
    pellets: Number.NaN,
    magazineSize: Number.NaN,
    fireIntervalSeconds: Number.NaN,
    reloadSeconds: Number.NaN,
  });
  assert.deepEqual(balance, {
    damagePerTrigger: 0,
    magazineDamage: 0,
    magazineCycleSeconds: 0.01,
    sustainedDirectDps: 0,
  });
});
