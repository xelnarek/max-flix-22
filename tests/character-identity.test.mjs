import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/characters.ts';
import { CHARACTER_MOTION_PROFILES, getCharacterMotionProfile } from '../src/characterMotion.ts';

const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

test('every operator has an explicit class identity and a one-line combat role', () => {
  for (const id of ids) {
    const definition = CHARACTERS[id];
    assert.ok(definition.className.length >= 6, id + ' needs a readable class name');
    assert.ok(definition.combatIdentity.length >= 24, id + ' needs a clear gameplay identity');
  }
  assert.match(CHARACTERS.marcin.combatIdentity, /5 HP/);
  assert.match(CHARACTERS.grzesiek.className, /MŁOT/);
  assert.match(CHARACTERS.dawid.combatIdentity, /skok/);
  assert.match(CHARACTERS.mateusz.combatIdentity, /najszybszy/);
  assert.match(CHARACTERS.piotr.combatIdentity, /podwójny skok/);
  for (const id of ids) assert.ok(CHARACTERS[id].movementIdentity.length >= 24, id + ' needs a movement description');
});

test('locomotion profiles create measurably different gait, posture and jump signatures', () => {
  for (const id of ids) {
    const profile = getCharacterMotionProfile(id);
    for (const [key, value] of Object.entries(profile)) assert.ok(Number.isFinite(value), id + '.' + key);
    assert.ok(profile.gaitFrequency >= 9 && profile.gaitFrequency <= 22);
    assert.ok(profile.stride > 0 && profile.armSwing > 0);
  }
  assert.ok(CHARACTER_MOTION_PROFILES.mateusz.gaitFrequency > CHARACTER_MOTION_PROFILES.grzesiek.gaitFrequency);
  assert.ok(CHARACTER_MOTION_PROFILES.dawid.jumpArmLift > CHARACTER_MOTION_PROFILES.marcin.jumpArmLift);
  assert.ok(CHARACTER_MOTION_PROFILES.grzesiek.bodyBob > CHARACTER_MOTION_PROFILES.mateusz.bodyBob);
  assert.ok(CHARACTER_MOTION_PROFILES.mateusz.runLean > CHARACTER_MOTION_PROFILES.marcin.runLean);
  assert.equal(getCharacterMotionProfile('piotr'), CHARACTER_MOTION_PROFILES.piotr);
  assert.ok(CHARACTER_MOTION_PROFILES.mateusz.groundAcceleration > CHARACTER_MOTION_PROFILES.grzesiek.groundAcceleration);
  assert.ok(CHARACTER_MOTION_PROFILES.dawid.airControl > CHARACTER_MOTION_PROFILES.marcin.airControl);
  assert.ok(CHARACTER_MOTION_PROFILES.dawid.riseGravityMultiplier < CHARACTER_MOTION_PROFILES.grzesiek.riseGravityMultiplier);
  assert.ok(CHARACTER_MOTION_PROFILES.grzesiek.landingSquashY < CHARACTER_MOTION_PROFILES.dawid.landingSquashY);
  for (const id of ids) {
    const profile = CHARACTER_MOTION_PROFILES[id];
    assert.ok(profile.groundAcceleration >= 8 && profile.groundAcceleration <= 22);
    assert.ok(profile.groundBraking >= 9 && profile.groundBraking <= 23);
    assert.ok(profile.airControl >= 5 && profile.airControl <= 20);
    assert.ok(profile.riseGravityMultiplier >= 0.8 && profile.riseGravityMultiplier <= 1.2);
    assert.ok(profile.fallGravityMultiplier >= 0.85 && profile.fallGravityMultiplier <= 1.25);
    assert.ok(profile.jumpStretchY >= 1.1 && profile.jumpStretchY <= 1.4);
    assert.ok(profile.landingSquashY >= 0.7 && profile.landingSquashY <= 0.95);
  }
});

test('procedural models have large class-specific silhouette equipment and movement is wired to profiles', async () => {
  const { readFile } = await import('node:fs/promises');
  const assets = await readFile(new URL('../src/warehouseAssets.ts', import.meta.url), 'utf8');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const feature of ['liftingBelt', 'sampleSlab', 'techPack', 'veteranStrap', 'managerBlue']) assert.ok(assets.includes(feature), 'missing class visual: ' + feature);
  assert.match(game, /getCharacterMotionProfile\(this\.currentCharacterId\)/);
  assert.match(game, /motionProfile\.gaitFrequency/);
  assert.match(game, /motionProfile\.jumpKneeTuck/);
  assert.match(game, /playerAccessory\.rotation\.x/);
  assert.match(game, /new THREE\.Color\(this\.charDef\.color\)/);
  assert.match(game, /motionProfile\.groundAcceleration/);
  assert.match(game, /motionProfile\.groundBraking/);
  assert.match(game, /motionProfile\.airControl/);
  assert.match(game, /motionProfile\.airBraking/);
  assert.match(game, /motionProfile\.riseGravityMultiplier/);
  assert.match(game, /motionProfile\.fallGravityMultiplier/);
  assert.match(game, /motionProfile\.landingSquashY/);
  assert.match(app, /def\.movementIdentity/);
  assert.match(html, /id="char-detail-movement"/);
  assert.match(app, /definition\.className/);
  assert.match(app, /definition\.combatIdentity/);
  assert.match(html, /id="char-detail-class"/);
});
