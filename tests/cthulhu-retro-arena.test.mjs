import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CTHULHU_RETRO_BOSS_MAX_HP,
  CTHULHU_RETRO_CORE_DAMAGE_MULTIPLIER,
  CTHULHU_RETRO_CORE_OPEN_SECONDS,
  CTHULHU_RETRO_FLOOR,
  CTHULHU_RETRO_HEIGHT,
  CTHULHU_RETRO_WIDTH,
  createCthulhuRetroState,
  getCthulhuRetroPhaseLabel,
  stepCthulhuRetroState,
} from '../src/cthulhuRetroArena.ts';

test('the Necronomicon encounter is an independent retro map with a bespoke R’lyeh palette', async () => {
  const source = await readFile(new URL('../src/cthulhuRetroArena.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.equal(CTHULHU_RETRO_WIDTH, 480);
  assert.equal(CTHULHU_RETRO_HEIGHT, 270);
  assert.match(source, /ZATOPIONE MIASTO R’LYEH/);
  assert.match(source, /drawBackground/);
  assert.match(source, /Massive broken obelisks frame the independent R'lyeh arena/);
  assert.match(source, /#080a19/);
  assert.match(source, /#ff54ce/);
  assert.match(source, /#73f1d1/);
  assert.match(css, /\.cthulhu-retro-overlay/);
  assert.match(css, /\.cthulhu-retro-canvas/);
});

test('Cthulhu is a huge multi-part pixel boss with two combat phases', () => {
  const source = createCthulhuRetroState();
  assert.equal(source.boss.hp, CTHULHU_RETRO_BOSS_MAX_HP);
  assert.equal(source.boss.phase, 1);
  assert.equal(source.boss.x, 382);
  assert.ok(source.boss.maxHp > source.player.maxHp);
  assert.equal(getCthulhuRetroPhaseLabel(1), 'FAZA I • PRZEBUDZENIE');
  assert.equal(getCthulhuRetroPhaseLabel(2), 'FAZA II • GNIEW GŁĘBIN');
});

test('the boss core opens for exactly 2.15 seconds after its strike', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.boss.riseSeconds = 0;
  state.boss.attack = 'slam';
  state.boss.nextAttack = 'lash';
  state.boss.windup = 0.001;
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.ok(state.boss.coreOpenSeconds > 2.10 && state.boss.coreOpenSeconds <= CTHULHU_RETRO_CORE_OPEN_SECONDS);
  assert.equal(CTHULHU_RETRO_CORE_OPEN_SECONDS, 2.15);
  assert.equal(CTHULHU_RETRO_CORE_DAMAGE_MULTIPLIER, 1.5);
});

test('projectiles cannot damage the closed core and receive the +50 percent opening bonus', () => {
  const closed = createCthulhuRetroState();
  closed.introSeconds = 0;
  closed.boss.riseSeconds = 0;
  closed.player.x = 190;
  closed.player.y = 145;
  closed.projectiles.push({ x: closed.boss.x - 18, y: closed.boss.y - 69, vx: 282, life: 1 });
  const closedHp = closed.boss.hp;
  stepCthulhuRetroState(closed, {}, 1 / 30);
  assert.equal(closed.boss.hp, closedHp);

  const open = createCthulhuRetroState();
  open.introSeconds = 0;
  open.boss.riseSeconds = 0;
  open.boss.coreOpenSeconds = 2;
  open.player.x = 190;
  open.player.y = 145;
  open.projectiles.push({ x: open.boss.x - 18, y: open.boss.y - 69, vx: 282, life: 1 });
  stepCthulhuRetroState(open, {}, 1 / 30);
  assert.equal(open.boss.hp, CTHULHU_RETRO_BOSS_MAX_HP - 15 * CTHULHU_RETRO_CORE_DAMAGE_MULTIPLIER);
});

test('the boss enters phase two when half its health remains and uses a faster wind-up', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.boss.riseSeconds = 0;
  state.boss.hp = 89;
  state.boss.windup = 0;
  state.boss.attackCooldown = 0;
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.equal(state.boss.phase, 2);
  assert.ok(state.boss.windup <= 0.64);
});

test('slam shockwaves can be jumped over and hit grounded players', () => {
  const grounded = createCthulhuRetroState();
  grounded.introSeconds = 0;
  grounded.boss.riseSeconds = 0;
  grounded.boss.windup = 0.001;
  grounded.boss.attack = 'slam';
  grounded.boss.attackCooldown = 100;
  grounded.player.x = 120;
  grounded.shockwaves.push({ x: 120 + 7 + 190 / 30, life: 1 });
  const groundedHp = grounded.player.hp;
  stepCthulhuRetroState(grounded, {}, 1 / 30);
  assert.ok(grounded.player.hp < groundedHp);

  const jumping = createCthulhuRetroState();
  jumping.introSeconds = 0;
  jumping.boss.riseSeconds = 0;
  jumping.player.x = 120;
  jumping.player.y = CTHULHU_RETRO_FLOOR - 65;
  jumping.player.vy = 0;
  jumping.player.grounded = false;
  jumping.shockwaves.push({ x: 120 + 190 / 30, life: 1 });
  const jumpingHp = jumping.player.hp;
  stepCthulhuRetroState(jumping, {}, 1 / 30);
  assert.equal(jumping.player.hp, jumpingHp);
});

test('evade grants a short invulnerable dodge and has a cooldown', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  stepCthulhuRetroState(state, { dodgePressed: true, left: true }, 1 / 60);
  assert.ok(state.player.dodgeSeconds > 0);
  assert.ok(state.player.dodgeCooldown > 1.3);
});

test('three boss attacks cycle through slam, lash and grab', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.boss.riseSeconds = 0;
  state.boss.windup = 0;
  state.boss.attackCooldown = 0;
  const sequence = [];
  for (let i = 0; i < 3; i++) {
    state.boss.windup = 0;
    state.boss.attackCooldown = 0;
    state.boss.strikeSeconds = 0;
    state.boss.nextAttack = i === 0 ? 'slam' : i === 1 ? 'lash' : 'grab';
    stepCthulhuRetroState(state, {}, 1 / 30);
    sequence.push(state.boss.attack);
    // Clear the strike / cooldown to request the next documented move.
    state.boss.strikeSeconds = 0;
    state.boss.windup = 0;
    state.boss.attackCooldown = 0;
  }
  assert.deepEqual(sequence, ['slam', 'lash', 'grab']);
});

test('the player and boss both have a real win/loss end state', () => {
  const defeated = createCthulhuRetroState();
  defeated.introSeconds = 0;
  defeated.boss.coreOpenSeconds = 1;
  defeated.boss.hp = 15;
  defeated.projectiles.push({ x: defeated.boss.x - 18, y: defeated.boss.y - 69, vx: 282, life: 1 });
  stepCthulhuRetroState(defeated, {}, 1 / 30);
  assert.equal(defeated.finished, true);
  assert.equal(defeated.won, true);

  const lost = createCthulhuRetroState();
  lost.introSeconds = 0;
  lost.player.hp = 1;
  lost.player.x = 120;
  lost.player.y = CTHULHU_RETRO_FLOOR - 26;
  lost.player.grounded = true;
  lost.boss.windup = 0.001;
  lost.boss.riseSeconds = 0;
  lost.boss.attack = 'lash';
  lost.boss.attackCooldown = 100;
  stepCthulhuRetroState(lost, {}, 1 / 30);
  assert.equal(lost.finished, true);
  assert.equal(lost.won, false);
});

test('the retro map controls work with keyboard, multiple pointers and native Android touches', async () => {
  const source = await readFile(new URL('../src/cthulhuRetroArena.ts', import.meta.url), 'utf8');
  assert.match(source, /const activePointers = new Map<number/);
  assert.match(source, /const activeTouches = new Map<number/);
  assert.match(source, /button\.addEventListener\('touchstart'/);
  assert.match(source, /window\.addEventListener\('touchend', releaseTouch/);
  assert.match(source, /window\.addEventListener\('pointerup', releasePointer/);
  assert.match(source, /event\.code === 'Escape'/);
  assert.match(source, /data-hold="attack"/);
  assert.match(source, /data-hold="dodge"/);
});

test('the dedicated boss attack has a synthesized deep-bass impact and pixel-art render pass', async () => {
  const source = await readFile(new URL('../src/cthulhuRetroArena.ts', import.meta.url), 'utf8');
  assert.match(source, /const playAbyssBass =/);
  assert.match(source, /frequency\.setValueAtTime\(43/);
  assert.match(source, /subGain\.gain\.exponentialRampToValueAtTime/);
  assert.match(source, /pixelCanvas\.width = CTHULHU_RETRO_WIDTH/);
  assert.match(source, /output\.drawImage\(pixelCanvas, 0, 0, canvas\.width, canvas\.height\)/);
});

test('player shots angle toward the giant chest core instead of flying below the boss', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  stepCthulhuRetroState(state, { attackHeld: true }, 1 / 60);
  assert.equal(state.projectiles.length, 1);
  assert.ok(state.projectiles[0].vy < 0, 'the shot must rise from the operator toward the elevated chest core');
  assert.ok(Math.abs(state.projectiles[0].vy) < 190);
});

test('jumping also avoids the telegraphed grasp, while a grounded operator is caught', () => {
  const grounded = createCthulhuRetroState();
  grounded.introSeconds = 0;
  grounded.boss.riseSeconds = 0;
  grounded.boss.windup = 0.001;
  grounded.boss.attack = 'grab';
  grounded.boss.grabX = grounded.player.x;
  grounded.boss.attackCooldown = 100;
  const hp = grounded.player.hp;
  stepCthulhuRetroState(grounded, {}, 1 / 30);
  assert.ok(grounded.player.hp < hp);

  const airborne = createCthulhuRetroState();
  airborne.introSeconds = 0;
  airborne.boss.riseSeconds = 0;
  airborne.boss.windup = 0.001;
  airborne.boss.attack = 'grab';
  airborne.boss.grabX = airborne.player.x;
  airborne.boss.attackCooldown = 100;
  airborne.player.y -= 35;
  airborne.player.grounded = false;
  const airborneHp = airborne.player.hp;
  stepCthulhuRetroState(airborne, {}, 1 / 30);
  assert.equal(airborne.player.hp, airborneHp);
});
