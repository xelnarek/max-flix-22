import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_PROGRESS_MAX_LEVEL,
  ACCOUNT_RANKS,
  ACCOUNT_TALENTS,
  canSpendAccountTalentPoint,
  combineAccountAndCharacterBonuses,
  createInitialAccountProgressionProfile,
  getAccountProgressionBonuses,
  getAccountProgressionSummary,
  getAccountRankInfo,
  getAccountXpRequirement,
  recordAccountPvpMatch,
  recordAccountSurvivalRun,
  sanitizeAccountProgressionProfile,
  spendAccountTalentPoint,
} from '../src/accountProgression.ts';

test('a new account starts as a Recruit with no spendable points', () => {
  const profile = createInitialAccountProgressionProfile();
  const summary = getAccountProgressionSummary(profile);
  assert.equal(profile.level, 1);
  assert.equal(getAccountXpRequirement(1), 75);
  assert.equal(summary.availableSkillPoints, 0);
  assert.equal(summary.spentSkillPoints, 0);
  assert.equal(summary.rankName, 'REKRUT');
  assert.equal(summary.nextRankName, 'OPERATOR');
  assert.equal(summary.nextRankLevel, 5);
});

test('Survival runs grant shared account XP from kills, survival time, bosses, secrets and wave progress', () => {
  const start = createInitialAccountProgressionProfile();
  const update = recordAccountSurvivalRun(start, {
    kills: 10,
    elapsedSeconds: 40,
    bossesDefeated: 1,
    secretsFound: 1,
    highestWave: 3,
  });

  assert.equal(update.xpEarned, 99);
  assert.equal(update.levelsGained, 1);
  assert.equal(update.profile.level, 2);
  assert.equal(update.profile.xp, 24);
  assert.equal(update.profile.stats.survivalRuns, 1);
  assert.equal(update.profile.stats.survivalKills, 10);
  assert.equal(update.profile.stats.bossesDefeated, 1);
  assert.equal(getAccountProgressionSummary(update.profile).availableSkillPoints, 1);
});

test('PvP match results grant the same shared account XP and preserve match statistics', () => {
  const start = createInitialAccountProgressionProfile();
  const update = recordAccountPvpMatch(start, {
    damageDealt: 400,
    shotsHit: 5,
    knockouts: 1,
    roundsWon: 2,
    wonMatch: true,
  });

  assert.equal(update.xpEarned, 84);
  assert.equal(update.levelsGained, 1);
  assert.equal(update.profile.level, 2);
  assert.equal(update.profile.xp, 9);
  assert.equal(update.profile.stats.pvpMatches, 1);
  assert.equal(update.profile.stats.pvpWins, 1);
  assert.equal(update.profile.stats.pvpDamage, 400);
});

test('each account level grants one point and branch prerequisites must be fully ranked', () => {
  const profile = createInitialAccountProgressionProfile();
  profile.level = 7;
  assert.equal(getAccountProgressionSummary(profile).availableSkillPoints, 6);

  assert.equal(canSpendAccountTalentPoint(profile, 'weapon_training'), true);
  assert.equal(canSpendAccountTalentPoint(profile, 'ability_calibration'), false);
  assert.equal(canSpendAccountTalentPoint(profile, 'unknown_talent'), false);

  let current = profile;
  for (let rank = 1; rank <= 3; rank++) {
    const result = spendAccountTalentPoint(current, 'weapon_training');
    assert.equal(result.purchased, true);
    current = result.profile;
  }
  assert.equal(canSpendAccountTalentPoint(current, 'ability_calibration'), true);
  const next = spendAccountTalentPoint(current, 'ability_calibration');
  assert.equal(next.purchased, true);
  assert.equal(next.profile.talentRanks.weapon_training, 3);
  assert.equal(next.profile.talentRanks.ability_calibration, 1);
  assert.equal(getAccountProgressionSummary(next.profile).availableSkillPoints, 2);
});

test('account profile sanitization rejects unknown talents, unmet prerequisites and points beyond earned level', () => {
  const clean = sanitizeAccountProgressionProfile({
    version: 99,
    level: 2,
    xp: 999999,
    talentRanks: {
      weapon_training: 3,
      ability_calibration: 3,
      field_intelligence: 3,
      invented_skill: 99,
    },
    stats: { pvpWins: -4, survivalKills: 23, pvpDamage: 99.4 },
  });

  assert.equal(clean.version, 1);
  assert.equal(clean.level, 2);
  assert.equal(clean.xp, 74);
  assert.deepEqual(clean.talentRanks, { weapon_training: 1 });
  assert.equal(clean.stats.pvpWins, 0);
  assert.equal(clean.stats.survivalKills, 23);
  assert.equal(clean.stats.pvpDamage, 99);
  assert.equal(getAccountProgressionSummary(clean).availableSkillPoints, 0);
});

test('the rank ladder advances at its published thresholds and stops at Legend B4', () => {
  assert.deepEqual(ACCOUNT_RANKS.map((rank) => rank.level), [1, 5, 10, 15, 20, 25, 30, 34, 37]);
  assert.equal(getAccountRankInfo(4).rankName, 'REKRUT');
  assert.equal(getAccountRankInfo(5).rankName, 'OPERATOR');
  assert.equal(getAccountRankInfo(37).rankName, 'LEGENDA B4');
  assert.equal(getAccountRankInfo(37).isMaxRank, true);
  assert.equal(getAccountXpRequirement(ACCOUNT_PROGRESS_MAX_LEVEL), 0);
});

test('all 36 points can fully rank the twelve talents without exceeding combat caps', () => {
  const full = createInitialAccountProgressionProfile();
  full.level = ACCOUNT_PROGRESS_MAX_LEVEL;
  full.talentRanks = Object.fromEntries(ACCOUNT_TALENTS.map((talent) => [talent.id, talent.maxRank]));
  const summary = getAccountProgressionSummary(full);
  const bonuses = getAccountProgressionBonuses(full);

  assert.equal(summary.spentSkillPoints, 36);
  assert.equal(summary.availableSkillPoints, 0);
  assert.equal(summary.isMaxLevel, true);
  assert.equal(bonuses.damageMultiplier, 1.08);
  assert.equal(bonuses.damageTakenMultiplier, 0.9108);
  assert.equal(bonuses.speedMultiplier, 1.06);
  assert.ok(bonuses.jumpMultiplier <= 1.06);
  assert.equal(bonuses.abilityCooldownMultiplier, 0.9306);
  assert.ok(Math.abs(bonuses.xpMultiplier - 1.17690048) < 1e-10);
});

test('account bonuses combine with the existing operator mastery without unbounded stat stacking', () => {
  const profile = createInitialAccountProgressionProfile();
  profile.level = ACCOUNT_PROGRESS_MAX_LEVEL;
  profile.talentRanks = Object.fromEntries(ACCOUNT_TALENTS.map((talent) => [talent.id, talent.maxRank]));
  const bonuses = getAccountProgressionBonuses(profile);
  const combined = combineAccountAndCharacterBonuses({
    attackMultiplier: 1.08,
    damageTakenMultiplier: 0.90,
    speedMultiplier: 1.08,
    jumpMultiplier: 1.08,
    abilityCooldownMultiplier: 0.90,
  }, bonuses);

  assert.equal(combined.attackMultiplier, 1.08);
  assert.equal(combined.damageTakenMultiplier, 0.90);
  assert.equal(combined.speedMultiplier, 1.08);
  assert.equal(combined.jumpMultiplier, 1.08);
  assert.equal(combined.abilityCooldownMultiplier, 0.90);
});

test('PvP adapter maps account cooldown bonuses to the server profile contract', async () => {
  const { getAccountPvpProgressionBonuses } = await import('../src/accountProgression.ts');
  const profile = createInitialAccountProgressionProfile();
  profile.level = 7;
  profile.talentRanks = { weapon_training: 3, ability_calibration: 3, rapid_protocol: 1 };
  const bonuses = getAccountPvpProgressionBonuses(profile);
  assert.equal(bonuses.damageMultiplier, getAccountProgressionBonuses(profile).damageMultiplier);
  assert.equal(bonuses.damageTakenMultiplier, getAccountProgressionBonuses(profile).damageTakenMultiplier);
  assert.equal(bonuses.speedMultiplier, getAccountProgressionBonuses(profile).speedMultiplier);
  assert.equal(bonuses.cooldownMultiplier, getAccountProgressionBonuses(profile).abilityCooldownMultiplier);
  assert.ok(bonuses.cooldownMultiplier < 1);
});
