import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_BOSS_SIGNATURES,
  getCampaignBossSignature,
  getCampaignBossVolley,
} from '../src/campaignBossSignatures.ts';

const stages = Object.keys(CAMPAIGN_BOSS_SIGNATURES);

test('all five Campaign bosses have separate signature names, callouts and patterns', () => {
  const signatures = stages.map((stageId) => getCampaignBossSignature(stageId));
  assert.equal(signatures.length, 5);
  assert.equal(new Set(signatures.map((entry) => entry.title)).size, 5);
  assert.equal(new Set(signatures.map((entry) => entry.callout)).size, 5);
  assert.equal(new Set(signatures.map((entry) => entry.pattern)).size, 5);
});

test('signature attack windows are readable and intervals stay bounded', () => {
  for (const signature of Object.values(CAMPAIGN_BOSS_SIGNATURES)) {
    assert.ok(signature.windupSeconds >= 0.9 && signature.windupSeconds <= 1.5);
    assert.ok(signature.intervalSeconds >= 12 && signature.intervalSeconds <= 19);
    assert.ok(signature.initialDelaySeconds >= 7 && signature.initialDelaySeconds <= 9);
    assert.ok(signature.maxShots >= 2 && signature.maxShots <= 5);
    assert.ok(signature.warning.length > 20);
  }
});

test('ramp, port, cold-store and sorter bosses use visibly different volleys', () => {
  const ramp = getCampaignBossVolley(getCampaignBossSignature('b4_intro'), 0, 1);
  const port = getCampaignBossVolley(getCampaignBossSignature('port_17'), 0, 1);
  const cold = getCampaignBossVolley(getCampaignBossSignature('cold_zero'), 0, 1);
  const sorter = getCampaignBossVolley(getCampaignBossSignature('night_sorting'), 0, 1);

  assert.deepEqual(ramp.angleOffsets, [-0.28, 0, 0.28]);
  assert.deepEqual(port.angleOffsets, [-0.44, 0.44]);
  assert.equal(cold.angleOffsets.length, 5);
  assert.equal(sorter.angleOffsets.length, 3);
  assert.equal(ramp.projectileKind, 'penalty');
  assert.equal(port.projectileKind, 'dyscyplinarka');
  assert.equal(cold.projectileKind, 'clipboard');
  assert.equal(sorter.projectileKind, 'spark');
});

test('final audit alternates a wide paperwork fan and a narrow electric crossfire', () => {
  const signature = getCampaignBossSignature('final_audit');
  const first = getCampaignBossVolley(signature, 0, 1);
  const second = getCampaignBossVolley(signature, 1, 1);
  const third = getCampaignBossVolley(signature, 2, 1);
  assert.equal(first.projectileKind, 'dyscyplinarka');
  assert.equal(first.angleOffsets.length, 5);
  assert.equal(second.projectileKind, 'spark');
  assert.equal(second.angleOffsets.length, 2);
  assert.deepEqual(third, first);
});

test('enraged phase widens each existing pattern without adding projectiles or changing its identity', () => {
  for (const signature of Object.values(CAMPAIGN_BOSS_SIGNATURES)) {
    for (const volleyIndex of [0, 1, 2, 3]) {
      const normal = getCampaignBossVolley(signature, volleyIndex, 1);
      const enraged = getCampaignBossVolley(signature, volleyIndex, 2);
      const laterEnraged = getCampaignBossVolley(signature, volleyIndex, 3);
      assert.equal(enraged.angleOffsets.length, normal.angleOffsets.length);
      assert.equal(enraged.projectileKind, normal.projectileKind);
      assert.ok(enraged.angleOffsets.every((angle) => Number.isFinite(angle) && Math.abs(angle) <= 0.72));
      assert.ok(enraged.lateralSpacing <= 0.68);
      assert.ok(enraged.angleOffsets.some((angle, index) => Math.abs(angle) > Math.abs(normal.angleOffsets[index]) + 1e-6));
      assert.deepEqual(laterEnraged, enraged, 'phase escalation remains capped and predictable');
    }
  }
});

test('malformed volley indices fail closed to the first predictable pattern', () => {
  const signature = getCampaignBossSignature('final_audit');
  assert.deepEqual(getCampaignBossVolley(signature, Number.NaN, 1), getCampaignBossVolley(signature, 0, 1));
  assert.deepEqual(getCampaignBossVolley(signature, -5, 1), getCampaignBossVolley(signature, 0, 1));
});
