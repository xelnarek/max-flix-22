import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkObstacleCollision,
  createDefaultPvpObstacles,
  createInitialPvpArenaState,
  PVP_ARENA_BOUNDS,
  PVP_NORMALIZED_HP,
  PVP_SPAWN_P1,
  PVP_SPAWN_P2,
  resetPvpRound,
  stepPvpArena,
} from '../src/pvpArena.ts';

test('initializes symmetric 1v1 arena with mirrored spawns and normalized HP', () => {
  const state = createInitialPvpArenaState('marcin', 'Gracz 1', 'grzesiek', 'Gracz 2');

  assert.equal(state.status, 'waiting');
  assert.equal(state.round, 1);
  assert.equal(state.maxRounds, 3);
  assert.equal(state.roundsToWin, 2);

  assert.equal(state.p1.hp, PVP_NORMALIZED_HP);
  assert.equal(state.p2.hp, PVP_NORMALIZED_HP);

  // Mirrored spawns on X axis
  assert.equal(state.p1.x, PVP_SPAWN_P1.x);
  assert.equal(state.p2.x, PVP_SPAWN_P2.x);
  assert.equal(state.p1.x, -state.p2.x);
  assert.equal(state.p1.z, 0);
  assert.equal(state.p2.z, 0);
});

test('obstacles are symmetrically arranged around the arena center', () => {
  const obstacles = createDefaultPvpObstacles();
  assert.ok(obstacles.length >= 6);

  const northPallet = obstacles.find((o) => o.id === 'cover_center_n');
  const southPallet = obstacles.find((o) => o.id === 'cover_center_s');
  assert.ok(northPallet && southPallet);
  assert.equal(northPallet.x, 0);
  assert.equal(southPallet.x, 0);
  assert.equal(northPallet.z, -southPallet.z);

  const westBarrier = obstacles.find((o) => o.id === 'barrier_west');
  const eastBarrier = obstacles.find((o) => o.id === 'barrier_east');
  assert.ok(westBarrier && eastBarrier);
  assert.equal(westBarrier.x, -eastBarrier.x);
  assert.equal(westBarrier.z, eastBarrier.z);
});

test('obstacle collision pushes entity out of bounding box', () => {
  const obstacles = createDefaultPvpObstacles();
  const northPallet = obstacles.find((o) => o.id === 'cover_center_n');
  assert.ok(northPallet);

  // Point inside or intersecting obstacle
  const testX = northPallet.x;
  const testZ = northPallet.z - northPallet.depth / 2 + 0.1;
  const radius = 0.65;

  const col = checkObstacleCollision(testX, testZ, radius, obstacles);
  assert.equal(col.hit, true);
  assert.ok(Math.abs(col.pushZ) > 0);
});

test('round countdown transitions to in_round', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  assert.equal(state.status, 'countdown');
  assert.equal(state.countdownTimer, 3.0);

  // Advance by 3.1s
  stepPvpArena(state, 3.1);
  assert.equal(state.status, 'in_round');
  assert.equal(state.countdownTimer, 0);
});

test('player movement is strictly clamped within arena bounds', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  stepPvpArena(state, 3.0); // countdown finished

  // Try to move P1 past minX boundary
  for (let i = 0; i < 30; i++) {
    stepPvpArena(state, 0.1, { moveX: -1, moveZ: 0, aimAngle: 0, isFiring: false });
  }

  assert.ok(state.p1.x >= PVP_ARENA_BOUNDS.minX);
  assert.ok(state.p1.x <= PVP_ARENA_BOUNDS.maxX);
  assert.ok(state.p1.z >= PVP_ARENA_BOUNDS.minZ);
  assert.ok(state.p1.z <= PVP_ARENA_BOUNDS.maxZ);
});

test('firing creates projectile that damages opponent upon collision', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  stepPvpArena(state, 3.0); // in_round

  // Place P1 and P2 close on X line
  state.p1.x = -2.0;
  state.p1.z = 0;
  state.p2.x = 2.0;
  state.p2.z = 0;

  // P1 aims at P2 (facing east, aimAngle = Math.PI / 2) and fires
  const aimAngle = Math.PI / 2;
  stepPvpArena(state, 0.05, { moveX: 0, moveZ: 0, aimAngle, isFiring: true });

  assert.ok(state.projectiles.length > 0);
  const proj = state.projectiles[0];
  assert.equal(proj.ownerSlot, 'p1');
  assert.ok(proj.vx > 0); // flying toward positive X

  // Advance until projectile hits P2
  const initialHp = state.p2.hp;
  for (let i = 0; i < 15; i++) {
    stepPvpArena(state, 0.03);
    if (state.p2.hp < initialHp) break;
  }

  assert.ok(state.p2.hp < initialHp);
  assert.ok(state.p1.damageDealt > 0);
  assert.equal(state.p1.shotsHit, 1);
});

test('knockout awards round win and triggers round reset or match victory', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  stepPvpArena(state, 3.0); // in_round

  // Set P2 to 10 HP, disable pickup for isolated test, and hit with projectile
  state.pickup.active = false;
  state.pickup.respawnTimer = 99;
  state.p2.hp = 10;
  state.p1.x = -1.0;
  state.p1.z = 0;
  state.p2.x = 1.0;
  state.p2.z = 0;

  stepPvpArena(state, 0.05, { moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: true });
  for (let i = 0; i < 15; i++) {
    stepPvpArena(state, 0.03);
    if (state.status === 'round_end') break;
  }

  assert.equal(state.status, 'round_end');
  assert.equal(state.roundWinner, 'p1');
  assert.equal(state.p1.score, 1);
  assert.equal(state.p2.score, 0);

  // Advance through round_end delay
  stepPvpArena(state, 2.5);
  assert.equal(state.round, 2);
  assert.equal(state.status, 'countdown');
  assert.equal(state.p1.hp, PVP_NORMALIZED_HP);
  assert.equal(state.p2.hp, PVP_NORMALIZED_HP);
});
