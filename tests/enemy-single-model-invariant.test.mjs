import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('each enemy installs exactly one imported actor rig and removes previous roots first', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private installActorVisualRoot\([\s\S]*?this\.removeAttachedActorVisuals\(group\)[\s\S]*?group\.add\(root\)/);
  assert.match(game, /private removeAttachedActorVisuals\([\s\S]*?const isActorRoot = child\.userData\.actorVisualRoot === true/);
  assert.match(game, /this\.gobkitEnemyTracks\.delete\(enemy\)/);
});

test('enemy model replacement removes the legacy procedural body while preserving HUD overlays', async () => {
  const [game, composition] = await Promise.all([
    read('../src/game.ts'),
    read('../src/enemyVisualComposition.ts'),
  ]);
  assert.match(game, /removeLegacyEnemyBodyVisuals\(mesh, overlays\)/);
  assert.match(composition, /export function removeLegacyEnemyBodyVisuals/);
  assert.match(composition, /const topLevelPreservedRoots = requestedRoots\.filter/);
  assert.match(composition, /disposeActorOwnedRenderResources\(child\)/);
  assert.match(composition, /child\.removeFromParent\(\)/);
  assert.match(composition, /object\.userData\.gobkitKeep === true/);
});

test('Base44 enemy models do not receive procedural role anatomy or secondary blocky kits', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const isBase44 = modelId === visualProfile\.base44Model;/);
  assert.match(game, /if \(!isBase44\) applyEnemyRoleAnatomy\(root, requestedType\)/);
  assert.doesNotMatch(game, /createEnemyRoleKit\(requestedType, root\)/);
});

test('async enemy model loads cannot attach to recycled, replaced, or expired enemy entities', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /!this\.enemies\.includes\(enemy\) \|\| enemy\.mesh !== mesh \|\| enemy\.type !== requestedType/);
  assert.match(game, /mesh\.parent !== this\.levelRoot \|\| deathVisualExpired/);
  assert.match(game, /this\.requestedGobkitEnemies\.add\(enemy\)/);
});
