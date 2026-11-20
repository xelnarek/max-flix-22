import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURVIVAL_FIREARM_PRESENTATION,
  getSurvivalFirearmReloadPose,
} from '../src/survivalFirearmPresentation.ts';

const archetypes = [
  'pistol', 'smg', 'rifle', 'shotgun', 'heavy-rifle',
  'minigun', 'rocket', 'flame', 'plasma', 'gauss',
];

test('every firearm archetype has its own projectile, recoil, reload and feedback profile', () => {
  assert.deepEqual(Object.keys(SURVIVAL_FIREARM_PRESENTATION).sort(), [...archetypes].sort());
  const projectileStyles = new Set(archetypes.map((archetype) =>
    SURVIVAL_FIREARM_PRESENTATION[archetype].projectileStyle));
  assert.equal(projectileStyles.size, archetypes.length, 'projectile silhouettes must be distinguishable');
  for (const archetype of archetypes) {
    const profile = SURVIVAL_FIREARM_PRESENTATION[archetype];
    assert.ok(profile.projectileLength > 0);
    assert.ok(profile.projectileWidth > 0);
    assert.ok(profile.muzzleParticles >= 1);
    assert.ok(profile.impactParticles >= 1);
    assert.ok(profile.trailIntervalSeconds === 0 || profile.trailIntervalSeconds >= 0.06);
    assert.ok(profile.recoilDepth > 0);
    assert.ok(profile.recoilSettleSeconds >= 0.12);
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

  assert.notEqual(shotgun.pumpOffsetZ, 0);
  assert.equal(minigun.rotorBrake, true);
  assert.notEqual(rocket.rocketCellOffsetZ, 0);
  assert.notEqual(flame.tankValveRotation, 0);
  assert.ok(plasma.coilPulse > 0);
  assert.notEqual(gauss.energyCellOffsetY, 0);
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
