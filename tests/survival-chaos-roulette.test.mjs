import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rollSurvivalChaosRoulette,
  SURVIVAL_CHAOS_ROULETTE_TABLE,
} from '../src/survivalChaosRoulette.ts';

test('roulette exposes every reward and risk class with a bounded weighted table', () => {
  const kinds = new Set(SURVIVAL_CHAOS_ROULETTE_TABLE.map((entry) => entry.kind));
  assert.deepEqual([...kinds].sort(), ['enemy_pack', 'explosion', 'heal', 'nova', 'perk', 'shield', 'skill']);
  assert.equal(SURVIVAL_CHAOS_ROULETTE_TABLE.reduce((sum, entry) => sum + entry.weight, 0), 100);
  assert.ok(SURVIVAL_CHAOS_ROULETTE_TABLE.every((entry) => entry.weight > 0));
});

test('roulette roll boundaries select the first and final outcomes deterministically', () => {
  assert.equal(rollSurvivalChaosRoulette(0), 'skill');
  assert.equal(rollSurvivalChaosRoulette(0.999999), 'enemy_pack');
});

test('roulette roll covers all seven outcomes across the weighted intervals', () => {
  const counts = new Map();
  for (let index = 0; index < 10000; index++) {
    const kind = rollSurvivalChaosRoulette(index / 10000);
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  assert.equal(counts.size, 7);
  assert.equal(counts.get('skill'), 2400);
  assert.equal(counts.get('perk'), 2400);
  assert.equal(counts.get('enemy_pack'), 800);
});

test('invalid roulette input falls back safely to the table midpoint', () => {
  assert.equal(rollSurvivalChaosRoulette(Number.NaN), 'perk');
  assert.equal(rollSurvivalChaosRoulette(-100), 'skill');
  assert.equal(rollSurvivalChaosRoulette(100), 'enemy_pack');
});
