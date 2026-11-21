import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SURVIVAL_FIREARM_ASSETS } from '../src/survivalFirearmAssets.ts';
import {
  getSurvivalFirearmAssetAnimationClips,
  getSurvivalFirearmAssetAnimationTiming,
} from '../src/survivalFirearmAssetAnimation.ts';

const weaponPhases = ['reload-open', 'reload-close', 'fire-open', 'fire-close'];

test('SMG, rifle and heavy rifle use both authored magazine and folding-stock clips during reload', () => {
  for (const archetype of ['smg', 'rifle', 'heavy-rifle']) {
    assert.deepEqual(getSurvivalFirearmAssetAnimationClips(archetype, 'reload-open'), [
      'magazine-open',
      'stock-open',
    ]);
    assert.deepEqual(getSurvivalFirearmAssetAnimationClips(archetype, 'reload-close'), [
      'magazine-close',
      'stock-close',
    ]);
    assert.deepEqual(getSurvivalFirearmAssetAnimationClips(archetype, 'fire-open'), []);
    assert.deepEqual(getSurvivalFirearmAssetAnimationClips(archetype, 'fire-close'), []);
  }
});

test('pistol slide, shotgun pump and all other mapped actions keep their weapon-specific clips', () => {
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('pistol', 'reload-open'), [
    'magazine-open', 'slide-open',
  ]);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('pistol', 'reload-close'), [
    'magazine-close', 'slide-close',
  ]);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('pistol', 'fire-open'), ['slide-open']);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('pistol', 'fire-close'), ['slide-close']);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('shotgun', 'reload-open'), ['open']);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('shotgun', 'reload-close'), ['close']);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('shotgun', 'fire-open'), ['open']);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('shotgun', 'fire-close'), ['close']);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('rocket', 'reload-open'), []);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('unknown', 'reload-open'), []);
  assert.deepEqual(getSurvivalFirearmAssetAnimationClips('smg', 'idle'), []);
});

test('every runtime-selected GLB clip exists in that archetype production asset manifest', () => {
  for (const [archetype, definition] of Object.entries(SURVIVAL_FIREARM_ASSETS)) {
    for (const phase of weaponPhases) {
      const selected = getSurvivalFirearmAssetAnimationClips(archetype, phase);
      for (const clipName of selected) {
        assert.ok(
          definition.expectedAnimations.includes(clipName),
          archetype + ' runtime requested a clip absent from its production manifest: ' + clipName,
        );
      }
    }
  }
});

test('the shared local and remote firearm runtime both use the tested clip resolver', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /import \{ getSurvivalFirearmAssetAnimationClips \} from '\.\/survivalFirearmAssetAnimation\.ts'/);
  assert.match(game, /const wanted = getSurvivalFirearmAssetAnimationClips\(archetype, phase\)/);
  assert.doesNotMatch(game, /else if \(phase === 'reload-open'\)\s*\{\s*wanted = \['magazine-open'\]/);
});

test('GLB clip playback is phase-seeked and finishes with the real reload or firing phase', () => {
  const timing = getSurvivalFirearmAssetAnimationTiming(1.2, 0.25, 0.8);
  assert.ok(timing);
  assert.ok(Math.abs(timing.timeSeconds - 0.3) < 1e-9);
  assert.ok(Math.abs(timing.timeScale - 1.5) < 1e-9);

  const clipDuration = 2.4;
  const phaseDuration = 0.65;
  for (const phaseProgress of [0, 0.1, 0.52, 0.99, 1]) {
    const result = getSurvivalFirearmAssetAnimationTiming(
      clipDuration,
      phaseProgress,
      phaseDuration,
    );
    assert.ok(result);
    const remainingClipSeconds = (clipDuration - result.timeSeconds) / result.timeScale;
    const remainingPhaseSeconds = (1 - phaseProgress) * phaseDuration;
    assert.ok(Math.abs(remainingClipSeconds - remainingPhaseSeconds) < 1e-9);
  }
});

test('GLB animation timing clamps phase progress and rejects invalid clip or action durations', () => {
  assert.deepEqual(
    getSurvivalFirearmAssetAnimationTiming(1, -5, 2),
    { timeSeconds: 0, timeScale: 0.5 },
  );
  assert.deepEqual(
    getSurvivalFirearmAssetAnimationTiming(1, 5, 2),
    { timeSeconds: 1, timeScale: 0.5 },
  );
  assert.equal(getSurvivalFirearmAssetAnimationTiming(0, 0.5, 2), null);
  assert.equal(getSurvivalFirearmAssetAnimationTiming(1, 0.5, 0), null);
  assert.equal(getSurvivalFirearmAssetAnimationTiming(Number.NaN, 0.5, 2), null);
  assert.equal(getSurvivalFirearmAssetAnimationTiming(1, Number.NaN, 2), null);
});

test('local Survival/Campaign and remote PvP rigs pass their authoritative action durations into animation sync', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /remoteCycleProgress,[\s\S]{0,180}remoteDefinition\.reloadSeconds,[\s\S]{0,100}remoteDefinition\.fireIntervalSeconds/);
  assert.match(game, /cycleProgress,[\s\S]{0,180}definition\.reloadSeconds,[\s\S]{0,100}definition\.fireIntervalSeconds/);
  assert.match(game, /action\.setEffectiveTimeScale\(timing\.timeScale\)/);
  assert.match(game, /action\.time = timing\.timeSeconds/);
});
