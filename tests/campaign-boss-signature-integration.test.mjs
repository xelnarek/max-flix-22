import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Campaign signature attacks run only for the active Campaign boss in Survival', async () => {
  const [game, signatures] = await Promise.all([
    read('../src/game.ts'),
    read('../src/campaignBossSignatures.ts'),
  ]);
  assert.match(game, /getCampaignBossSignature, getCampaignBossVolley/);
  assert.match(game, /if \(this\.campaignStage && boss\.id === this\.campaignBossEnemyId\)\s*\{\s*this\.updateCampaignBossSignature\(boss, dt\);/);
  const pulseStart = game.indexOf('private updateSurvivalCommanderPulse');
  const pulseEnd = game.indexOf('private updateSurvivalSupportPulse', pulseStart);
  assert.ok(pulseStart >= 0 && pulseEnd > pulseStart);
  const pulse = game.slice(pulseStart, pulseEnd);
  assert.match(pulse, /if \(this\.gameMode !== 'survival' \|\| boss\.state === 'defeated'\) return/);
  assert.match(pulse, /this\.updateCampaignBossSignature\(boss, dt\)/);

  const signatureStart = game.indexOf('private updateCampaignBossSignature');
  const signatureEnd = game.indexOf('private updateSurvivalCommanderPulse', signatureStart);
  assert.ok(signatureStart >= 0 && signatureEnd > signatureStart);
  const signature = game.slice(signatureStart, signatureEnd);
  assert.match(signature, /boss\.id !== this\.campaignBossEnemyId/);
  assert.match(signature, /boss\.stunTimer/);
  assert.match(signature, /runtime\.windupRemaining = 0/);
  assert.match(signature, /runtime\.lockedDirection = Math\.atan2/);
  assert.match(signature, /signature\.windupSeconds/);
  assert.match(signature, /signature\.intervalSeconds/);
  assert.match(signature, /onSurvivalAnnouncement/);
  assert.doesNotMatch(signature, /emitFloatingToast|spawnBossLaneTelegraph/);

  assert.match(game, /case 'penalty':[\s\S]*?spawnPenaltyNotice/);
  assert.match(game, /case 'dyscyplinarka':[\s\S]*?spawnDyscyplinarkaNotice/);
  assert.match(game, /case 'clipboard':[\s\S]*?spawnOdprawaClipboardProjectile/);
  assert.match(game, /case 'spark':[\s\S]*?spawnSparkZapProjectile/);
  assert.match(signatures, /b4_intro:[\s\S]*?pattern: 'ramp_sweep'/);
  assert.match(signatures, /port_17:[\s\S]*?pattern: 'container_crossfire'/);
  assert.match(signatures, /cold_zero:[\s\S]*?pattern: 'frost_manifest'/);
  assert.match(signatures, /night_sorting:[\s\S]*?pattern: 'scanner_sweep'/);
  assert.match(signatures, /final_audit:[\s\S]*?pattern: 'audit_combo'/);
});
