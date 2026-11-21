import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURVIVAL_FIREARM_PRESENTATION,
  SURVIVAL_FIREARM_CYCLE_TIMING,
  getSurvivalFirearmCyclePose,
  getSurvivalFirearmReloadPose,
} from '../src/survivalFirearmPresentation.ts';

const archetypes = [
  'pistol', 'smg', 'rifle', 'shotgun', 'heavy-rifle',
  'minigun', 'rocket', 'flame', 'plasma', 'gauss', 'grenade',
];

test('every firearm archetype has its own projectile, recoil, reload and feedback profile', () => {
  assert.deepEqual(Object.keys(SURVIVAL_FIREARM_PRESENTATION).sort(), [...archetypes].sort());
  const projectileStyles = new Set(archetypes.map((archetype) =>
    SURVIVAL_FIREARM_PRESENTATION[archetype].projectileStyle));
  assert.equal(projectileStyles.size, archetypes.length, 'projectile silhouettes must be distinguishable');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].muzzleStyle)).size, archetypes.length,
    'each weapon must have its own muzzle signature');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].trailStyle)).size, archetypes.length,
    'each weapon must leave a visually distinct projectile trail');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].impactStyle)).size, archetypes.length,
    'each weapon must have its own hit/impact signature');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].trailStretch)).size, archetypes.length,
    'projectile trails must have a distinct silhouette and scale');
  assert.equal(projectileStyles.size, archetypes.length, 'projectile silhouettes must be distinguishable');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].projectileLength)).size, archetypes.length, 'projectile lengths must be visibly distinct');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].trailParticleSize)).size, archetypes.length, 'every firearm needs its own trail scale');
  assert.equal(new Set(archetypes.map((archetype) => SURVIVAL_FIREARM_PRESENTATION[archetype].impactParticles)).size, archetypes.length, 'impact signatures must have distinct particle budgets');
  for (const archetype of archetypes) {
    const profile = SURVIVAL_FIREARM_PRESENTATION[archetype];
    assert.ok(profile.projectileLength > 0);
    assert.ok(profile.projectileWidth > 0);
    assert.ok(profile.muzzleFlashScale > 0 && profile.muzzleLifeSeconds >= 0.06);
    assert.ok(profile.trailOpacity > 0 && profile.trailOpacity <= 1);
    assert.ok(profile.trailLifeSeconds >= 0.06 && profile.trailStretch > 0);
    assert.ok(profile.muzzleParticles >= 1);
    assert.ok(profile.impactParticles >= 1);
    assert.ok(profile.trailIntervalSeconds === 0 || profile.trailIntervalSeconds >= 0.06);
    assert.ok(profile.recoilDepth > 0);
    assert.ok(profile.recoilSettleSeconds >= 0.12);
  }
});

test('all eleven weapons have distinct asymmetric firing-cycle timing and return to a neutral pose', () => {
  assert.deepEqual(Object.keys(SURVIVAL_FIREARM_CYCLE_TIMING).sort(), [...archetypes].sort());
  const signatures = new Set(archetypes.map((archetype) => {
    const timing = SURVIVAL_FIREARM_CYCLE_TIMING[archetype];
    assert.ok(timing.peakProgress > 0 && timing.peakProgress < timing.returnStartProgress);
    assert.ok(timing.returnStartProgress < 1);
    return timing.peakProgress + ':' + timing.returnStartProgress;
  }));
  assert.equal(signatures.size, archetypes.length);
  for (const archetype of archetypes) {
    const start = getSurvivalFirearmCyclePose(archetype, 0);
    const peak = getSurvivalFirearmCyclePose(archetype, SURVIVAL_FIREARM_CYCLE_TIMING[archetype].peakProgress);
    const complete = getSurvivalFirearmCyclePose(archetype, 1);
    for (const value of Object.values(start)) assert.equal(value, 0);
    for (const value of Object.values(complete)) assert.equal(value, 0);
    assert.ok(Object.values(peak).some((value) => Math.abs(value) > 0));
  }
});

test('reload pose ejects and reinserts magazines without leaving the weapon in a broken pose', () => {
  const start = getSurvivalFirearmReloadPose('pistol', 0);
  const eject = getSurvivalFirearmReloadPose('pistol', 0.22);
  const empty = getSurvivalFirearmReloadPose('pistol', 0.42);
  const insert = getSurvivalFirearmReloadPose('pistol', 0.76);
  const complete = getSurvivalFirearmReloadPose('pistol', 1);

  assert.equal(start.magazineVisible, true);
  assert.ok(eject.magazineOffsetY < 0);
  assert.equal(empty.magazineVisible, false);
  assert.ok(insert.magazineOffsetY < 0);
  assert.equal(complete.magazineVisible, true);
  assert.equal(complete.magazineOffsetY, 0);
  assert.equal(complete.boltOffsetZ, 0);
});

test('shotgun, minigun, rocket launcher, flamethrower and energy weapons animate their own mechanisms', () => {
  const shotgun = getSurvivalFirearmReloadPose('shotgun', 0.42);
  const minigun = getSurvivalFirearmReloadPose('minigun', 0.42);
  const rocket = getSurvivalFirearmReloadPose('rocket', 0.42);
  const flame = getSurvivalFirearmReloadPose('flame', 0.42);
  const plasma = getSurvivalFirearmReloadPose('plasma', 0.42);
  const gauss = getSurvivalFirearmReloadPose('gauss', 0.42);
  const grenade = getSurvivalFirearmReloadPose('grenade', 0.42);

  assert.notEqual(shotgun.pumpOffsetZ, 0);
  assert.equal(minigun.rotorBrake, true);
  assert.notEqual(rocket.rocketCellOffsetZ, 0);
  assert.notEqual(flame.tankValveRotation, 0);
  assert.ok(plasma.coilPulse > 0);
  assert.notEqual(gauss.energyCellOffsetY, 0);
  assert.notEqual(grenade.rocketCellOffsetZ, 0);
});

test('reload animation inputs are clamped and every pose is finite at boundaries', () => {
  for (const archetype of archetypes) {
    for (const progress of [-4, 0, 0.25, 0.5, 0.75, 1, 5, Number.NaN]) {
      const pose = getSurvivalFirearmReloadPose(archetype, progress);
      for (const value of Object.values(pose)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value));
      }
    }
  }
});
