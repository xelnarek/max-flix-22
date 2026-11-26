import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('attaching a GLB or MakeHuman rig cancels pending delayed procedural enemy polish', async () => {
  const game = await read('../src/game.ts');

  assert.match(
    game,
    /attachMakeHumanEnemyModel[\s\S]*?removeLegacyEnemyBodyVisuals\(mesh as THREE\.Group, overlays\);\s*delete mesh\.userData\.enemyVisualPolishPending;\s*this\.installActorVisualRoot/,
  );
  assert.match(
    game,
    /installEnemyRigFromGltf[\s\S]*?removeLegacyEnemyBodyVisuals\(mesh, overlays\);\s*delete mesh\.userData\.enemyVisualPolishPending;\s*this\.installActorVisualRoot/,
  );

  const polishStart = game.indexOf('private applyEnemyVisualPolish(enemy: EnemyItem)');
  const polishEnd = game.indexOf('private applyStorybookStyle(', polishStart);
  assert.ok(polishStart >= 0 && polishEnd > polishStart);
  const polish = game.slice(polishStart, polishEnd);
  assert.match(polish, /this\.ensureEnemyContactShadow\(enemy\);/);
  assert.match(polish, /delete root\.userData\.enemyVisualPolishPending;/);
  assert.doesNotMatch(polish, /new THREE\.SphereGeometry|new THREE\.BoxGeometry|shoulderBeacon/);
});

test('GLB model attachment preserves scaled collisionRadius and forces immediate crowd resolution', async () => {
  const game = await read('../src/game.ts');
  const attachStart = game.indexOf('private installEnemyRigFromGltf(');
  const attachEnd = game.indexOf('private updateGobkitAnimations(', attachStart);
  assert.ok(attachStart >= 0 && attachEnd > attachStart);
  const attach = game.slice(attachStart, attachEnd);

  assert.match(attach, /const horizontalScale = enemy\.hitBaseScale/);
  assert.match(attach, /enemy\.collisionRadius = getEnemyCollisionRadius\(requestedType, Math\.max\(modelSize\.x, modelSize\.z\) \* 0\.46\) \*/);
  assert.match(attach, /this\.enemyCrowdResolutionNextAt = 0;/);
});

test('bespoke Cthulhu boss skips Gobkit rig loading and fallback survival spawns disperse around corners', async () => {
  const game = await read('../src/game.ts');
  const cthulhuStart = game.indexOf('private addCthulhuBossEnemy(');
  const cthulhuEnd = game.indexOf('private addKrolLetoBossEnemy(', cthulhuStart);
  assert.ok(cthulhuStart >= 0 && cthulhuEnd > cthulhuStart);
  assert.match(game.slice(cthulhuStart, cthulhuEnd), /built\.group\.userData\.skipGobkitRig = true;/);
  assert.match(game, /if \(!modelId \|\| !enemy\.mesh \|\| enemy\.mesh\.userData\.skipGobkitRig\) continue;/);

  const spawnStart = game.indexOf('private getSurvivalSpawnPoint(');
  const spawnEnd = game.indexOf('private spawnSurvivalEnemy(', spawnStart);
  assert.ok(spawnStart >= 0 && spawnEnd > spawnStart);
  const spawnFn = game.slice(spawnStart, spawnEnd);
  assert.match(spawnFn, /const dispersed: \{ x: number; z: number \}\[\] = \[\];/);
  assert.match(spawnFn, /return chooseSpacedSpawnPoint\(dispersed, this\.enemies, 2\.2\)/);
});
