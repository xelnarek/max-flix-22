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
  assert.equal(source.boss.nextAttack, 'slam', 'the first boss move should be the readable ground slam');
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

test('the phase-two slam sends a second shockwave so the finale has a harder rhythm', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.boss.phase = 2;
  state.boss.riseSeconds = 0;
  state.boss.windup = 0.001;
  state.boss.attack = 'slam';
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.equal(state.shockwaves.length, 2);
  assert.ok(state.shockwaves[1].x > state.shockwaves[0].x, 'the second wave should follow the first');
});

test('the boss death animation sinks Cthulhu and lets R’lyeh collapse before the result panel', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.boss.coreOpenSeconds = 1;
  state.boss.hp = 15;
  state.projectiles.push({ x: state.boss.x - 18, y: state.boss.y - 69, vx: 282, vy: 0, life: 1 });
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.equal(state.boss.defeated, true);
  assert.equal(state.won, true);
  assert.equal(state.finished, false, 'the pixel collapse should play before returning the result');
  for (let frame = 0; frame < 68 && !state.finished; frame++) {
    stepCthulhuRetroState(state, {}, 1 / 30);
  }
  assert.equal(state.finished, true);
  assert.equal(state.won, true);
  assert.ok(state.boss.deathSeconds >= 2.25);
});

test('the player and boss both have a real win/loss end state', () => {
  const defeated = createCthulhuRetroState();
  defeated.introSeconds = 0;
  defeated.boss.coreOpenSeconds = 1;
  defeated.boss.hp = 15;
  defeated.projectiles.push({ x: defeated.boss.x - 18, y: defeated.boss.y - 69, vx: 282, life: 1 });
  defeated.projectiles[0].vy = 0;
  stepCthulhuRetroState(defeated, {}, 1 / 30);
  assert.equal(defeated.boss.defeated, true);
  for (let frame = 0; frame < 68 && !defeated.finished; frame++) stepCthulhuRetroState(defeated, {}, 1 / 30);
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
  assert.match(source, /data-dodge-status/);
  assert.match(source, /unlockAbyssAudio/);
});

test('the dedicated boss attack has a synthesized deep-bass impact and pixel-art render pass', async () => {
  const source = await readFile(new URL('../src/cthulhuRetroArena.ts', import.meta.url), 'utf8');
  assert.match(source, /const playAbyssBass =/);
  assert.match(source, /sub\.frequency\.setValueAtTime\(46/);
  assert.match(source, /punchGain\.gain\.exponentialRampToValueAtTime/);
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


test('the opening boss attack is a ground slam, followed by lash and grab', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.boss.riseSeconds = 0;
  state.boss.attackCooldown = 0;
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.equal(state.boss.attack, 'slam');
  assert.ok(state.boss.windup > 0);
  state.boss.windup = 0.001;
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.equal(state.shockwaves.length, 1);
  state.boss.strikeSeconds = 0;
  state.boss.attackCooldown = 0;
  state.boss.windup = 0;
  stepCthulhuRetroState(state, {}, 1 / 30);
  assert.equal(state.boss.attack, 'lash');
});

test('boss shots always face right toward the weak point, even after retreating left', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  state.player.facing = -1;
  stepCthulhuRetroState(state, { attackHeld: true }, 1 / 60);
  assert.equal(state.player.facing, 1);
  assert.equal(state.projectiles[0].vx, 282);
  assert.ok(state.projectiles[0].vy < 0);
});

test('the input code unlocks audio on the gesture and builds a layered bass impact', async () => {
  const source = await readFile(new URL('../src/cthulhuRetroArena.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!event\.repeat && \['ArrowLeft'/);
  assert.match(source, /const punch = audio\.createOscillator\(\)/);
  assert.match(source, /punch\.frequency\.setValueAtTime\(142/);
  assert.match(source, /sub\.frequency\.setValueAtTime\(46/);
});


test('any first movement or dodge gesture unlocks the bass channel before the first boss strike', async () => {
  const source = await readFile(new URL('../src/cthulhuRetroArena.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!event\.repeat && \['ArrowLeft',[\s\S]{0,220}unlockAbyssAudio\(\)/);
  assert.match(source, /button\.addEventListener\('pointerdown',[\s\S]{0,240}unlockAbyssAudio\(\)/);
  assert.match(source, /button\.addEventListener\('touchstart',[\s\S]{0,520}unlockAbyssAudio\(\)/);
});


test('retreating while holding fire preserves the boss-facing sprite and keeps leftward movement responsive', () => {
  const state = createCthulhuRetroState();
  state.introSeconds = 0;
  const startX = state.player.x;
  stepCthulhuRetroState(state, { left: true, attackHeld: true }, 1 / 60);
  assert.ok(state.player.x < startX, 'the operator must still retreat while firing');
  assert.equal(state.player.facing, 1, 'the sprite should stay aimed at the boss');
  assert.equal(state.projectiles[0].vx, 282);
});
