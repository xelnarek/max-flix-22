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
  assert.match(game, /private readonly actorDisplacementScratch = new THREE\.Vector3\(\)/);
  assert.match(game, /private readonly actorLocalMovementScratch = new THREE\.Vector3\(\)/);
  assert.match(game, /private readonly actorRotationScratch = new THREE\.Quaternion\(\)/);
  assert.match(method, /const displacement = this\.actorDisplacementScratch/);
  assert.match(method, /const localMovement = this\.actorLocalMovementScratch/);
  assert.match(method, /const actorRotation = this\.actorRotationScratch/);
  assert.match(method, /displacement\.copy\(position\)\.sub\(track\.lastPosition\)/);
  assert.match(method, /parent\.getWorldQuaternion\(actorRotation\)\.invert\(\)/);
  assert.doesNotMatch(method, /new THREE\.(?:Vector3|Quaternion)\(/,
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
  assert.match(game, /if \(!meleeProfile && e\.state !== 'stunned'\) this\.requestEnemyAttackAnimation\(e, 0\.48\)/);
  assert.match(game, /this\.beginEnemyMeleeAttackTelegraph\(e, meleeProfile, dist\)/);
});

test('imported enemy rigs use directional locomotion, bounded cadence and distance-based mixer LOD', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private updateGobkitAnimations(dt: number)');
  const end = game.indexOf('private ', start + 12);
  const method = game.slice(start, end);
  assert.match(game, /animationAccumulator\?: number/);
  assert.match(method, /getActorAnimationIntervalFromDistanceSquared\(distanceSquared, this\.isHandheldViewport\)/);
  assert.match(method, /const accumulatedDt = \(track\.animationAccumulator \?\? 0\) \+ dt/);
  assert.match(method, /shouldAdvanceActorAnimation\(interval, accumulatedDt, forceAnimationUpdate\)/);
  assert.match(method, /if \(!advanceMixer\) \{[\s\S]*?track\.animationAccumulator = accumulatedDt;[\s\S]*?continue;/);
  assert.ok(method.indexOf('if (!advanceMixer)') < method.indexOf('enemy.mesh.getWorldQuaternion'),
    'distance-throttled actors must skip quaternion and velocity work until their animation tick');
  assert.match(method, /timedOneShotActive = Number\.isFinite\(track\.oneShotRemaining\) && track\.oneShotRemaining > 0/);
  assert.match(method, /wantsDeathTransition = enemy\.state === 'defeated'[\s\S]*?getGobkitActionPriority\('Death'\)/);
  assert.match(method, /track\.mixer\.update\(animationDt\)/);
  assert.match(method, /chooseMakeHumanLocomotion\(\s*localVelocityX,\s*localVelocityZ/);
  assert.match(method, /getEnemyRigPlaybackRate\(activeAction, localSpeed \|\| worldSpeed\)/);
  assert.match(method, /track\.lastPosition\.copy\(enemy\.mesh\.position\)/);
  assert.match(game, /dampActorAngle\(facingAtFrameStart, e\.mesh\.rotation\.y, turnResponsiveness, dt\)/);
});

test('homing and high-speed projectile collision use the enemy broad phase and reusable steering state', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /projectileSteeringScratch = new THREE\.Vector3\(\)/);
  assert.match(game, /enemySpatialIndex\.query\(p\.mesh\.position\.x, p\.mesh\.position\.z, homingRange\)/);
  assert.match(game, /const toPlayer = this\.projectileSteeringScratch\.set\(/);
  assert.match(game, /const broadphaseRadius = Math\.sqrt\(segmentLengthSq\) \* 0\.5 \+ 1\.65/);
  assert.match(game, /closest point on this frame's movement segment/);
});

test('handheld enemy broadphase refreshes below display rate and immediately after roster changes', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private enemySpatialIndexNextRefreshAt = 0/);
  assert.match(game, /private enemySpatialIndexCachedCount = -1/);
  const start = game.indexOf('// Rebuilding all crowd buckets at 60–120 Hz wastes CPU on handheld devices.');
  const end = game.indexOf('for (const e of this.enemies)', start);
  const refresh = game.slice(start, end);
  assert.match(refresh, /!this\.isHandheldViewport/);
  assert.match(refresh, /enemyCountChanged/);
  assert.match(refresh, /spatialIndexNow \+ 24/);
  assert.match(refresh, /this\.enemySpatialIndex\.rebuild\(this\.enemies\)/);
});


test('handheld actor shadow budget removes per-rig shadow casters and reduces map refresh cost', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private applyHandheldActorShadowBudget\(root: THREE\.Object3D\): void/);
  assert.match(game, /object\.castShadow = false/);
  assert.match(game, /object\.receiveShadow = false/);
  assert.match(game, /root\.userData\.handheldActorShadowBudgetApplied === true/);
  assert.match(game, /const shadowMapSize = isMobile \? 512 : 2048/);
  assert.match(game, /this\.adaptivePerformanceTier >= 2 \? 6 : this\.adaptivePerformanceTier === 1 \? 9 : 12/);
  assert.match(game, /this\.applyHandheldActorShadowBudget\(e\.mesh\)/);
  assert.match(game, /this\.applyHandheldActorShadowBudget\(root\)/);
});



test('enemy role secondary motion reuses per-rig offset buffers instead of allocating per mixer tick', async () => {
  const polish = await read('../src/enemyAnimationPolish.ts');
  assert.match(polish, /interface AppliedOffsetBuffer/);
  assert.match(polish, /const previousOffsets = new WeakMap<THREE\.Group, AppliedOffsetBuffer>/);
  assert.match(polish, /function getAppliedOffsetBuffer\(root: THREE\.Group\)/);
  assert.match(polish, /const applied = getAppliedOffsetBuffer\(root\)/);
  assert.match(polish, /const index = record\.used\+\+/);
  assert.match(polish, /offset\.bone = bone;[\s\S]*?offset\.axis = axis;[\s\S]*?offset\.angle = angle;/);
  assert.match(polish, /offsets\.used = 0/);
  assert.doesNotMatch(polish, /const applied: AppliedOffset\[\] = \[\]/);
  assert.match(polish, /const stablePhaseCache = new Map<EnemyType, number>\(\)/);
});

test('floating toast projection keeps one scratch vector and avoids redundant display writes', async () => {
  const app = await read('../src/index.ts');
  const updaterStart = app.indexOf('const toastProjectionScratch = new THREE.Vector3()');
  const updaterEnd = app.indexOf('const showPerkDropBanner', updaterStart);
  assert.ok(updaterStart >= 0 && updaterEnd > updaterStart);
  const updater = app.slice(updaterStart, updaterEnd);
  const callbackStart = updater.indexOf('(this as any)._updateToasts =');
  assert.ok(callbackStart >= 0, 'toast updater callback should exist');
  const callback = updater.slice(callbackStart);
  assert.match(callback, /const tempVec = toastProjectionScratch/);
  assert.doesNotMatch(callback, /new THREE\\.Vector3\\(\\)/);
  assert.ok(callback.includes("if (t.element.style.display !== 'none')"));
  assert.ok(callback.includes("if (t.element.style.display !== 'flex')"));
});
