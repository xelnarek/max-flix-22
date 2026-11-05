import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSurvivalAchievementProgress,
  getSurvivalAchievementCards,
  getSurvivalAchievementSummary,
  recordSurvivalSecretDiscovery,
  sanitizeSurvivalAchievementProgress,
  updateSurvivalAchievementProgress,
} from '../src/survivalAchievements.ts';
import { SURVIVAL_MAP_IDS, getSurvivalMapDefinition } from '../src/survivalMaps.ts';

test('first kill and single-run milestones unlock achievement progress monotonically', () => {
  let progress = createInitialSurvivalAchievementProgress();
  let result = updateSurvivalAchievementProgress(progress, {
    mapId: 'warehouse_b4', kills: 1, elapsedSeconds: 10, bossesDefeated: 0,
  });
  progress = result.progress;
  assert.ok(progress.unlocked.includes('first_blood'));
  assert.deepEqual(result.newlyUnlocked, ['first_blood']);

  result = updateSurvivalAchievementProgress(progress, {
    mapId: 'warehouse_b4', kills: 52, elapsedSeconds: 620, bossesDefeated: 3,
  });
  progress = result.progress;
  for (const id of ['warehouse_veteran', 'long_shift', 'night_shift', 'boss_breaker']) {
    assert.ok(progress.unlocked.includes(id));
  }
  assert.equal(progress.bestKills, 52);
  assert.equal(progress.bestSurvivalSeconds, 620);
  assert.equal(progress.bestBossesDefeated, 3);

  const worseRun = updateSurvivalAchievementProgress(progress, {
    mapId: 'container_terminal', kills: 4, elapsedSeconds: 40, bossesDefeated: 0,
  });
  assert.equal(worseRun.progress.bestKills, 52);
  assert.equal(worseRun.progress.bestSurvivalSeconds, 620);
  assert.equal(worseRun.progress.bestBossesDefeated, 3);
});

test('map explorer unlocks only after all four different arenas have been visited', () => {
  let progress = createInitialSurvivalAchievementProgress();
  for (const mapId of SURVIVAL_MAP_IDS.slice(0, 3)) {
    const result = updateSurvivalAchievementProgress(progress, {
      mapId, kills: 0, elapsedSeconds: 0, bossesDefeated: 0,
    });
    progress = result.progress;
    assert.ok(!progress.unlocked.includes('map_explorer'));
  }
  const result = updateSurvivalAchievementProgress(progress, {
    mapId: SURVIVAL_MAP_IDS[3], kills: 0, elapsedSeconds: 0, bossesDefeated: 0,
  });
  assert.ok(result.progress.unlocked.includes('map_explorer'));
  assert.equal(result.progress.mapsVisited.length, 4);
});

test('secret discovery is unique across maps and unlocks hunter and full archive awards', () => {
  let progress = createInitialSurvivalAchievementProgress();
  const discoveries = SURVIVAL_MAP_IDS.flatMap((mapId) =>
    getSurvivalMapDefinition(mapId).secretLocations.map((secret) => ({ mapId, secretId: secret.id }))
  );
  for (let index = 0; index < 3; index++) {
    const secret = discoveries[index];
    const result = recordSurvivalSecretDiscovery(progress, secret.mapId, secret.secretId);
    assert.equal(result.added, true);
    progress = result.progress;
  }
  assert.ok(progress.unlocked.includes('secret_hunter'));
  assert.ok(!progress.unlocked.includes('secret_archive'));

  const duplicate = recordSurvivalSecretDiscovery(progress, discoveries[0].mapId, discoveries[0].secretId);
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.progress.discoveredSecrets.length, 3);

  for (const secret of discoveries.slice(3)) {
    progress = recordSurvivalSecretDiscovery(progress, secret.mapId, secret.secretId).progress;
  }
  assert.ok(progress.unlocked.includes('secret_archive'));
  assert.equal(progress.discoveredSecrets.length, 16);
});

test('progress sanitization rejects corrupt IDs, duplicates and invalid counters', () => {
  const sanitized = sanitizeSurvivalAchievementProgress({
    unlocked: ['first_blood', 'first_blood', 'not_an_achievement'],
    mapsVisited: ['warehouse_b4', 'warehouse_b4', 'unknown_map'],
    discoveredSecrets: ['warehouse_b4:golden_wz', 'fake:secret'],
    bestKills: -10,
    bestSurvivalSeconds: Number.NaN,
    bestBossesDefeated: 'three',
  });
  assert.deepEqual(sanitized.unlocked, ['first_blood']);
  assert.deepEqual(sanitized.mapsVisited, ['warehouse_b4']);
  assert.deepEqual(sanitized.discoveredSecrets, ['warehouse_b4:golden_wz']);
  assert.equal(sanitized.bestKills, 0);
  assert.equal(sanitized.bestSurvivalSeconds, 0);
  assert.equal(sanitized.bestBossesDefeated, 0);
});

test('achievement cards and archive summary expose accurate progress counts', () => {
  let progress = createInitialSurvivalAchievementProgress();
  progress = updateSurvivalAchievementProgress(progress, {
    mapId: 'warehouse_b4', kills: 25, elapsedSeconds: 150, bossesDefeated: 1,
  }).progress;
  const cards = getSurvivalAchievementCards(progress);
  assert.equal(cards.length, 8);
  assert.equal(cards.find((card) => card.id === 'first_blood')?.unlocked, true);
  assert.equal(cards.find((card) => card.id === 'warehouse_veteran')?.progressLabel, '25 / 50 eliminacji');
  const summary = getSurvivalAchievementSummary(progress);
  assert.equal(summary.total, 8);
  assert.equal(summary.unlocked, 1);
  assert.equal(summary.totalSecrets, 16);
});
