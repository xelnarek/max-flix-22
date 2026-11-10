import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('operator arms and legs rotate around shoulder and hip pivots, not segment centres', async () => {
  const [assets, game] = await Promise.all([
    read('../src/warehouseAssets.ts'),
    read('../src/game.ts'),
  ]);

  assert.match(assets, /leftLeg: THREE\.Group;/);
  assert.match(assets, /rightLeg: THREE\.Group;/);
  assert.match(assets, /leftArm: THREE\.Group;/);
  assert.match(assets, /rightArm: THREE\.Group;/);
  assert.match(assets, /leftLeg\.position\.set\(-0\.1 \* profile\.torsoWidth, 0\.35, 0\)/);
  assert.match(assets, /leftLegMesh\.position\.y = -0\.16/);
  assert.match(assets, /leftArm\.position\.set\(-0\.25 \* profile\.torsoWidth, 0\.72, 0\)/);
  assert.match(assets, /leftArmMesh\.position\.y = -0\.18/);
  assert.match(assets, /rightArm\.attach\(accessory\)/);
  assert.match(game, /private leftArm: THREE\.Group \| null = null/);
});

test('the existing operator model proportions and combat animation systems remain present', async () => {
  const [assets, game] = await Promise.all([
    read('../src/warehouseAssets.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(assets, /new THREE\.CapsuleGeometry\(0\.18, 0\.10, 4, 16\)/);
  assert.match(assets, /const faceProfile: Record<CharacterId/);
  assert.match(assets, /const silhouette: Record<CharacterId/);
  assert.match(game, /getCharacterAttackMotionProfile\(this\.currentCharacterId\)/);
  assert.match(game, /setProceduralLimbPose\(this\.leftLeg, gait \* motionProfile\.stride\)/);
  assert.match(game, /setProceduralLimbPose\(this\.rightLeg, -gait \* motionProfile\.stride\)/);
  assert.match(game, /setProceduralLimbPose\(this\.leftArm, -gait \* motionProfile\.armSwing, armSpread\)/);
  assert.match(game, /setProceduralLimbPose\(this\.rightArm, gait \* motionProfile\.armSwing, -armSpread\)/);
});
