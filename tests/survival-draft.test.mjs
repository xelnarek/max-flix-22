import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSurvivalDraftSynergyHint,
  scoreSurvivalDraftOption,
  selectSurvivalDraftOptions,
} from '../src/survivalDraft.ts';

const stableRandom = () => 0;

test('a draft presents only operator perks across meaningfully different categories', () => {
  const options = [
    'damage', 'rapid', 'critical', 'critical_damage',
    'dash', 'boots', 'medkit', 'growth', 'drone',
  ].map((id) => ({ id }));
  const selected = selectSurvivalDraftOptions(options, {}, stableRandom);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((option) => option.id)).size, 3);
  assert.ok(selected.some((option) => ['damage', 'rapid', 'growth', 'drone'].includes(option.id)));
  assert.ok(selected.every((option) => !option.id.startsWith('weapon_')));
});

test('legacy weapon unlock, upgrade and evolution offers are filtered out of all operator drafts', () => {
  const legacy = [
    { id: 'weapon_unlock:pallet_cannon' },
    { id: 'weapon_upgrade:piorun_drone' },
    { id: 'weapon_evolve:diamond_saw' },
  ];
  const selected = selectSurvivalDraftOptions([
    ...legacy,
    { id: 'damage' }, { id: 'medkit' }, { id: 'growth' }, { id: 'boots' },
  ], {}, stableRandom);
  assert.equal(selected.length, 3);
  assert.ok(selected.every((option) => !option.id.startsWith('weapon_')));
  assert.equal(getSurvivalDraftSynergyHint('weapon_evolve:pallet_cannon', {}), null);
  assert.equal(scoreSurvivalDraftOption('weapon_upgrade:pallet_cannon', {}), Number.NEGATIVE_INFINITY);
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
  assert.ok(scoreWithPartner > scoreWithoutPartner + 10);
  assert.match(
    getSurvivalDraftSynergyHint('critical_damage', {}, ['critical']) || '',
    /Protokół krytyczny/,
  );
});


test('a passive without an owned or planned partner does not receive a false synergy score bonus', () => {
  const alone = scoreSurvivalDraftOption('critical_damage', {});
  const paired = scoreSurvivalDraftOption('critical_damage', {}, ['critical']);
  assert.ok(paired > alone);
  assert.equal(
    getSurvivalDraftSynergyHint('critical_damage', {}),
    null,
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

test('critical synergy progress uses the exact 3 plus 2 requirements and does not promise an early unlock', () => {
  const nearlyReady = getSurvivalDraftSynergyHint('critical', {
    stacks: { critical: 2, critical_damage: 1 },
  });
  assert.match(nearlyReady || '', /POSTĘP SYNERGII/);
  assert.match(nearlyReady || '', /3\/3/);
  assert.match(nearlyReady || '', /1\/2/);
  assert.doesNotMatch(nearlyReady || '', /DOMKNIESZ SYNERGIĘ/);

  const completedByCard = getSurvivalDraftSynergyHint('critical', {
    stacks: { critical: 2, critical_damage: 2 },
  });
  assert.match(completedByCard || '', /DOMKNIESZ SYNERGIĘ/);
  assert.match(completedByCard || '', /3\/3/);
  assert.match(completedByCard || '', /2\/2/);
});

test('Overdrive only completes at three damage stacks and two attack-speed stacks', () => {
  const incomplete = getSurvivalDraftSynergyHint('rapid', {
    stacks: { damage: 2, rapid: 1 },
  });
  assert.match(incomplete || '', /POSTĘP SYNERGII/);
  assert.match(incomplete || '', /2\/3/);
  assert.match(incomplete || '', /2\/2/);
  assert.doesNotMatch(incomplete || '', /DOMKNIESZ SYNERGIĘ/);

  const complete = getSurvivalDraftSynergyHint('rapid', {
    stacks: { damage: 3, rapid: 1 },
  });
  assert.match(complete || '', /DOMKNIESZ SYNERGIĘ: Overdrive/);
});

test('already-complete synergies are not advertised as still progressing', () => {
  assert.equal(getSurvivalDraftSynergyHint('critical', {
    stacks: { critical: 2, critical_damage: 2 },
  }), null);
  assert.equal(getSurvivalDraftSynergyHint('critical', {
    stacks: { critical: 3, critical_damage: 2 },
  }), null);
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
