import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STARTING_SURVIVAL_FIREARM,
  SURVIVAL_FIREARM_DEFS,
  createStartingSurvivalFirearmState,
  createSurvivalFirearmState,
  rollSurvivalFirearmDrop,
  rollSurvivalFirearmId,
  getSurvivalFirearmDamageSource,
} from '../src/survivalFirearms.ts';

test('every operator receives the same full-magazine starter sidearm', () => {
  const states = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'].map(() => createStartingSurvivalFirearmState());
  assert.ok(states.every((state) => state.id === STARTING_SURVIVAL_FIREARM));
  assert.deepEqual(states[0], states[4]);
  assert.equal(states[0].ammoInMagazine, SURVIVAL_FIREARM_DEFS.starter_pistol.magazineSize);
  assert.equal(states[0].reloadRemaining, 0);
});

test('firearm catalogue has clearly differentiated cadence, ammunition, projectile and impact profiles', () => {
  const definitions = Object.values(SURVIVAL_FIREARM_DEFS);
  assert.equal(definitions.length, 10);
  assert.equal(new Set(definitions.map((entry) => entry.archetype)).size, definitions.length);
  assert.ok(definitions.every((entry) => entry.icon.length > 0));
  assert.ok(definitions.every((entry) => entry.magazineSize > 0 && entry.reloadSeconds > 0));
  assert.ok(definitions.every((entry) => entry.fireIntervalSeconds > 0 && entry.projectileSpeed > 0));
  assert.ok(definitions.every((entry) => entry.pellets >= 1 && entry.spreadRadians >= 0));
  assert.ok(definitions.some((entry) => entry.archetype === 'shotgun' && entry.pellets >= 6));
  assert.ok(definitions.some((entry) => entry.archetype === 'rocket' && entry.aoeRadius >= 2));
  assert.ok(definitions.some((entry) => entry.archetype === 'flame' && entry.igniteOnHit));
  assert.ok(definitions.some((entry) => entry.archetype === 'gauss' && entry.projectileSpeed >= 50 && entry.pierce >= 4));
  assert.ok(Math.max(...definitions.map((entry) => entry.fireIntervalSeconds)) /
    Math.min(...definitions.map((entry) => entry.fireIntervalSeconds)) >= 10);
  const cadenceById = Object.fromEntries(definitions.map((entry) => [entry.id, entry.fireIntervalSeconds]));
  assert.deepEqual(cadenceById, {
    starter_pistol: 0.58, smg_45: 0.22, assault_rifle: 0.31, shotgun_12g: 1.15, battle_rifle: 1.05,
    minigun: 0.14, rocket_launcher: 2.2, flamethrower: 0.19, plasma_rifle: 0.65, gauss_rifle: 1.55,
  });
});

test('firearm drops unlock after eight kills: 4% normal, 22% elite, boss guaranteed and 18-kill pity', () => {
  const beforeUnlock = rollSurvivalFirearmDrop(7, 'boss', 0, 0);
  assert.equal(beforeUnlock.shouldDrop, false);
  assert.equal(beforeUnlock.chance, 0);

  assert.equal(rollSurvivalFirearmDrop(8, 'normal', 0, 0.04).shouldDrop, false);
  assert.equal(rollSurvivalFirearmDrop(8, 'normal', 0, 0.039).shouldDrop, true);
  assert.equal(rollSurvivalFirearmDrop(8, 'elite', 0, 0.22).shouldDrop, false);
  assert.equal(rollSurvivalFirearmDrop(8, 'elite', 0, 0.219).shouldDrop, true);

  const pity = rollSurvivalFirearmDrop(25, 'normal', 17, 0.999);
  assert.equal(pity.isPityDrop, true);
  assert.equal(pity.isGuaranteed, true);
  assert.equal(pity.shouldDrop, true);

  assert.equal(rollSurvivalFirearmDrop(8, 'boss', 0, 0.999).shouldDrop, true);
  assert.equal(rollSurvivalFirearmDrop(8, 'boss', 0, 0.999).isGuaranteed, true);
});

test('weighted drops never offer the starter pistol or the firearm already in hand', () => {
  for (let roll = 0; roll < 1; roll += 0.001) {
    const id = rollSurvivalFirearmId('starter_pistol', 0, roll);
    assert.ok(id);
    assert.notEqual(id, 'starter_pistol');
  }
  const replacement = rollSurvivalFirearmId('gauss_rifle', 0, 0.999);
  assert.ok(replacement);
  assert.notEqual(replacement, 'gauss_rifle');
  assert.notEqual(replacement, 'starter_pistol');
  assert.equal(rollSurvivalFirearmId('starter_pistol', -1, 0.5), null);
});

test('pickup creates a fresh loaded magazine and damage accounting source is unique', () => {
  const state = createSurvivalFirearmState('rocket_launcher');
  assert.equal(state.ammoInMagazine, 5);
  assert.equal(state.reloadRemaining, 0);
  assert.equal(getSurvivalFirearmDamageSource('rocket_launcher'), 'firearm:rocket_launcher');
});
