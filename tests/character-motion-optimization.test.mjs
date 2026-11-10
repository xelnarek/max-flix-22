import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('animated operator equipment is attached to the skeleton that drives the matching body part', async () => {
  const assets = await read('../src/makeHumanAssets.ts');
  assert.match(assets, /rootSpace = false/);
  assert.match(assets, /parentInRoot\.invert\(\)\.multiply\(rootTransform\)\.decompose\(mesh\.position, mesh\.quaternion, mesh\.scale\)/);
  for (const bone of ['head', 'spine_02', 'pelvis']) {
    assert.ok(assets.includes("'" + bone + "', true"), 'expected root-space equipment anchor for ' + bone);
  }
  assert.match(assets, /'helmet-dome'[\s\S]*?'head', true/);
  assert.match(assets, /'vest-strap-' \+ side[\s\S]*?'spine_02', true/);
  assert.match(assets, /'courier-parcel'[\s\S]*?'spine_02', true/);
  assert.match(assets, /'tool-belt-loop'[\s\S]*?'pelvis', true/);
  assert.match(assets, /'hand-scanner'[\s\S]*?'hand_r'\)/);
  assert.match(assets, /'clipboard-board'[\s\S]*?'hand_l'\)/);
});

test('actor animation updates reuse persistent scratch transforms per frame', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private updateGobkitAnimations(dt: number)');
  const end = game.indexOf('private ', start + 12);
  const method = game.slice(start, end);
  assert.match(game, /private readonly actorDisplacementScratch = new THREE\\.Vector3\\(\\)/);
  assert.match(game, /private readonly actorLocalMovementScratch = new THREE\\.Vector3\\(\\)/);
  assert.match(game, /private readonly actorRotationScratch = new THREE\\.Quaternion\\(\\)/);
  assert.match(method, /const displacement = this\\.actorDisplacementScratch/);
  assert.match(method, /const localMovement = this\\.actorLocalMovementScratch/);
  assert.match(method, /const actorRotation = this\\.actorRotationScratch/);
  assert.match(method, /displacement\\.copy\\(position\\)\\.sub\\(track\\.lastPosition\\)/);
  assert.match(method, /parent\\.getWorldQuaternion\\(actorRotation\\)\\.invert\\(\\)/);
  assert.doesNotMatch(method, /new THREE\\.(?:Vector3|Quaternion)\\(/,
    'animation updates must not allocate transform objects per frame or actor');
});

test('enemy crowd separation reuses one result object in both movement modes', async () => {
  const [game, spacing] = await Promise.all([
    read('../src/game.ts'), read('../src/enemySpacing.ts')
  ]);
  assert.match(spacing, /out: HorizontalVector = \{ x: 0, z: 0 \}/);
  assert.match(spacing, /out\.x = x;\s*out\.z = z;\s*return out/);
  assert.match(game, /enemySeparationScratch = \{ x: 0, z: 0 \}/);
  assert.match(game, /calculateEnemySeparationVector\(enemy, nearbyEnemies, 2\.6, this\.enemySeparationScratch\)/);
  assert.match(game, /calculateEnemySeparationVector\(e, nearbyCampaignEnemies, 2\.5, this\.enemySeparationScratch\)/);
});

test('enemy contact attacks use a gated full-body Attack action instead of restarting every frame', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /enemyAttackAnimationUntil = new WeakMap<EnemyItem, number>/);
  assert.match(game, /private requestEnemyAttackAnimation\(enemy: EnemyItem, durationSeconds = 0\.48\)/);
  assert.match(game, /this\.enemyAttackAnimationUntil\.set\(enemy, now \+ 720\)/);
  assert.match(game, /if \(e\.state !== 'stunned'\) this\.requestEnemyAttackAnimation\(e, 0\.48\)/);
});

test('homing and high-speed projectile collision use the enemy broad phase and reusable steering state', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /projectileSteeringScratch = new THREE\.Vector3\(\)/);
  assert.match(game, /enemySpatialIndex\.query\(p\.mesh\.position\.x, p\.mesh\.position\.z, minDist\)/);
  assert.match(game, /const toPlayer = this\.projectileSteeringScratch\.set\(/);
  assert.match(game, /const broadphaseRadius = Math\.sqrt\(segmentLengthSq\) \* 0\.5 \+ 1\.65/);
  assert.match(game, /closest point on this frame's movement segment/);
});
