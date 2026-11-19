import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_STAGES,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  createInitialCampaignProgress,
  evaluateCampaignStars,
  getCampaignMasteryProgress,
  getCampaignSideOrderProgress,
  getCampaignRewardChoices,
  getNextCampaignStageId,
  readCampaignProgress,
  recordCampaignStageResult,
  sanitizeCampaignProgress,
  writeCampaignProgress,
} from '../src/campaignProgression.ts';

test('five compact stages have a short first mission and an early boss', () => {
  assert.equal(CAMPAIGN_STAGES.length, 5);
  assert.equal(CAMPAIGN_STAGES[0].durationSeconds, 90);
  assert.ok(CAMPAIGN_STAGES.every((stage) => stage.durationSeconds <= 210 && stage.bossSpawnAtSeconds < stage.durationSeconds));
  assert.equal(new Set(CAMPAIGN_STAGES.map((stage) => stage.mastery.metric)).size, 4);
});

test('boss clear and kill quota determine the first two stars', () => {
  const stage = CAMPAIGN_STAGES[0];
  assert.equal(evaluateCampaignStars(stage, { bossDefeated: false, kills: 99, perfectDodges: 99 }), 0);
  assert.equal(evaluateCampaignStars(stage, { bossDefeated: true, kills: 0, perfectDodges: 0 }), 1);
  assert.equal(evaluateCampaignStars(stage, { bossDefeated: true, kills: stage.bonusKillTarget - 1, perfectDodges: 1 }), 1);
  assert.equal(evaluateCampaignStars(stage, { bossDefeated: true, kills: stage.bonusKillTarget, perfectDodges: 0 }), 2);
  assert.equal(evaluateCampaignStars(stage, { bossDefeated: true, kills: stage.bonusKillTarget, perfectDodges: 1 }), 3);
});

test('each mission has a different readable mastery objective', () => {
  const [b4, port, cold, night, final] = CAMPAIGN_STAGES;
  assert.deepEqual([b4.mastery.metric, port.mastery.metric, cold.mastery.metric, night.mastery.metric, final.mastery.metric], [
    'perfect_dodges', 'kill_streak', 'xp_streak', 'operator_level', 'perfect_dodges',
  ]);
  assert.equal(getCampaignMasteryProgress(port, { killStreak: 5 }).completed, false);
  assert.equal(getCampaignMasteryProgress(port, { killStreak: 6 }).completed, true);
  assert.equal(getCampaignMasteryProgress(cold, { xpStreak: 2 }).completed, false);
  assert.equal(getCampaignMasteryProgress(cold, { xpStreak: 3 }).completed, true);
  assert.equal(getCampaignMasteryProgress(night, { level: 3 }).completed, false);
  assert.equal(getCampaignMasteryProgress(night, { level: 4 }).completed, true);
  assert.equal(getCampaignMasteryProgress(final, { perfectDodges: 3 }).completed, true);
});

test('mastery objective grants the third star only after the kill quota', () => {
  const port = CAMPAIGN_STAGES[1];
  assert.equal(evaluateCampaignStars(port, { bossDefeated: true, kills: port.bonusKillTarget - 1, killStreak: 6 }), 1);
  assert.equal(evaluateCampaignStars(port, { bossDefeated: true, kills: port.bonusKillTarget, killStreak: 5 }), 2);
  assert.equal(evaluateCampaignStars(port, { bossDefeated: true, kills: port.bonusKillTarget, killStreak: 6 }), 3);
});

test('stage clear unlocks only the next and keeps best records', () => {
  let progress = createInitialCampaignProgress();
  assert.deepEqual(progress.unlockedStageIds, ['b4_intro']);
  assert.equal(getNextCampaignStageId(progress, 'b4_intro'), null);
  progress = recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: true, kills: 10, elapsedSeconds: 72, perfectDodges: 1,
  });
  assert.ok(progress.unlockedStageIds.includes('port_17'));
  assert.equal(progress.completedStages.b4_intro?.bestStars, 3);
  assert.equal(progress.completedStages.b4_intro?.bestMasteryValue, 1);
  progress = recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: true, kills: 4, elapsedSeconds: 80, perfectDodges: 0,
  });
  assert.equal(progress.completedStages.b4_intro?.bestStars, 3);
  assert.equal(progress.completedStages.b4_intro?.bestKills, 10);
  assert.equal(progress.completedStages.b4_intro?.bestTimeSeconds, 72);
  assert.equal(progress.completedStages.b4_intro?.bestMasteryValue, 1);
  assert.equal(progress.completedStages.b4_intro?.completions, 2);
  assert.equal(getNextCampaignStageId(progress, 'b4_intro'), 'port_17');
});

test('failed and locked stages cannot advance progression', () => {
  const progress = createInitialCampaignProgress();
  assert.deepEqual(recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: false, kills: 20, elapsedSeconds: 50, perfectDodges: 4,
  }), progress);
  assert.deepEqual(recordCampaignStageResult(progress, 'cold_zero', {
    bossDefeated: true, kills: 20, elapsedSeconds: 50, perfectDodges: 4,
  }), progress);
});

test('storage tolerates corrupt data and write failures', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(writeCampaignProgress(storage, createInitialCampaignProgress()), true);
  assert.ok(data.has(CAMPAIGN_PROGRESS_STORAGE_KEY));
  assert.deepEqual(readCampaignProgress(storage), createInitialCampaignProgress());
  assert.deepEqual(readCampaignProgress({ getItem: () => '{bad' }), createInitialCampaignProgress());
  assert.equal(writeCampaignProgress({ setItem: () => { throw Error('blocked'); } }, createInitialCampaignProgress()), false);
});

test('v1 save migration preserves old star records and supplies a safe mastery default', () => {
  const progress = sanitizeCampaignProgress({
    version: 1,
    completedStages: { b4_intro: { bestStars: 3, bestKills: 22, bestTimeSeconds: 75, completions: 2 } },
  });
  assert.deepEqual(progress.unlockedStageIds, ['b4_intro', 'port_17']);
  assert.equal(progress.completedStages.b4_intro?.bestStars, 3);
  assert.equal(progress.completedStages.b4_intro?.bestMasteryValue, 0);
});

test('sanitizer prevents gaps in the unlock sequence', () => {
  const progress = sanitizeCampaignProgress({
    unlockedStageIds: ['final_audit'],
    completedStages: { b4_intro: { bestStars: 1, bestKills: 2, bestTimeSeconds: 75, completions: 1 } },
  });
  assert.deepEqual(progress.unlockedStageIds, ['b4_intro', 'port_17']);
});

test('every campaign mission has one distinct optional field order', () => {
  const metrics = CAMPAIGN_STAGES.map((stage) => stage.sideOrder.metric);
  assert.deepEqual(metrics, ['xp_pickups', 'kill_streak', 'secrets_found', 'player_hp_percent', 'boss_kill_seconds']);
});

test('field orders are optional until boss victory and apply direction-aware thresholds', () => {
  const [b4, port, cold, night, final] = CAMPAIGN_STAGES;
  assert.equal(getCampaignSideOrderProgress(b4, { xpPickups: 5, bossDefeated: false }).completed, false);
  assert.equal(getCampaignSideOrderProgress(b4, { xpPickups: 4, bossDefeated: true }).completed, false);
  assert.equal(getCampaignSideOrderProgress(b4, { xpPickups: 5, bossDefeated: true }).completed, true);
  assert.equal(getCampaignSideOrderProgress(port, { killStreak: 8, bossDefeated: true }).completed, false);
  assert.equal(getCampaignSideOrderProgress(port, { killStreak: 9, bossDefeated: true }).completed, true);
  assert.equal(getCampaignSideOrderProgress(cold, { secretsFound: 1, bossDefeated: true }).completed, true);
  assert.equal(getCampaignSideOrderProgress(night, { playerHpPercent: 59, bossDefeated: true }).completed, false);
  assert.equal(getCampaignSideOrderProgress(night, { playerHpPercent: 60, bossDefeated: true }).completed, true);
  assert.equal(getCampaignSideOrderProgress(final, { bossKillSeconds: 36, bossDefeated: true }).completed, false);
  assert.equal(getCampaignSideOrderProgress(final, { bossKillSeconds: 35, bossDefeated: true }).completed, true);
  assert.equal(getCampaignSideOrderProgress(final, { bossKillSeconds: 35.01, bossDefeated: true }).completed, false);
  assert.equal(getCampaignSideOrderProgress(final, { bossKillSeconds: 20, bossDefeated: false }).completed, false);
});

test('a completed field order unlocks one extra unique supply choice', () => {
  const standard = getCampaignRewardChoices('b4_intro', 1);
  const bonus = getCampaignRewardChoices('b4_intro', 1, true);
  assert.equal(standard.length, 3);
  assert.equal(bonus.length, 4);
  assert.deepEqual(bonus.slice(0, 3).map((reward) => reward.id), standard.map((reward) => reward.id));
  assert.equal(new Set(bonus.map((reward) => reward.id)).size, 4);
  assert.ok(!standard.some((reward) => reward.id === bonus[3].id));
});

test('field-order records preserve completion and the best qualifying metric', () => {
  let progress = createInitialCampaignProgress();
  progress = recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: true, kills: 10, elapsedSeconds: 72, perfectDodges: 1, xpPickups: 5,
  });
  assert.equal(progress.completedStages.b4_intro?.bestSideOrderCompleted, true);
  assert.equal(progress.completedStages.b4_intro?.bestSideOrderValue, 5);
  progress = recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: true, kills: 8, elapsedSeconds: 80, perfectDodges: 0, xpPickups: 3,
  });
  assert.equal(progress.completedStages.b4_intro?.bestSideOrderCompleted, true);
  assert.equal(progress.completedStages.b4_intro?.bestSideOrderValue, 5);
});

test('time-based field order keeps the fastest qualifying boss clear', () => {
  let progress = createInitialCampaignProgress();
  for (const stage of CAMPAIGN_STAGES.slice(0, 4)) {
    progress = recordCampaignStageResult(progress, stage.id, {
      bossDefeated: true,
      kills: stage.bonusKillTarget,
      elapsedSeconds: stage.durationSeconds - 5,
      perfectDodges: 3,
      xpStreak: 3,
      level: 4,
      killStreak: 10,
      xpPickups: 12,
      secretsFound: 1,
      playerHpPercent: 85,
      bossKillSeconds: 20,
    });
  }
  assert.ok(progress.unlockedStageIds.includes('final_audit'));
  for (const bossKillSeconds of [30, 24, 36]) {
    progress = recordCampaignStageResult(progress, 'final_audit', {
      bossDefeated: true, kills: 31, elapsedSeconds: 200, perfectDodges: 3, xpPickups: 12,
      bossKillSeconds,
    });
  }
  assert.equal(progress.completedStages.final_audit?.bestSideOrderCompleted, true);
  assert.equal(progress.completedStages.final_audit?.bestSideOrderValue, 24);
});
