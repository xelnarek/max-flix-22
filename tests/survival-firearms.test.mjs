import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STARTING_SURVIVAL_FIREARM,
  SURVIVAL_FIREARM_DEFS,
  SURVIVAL_FIREARM_DROP_POLICY,
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
  assert.equal(definitions.length, 11);
  assert.equal(new Set(definitions.map((entry) => entry.archetype)).size, definitions.length);
  assert.ok(definitions.every((entry) => entry.icon.length > 0));
  assert.ok(definitions.every((entry) => entry.magazineSize > 0 && entry.reloadSeconds > 0));
  assert.equal(new Set(definitions.map((entry) => entry.rangeMeters)).size, definitions.length, 'every firearm needs its own effective range');
  assert.equal(new Set(definitions.map((entry) => entry.reloadSeconds)).size, definitions.length, 'reload duration must be weapon-specific');
  assert.equal(new Set(definitions.map((entry) => entry.damage)).size, definitions.length, 'each weapon needs a distinct base hit value');
  assert.ok(Math.min(...definitions.map((entry) => entry.fireIntervalSeconds)) >= 0.14, 'rapid-fire automatic weapons stay bounded within Crimsonland cadence');
  assert.ok(definitions.every((entry) => entry.fireIntervalSeconds > 0 && entry.projectileSpeed > 0));
  assert.ok(definitions.every((entry) => entry.pellets >= 1 && entry.spreadRadians >= 0));
  assert.ok(definitions.some((entry) => entry.archetype === 'shotgun' && entry.pellets >= 6));
  assert.ok(definitions.some((entry) => entry.archetype === 'rocket' && entry.aoeRadius >= 2));
  assert.ok(definitions.some((entry) => entry.archetype === 'flame' && entry.igniteOnHit));
  assert.ok(definitions.some((entry) => entry.archetype === 'gauss' && entry.projectileSpeed >= 50 && entry.pierce >= 4));
  assert.ok(Math.max(...definitions.map((entry) => entry.fireIntervalSeconds)) /
    Math.min(...definitions.map((entry) => entry.fireIntervalSeconds)) >= 7);
  const cadenceById = Object.fromEntries(definitions.map((entry) => [entry.id, entry.fireIntervalSeconds]));
  assert.deepEqual(cadenceById, {
    starter_pistol: 1.05, smg_45: 0.24, assault_rifle: 0.32, shotgun_12g: 0.94, battle_rifle: 0.78,
    minigun: 0.14, rocket_launcher: 1.55, flamethrower: 0.15, plasma_rifle: 0.36, gauss_rifle: 1.38,
    ballistic_grenade_launcher: 1.18,
  });
  const impactById = Object.fromEntries(definitions.map((entry) => [entry.id, entry.damage]));
  assert.deepEqual(impactById, {
    starter_pistol: 1.55, smg_45: 0.78, assault_rifle: 1.24, shotgun_12g: 0.92, battle_rifle: 3.15,
    minigun: 0.68, rocket_launcher: 3.85, flamethrower: 0.42, plasma_rifle: 1.65, gauss_rifle: 7.4,
    ballistic_grenade_launcher: 3.7,
  });
  assert.ok(definitions.every((entry) => entry.reloadSeconds >= 1.2), 'every firearm has a meaningful reload window');
});

test('firearm drops use the shared 7% / 30% / guaranteed-boss policy and bounded pity', () => {
  const beforeUnlock = rollSurvivalFirearmDrop(7, 'boss', 0, 0);
  assert.equal(beforeUnlock.shouldDrop, false);
  assert.equal(beforeUnlock.chance, 0);

  assert.equal(rollSurvivalFirearmDrop(8, 'normal', 0, 0.07).shouldDrop, false);
  assert.equal(rollSurvivalFirearmDrop(8, 'normal', 0, 0.069).shouldDrop, true);
  assert.equal(rollSurvivalFirearmDrop(8, 'elite', 0, 0.30).shouldDrop, false);
  assert.equal(rollSurvivalFirearmDrop(8, 'elite', 0, 0.299).shouldDrop, true);

  const pity = rollSurvivalFirearmDrop(18, 'normal', SURVIVAL_FIREARM_DROP_POLICY.pityMisses, 0.999);
  assert.equal(pity.isPityDrop, true);
  assert.equal(pity.isGuaranteed, true);
  assert.equal(pity.shouldDrop, true);

  assert.equal(rollSurvivalFirearmDrop(8, 'boss', 0, 0.999).shouldDrop, true);
  assert.equal(rollSurvivalFirearmDrop(8, 'boss', 0, 0.999).isGuaranteed, true);
  assert.deepEqual(SURVIVAL_FIREARM_DROP_POLICY, {
    unlockElapsedSeconds: 45, minimumKills: 8, minimumIntervalSeconds: 75,
    dropLifetimeSeconds: 40, maximumActiveDrops: 1, normalChance: 0.07,
    eliteChance: 0.30, pityMisses: 10,
  });
});

test('every available firearm has an identical drop-selection probability', () => {
  const eligible = Object.values(SURVIVAL_FIREARM_DEFS).filter((entry) =>
    entry.id !== STARTING_SURVIVAL_FIREARM && entry.dropWeight > 0);
  assert.equal(eligible.length, 10);
  assert.deepEqual([...new Set(eligible.map((entry) => entry.dropWeight))], [1],
    'PvE, Campaign and PvP must use equal selection weights for every weapon');

  const counts = new Map(eligible.map((entry) => [entry.id, 0]));
  for (let sample = 0; sample < 1000; sample++) {
    const id = rollSurvivalFirearmId('starter_pistol', 0, (sample + 0.5) / 1000);
    assert.ok(id);
    assert.ok(counts.has(id), 'the starting pistol and currently held firearm cannot drop');
    counts.set(id, counts.get(id) + 1);
  }
  assert.deepEqual([...counts.values()], Array(10).fill(100),
    'each of the ten world pickups must occupy exactly one tenth of the selection interval');

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
