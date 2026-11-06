import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_MASTERY_MAX_LEVEL,
  CHARACTER_TALENTS,
  calculateCharacterMasteryXp,
  createInitialCharacterMasteryProfile,
  getCharacterMasterySummary,
  getCharacterMasteryXpRequirement,
  getCharacterTalentBonuses,
  recordCharacterRunResult,
  sanitizeCharacterMasteryProfile,
  spendCharacterTalentPoint,
} from '../src/characterProgression.ts';

const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

test('each operator receives three bespoke, bounded talent branches', () => {
  for (const id of ids) {
    assert.equal(CHARACTER_TALENTS[id].length, 3);
    assert.equal(new Set(CHARACTER_TALENTS[id].map(talent => talent.id)).size, 3);
    for (const talent of CHARACTER_TALENTS[id]) {
      assert.ok(talent.name.length >= 4);
      assert.ok(talent.description.length >= 20);
      assert.equal(talent.maxRank, 3);
      assert.ok(talent.perRank > 0 && talent.perRank <= 0.03);
    }
  }
  assert.notDeepEqual(CHARACTER_TALENTS.marcin.map(x => x.id), CHARACTER_TALENTS.grzesiek.map(x => x.id));
  assert.notDeepEqual(CHARACTER_TALENTS.dawid.map(x => x.id), CHARACTER_TALENTS.mateusz.map(x => x.id));
});

test('mastery XP rewards eliminations, time, bosses and discovered secrets', () => {
  assert.equal(calculateCharacterMasteryXp({ kills: 40, elapsedSeconds: 90, bossesDefeated: 1, secretsFound: 2 }), 40 + 3 + 15 + 20);
  assert.equal(calculateCharacterMasteryXp({ kills: -4, elapsedSeconds: Number.NaN, bossesDefeated: -2, secretsFound: -1 }), 0);
});

test('each operator levels independently and receives one talent point per mastery level', () => {
  const initial = createInitialCharacterMasteryProfile();
  const run = recordCharacterRunResult(initial, 'marcin', {
    kills: 80, elapsedSeconds: 300, bossesDefeated: 1, secretsFound: 1,
  });
  const marcin = getCharacterMasterySummary(run.profile, 'marcin');
  const mateusz = getCharacterMasterySummary(run.profile, 'mateusz');
  assert.ok(run.xpEarned >= 70);
  assert.ok(run.levelsGained >= 1);
  assert.equal(marcin.level, 1 + run.levelsGained);
  assert.equal(marcin.availableTalentPoints, run.levelsGained);
  assert.equal(mateusz.level, 1);
  assert.equal(mateusz.xp, 0);
  assert.equal(marcin.totalRuns, 1);
  assert.equal(marcin.totalKills, 80);
});

test('talent spending requires points, respects three ranks and updates only that operator', () => {
  let profile = createInitialCharacterMasteryProfile();
  profile = {
    ...profile,
    characters: {
      ...profile.characters,
      dawid: { ...profile.characters.dawid, level: 3 },
    },
  };
  const first = spendCharacterTalentPoint(profile, 'dawid', 'aerial_installation');
  assert.equal(first.purchased, true);
  const second = spendCharacterTalentPoint(first.profile, 'dawid', 'aerial_installation');
  assert.equal(second.purchased, true);
  const third = spendCharacterTalentPoint(second.profile, 'dawid', 'aerial_installation');
  assert.equal(third.purchased, false, 'level 3 only supplies two points');
  assert.equal(getCharacterMasterySummary(second.profile, 'dawid').availableTalentPoints, 0);
  assert.equal(getCharacterMasterySummary(second.profile, 'marcin').availableTalentPoints, 0);
});

test('talents modify combat bonuses without creating unbounded multipliers', () => {
  let profile = createInitialCharacterMasteryProfile();
  profile = {
    ...profile,
    characters: {
      ...profile.characters,
      mateusz: {
        ...profile.characters.mateusz,
        level: 10,
        talentRanks: { overclock_drive: 3, capacitor_cycle: 3, shock_calibration: 3 },
      },
    },
  };
  const bonuses = getCharacterTalentBonuses(profile, 'mateusz');
  assert.ok(bonuses.speedMultiplier > 1);
  assert.ok(bonuses.attackMultiplier > 1);
  assert.ok(bonuses.abilityCooldownMultiplier < 1);
  assert.ok(bonuses.speedMultiplier <= 1.08);
  assert.ok(bonuses.abilityCooldownMultiplier >= 0.90);
  assert.deepEqual(getCharacterTalentBonuses(profile, 'piotr'), {
    attackMultiplier: 1,
    damageTakenMultiplier: 1,
    speedMultiplier: 1,
    jumpMultiplier: 1,
    abilityCooldownMultiplier: 1,
  });
});

test('mastery level and XP are capped safely and cannot create free talent points', () => {
  assert.equal(getCharacterMasteryXpRequirement(CHARACTER_MASTERY_MAX_LEVEL), 0);
  const dirty = {
    characters: {
      piotr: {
        level: 999,
        xp: 999999,
        talentRanks: { veteran_grip: 3, mafia_protocol: 3, fake_node: 3 },
        totalRuns: -9,
        totalKills: 12,
      },
    },
  };
  const clean = sanitizeCharacterMasteryProfile(dirty);
  const summary = getCharacterMasterySummary(clean, 'piotr');
  assert.equal(summary.level, CHARACTER_MASTERY_MAX_LEVEL);
  assert.equal(summary.xp, 0);
  assert.equal(summary.availableTalentPoints, CHARACTER_MASTERY_MAX_LEVEL - 1 - 6);
  assert.equal(clean.characters.piotr.totalRuns, 0);
  assert.deepEqual(Object.keys(clean.characters.piotr.talentRanks).sort(), ['mafia_protocol', 'veteran_grip']);
});

test('mastery progression preserves XP overflow when several thresholds are crossed', () => {
  let profile = createInitialCharacterMasteryProfile();
  const enoughXp = Array.from({ length: 5 }, (_, i) => getCharacterMasteryXpRequirement(i + 1)).reduce((sum, value) => sum + value, 0) + 12;
  profile = {
    ...profile,
    characters: {
      ...profile.characters,
      grzesiek: { ...profile.characters.grzesiek, xp: enoughXp },
    },
  };
  const update = recordCharacterRunResult(profile, 'grzesiek', {
    kills: 0, elapsedSeconds: 0, bossesDefeated: 0, secretsFound: 0,
  });
  assert.ok(update.levelsGained >= 5);
  assert.equal(getCharacterMasterySummary(update.profile, 'grzesiek').xp, 12);
});
