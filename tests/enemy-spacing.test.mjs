import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EnemySpatialIndex,
  calculateEnemySeparationVector,
  chooseSpacedSpawnPoint,
  resolveEnemyPlayerSeparation,
} from '../src/enemySpacing.ts';

test('coincident enemies receive finite, opposite deterministic separation vectors', () => {
  const first = { id: 'enemy-a', x: 0, z: 0 };
  const second = { id: 'enemy-b', x: 0, z: 0 };
  const fromFirst = calculateEnemySeparationVector(first, [first, second]);
  const fromSecond = calculateEnemySeparationVector(second, [first, second]);
  assert.ok(Number.isFinite(fromFirst.x) && Number.isFinite(fromFirst.z));
  assert.ok(Math.hypot(fromFirst.x, fromFirst.z) > 0);
  assert.ok(Math.abs(fromFirst.x + fromSecond.x) < 1e-9);
  assert.ok(Math.abs(fromFirst.z + fromSecond.z) < 1e-9);
});

test('separation is zero outside the requested spacing radius', () => {
  const self = { id: 'self', x: 0, z: 0 };
  const far = { id: 'far', x: 3.5, z: 0 };
  assert.deepEqual(calculateEnemySeparationVector(self, [self, far], 2.6), { x: 0, z: 0 });
});

test('defeated actors and invalid positions do not affect live enemy steering', () => {
  const self = { id: 'self', x: 0, z: 0 };
  const defeated = { id: 'dead', x: 0.4, z: 0, state: 'defeated' };
  const invalid = { id: 'invalid', x: Number.NaN, z: 0 };
  assert.deepEqual(calculateEnemySeparationVector(self, [self, defeated, invalid]), { x: 0, z: 0 });
});

test('separation magnitude is capped when several actors overlap', () => {
  const self = { id: 'self', x: 0, z: 0 };
  const neighbours = Array.from({ length: 30 }, (_, index) => ({
    id: 'enemy-' + index,
    x: 0.01 * (index + 1),
    z: 0.01 * ((index % 3) - 1),
  }));
  const vector = calculateEnemySeparationVector(self, [self, ...neighbours]);
  assert.ok(Math.hypot(vector.x, vector.z) <= 1.65 + 1e-9);
});

test('spawn selection prefers an unobstructed candidate with the required clearance', () => {
  const occupied = [{ id: 'existing', x: 0, z: 0 }];
  const candidates = [{ x: 1, z: 0 }, { x: 8, z: 0 }, { x: -9, z: 0 }];
  assert.deepEqual(chooseSpacedSpawnPoint(candidates, occupied, 3.2), { x: 8, z: 0 });
});

test('when every spawn point is crowded, choose the least crowded valid candidate', () => {
  const occupied = [
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 10, z: 0 },
  ];
  const candidates = [{ x: 1, z: 0 }, { x: 7, z: 0 }, { x: 9, z: 0 }];
  assert.deepEqual(chooseSpacedSpawnPoint(candidates, occupied, 3.2), { x: 7, z: 0 });
});

test('invalid candidate positions are ignored and an empty candidate list returns null', () => {
  assert.equal(chooseSpacedSpawnPoint([{ x: Number.NaN, z: 0 }], [], 3.2), null);
});

test('spatial index finds actors across positive and negative cell boundaries and filters inactive entries', () => {
  const actors = [
    { id: 'center', x: 0, z: 0 },
    { id: 'near-negative', x: -2.5, z: 1 },
    { id: 'outside', x: 8, z: 0 },
    { id: 'defeated', x: 0.2, z: 0, state: 'defeated' },
    { id: 'invalid', x: Number.NaN, z: 0 },
  ];
  const index = new EnemySpatialIndex(4);
  index.rebuild(actors);
  assert.deepEqual(index.query(0, 0, 3).map((actor) => actor.id).sort(), ['center', 'near-negative']);
});

test('spatial index rebuild replaces old cells and query reuses its scratch buffer', () => {
  const index = new EnemySpatialIndex(4);
  const first = { id: 'first', x: 0, z: 0 };
  index.rebuild([first]);
  const firstResult = index.query(0, 0, 1);
  assert.deepEqual(firstResult.map((actor) => actor.id), ['first']);

  const second = { id: 'second', x: 12, z: -8 };
  index.rebuild([second]);
  const secondResult = index.query(12, -8, 1);
  assert.equal(firstResult, secondResult);
  assert.deepEqual(secondResult.map((actor) => actor.id), ['second']);
  assert.deepEqual(index.query(0, 0, 1), []);
});


const testArena = { minX: -10, maxX: 10, minZ: -8, maxZ: 8 };

test('enemy models are moved outside the player clearance without moving the player', () => {
  const enemy = { id: 'enemy-near-player', x: 0.5, z: 0 };
  const player = { x: 0, z: 0 };
  const result = resolveEnemyPlayerSeparation(enemy, player, 1.3, testArena, 0.5);

  assert.equal(result.corrected, true);
  assert.ok(Math.abs(Math.hypot(result.x - player.x, result.z - player.z) - 1.3) < 1e-9);
  assert.deepEqual(player, { x: 0, z: 0 });
  assert.deepEqual(enemy, { id: 'enemy-near-player', x: 0.5, z: 0 });
});

test('enemy separation leaves actors outside the requested clearance unchanged', () => {
  const enemy = { id: 'enemy-clear', x: 1.5, z: 0 };
  assert.deepEqual(
    resolveEnemyPlayerSeparation(enemy, { x: 0, z: 0 }, 1.25, testArena),
    { x: 1.5, z: 0, corrected: false },
  );
});

test('coincident enemy and player models are separated in a stable direction', () => {
  const enemy = { id: 'coincident-enemy', x: 0, z: 0 };
  const player = { x: 0, z: 0 };
  const first = resolveEnemyPlayerSeparation(enemy, player, 1.4, testArena);
  const second = resolveEnemyPlayerSeparation(enemy, player, 1.4, testArena);

  assert.deepEqual(first, second);
  assert.equal(first.corrected, true);
  assert.ok(Number.isFinite(first.x) && Number.isFinite(first.z));
  assert.ok(Math.abs(Math.hypot(first.x, first.z) - 1.4) < 1e-9);
});

test('player separation chooses an in-bounds escape direction near an arena wall', () => {
  const enemy = { id: 'wall-enemy', x: 4.9, z: 0 };
  const player = { x: 4.9, z: 0 };
  const result = resolveEnemyPlayerSeparation(enemy, player, 1.5, {
    minX: -5, maxX: 5, minZ: -5, maxZ: 5,
  });
  assert.equal(result.corrected, true);
  assert.ok(result.x >= -5 && result.x <= 5 && result.z >= -5 && result.z <= 5);
  assert.ok(Math.hypot(result.x - player.x, result.z - player.z) >= 1.5 - 1e-9);
});

test('defeated enemies and invalid positions are never moved by player separation', () => {
  assert.deepEqual(
    resolveEnemyPlayerSeparation(
      { id: 'dead', x: 0, z: 0, state: 'defeated' },
      { x: 0, z: 0 }, 1.25, testArena,
    ),
    { x: 0, z: 0, corrected: false },
  );
  const invalid = resolveEnemyPlayerSeparation(
    { id: 'invalid', x: Number.NaN, z: 0 },
    { x: 0, z: 0 }, 1.25, testArena,
  );
  assert.equal(invalid.corrected, false);
  assert.ok(Number.isNaN(invalid.x));
});


test('Pomazaniec event spawn stays clear of the player, scenery and earlier riders', async () => {
  const { chooseSurvivalEventSpawnPoint } = await import('../src/survivalSpawn.ts');
  const bounds = { minX: -30, maxX: 30, minZ: -24, maxZ: 24 };
  const obstacles = [{ x: 0, z: 0, halfWidth: 5, halfDepth: 5 }];
  const occupied = [];
  const origin = { x: 0, z: 0 };

  for (let index = 0; index < 5; index++) {
    const point = chooseSurvivalEventSpawnPoint(
      origin,
      (index / 5) * Math.PI * 2,
      bounds,
      obstacles,
      occupied,
    );
    assert.ok(point, 'a clear event spawn point should be found');
    assert.ok(Math.hypot(point.x - origin.x, point.z - origin.z) >= 7.8 - 1e-9);
    assert.ok(Math.abs(point.x) >= 5.85 || Math.abs(point.z) >= 5.85, 'spawn must clear the central obstacle');
    assert.ok(occupied.every((enemy) => Math.hypot(enemy.x - point.x, enemy.z - point.z) >= 2.2 - 1e-9));
    occupied.push({ id: 'rider-' + index, ...point });
  }
});

test('Pomazaniec event spawn falls back to clear arena edges when the preferred ring is blocked', async () => {
  const { chooseSurvivalEventSpawnPoint } = await import('../src/survivalSpawn.ts');
  const bounds = { minX: -30, maxX: 30, minZ: -24, maxZ: 24 };
  const point = chooseSurvivalEventSpawnPoint(
    { x: 0, z: 0 },
    0,
    bounds,
    [{ x: 0, z: 0, halfWidth: 14, halfDepth: 14 }],
    [],
  );
  assert.ok(point);
  assert.ok(point.x >= -27.2 && point.x <= 27.2);
  assert.ok(point.z >= -22.2 && point.z <= 22.2);
  assert.ok(Math.abs(point.x) >= 14.85 || Math.abs(point.z) >= 14.85);
});

test('Pomazaniec event spawn stays inside bounds and rejects invalid inputs', async () => {
  const { chooseSurvivalEventSpawnPoint } = await import('../src/survivalSpawn.ts');
  const bounds = { minX: -12, maxX: 12, minZ: -10, maxZ: 10 };
  const point = chooseSurvivalEventSpawnPoint(
    { x: -7, z: 0 },
    Math.PI / 3,
    bounds,
    [],
    [],
  );
  assert.ok(point);
  assert.ok(point.x >= -9.2 && point.x <= 9.2);
  assert.ok(point.z >= -8.2 && point.z <= 8.2);
  assert.equal(chooseSurvivalEventSpawnPoint(
    { x: Number.NaN, z: 0 }, 0, bounds, [], [],
  ), null);
});


test('Pomazaniec event spawn declines to choose a point when the whole arena is obstructed', async () => {
  const { chooseSurvivalEventSpawnPoint } = await import('../src/survivalSpawn.ts');
  assert.equal(chooseSurvivalEventSpawnPoint(
    { x: 0, z: 0 },
    0,
    { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    [{ x: 0, z: 0, halfWidth: 20, halfDepth: 20 }],
    [],
  ), null);
});
