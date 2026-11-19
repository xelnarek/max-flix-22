import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalDraftSynergyHint,
  scoreSurvivalDraftOption,
  selectSurvivalDraftOptions,
} from '../src/survivalDraft.ts';

const stableRandom = () => 0;

test('a draft offers at most one weapon and two meaningfully different passive categories', () => {
  const options = [
    'damage', 'rapid', 'critical', 'critical_damage',
    'dash', 'boots', 'medkit', 'growth', 'drone',
  ].map((id) => ({ id }));
  const selected = selectSurvivalDraftOptions(options, {}, stableRandom);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((option) => option.id)).size, 3);
  assert.ok(selected.some((option) => ['damage', 'rapid', 'growth', 'drone'].includes(option.id)));
  const weaponCount = selected.filter((option) => option.id.startsWith('weapon_')).length;
  assert.equal(weaponCount, 0);
});

test('a selected weapon is paired with two passive choices, never a second weapon', () => {
  const options = [
    { id: 'weapon_unlock:pallet_cannon' },
    { id: 'weapon_unlock:glue_mine' },
    { id: 'weapon_upgrade:piorun_drone' },
    { id: 'weapon_evolve:diamond_saw' },
    { id: 'damage' },
    { id: 'medkit' },
    { id: 'growth' },
    { id: 'boots' },
  ];
  const selected = selectSurvivalDraftOptions(options, {
    stacks: { damage: 2, range: 1 },
    weapons: [{ id: 'diamond_saw', level: 5 }],
  }, stableRandom);
  assert.equal(selected.length, 3);
  assert.equal(selected[0].id, 'weapon_evolve:diamond_saw');
  assert.equal(selected.filter((option) => option.id.startsWith('weapon_')).length, 1);
});

test('a new weapon remains ahead of ordinary weapon level-ups when both are available', () => {
  const selected = selectSurvivalDraftOptions([
    { id: 'weapon_unlock:glue_mine' },
    { id: 'weapon_upgrade:pallet_cannon' },
    { id: 'damage' },
    { id: 'medkit' },
    { id: 'growth' },
  ], {
    weapons: [{ id: 'pallet_cannon', level: 5 }],
  }, stableRandom);
  assert.equal(selected[0].id, 'weapon_unlock:glue_mine');
});

test('weapon unlocks follow the owned passive and favour a missing weapon role', () => {
  const selected = selectSurvivalDraftOptions([
    { id: 'weapon_unlock:pallet_cannon' },
    { id: 'weapon_unlock:glue_mine' },
    { id: 'weapon_unlock:kfc_bomber' },
    { id: 'damage' },
    { id: 'medkit' },
  ], {
    stacks: { damage: 2 },
    weapons: [{ id: 'glue_mine', level: 2 }],
  }, stableRandom);
  assert.equal(selected[0].id, 'weapon_unlock:pallet_cannon');
  assert.match(
    getSurvivalDraftSynergyHint(selected[0].id, { stacks: { damage: 1 } }) || '',
    /Wzmocniona amunicja/,
  );
});

test('the draft actively completes an existing passive pair before unrelated upgrades', () => {
  const options = [
    { id: 'critical_damage' },
    { id: 'medkit' },
    { id: 'boots' },
    { id: 'growth' },
  ];
  const selected = selectSurvivalDraftOptions(options, {
    stacks: { critical: 2 },
    healthRatio: 1,
  }, stableRandom);
  assert.equal(selected[0].id, 'critical_damage');
  assert.match(
    getSurvivalDraftSynergyHint('critical_damage', { stacks: { critical: 2 } }) || '',
    /Protokół krytyczny/,
  );
});

test('two complementary cards in the same draft are recognised as a planned synergy', () => {
  const scoreWithoutPartner = scoreSurvivalDraftOption('critical_damage', {});
  const scoreWithPartner = scoreSurvivalDraftOption('critical_damage', {}, ['critical']);
  assert.ok(scoreWithPartner > scoreWithoutPartner + 20);
  assert.match(
    getSurvivalDraftSynergyHint('critical_damage', {}, ['critical']) || '',
    /Protokół krytyczny/,
  );
});

test('low health sharply raises the value of recovery and defensive options', () => {
  const options = [
    { id: 'damage' },
    { id: 'medkit' },
    { id: 'growth' },
    { id: 'armor' },
  ];
  const selected = selectSurvivalDraftOptions(options, { healthRatio: 0.2 }, stableRandom);
  assert.equal(selected[0].id, 'medkit');
  assert.ok(scoreSurvivalDraftOption('medkit', { healthRatio: 0.2 }) >
    scoreSurvivalDraftOption('medkit', { healthRatio: 1 }));
});

test('weapon evolution is only described as ready when the actual offer is eligible', () => {
  assert.match(
    getSurvivalDraftSynergyHint('weapon_evolve:pallet_cannon', {}) || '',
    /EWOLUCJA GOTOWA/,
  );
  assert.equal(getSurvivalDraftSynergyHint('damage', {}), null);
});

test('reroll exclusions and duplicate IDs leave a safe three-card draft', () => {
  const selected = selectSurvivalDraftOptions([
    { id: 'critical' },
    { id: 'critical' },
    { id: 'medkit' },
    { id: 'growth' },
    { id: 'weapon_upgrade:pallet_cannon' },
  ], {}, stableRandom);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((option) => option.id)).size, 3);
});

test('malformed context and random values fail safely without producing duplicate cards', () => {
  const selected = selectSurvivalDraftOptions([
    { id: 'damage' }, { id: 'rapid' }, { id: 'medkit' }, { id: 'growth' },
  ], {
    stacks: { damage: Number.NaN, rapid: Number.POSITIVE_INFINITY },
    healthRatio: Number.NaN,
    elapsedSeconds: Number.NaN,
  }, () => Number.NaN);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((option) => option.id)).size, 3);
});
