import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEnemyProjectileDodge,
  predictEnemyAimPoint,
} from '../src/enemyTactics.ts';

test('enemy aim leads a laterally moving target without snapping to a perfect intercept', () => {
  const aim = predictEnemyAimPoint(
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 0, z: 4 },
    10,
  );
  assert.equal(aim.x, 10);
  assert.ok(aim.z > 0.5 && aim.z <= 2.5);
});

test('stationary targets keep their exact aim point', () => {
  assert.deepEqual(
    predictEnemyAimPoint(
      { x: -4, z: 3 },
      { x: 8, z: -2 },
      { x: 0, z: 0 },
      8,
    ),
    { x: 8, z: -2 },
  );
});

test('enemy aim lead is bounded and malformed velocity cannot create a non-finite target', () => {
  const aim = predictEnemyAimPoint(
    { x: 0, z: 0 },
    { x: 0, z: 14 },
    { x: 40, z: 0 },
    7,
    1,
    0.5,
  );
  assert.ok(Math.abs(aim.x) <= 4.01);
  assert.ok(Number.isFinite(aim.x) && Number.isFinite(aim.z));

  const safe = predictEnemyAimPoint(
    { x: 0, z: 0 },
    { x: 5, z: 7 },
    { x: Number.NaN, z: Number.POSITIVE_INFINITY },
    9,
  );
  assert.deepEqual(safe, { x: 5, z: 7 });
});

test('enemy dodges a projectile on a collision course with a stable perpendicular sidestep', () => {
  const actor = { id: 'guard-01', x: 0, y: 0.5, z: 0 };
  const shot = {
    mesh: { position: { x: -4, y: 1.12, z: 0 } },
    vel: { x: 8, y: 0, z: 0 },
  };
  const first = calculateEnemyProjectileDodge(actor, [shot]);
  const second = calculateEnemyProjectileDodge(actor, [shot]);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(first.x) < 1e-9);
  assert.ok(Math.abs(first.z) > 0.4);
});

test('enemy ignores projectiles that miss vertically, pass outside clearance, move away or already hit it', () => {
  const actor = { id: 'guard-02', x: 0, y: 0.5, z: 0 };
  const misses = [
    { mesh: { position: { x: -4, y: 3.2, z: 0 } }, vel: { x: 8, y: 0, z: 0 } },
    { mesh: { position: { x: -4, y: 1.12, z: 1.8 } }, vel: { x: 8, y: 0, z: 0 } },
    { mesh: { position: { x: -1.5, y: 1.12, z: 0 } }, vel: { x: -8, y: 0, z: 0 } },
    { mesh: { position: { x: -4, y: 1.12, z: 0 } }, vel: { x: 8, y: 0, z: 0 }, hitIds: new Set(['guard-02']) },
    { mesh: { position: { x: -4, y: 1.12, z: 0 } }, vel: { x: 8, y: 0, z: 0 }, orbiting: true },
  ];
  for (const shot of misses) {
    assert.deepEqual(calculateEnemyProjectileDodge(actor, [shot]), { x: 0, z: 0 });
  }
});

test('invalid actor data and empty projectile lists safely return no dodge', () => {
  assert.deepEqual(
    calculateEnemyProjectileDodge({ id: 'bad', x: Number.NaN, y: 0, z: 0 }, []),
    { x: 0, z: 0 },
  );
  assert.deepEqual(
    calculateEnemyProjectileDodge({ id: 'safe', x: 0, y: 0, z: 0 }, []),
    { x: 0, z: 0 },
  );
});

test('projectile dodge reuses caller-owned output and clears stale dodge when no projectile threatens', () => {
  const actor = { id: 'guard-reused', x: 0, y: 0.5, z: 0 };
  const shot = {
    mesh: { position: { x: -4, y: 1.12, z: 0 } },
    vel: { x: 8, y: 0, z: 0 },
  };
  const out = { x: 77, z: -55 };
  const dodge = calculateEnemyProjectileDodge(actor, [shot], 0.72, 1.02, 0.95, out);
  assert.strictEqual(dodge, out);
  assert.ok(Math.abs(dodge.z) > 0.4);

  const clear = calculateEnemyProjectileDodge(actor, [], 0.72, 1.02, 0.95, out);
  assert.strictEqual(clear, out);
  assert.deepEqual(clear, { x: 0, z: 0 });
});

test('projectile dodge scratch resets before rejecting invalid actor data', () => {
  const out = { x: 12, z: -9 };
  const result = calculateEnemyProjectileDodge(
    { id: 'guard-bad-reused', x: Number.NaN, y: 0.5, z: 0 },
    [],
    0.72,
    1.02,
    0.95,
    out,
  );
  assert.strictEqual(result, out);
  assert.deepEqual(result, { x: 0, z: 0 });
});
