import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createOniricPlatformerState,
  ONIRIC_COLLECTIBLES,
  ONIRIC_GOAL_X,
  ONIRIC_PIXEL_GLITCH_WIDTH,
  ONIRIC_PIXEL_GLITCH_DURATION_MS,
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

test('pocket watches are collected by touching their world positions', () => {
  const state = createOniricPlatformerState();
  ONIRIC_COLLECTIBLES.forEach((item, index) => {
    state.player.x = item.x - 12;
    state.player.y = item.y - 22;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = false;
    stepOniricPlatformer(state, {}, 1 / 60);
    assert.equal(state.collected[index], true, 'watch ' + (index + 1) + ' should be collectible');
  });
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


test('opening the rabbit hole starts a bounded 15-second pixel-chaos sequence', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(source, /oniric-platformer-overlay oniric-pixel-chaos/);
  assert.match(source, /window\.setTimeout\([\s\S]*?oniric-pixel-chaos[\s\S]*?ONIRIC_PIXEL_GLITCH_DURATION_MS/);
  assert.match(source, /window\.clearTimeout\(pixelChaosTimer\)/);
  assert.match(css, /\.oniric-platformer-overlay\.oniric-pixel-chaos \.oniric-platformer-canvas/);
  assert.match(css, /@keyframes oniric-scanline-chaos/);
  assert.match(css, /@keyframes oniric-error-banner/);
});


test('the opening 15-second Oniric glitch uses a real low-resolution pixel buffer', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  assert.equal(ONIRIC_PIXEL_GLITCH_WIDTH, 160);
  assert.equal(ONIRIC_PIXEL_GLITCH_DURATION_MS, 15_000);
  assert.match(source, /pixelCanvas\.width = ONIRIC_PIXEL_GLITCH_WIDTH/);
  assert.match(source, /performance\.now\(\) < pixelChaosEndsAt/);
  assert.match(source, /outputContext!\.imageSmoothingEnabled = false/);
  assert.match(source, /drawImage\(pixelCanvas, 0, 0, canvas\.width, canvas\.height\)/);
});


test('retrying the secret restarts the full 15-second pixel-chaos window', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  assert.match(source, /let pixelChaosEndsAt = performance\.now\(\) \+ ONIRIC_PIXEL_GLITCH_DURATION_MS/);
  assert.match(source, /const restartPixelChaos = \(\) => \{/);
  assert.match(source, /pixelChaosEndsAt = performance\.now\(\) \+ ONIRIC_PIXEL_GLITCH_DURATION_MS/);
  assert.match(source, /root\.classList\.add\('oniric-pixel-chaos'\)/);
  assert.match(source, /const resetRun = \(\) => \{\s*restartPixelChaos\(\);/);
});


test('the finished Oniric level stops its animation loop until retry', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!completedCallback && !state\.finished\) rafId = window\.requestAnimationFrame\(frame\)/);
  assert.match(source, /if \(!rafId && !completedCallback\) rafId = window\.requestAnimationFrame\(frame\)/);
  assert.match(source, /lastFrame = 0;[\s\S]*?resultPanel\.hidden = true/);
});

test('Oniric releases held controls on focus loss and app backgrounding', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  assert.match(source, /const clearHeldInput = \(\) => \{[\s\S]*?held\.left = false;[\s\S]*?held\.right = false;[\s\S]*?jumpQueued = false;/);
  assert.match(source, /window\.addEventListener\('blur', onWindowBlur\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(source, /window\.removeEventListener\('blur', onWindowBlur\)/);
  assert.match(source, /document\.removeEventListener\('visibilitychange', onVisibilityChange\)/);
});

test('Oniric dialog locks background scroll and restores focus and scroll state on exit', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  assert.match(source, /const previousFocus = document\.activeElement instanceof HTMLElement/);
  assert.match(source, /const previousBodyOverflow = document\.body\.style\.overflow/);
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(source, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.match(source, /if \(previousFocus\?\.isConnected\) previousFocus\.focus\(\)/);
  assert.match(source, /if \(event\.code === 'Tab'\)/);
});


test('Oniric checkpoints activate only after landing and protect the first hazard section', () => {
  const state = createOniricPlatformerState();
  state.player.x = 940;
  state.player.y = 100;
  state.player.vy = 0;
  state.player.onGround = false;
  stepOniricPlatformer(state, {}, 1 / 60);
  assert.equal(state.checkpointX, 76, 'an airborne pass must not create a floating checkpoint');

  state.player.y = 394;
  state.player.vy = 0;
  state.player.onGround = false;
  stepOniricPlatformer(state, {}, 1 / 60);
  assert.equal(state.player.onGround, true, 'the operator must land on the first platform');
  assert.equal(state.checkpointX, 930, 'the first safe checkpoint should be enabled after landing');
  assert.equal(state.checkpointTop, 440);
});


test('Oniric focus trapping skips controls hidden inside the result panel', async () => {
  const source = await readFile(new URL('../src/oniricPlatformer.ts', import.meta.url), 'utf8');
  assert.match(source, /querySelectorAll<HTMLButtonElement>\([\s\S]*?button:not\(\[disabled\]\)/);
  assert.match(source, /filter\(\(button\) => !button\.closest\('\[hidden\]'\)\)/);
});
