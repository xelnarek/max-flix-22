import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkObstacleCollision,
  createDefaultPvpObstacles,
  createInitialPvpArenaState,
  hasPvpLineOfSight,
  PVP_ARENA_BOUNDS,
  PVP_NORMALIZED_HP,
  PVP_SPAWN_P1,
  PVP_SPAWN_P2,
  resetPvpRound,
  resetPvpMatchStats,
  sanitizePvpInputIntent,
  stepPvpArena,
} from '../src/pvpArena.ts';

function advanceArena(state, seconds, p1Input, p2Input) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(0.1, remaining);
    stepPvpArena(state, dt, p1Input, p2Input);
    remaining -= dt;
  }
}

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
  advanceArena(state, 3.1);
  assert.equal(state.status, 'in_round');
  assert.equal(state.countdownTimer, 0);
});

test('player movement is strictly clamped within arena bounds', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0); // countdown finished

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
  advanceArena(state, 3.0); // in_round

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
  assert.ok(state.p1.primaryDamageDealt > 0);
  assert.equal(state.p1.abilityDamageDealt, 0);
  assert.ok(state.p2.damageTaken > 0);
  assert.equal(state.stats.p1.damageDealt, state.p1.damageDealt);
  assert.equal(state.stats.p2.damageTaken, state.p2.damageTaken);
});

test('knockout awards round win and triggers round reset or match victory', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0); // in_round

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
  assert.equal(state.p1.knockouts, 1);

  // Advance through round_end delay
  advanceArena(state, 2.5);
  assert.equal(state.round, 2);
  assert.equal(state.status, 'countdown');
  assert.equal(state.p1.hp, PVP_NORMALIZED_HP);
  assert.equal(state.p2.hp, PVP_NORMALIZED_HP);
});

test('sanitizes malformed and over-length player input before simulation', () => {
  const input = sanitizePvpInputIntent({
    moveX: 4,
    moveZ: 4,
    aimAngle: Number.POSITIVE_INFINITY,
    isFiring: 'yes',
    wantDash: 1,
    wantAbility: true,
  });
  assert.ok(Math.abs(Math.hypot(input.moveX, input.moveZ) - 1) < 1e-10);
  assert.equal(input.aimAngle, 0);
  assert.equal(input.isFiring, false);
  assert.equal(input.wantDash, false);
  assert.equal(input.wantAbility, true);
});

test('fast projectile cannot tunnel through an opponent during a single server tick', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.pickup.active = false;
  state.p1.x = -3;
  state.p1.z = 0;
  state.p2.x = 0;
  state.p2.z = 0;
  const initialHp = state.p2.hp;

  stepPvpArena(state, 0.1, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: true,
  });

  assert.ok(state.p2.hp < initialHp);
  assert.equal(state.p1.shotsHit, 1);
  assert.ok(state.p1.damageDealt > 0);
});

test('fast projectile is stopped by warehouse cover even when one tick crosses the whole pallet', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.pickup.active = false;
  state.p1.x = -4;
  state.p1.z = 5;
  state.p2.x = 12;
  state.p2.z = 5;
  const initialHp = state.p2.hp;

  stepPvpArena(state, 0.1, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: true,
  });

  assert.equal(state.p2.hp, initialHp);
  assert.equal(state.p1.shotsHit, 0);
  assert.equal(state.projectiles.length, 0);
});

test('players cannot occupy the same point after collision resolution', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.pickup.active = false;
  state.p1.x = -0.2;
  state.p1.z = 0;
  state.p2.x = 0.2;
  state.p2.z = 0;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false,
  }, {
    moveX: 0, moveZ: 0, aimAngle: -Math.PI / 2, isFiring: false,
  });

  assert.ok(Math.hypot(state.p2.x - state.p1.x, state.p2.z - state.p1.z) >= 1.3 - 1e-6);
});

test('dash substeps prevent moving through a pallet barrier', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.pickup.active = false;
  state.p1.x = -11.5;
  state.p1.z = 0;
  state.p2.x = 15;
  state.p2.z = 0;

  stepPvpArena(state, 0.1, {
    moveX: 1, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false, wantDash: true,
  });
  stepPvpArena(state, 0.1, {
    moveX: 1, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false,
  });

  assert.ok(state.p1.x <= -9.55 + 1e-6, 'dash should remain outside the west pallet barrier');
});

test('the nearest player wins a medkit claim instead of P1 winning by update order', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.p1.x = -1.2;
  state.p1.z = 0;
  state.p2.x = 0.2;
  state.p2.z = 0;
  state.p1.hp = 800;
  state.p2.hp = 800;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false,
  });

  assert.equal(state.pickup.active, false);
  assert.equal(state.p2.hp, 1000);
  assert.equal(state.p1.hp, 800);
});

test('exactly tied medkit claims alternate priority by round parity', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.p1.x = -0.65;
  state.p1.z = 0;
  state.p2.x = 0.65;
  state.p2.z = 0;
  state.p1.hp = 800;
  state.p2.hp = 800;
  state.round = 1;

  stepPvpArena(state, 0.05);
  assert.equal(state.p1.hp, 1000);
  assert.equal(state.p2.hp, 800);

  state.pickup.active = true;
  state.pickup.respawnTimer = 0;
  state.p1.hp = 800;
  state.p2.hp = 800;
  state.round = 2;
  stepPvpArena(state, 0.05);
  assert.equal(state.p1.hp, 800);
  assert.equal(state.p2.hp, 1000);
});

test('Grzesiek forklift ability only hits opponents inside its forward cone', () => {
  const behind = createInitialPvpArenaState('grzesiek', 'P1', 'marcin', 'P2');
  resetPvpRound(behind);
  behind.status = 'in_round';
  behind.countdownTimer = 0;
  behind.pickup.active = false;
  behind.p1.x = -2;
  behind.p1.z = 0;
  behind.p2.x = 0;
  behind.p2.z = 0;
  const initialHp = behind.p2.hp;

  stepPvpArena(behind, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: -Math.PI / 2, isFiring: false, wantAbility: true,
  });

  assert.equal(behind.p2.hp, initialHp);
  assert.equal(behind.p1.damageDealt, 0);
});

test('Grzesiek frontal forklift ability applies credited damage and a visible hit event', () => {
  const state = createInitialPvpArenaState('grzesiek', 'P1', 'marcin', 'P2');
  resetPvpRound(state);
  state.status = 'in_round';
  state.countdownTimer = 0;
  state.pickup.active = false;
  state.pickup.respawnTimer = 30; // keep the medkit unavailable during the isolated damage test
  state.obstacles = []; // isolate direct ability damage from cover checks
  state.p1.x = -2;
  state.p1.z = 0;
  state.p2.x = 0;
  state.p2.z = 0;
  assert.equal(state.status, 'in_round');
  assert.equal(state.p1.operatorId, 'grzesiek');
  const dx = state.p2.x - state.p1.x;
  const dz = state.p2.z - state.p1.z;
  const distance = Math.hypot(dx, dz);
  const forwardAlignment = (dx * Math.sin(Math.PI / 2) + dz * Math.cos(Math.PI / 2)) / distance;
  assert.ok(distance < 3.8);
  assert.ok(forwardAlignment >= Math.cos(Math.PI / 4), 'the test opponent is directly in the aim cone');
  assert.ok(hasPvpLineOfSight(state.p1, state.p2, state.obstacles), 'clear centre lane should allow line of sight');
  const initialHp = state.p2.hp;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false, wantAbility: true,
  });

  assert.ok(state.p1.abilityCooldownTimer > 0, 'the Grzesiek ability input should be consumed');
  assert.equal(state.p1.isDashing, true, 'the frontal charge should start its dash');
  assert.equal(state.p1.aimAngle, Math.PI / 2, 'the charge must use the explicit player aim angle');
  assert.equal(state.p2.hp, initialHp - 180);
  assert.equal(state.p1.damageDealt, 180);
  assert.equal(state.lastHitEvent?.damage, 180);
  assert.equal(state.lastHitEvent?.sourceSlot, 'p1');
  assert.equal(state.lastHitEvent?.id, 1);
  assert.equal(state.hitEventSequence, 1);
});

test('Mateusz shockwave cannot damage a player hidden behind full pallet cover', () => {
  const state = createInitialPvpArenaState('mateusz', 'P1', 'piotr', 'P2');
  resetPvpRound(state);
  state.status = 'in_round';
  state.countdownTimer = 0;
  state.pickup.active = false;
  state.obstacles = [{
    id: 'test_wall',
    x: 0,
    z: 0,
    width: 1.6,
    depth: 4.0,
    height: 2.0,
    type: 'barrier',
  }];
  state.p1.x = -2.4;
  state.p1.z = 0;
  state.p2.x = 2.4;
  state.p2.z = 0;
  const initialHp = state.p2.hp;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false, wantAbility: true,
  });

  assert.equal(state.p2.hp, initialHp);
  assert.equal(state.p1.damageDealt, 0);
});

test('direct PvP ability damage is clipped to remaining shield and HP', () => {
  const state = createInitialPvpArenaState('mateusz', 'P1', 'piotr', 'P2');
  resetPvpRound(state);
  state.status = 'in_round';
  state.countdownTimer = 0;
  state.pickup.active = false;
  state.pickup.respawnTimer = 30; // keep the medkit unavailable during the isolated damage test
  state.obstacles = []; // isolate direct ability damage from cover checks
  state.p1.x = -2;
  state.p1.z = 0;
  state.p2.x = 2;
  state.p2.z = 0;
  state.p2.hp = 40;
  state.p2.shieldHp = 50;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false, wantAbility: true,
  });

  assert.equal(state.p2.hp, 0);
  assert.equal(state.p2.shieldHp, 0);
  assert.equal(state.p1.damageDealt, 90);
  assert.equal(state.lastHitEvent?.damage, 90);
  assert.equal(state.status, 'round_end');
});

test('simultaneous PvP hits in one server tick are all retained with unique ordered event IDs', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  state.status = 'in_round';
  state.obstacles = [];
  state.pickup.active = false;
  state.pickup.respawnTimer = 30;
  state.p1.x = -3;
  state.p1.z = 0;
  state.p2.x = 0;
  state.p2.z = 0;
  state.projectiles = [
    {
      id: 'sim-hit-1', ownerSlot: 'p1', x: -1.5, y: 0.6, z: 0,
      vx: 20, vz: 0, radius: 0.2, damage: 50, life: 1, pierce: 1, color: 0x3b82f6,
    },
    {
      id: 'sim-hit-2', ownerSlot: 'p1', x: -1.25, y: 0.6, z: 0,
      vx: 20, vz: 0, radius: 0.2, damage: 50, life: 1, pierce: 1, color: 0x3b82f6,
    },
  ];

  stepPvpArena(state, 0.05);

  assert.equal(state.hitEvents.length, 2);
  assert.deepEqual(state.hitEvents.map((event) => event.id), [1, 2]);
  assert.equal(state.lastHitEvent?.id, 2);
  assert.equal(state.p1.damageDealt, 100);
  assert.equal(state.p2.hp, 900);
});

test('PvP round reset clears transient hit notifications but keeps event IDs monotonic', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  state.hitEventSequence = 17;
  state.hitEvents = [{
    id: 17, sourceSlot: 'p1', targetSlot: 'p2', damage: 25, x: 0, z: 0,
  }];
  state.lastHitEvent = state.hitEvents[0];

  resetPvpRound(state);

  assert.equal(state.hitEvents.length, 0);
  assert.equal(state.lastHitEvent, undefined);
  assert.equal(state.hitEventSequence, 17);
});

test('direct PvP ability damage is separated from primary weapon accuracy', () => {
  const state = createInitialPvpArenaState('mateusz', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.obstacles = [];
  state.p1.x = -2;
  state.p1.z = 0;
  state.p2.x = 2;
  state.p2.z = 0;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2,
    isFiring: false, wantAbility: true,
  });

  assert.equal(state.p1.abilityUses, 1);
  assert.equal(state.p1.abilityHits, 1);
  assert.equal(state.p1.abilityDamageDealt, 150);
  assert.equal(state.p1.primaryDamageDealt, 0);
  assert.equal(state.p1.shotsFired, 0);
  assert.equal(state.p1.shotsHit, 0);
  assert.equal(state.p2.damageTaken, 150);
  assert.equal(state.stats.p1.abilityDamageDealt, 150);
});

test('Dawid ability beams do not inflate primary-weapon accuracy', () => {
  const state = createInitialPvpArenaState('dawid', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.obstacles = [];
  state.p1.x = -6;
  state.p1.z = 0;
  state.p2.x = 6;
  state.p2.z = 0;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2,
    isFiring: false, wantAbility: true,
  });
  assert.ok(state.projectiles.some((projectile) => projectile.kind === 'ability'));

  for (let i = 0; i < 10 && state.p1.abilityHits === 0; i++) stepPvpArena(state, 0.05);

  assert.ok(state.p1.abilityHits > 0);
  assert.ok(state.p1.abilityDamageDealt > 0);
  assert.equal(state.p1.shotsFired, 0);
  assert.equal(state.p1.shotsHit, 0);
});

test('PvP match stats count actual medkit healing and accepted dashes', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.p1.x = -1;
  state.p1.z = 0;
  state.p1.hp = 500;
  state.p2.x = 12;
  state.p2.z = 9;

  stepPvpArena(state, 0.05, {
    moveX: 0, moveZ: 0, aimAngle: Math.PI / 2,
    isFiring: false, wantDash: true,
  });

  assert.equal(state.p1.healingDone, 220);
  assert.equal(state.p1.hp, 720);
  assert.equal(state.p1.dashesUsed, 1);
  assert.equal(state.stats.p1.healingDone, 220);
  assert.equal(state.stats.p1.dashesUsed, 1);
  assert.equal(state.p2.healingDone, 0);
});

test('PvP match statistics survive round resets instead of starting over each round', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  state.p1.damageDealt = 320;
  state.p1.damageTaken = 180;
  state.p1.primaryDamageDealt = 200;
  state.p1.abilityDamageDealt = 120;
  state.p1.shotsFired = 10;
  state.p1.shotsHit = 4;
  state.p1.abilityUses = 2;
  state.p1.abilityHits = 1;
  state.p1.healingDone = 220;
  state.p1.dashesUsed = 3;
  state.p1.knockouts = 1;

  resetPvpRound(state);

  assert.deepEqual({
    damageDealt: state.p1.damageDealt,
    damageTaken: state.p1.damageTaken,
    primaryDamageDealt: state.p1.primaryDamageDealt,
    abilityDamageDealt: state.p1.abilityDamageDealt,
    shotsFired: state.p1.shotsFired,
    shotsHit: state.p1.shotsHit,
    abilityUses: state.p1.abilityUses,
    abilityHits: state.p1.abilityHits,
    healingDone: state.p1.healingDone,
    dashesUsed: state.p1.dashesUsed,
    knockouts: state.p1.knockouts,
  }, {
    damageDealt: 320,
    damageTaken: 180,
    primaryDamageDealt: 200,
    abilityDamageDealt: 120,
    shotsFired: 10,
    shotsHit: 4,
    abilityUses: 2,
    abilityHits: 1,
    healingDone: 220,
    dashesUsed: 3,
    knockouts: 1,
  });
});

test('PvP round-ending knockout prevents the opponent from firing or dashing later in the same tick', () => {
  const state = createInitialPvpArenaState('mateusz', 'P1', 'grzesiek', 'P2');
  resetPvpRound(state);
  advanceArena(state, 3.0);
  state.obstacles = [];
  state.p1.x = -2;
  state.p1.z = 0;
  state.p2.x = 2;
  state.p2.z = 0;
  state.p2.hp = 10;

  stepPvpArena(state, 0.05,
    { moveX: 0, moveZ: 0, aimAngle: Math.PI / 2, isFiring: false, wantAbility: true },
    { moveX: 1, moveZ: 0, aimAngle: -Math.PI / 2, isFiring: true, wantDash: true },
  );

  assert.equal(state.status, 'round_end');
  assert.equal(state.p1.knockouts, 1);
  assert.equal(state.p2.shotsFired, 0);
  assert.equal(state.p2.dashesUsed, 0);
  assert.equal(state.stats.p1.knockouts, 1);
});

test('starting a rematch resets every match-wide statistic and its published snapshot', () => {
  const state = createInitialPvpArenaState('marcin', 'P1', 'grzesiek', 'P2');
  for (const player of [state.p1, state.p2]) {
    player.damageDealt = 420;
    player.damageTaken = 300;
    player.primaryDamageDealt = 250;
    player.abilityDamageDealt = 170;
    player.shotsFired = 20;
    player.shotsHit = 8;
    player.abilityUses = 4;
    player.abilityHits = 3;
    player.healingDone = 220;
    player.dashesUsed = 5;
    player.knockouts = 1;
  }

  resetPvpMatchStats(state);

  for (const slot of ['p1', 'p2']) {
    assert.deepEqual(state.stats[slot], {
      damageDealt: 0,
      damageTaken: 0,
      primaryDamageDealt: 0,
      abilityDamageDealt: 0,
      shotsFired: 0,
      shotsHit: 0,
      abilityUses: 0,
      abilityHits: 0,
      healingDone: 0,
      dashesUsed: 0,
      knockouts: 0,
    });
  }
});
