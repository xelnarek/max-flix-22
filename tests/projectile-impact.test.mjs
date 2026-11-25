import test from 'node:test';
import assert from 'node:assert/strict';
import { findFirstProjectileEnemyImpact, stopProjectileAtImpact } from '../src/projectileImpact.ts';

test('fast enemy projectile is caught at the first enemy along its full travel segment', () => {
  const first = { id: 'first', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const second = { id: 'second', type: 'walczak', x: 3, y: 0.5, z: 0, state: 'chase' };
  const hit = findFirstProjectileEnemyImpact(
    { x: -4, y: 1.12, z: 0 }, { x: 5, y: 1.12, z: 0 }, [second, first],
  );
  assert.ok(hit);
  assert.equal(hit.actor.id, 'first');
  assert.ok(hit.t > 0 && hit.t < 0.5);
  assert.ok(Math.abs(hit.x) < 1);
});

test('a projectile that starts inside its firing enemy does not self-hit', () => {
  const shooter = { id: 'shooter', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const hit = findFirstProjectileEnemyImpact(
    { x: 0, y: 1.12, z: 0 }, { x: 5, y: 1.12, z: 0 }, [shooter],
  );
  assert.equal(hit, null);
});

test('projectiles pass above actors and ignore defeated bodies', () => {
  const live = { id: 'live', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const dead = { id: 'dead', type: 'walczak', x: 2, y: 0.5, z: 0, state: 'defeated' };
  const hit = findFirstProjectileEnemyImpact(
    { x: -4, y: 3.0, z: 0 }, { x: 4, y: 3.0, z: 0 }, [live, dead],
  );
  assert.equal(hit, null);
});

test('nearest segment intersection wins even when input actor order is reversed', () => {
  const far = { id: 'far', type: 'walczak', x: 3, y: 0.5, z: 0, state: 'chase' };
  const near = { id: 'near', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const hit = findFirstProjectileEnemyImpact(
    { x: -4, y: 1.12, z: 0 }, { x: 5, y: 1.12, z: 0 }, [far, near],
  );
  assert.equal(hit?.actor.id, 'near');
});

test('player body collision wins over a friendly enemy standing just behind the operator', async () => {
  const { findFirstProjectileBodyImpact } = await import('../src/projectileImpact.ts');
  const start = { x: -2, y: 1.05, z: 0 };
  const end = { x: 2, y: 1.05, z: 0 };
  const player = findFirstProjectileBodyImpact(start, end, { x: 0, y: 1.05, z: 0 }, 0.85, 1.0);
  const enemy = findFirstProjectileBodyImpact(start, end, { x: 1.0, y: 1.05, z: 0 }, 0.66, 0.9);
  assert.ok(player);
  assert.ok(enemy);
  assert.ok(player.t < enemy.t, 'the shot must stop on the player before reaching an enemy behind them');
});

test('projectile body impact handles vertical travel through the body height window', async () => {
  const { findFirstProjectileBodyImpact } = await import('../src/projectileImpact.ts');
  const hit = findFirstProjectileBodyImpact(
    { x: 0, y: 3, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0.5, z: 0 },
    0.85,
    0.5,
  );
  assert.ok(hit);
  assert.ok(hit.t > 0 && hit.t < 1);
  assert.ok(Math.abs(hit.y - 0.5) <= 0.5);
});

test('body impact reuses a caller-owned output record', async () => {
  const { findFirstProjectileBodyImpact } = await import('../src/projectileImpact.ts');
  const scratch = { t: -1, x: -1, y: -1, z: -1 };
  const hit = findFirstProjectileBodyImpact(
    { x: -2, y: 1.05, z: 0 },
    { x: 2, y: 1.05, z: 0 },
    { x: 0, y: 1.05, z: 0 },
    0.85,
    1.0,
    scratch,
  );
  assert.strictEqual(hit, scratch);
  assert.ok(hit);
  assert.ok(hit.t > 0 && hit.t < 0.5);
});

test('enemy impact reuses output and target/body scratch records without changing earliest-hit selection', () => {
  const near = { id: 'near', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const far = { id: 'far', type: 'walczak', x: 3, y: 0.5, z: 0, state: 'chase' };
  const output = { t: 0, x: 0, y: 0, z: 0, actor: null };
  const target = { x: 0, y: 0, z: 0 };
  const bodyImpact = { t: 0, x: 0, y: 0, z: 0 };
  const hit = findFirstProjectileEnemyImpact(
    { x: -4, y: 1.12, z: 0 },
    { x: 5, y: 1.12, z: 0 },
    [far, near],
    0.9,
    output,
    target,
    bodyImpact,
  );
  assert.strictEqual(hit, output);
  assert.equal(hit?.actor.id, 'near');
  assert.equal(target.x, near.x);
  assert.equal(target.y, near.y + 0.62);
  assert.ok(hit && hit.t > 0 && hit.t < 0.5);
});


test('player-fired projectiles register point-blank muzzle overlap instead of treating the target as the shooter', () => {
  const target = { id: 'point-blank', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const hit = findFirstProjectileEnemyImpact(
    { x: 0, y: 1.12, z: 0 },
    { x: 3, y: 1.12, z: 0 },
    [target],
    0.9,
    undefined,
    undefined,
    undefined,
    undefined,
    false,
    1.0,
  );
  assert.ok(hit, 'a living enemy overlapping the muzzle must receive the shot');
  assert.equal(hit.actor.id, target.id);
  assert.equal(hit.t, 0);
});

test('piercing projectiles skip targets already hit and select the next body along the segment', () => {
  const near = { id: 'near', type: 'inspector', x: 0, y: 0.5, z: 0, state: 'chase' };
  const far = { id: 'far', type: 'walczak', x: 3, y: 0.5, z: 0, state: 'chase' };
  const hit = findFirstProjectileEnemyImpact(
    { x: -4, y: 1.12, z: 0 },
    { x: 5, y: 1.12, z: 0 },
    [far, near],
    0.9,
    undefined,
    undefined,
    undefined,
    new Set(['near']),
    false,
    1.0,
  );
  assert.ok(hit);
  assert.equal(hit.actor.id, 'far');
});


test('a normal projectile is frozen at its first confirmed body contact', () => {
  const position = { x: 99, y: 99, z: 99, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const velocity = { x: 12, y: 3, z: -4, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const projectile = { mesh: { position }, vel: velocity, life: 9 };
  const impact = { x: 1.25, y: 0.92, z: -3.5 };

  assert.equal(stopProjectileAtImpact(projectile, impact), true);
  assert.deepEqual(position, { x: 1.25, y: 0.92, z: -3.5, set: position.set });
  assert.deepEqual({ x: velocity.x, y: velocity.y, z: velocity.z }, { x: 0, y: 0, z: 0 });
  assert.equal(projectile.life, 0.085);
  assert.equal(projectile.impactStopped, true);
});

test('a stopped projectile cannot be stopped or dealt another hit a second time', () => {
  const position = { x: 1, y: 2, z: 3, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const velocity = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const projectile = { mesh: { position }, vel: velocity, life: 0.085, impactStopped: true };

  assert.equal(stopProjectileAtImpact(projectile, { x: 8, y: 8, z: 8 }), false);
  assert.deepEqual({ x: position.x, y: position.y, z: position.z }, { x: 1, y: 2, z: 3 });
  assert.equal(projectile.life, 0.085);
});

test('invalid impact coordinates never mutate projectile state', () => {
  const position = { x: 1, y: 2, z: 3, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const velocity = { x: 4, y: 5, z: 6, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const projectile = { mesh: { position }, vel: velocity, life: 5 };

  assert.equal(stopProjectileAtImpact(projectile, { x: Number.NaN, y: 0, z: 0 }), false);
  assert.equal(projectile.life, 5);
  assert.equal(projectile.impactStopped, undefined);
  assert.deepEqual({ x: position.x, y: position.y, z: position.z }, { x: 1, y: 2, z: 3 });
  assert.deepEqual({ x: velocity.x, y: velocity.y, z: velocity.z }, { x: 4, y: 5, z: 6 });
});
