import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSurvivalCoalitionOrders,
  getSurvivalCoalitionRole,
} from '../src/survivalCoalition.ts';

const makeCandidate = (id, type, x, z, extra = {}) => ({
  id, type, x, z, state: 'chase', ...extra,
});

test('enemy types resolve into the four intended coalition roles', () => {
  assert.equal(getSurvivalCoalitionRole('sztaplar_szalony'), 'bruiser');
  assert.equal(getSurvivalCoalitionRole('elite_walczak_guard'), 'bruiser');
  assert.equal(getSurvivalCoalitionRole('inspector'), 'support');
  assert.equal(getSurvivalCoalitionRole('handlowiec'), 'ranged');
  assert.equal(getSurvivalCoalitionRole('bosman_krakow'), 'ranged');
  assert.equal(getSurvivalCoalitionRole('kurier'), 'flanker');
  assert.equal(getSurvivalCoalitionRole('unknown_enemy'), 'flanker');
});

test('a coalition appoints its bruiser as leader and assigns distinct squad slots', () => {
  const candidates = [
    makeCandidate('guard', 'kurier', 10, 1),
    makeCandidate('heavy', 'sztaplar_szalony', 10, 0, { maxHp: 24 }),
    makeCandidate('ranged', 'handlowiec', 11, 0),
    makeCandidate('wing', 'monter', 10, -1),
  ];
  const orders = buildSurvivalCoalitionOrders(candidates, 0, 0, Math.PI / 2, 6, 4);
  assert.equal(orders.length, 4);
  assert.equal(new Set(orders.map((order) => order.slot)).size, 4);
  assert.ok(orders.every((order) => order.squadId === 0 && order.squadSize === 4));
  assert.ok(orders.every((order) => order.leaderId === 'heavy'));
  assert.equal(orders.find((order) => order.enemyId === 'heavy')?.isLeader, true);
  assert.equal(orders.filter((order) => order.isLeader).length, 1);
});

test('flankers take opposite pincer lanes while ranged and support hold the rear arc', () => {
  const candidates = [
    makeCandidate('lead', 'sztaplar_szalony', 12, 0),
    makeCandidate('left', 'kurier', 12, 1),
    makeCandidate('right', 'monter', 12, -1),
    makeCandidate('ranged', 'handlowiec', 13, 0),
    makeCandidate('support', 'inspector', 13, 1),
  ];
  const orders = buildSurvivalCoalitionOrders(candidates, 0, 0, Math.PI / 2, 6, 5);
  const byId = new Map(orders.map((order) => [order.enemyId, order]));
  const leftOffset = byId.get('left').flankAngle - Math.PI / 2;
  const rightOffset = byId.get('right').flankAngle - Math.PI / 2;
  assert.ok(leftOffset < -0.7 && leftOffset > -0.95);
  assert.ok(rightOffset > 0.7 && rightOffset < 0.95);
  assert.ok(byId.get('ranged').preferredRadius >= 7.3);
  assert.ok(byId.get('support').preferredRadius >= 5.5);
  assert.ok(byId.get('lead').preferredRadius < 3);
});

test('coalition planner respects the active-attacker cap and creates multiple four-person squads', () => {
  const candidates = Array.from({ length: 9 }, (_, index) =>
    makeCandidate('enemy-' + index, index % 4 === 0 ? 'sztaplar_szalony' : 'kurier', 14 + index, index * 0.2)
  );
  const orders = buildSurvivalCoalitionOrders(candidates, 0, 0, 0, 8, 4);
  assert.equal(orders.length, 8);
  assert.deepEqual([...new Set(orders.map((order) => order.squadId))], [0, 1]);
  assert.deepEqual(
    [...new Set(orders.filter((order) => order.squadId === 0).map((order) => order.squadSize))],
    [4],
  );
  assert.deepEqual(
    [...new Set(orders.filter((order) => order.squadId === 1).map((order) => order.squadSize))],
    [4],
  );
});

test('defeated, duplicate and malformed enemies cannot enter a coalition', () => {
  const candidates = [
    makeCandidate('alive', 'kurier', 5, 0),
    makeCandidate('dead', 'sztaplar_szalony', 1, 0, { state: 'defeated' }),
    makeCandidate('bad', 'inspector', Number.NaN, 0),
    makeCandidate('alive', 'handlowiec', 0, 0),
  ];
  const orders = buildSurvivalCoalitionOrders(candidates, 0, 0, 0, 8);
  assert.deepEqual(orders.map((order) => order.enemyId), ['alive']);
});

test('coalition assignments are deterministic when input order changes', () => {
  const candidates = [
    makeCandidate('c', 'inspector', 11, 2),
    makeCandidate('a', 'sztaplar_szalony', 10, 0, { maxHp: 18 }),
    makeCandidate('d', 'handlowiec', 12, 0),
    makeCandidate('b', 'kurier', 10, -1),
  ];
  const first = buildSurvivalCoalitionOrders(candidates, 0, 0, 0.3, 8, 4);
  const second = buildSurvivalCoalitionOrders([...candidates].reverse(), 0, 0, 0.3, 8, 4);
  assert.deepEqual(first, second);
});

test('malformed player positions and zero active caps return no orders', () => {
  const candidates = [makeCandidate('one', 'kurier', 1, 1)];
  assert.deepEqual(buildSurvivalCoalitionOrders(candidates, Number.NaN, 0, 0, 4), []);
  assert.deepEqual(buildSurvivalCoalitionOrders(candidates, 0, 0, Number.POSITIVE_INFINITY, 4), []);
  assert.deepEqual(buildSurvivalCoalitionOrders(candidates, 0, 0, 0, 0), []);
});
