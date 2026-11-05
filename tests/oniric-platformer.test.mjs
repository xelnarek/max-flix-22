import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOniricPlatformerState,
  ONIRIC_COLLECTIBLES,
  ONIRIC_GOAL_X,
  ONIRIC_WORLD_WIDTH,
  ONIRIC_PLATFORMS,
  stepOniricPlatformer,
} from '../src/oniricPlatformer.ts';

test('the rabbit-hole level is a bounded side-scrolling platform course', () => {
  assert.ok(ONIRIC_WORLD_WIDTH > 2500);
  assert.ok(ONIRIC_PLATFORMS.length >= 8);
  assert.equal(ONIRIC_COLLECTIBLES.length, 3);
  for (const platform of ONIRIC_PLATFORMS) {
    assert.ok(platform.x >= 0);
    assert.ok(platform.x + platform.width <= ONIRIC_WORLD_WIDTH + 100);
    assert.ok(platform.y > 0 && platform.y < 540);
  }
});

test('the operator can jump from a grounded platform and land on the next ledge', () => {
  const state = createOniricPlatformerState();
  assert.equal(state.player.onGround, true);
  // Begin near the edge so the first jump clears the opening gap.
  state.player.x = 300;
  stepOniricPlatformer(state, { right: true, jumpPressed: true }, 1 / 60);
  assert.ok(state.player.vy < 0, 'jump must apply upward velocity');
  assert.equal(state.player.onGround, false);

  for (let i = 0; i < 120 && !state.player.onGround; i++) {
    stepOniricPlatformer(state, { right: true }, 1 / 60);
  }
  assert.equal(state.player.onGround, true, 'player should land instead of falling through the platform');
});

test('the rabbit-hole exit stays locked until all three pocket watches are collected', () => {
  const state = createOniricPlatformerState();
  state.player.x = ONIRIC_GOAL_X;
  state.player.y = 394;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = true;
  stepOniricPlatformer(state, {}, 1 / 60);
  assert.equal(state.finished, false);
  assert.equal(state.won, false);

  ONIRIC_COLLECTIBLES.forEach((item, index) => {
    state.collected[index] = true;
  });
  stepOniricPlatformer(state, {}, 1 / 60);
  assert.equal(state.finished, true);
  assert.equal(state.won, true);
});

test('the course ends safely when time expires or all lives are lost', () => {
  const timed = createOniricPlatformerState();
  timed.remainingSeconds = 0.001;
  stepOniricPlatformer(timed, {}, 1 / 60);
  assert.equal(timed.finished, true);
  assert.equal(timed.won, false);

  const exhausted = createOniricPlatformerState();
  exhausted.lives = 1;
  exhausted.player.y = 900;
  stepOniricPlatformer(exhausted, {}, 1 / 60);
  assert.equal(exhausted.finished, true);
});
