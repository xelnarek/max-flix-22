import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalCommanderProfile,
  selectSurvivalCommanderTargets,
} from '../src/survivalCommander.ts';

const commander = { id: 'boss-1', type: 'walczak', x: 0, z: 0, state: 'chase' };

test('each Survival boss has a distinct, bounded command profile', () => {
  const walczak = getSurvivalCommanderProfile('walczak', 1);
  const krol = getSurvivalCommanderProfile('krol_leto', 1);
  const bosman = getSurvivalCommanderProfile('bosman_krakow', 1);
  const sebix = getSurvivalCommanderProfile('sebix_m', 1);
  assert.ok(walczak && krol && bosman && sebix);
  assert.equal(new Set([walczak.callout, krol.callout, bosman.callout, sebix.callout]).size, 4);
  for (const profile of [walczak, krol, bosman, sebix]) {
    assert.ok(profile.cooldownSeconds >= 10);
    assert.ok(profile.durationSeconds >= 3);
    assert.ok(profile.moveSpeedMultiplier > 1 && profile.moveSpeedMultiplier <= 1.25);
    assert.ok(profile.maxTargets >= 1 && profile.maxTargets <= 3);
  }
});

test('boss phase two strengthens the command without runaway multipliers', () => {
  for (const type of ['walczak', 'krol_leto', 'bosman_krakow', 'sebix_m']) {
    const phaseOne = getSurvivalCommanderProfile(type, 1);
    const phaseTwo = getSurvivalCommanderProfile(type, 2);
    assert.ok(phaseOne && phaseTwo);
    assert.ok(phaseTwo.moveSpeedMultiplier > phaseOne.moveSpeedMultiplier);
    assert.ok(phaseTwo.durationSeconds > phaseOne.durationSeconds);
    assert.ok(phaseTwo.cooldownSeconds < phaseOne.cooldownSeconds);
    assert.ok(phaseTwo.moveSpeedMultiplier <= 1.25);
  }
});

test('Walczak prioritizes frontline bruisers and flankers over unrelated roles', () => {
  const profile = getSurvivalCommanderProfile('walczak', 1);
  assert.ok(profile);
  const targets = selectSurvivalCommanderTargets(commander, [
    { id: 'support-near', type: 'inspector', x: 1, z: 0, state: 'chase' },
    { id: 'flanker-near', type: 'kurier', x: 2, z: 0, state: 'chase' },
    { id: 'bruiser-far', type: 'sztaplar_szalony', x: 8, z: 0, state: 'chase' },
    { id: 'bruiser-near', type: 'agv_robot', x: 3, z: 0, state: 'chase' },
    { id: 'ranged-near', type: 'handlowiec', x: 1, z: 0, state: 'chase' },
  ], profile);
  assert.deepEqual(targets, ['bruiser-near', 'bruiser-far', 'flanker-near']);
});

test('Bosman selects ranged and support units and never selects another boss or drone', () => {
  const profile = getSurvivalCommanderProfile('bosman_krakow', 1);
  assert.ok(profile);
  const targets = selectSurvivalCommanderTargets(
    { id: 'bosman-1', type: 'bosman_krakow', x: 0, z: 0, state: 'chase' },
    [
      { id: 'drone', type: 'piorun_dron', x: 0.5, z: 0, state: 'chase' },
      { id: 'boss', type: 'sebix_m', x: 0.2, z: 0, state: 'chase' },
      { id: 'support', type: 'inspector', x: 2, z: 0, state: 'chase' },
      { id: 'ranged', type: 'handlowiec', x: 3, z: 0, state: 'chase' },
      { id: 'bruiser', type: 'agv_robot', x: 1, z: 0, state: 'chase' },
    ],
    profile,
  );
  assert.deepEqual(targets, ['ranged', 'support']);
});

test('defeated, duplicate, distant and malformed enemies cannot receive an order', () => {
  const profile = getSurvivalCommanderProfile('sebix_m', 2);
  assert.ok(profile);
  const targets = selectSurvivalCommanderTargets(
    { id: 'sebix', type: 'sebix_m', x: 0, z: 0, state: 'chase' },
    [
      { id: 'dead', type: 'sztaplar_szalony', x: 1, z: 0, state: 'defeated' },
      { id: 'distant', type: 'kurier', x: 99, z: 0, state: 'chase' },
      { id: '', type: 'kurier', x: 1, z: 0, state: 'chase' },
      { id: 'same', type: 'kurier', x: 2, z: 0, state: 'chase' },
      { id: 'same', type: 'sztaplar_szalony', x: 1, z: 0, state: 'chase' },
    ],
    profile,
  );
  assert.deepEqual(targets, ['same']);
});

test('unknown bosses and invalid command inputs safely produce no target list', () => {
  assert.equal(getSurvivalCommanderProfile('customer', 1), null);
  const profile = getSurvivalCommanderProfile('walczak', 1);
  assert.ok(profile);
  assert.deepEqual(selectSurvivalCommanderTargets({ ...commander, x: Number.NaN }, [], profile), []);
  assert.deepEqual(selectSurvivalCommanderTargets(commander, [], { ...profile, radius: Number.NaN }), []);
});

test('command pulses are wired to Survival movement and remain isolated from Campaign', async () => {
  const { readFile } = await import('node:fs/promises');
  const [game, types] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/types.ts', import.meta.url), 'utf8'),
  ]);
  assert.ok(game.includes('this.updateSurvivalCommanderPulse(e, dt)'));
  assert.ok(game.includes('enemy.aiCommandBoostMultiplier ?? 1'));
  assert.ok(game.includes('this.survivalCommanderPulseTimer'));
  assert.ok(types.includes('aiCommanderPulseTimer?: number'));
  assert.ok(types.includes('aiCommandBoostTimer?: number'));
  assert.ok(types.includes('aiCommandBoostMultiplier?: number'));
});
