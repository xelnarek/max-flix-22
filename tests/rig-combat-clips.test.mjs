import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { createRigCombatClips, getRigCombatMotionProfile, RIG_COMBAT_MOTION_PROFILES } from '../src/rigCombatClips.ts';
import { getAttackPoseStrength } from '../src/characterAttackMotion.ts';

function makeMixamoLikeRig() {
  const root = new THREE.Group();
  const names = [
    'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine2', 'mixamorigHead',
    'mixamorigLeftArm', 'mixamorigRightArm',
    'mixamorigLeftForeArm', 'mixamorigRightForeArm',
    'mixamorigLeftUpLeg', 'mixamorigRightUpLeg',
    'mixamorigLeftLeg', 'mixamorigRightLeg',
  ];
  const bones = names.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
    return bone;
  });
  return { root, bones };
}

test('role-matched rigs receive authored attack, special, hit, jump, fall and landing clips', () => {
  const { root } = makeMixamoLikeRig();
  const clips = createRigCombatClips(root, 'heavy-melee');
  assert.deepEqual(clips.map((clip) => clip.name), ['Attack', 'Special', 'Hit', 'Jump', 'Fall', 'Land']);
  for (const clip of clips) {
    assert.ok(clip.tracks.length >= 4, clip.name + ' should animate multiple joints');
    assert.ok(clip.duration > 0);
  }
});

test('combat style changes the authored attack silhouette without changing combat stats', () => {
  const { root: meleeRoot } = makeMixamoLikeRig();
  const { root: rangedRoot } = makeMixamoLikeRig();
  const melee = createRigCombatClips(meleeRoot, 'tool-melee').find((clip) => clip.name === 'Attack');
  const ranged = createRigCombatClips(rangedRoot, 'ranged').find((clip) => clip.name === 'Attack');
  assert.ok(melee && ranged);
  assert.notDeepEqual(Array.from(melee.tracks[0].values), Array.from(ranged.tracks[0].values));
});

test('identical rigs reuse cached clips and model-specific rest poses remain respected', () => {
  const { root: first } = makeMixamoLikeRig();
  const { root: second } = makeMixamoLikeRig();
  assert.equal(createRigCombatClips(first, 'heavy-melee'), createRigCombatClips(second, 'heavy-melee'));
  const altered = makeMixamoLikeRig();
  altered.bones[2].rotation.set(0.15, 0.08, -0.04);
  assert.notEqual(createRigCombatClips(first, 'heavy-melee'), createRigCombatClips(altered.root, 'heavy-melee'));
});

test('non-humanoid and incomplete rigs fail soft without adding invalid clips', () => {
  assert.deepEqual(createRigCombatClips(new THREE.Group(), 'tool-melee'), []);
  const { root } = makeMixamoLikeRig();
  assert.deepEqual(createRigCombatClips(root, 'vehicle'), []);
  assert.deepEqual(createRigCombatClips(root, 'none'), []);
});

test('animation clips bind to actual bone names on a Three.js mixer', () => {
  const { root } = makeMixamoLikeRig();
  const clips = createRigCombatClips(root, 'ranged');
  const attackClip = clips.find((clip) => clip.name === 'Attack');
  assert.ok(attackClip);
  const mixer = new THREE.AnimationMixer(root);
  const attack = mixer.clipAction(attackClip);
  attack.setLoop(THREE.LoopOnce, 1).play();
  mixer.update(0.20);
  assert.ok(root.getObjectByName('mixamorigRightArm').quaternion.angleTo(new THREE.Quaternion()) > 0.01);
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
});

test('runtime injects role-specific authored combat clips into Gobkit actors', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /createRigCombatClips\(root, combatStyle, enemyType\)/);
  assert.match(game, /ENEMY_VISUAL_PROFILES\[requestedType\]\.attackStyle,[\s\S]{0,100}requestedType/);
  assert.match(game, /ENEMY_VISUAL_PROFILES\[requestedType\]\.attackStyle/);
  assert.match(game, /private createGobkitAnimationTrack\([\s\S]{0,260}combatStyle: RigCombatStyle/);
});

test('the operator attack envelope has a crisp contact beat and a controlled follow-through', () => {
  assert.equal(getAttackPoseStrength(0), 0);
  assert.ok(getAttackPoseStrength(0.50) > 0.95);
  assert.ok(getAttackPoseStrength(0.50) > getAttackPoseStrength(0.12));
  assert.ok(getAttackPoseStrength(0.90) < getAttackPoseStrength(0.50));
  assert.equal(getAttackPoseStrength(1), 0);
});


test('every humanoid and creature role has its own readable combat motion signature', () => {
  const expected = [
    'customer', 'architect', 'inspector', 'kurier', 'handlowiec', 'monter',
    'przedstawiciel_włoski', 'sztaplar_szalony', 'krol_leto', 'pan_roman',
    'serwisant', 'bosman_krakow', 'zombie_pracownik', 'sebix_m',
    'mutant_gamma_forklift', 'radioactive_pip', 'cyber_salesman',
    'elite_walczak_guard', 'walczak',
  ];
  for (const type of expected) {
    assert.ok(RIG_COMBAT_MOTION_PROFILES[type], 'missing motion signature: ' + type);
    const profile = getRigCombatMotionProfile(type);
    assert.ok(profile.power >= 0.7 && profile.power <= 1.4);
    assert.ok(profile.windup >= 0.7 && profile.windup <= 1.35);
    assert.ok(profile.leadSide === -1 || profile.leadSide === 1);
  }
  const signatures = new Set(expected.map((type) => JSON.stringify(getRigCombatMotionProfile(type))));
  assert.ok(signatures.size >= 17, 'roles should not share generic attack/hit poses');
});

test('same combat style receives different authored attack, special and hit clips per role', () => {
  const walczak = makeMixamoLikeRig();
  const sebix = makeMixamoLikeRig();
  const walczakClips = createRigCombatClips(walczak.root, 'heavy-melee', 'walczak');
  const sebixClips = createRigCombatClips(sebix.root, 'heavy-melee', 'sebix_m');
  const clipValues = (clips, name) => Array.from(clips.find((clip) => clip.name === name).tracks)
    .flatMap((track) => Array.from(track.values));
  for (const name of ['Attack', 'Special', 'Hit']) {
    assert.notDeepEqual(clipValues(walczakClips, name), clipValues(sebixClips, name),
      name + ' should keep a distinct role-specific silhouette');
  }
  assert.equal(
    createRigCombatClips(walczak.root, 'heavy-melee', 'walczak'),
    walczakClips,
    'the same rig/role signature should reuse its cached clips',
  );
});

