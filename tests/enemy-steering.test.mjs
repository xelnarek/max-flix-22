import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStableEnemySteering, getEnemyEngageRadius } from '../src/enemySteering.ts';

test('crowd repulsion cannot pin an enemy outside its attack range', () => {
  const result = calculateStableEnemySteering({
    chase: { x: 1, z: 0 }, separation: { x: -1.65, z: 0 },
    separationWeight: 1.2, dt: 1 / 60,
  });
  assert.ok(result.x > 0.2);
  assert.ok(Math.abs(Math.hypot(result.x, result.z) - 1) < 1e-9);
});

test('steering resists small alternating lateral forces instead of flipping direction', () => {
  const first = calculateStableEnemySteering({
    chase: { x: 1, z: 0 }, separation: { x: 0, z: 0.3 },
    previous: { x: 1, z: 0 }, dt: 1 / 60,
  });
  const second = calculateStableEnemySteering({
    chase: { x: 1, z: 0 }, separation: { x: 0, z: -0.3 },
    previous: first, dt: 1 / 60,
  });
  assert.ok(first.x > 0.98 && second.x > 0.95);
  assert.ok(Math.abs(second.z) < 0.12);
});

test('invalid forces do not create non-finite steering', () => {
  assert.deepEqual(calculateStableEnemySteering({
    chase: { x: 0, z: 2 },
    separation: { x: Number.NaN, z: Number.POSITIVE_INFINITY },
    avoidance: { x: Number.NaN, z: 0 },
    previous: { x: Number.NaN, z: 0 },
    dt: Number.NaN,
  }), { x: 0, z: 1 });
});

test('melee enemies close in while ranged and support roles keep distance', () => {
  assert.ok(getEnemyEngageRadius('bruiser') < 1.8);
  assert.ok(getEnemyEngageRadius('standard') < 2.1);
  assert.ok(getEnemyEngageRadius('flanker') < 2);
  assert.ok(getEnemyEngageRadius('ranged') > 6);
  assert.ok(getEnemyEngageRadius('support') > 5);
});

test('stable steering reuses a caller-owned output record and clears it on a zero chase', () => {
  const out = { x: 88, z: -31 };
  const input = {
    chase: { x: 1, z: 0 },
    separation: { x: 0, z: 0.2 },
    previous: { x: 1, z: 0 },
    dt: 1 / 60,
  };
  const first = calculateStableEnemySteering(input, out);
  assert.strictEqual(first, out);
  assert.ok(first.x > 0.98);
  assert.ok(Math.abs(Math.hypot(first.x, first.z) - 1) < 1e-9);

  input.chase.x = 0;
  input.chase.z = 0;
  const stopped = calculateStableEnemySteering(input, out);
  assert.strictEqual(stopped, out);
  assert.deepEqual(stopped, { x: 0, z: 0 });
});

test('stable steering scratch output stays finite when prior direction is malformed', () => {
  const out = { x: Number.NaN, z: Number.POSITIVE_INFINITY };
  const result = calculateStableEnemySteering({
    chase: { x: 0, z: -3 },
    previous: { x: Number.NaN, z: Number.POSITIVE_INFINITY },
    dt: Number.NaN,
  }, out);
  assert.strictEqual(result, out);
  assert.deepEqual(result, { x: 0, z: -1 });
});
