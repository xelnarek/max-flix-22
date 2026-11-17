import test from 'node:test';
import assert from 'node:assert/strict';
import { findFirstProjectileEnemyImpact } from '../src/projectileImpact.ts';

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
