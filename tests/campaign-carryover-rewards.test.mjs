import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_REWARDS,
  CAMPAIGN_STAGES,
  createInitialCampaignProgress,
  getCampaignRewardChoices,
  recordCampaignStageResult,
  sanitizeCampaignProgress,
  setPendingCampaignReward,
  consumePendingCampaignReward,
} from '../src/campaignProgression.ts';

test('each campaign clear offers three unique deterministic rewards', () => {
  for (const stage of CAMPAIGN_STAGES) {
    const first = getCampaignRewardChoices(stage.id, 1);
    const repeated = getCampaignRewardChoices(stage.id, 1);
    assert.equal(first.length, 3);
    assert.equal(new Set(first.map((reward) => reward.id)).size, 3);
    assert.deepEqual(first, repeated);
    assert.ok(first.every((reward) => CAMPAIGN_REWARDS.some((known) => known.id === reward.id)));
  }
});

test('campaign progress stores a selected reward for exactly the unlocked next stage', () => {
  let progress = createInitialCampaignProgress();
  progress = recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: true,
    kills: 12,
    elapsedSeconds: 77,
    perfectDodges: 2,
  });
  assert.ok(progress.unlockedStageIds.includes('port_17'));

  progress = setPendingCampaignReward(progress, 'port_17', 'damage_core');
  assert.equal(progress.pendingRewardId, 'damage_core');
  assert.equal(progress.pendingRewardStageId, 'port_17');

  const wrongStage = consumePendingCampaignReward(progress, 'cold_zero');
  assert.equal(wrongStage.rewardId, null);
  assert.equal(wrongStage.progress.pendingRewardId, 'damage_core');

  const nextStage = consumePendingCampaignReward(wrongStage.progress, 'port_17');
  assert.equal(nextStage.rewardId, 'damage_core');
  assert.equal(nextStage.progress.pendingRewardId, null);
  assert.equal(nextStage.progress.pendingRewardStageId, null);

  const duplicateConsume = consumePendingCampaignReward(nextStage.progress, 'port_17');
  assert.equal(duplicateConsume.rewardId, null);
});

test('invalid and locked reward targets are rejected', () => {
  const initial = createInitialCampaignProgress();
  assert.deepEqual(setPendingCampaignReward(initial, 'port_17', 'damage_core'), initial);
  assert.deepEqual(setPendingCampaignReward(initial, 'b4_intro', 'not-a-reward'), initial);
  const malformed = sanitizeCampaignProgress({
    unlockedStageIds: ['final_audit'],
    completedStages: {},
    pendingRewardId: 'damage_core',
    pendingRewardStageId: 'final_audit',
  });
  assert.equal(malformed.pendingRewardId, null);
  assert.equal(malformed.pendingRewardStageId, null);
});

test('legacy campaign saves remain valid and gain empty reward fields', () => {
  const migrated = sanitizeCampaignProgress({
    version: 1,
    unlockedStageIds: ['b4_intro', 'port_17'],
    completedStages: {
      b4_intro: { bestStars: 2, bestKills: 14, bestTimeSeconds: 73, completions: 1 },
    },
  });
  assert.deepEqual(migrated.unlockedStageIds, ['b4_intro', 'port_17']);
  assert.equal(migrated.completedStages.b4_intro?.bestStars, 2);
  assert.equal(migrated.pendingRewardId, null);
  assert.equal(migrated.pendingRewardStageId, null);
});

test('new stage starts consume no reward after the previous target reward is spent', () => {
  let progress = createInitialCampaignProgress();
  progress = recordCampaignStageResult(progress, 'b4_intro', {
    bossDefeated: true,
    kills: 10,
    elapsedSeconds: 80,
    perfectDodges: 1,
  });
  progress = setPendingCampaignReward(progress, 'port_17', 'reserve_crate');
  const consumed = consumePendingCampaignReward(progress, 'port_17');
  assert.equal(consumed.rewardId, 'reserve_crate');
  assert.equal(consumePendingCampaignReward(consumed.progress, 'port_17').rewardId, null);
});
