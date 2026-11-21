import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SURVIVAL_FIREARM_ASSETS } from '../src/survivalFirearmAssets.ts';
import {
  getSurvivalFirearmAssetAnimationClips,
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
