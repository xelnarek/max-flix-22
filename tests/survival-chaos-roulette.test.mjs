import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rollSurvivalChaosRoulette,
  SURVIVAL_CHAOS_ROULETTE_TABLE,
} from '../src/survivalChaosRoulette.ts';

test('B4 roulette exposes twelve reward/risk classes and a bounded weighted table', () => {
  const kinds = new Set(SURVIVAL_CHAOS_ROULETTE_TABLE.map((entry) => entry.kind));
  assert.deepEqual([...kinds].sort(), [
    'bounty', 'elite_delivery', 'enemy_pack', 'explosion', 'heal', 'nova',
    'overdrive', 'perk', 'shield', 'skill', 'time_lock', 'xp_rain',
  ]);
  assert.equal(SURVIVAL_CHAOS_ROULETTE_TABLE.reduce((sum, entry) => sum + entry.weight, 0), 100);
  assert.ok(SURVIVAL_CHAOS_ROULETTE_TABLE.every((entry) => Number.isInteger(entry.weight) && entry.weight > 0));
});

test('roulette roll boundaries select the first and final outcomes deterministically', () => {
  assert.equal(rollSurvivalChaosRoulette(0), 'skill');
  assert.equal(rollSurvivalChaosRoulette(0.999999), 'elite_delivery');
});

test('roulette roll covers all twelve outcomes across the weighted intervals', () => {
  const counts = new Map();
  for (let index = 0; index < 10000; index++) {
    const kind = rollSurvivalChaosRoulette(index / 10000);
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  assert.equal(counts.size, 12);
  assert.equal(counts.get('skill'), 1700);
  assert.equal(counts.get('perk'), 1600);
  assert.equal(counts.get('enemy_pack'), 700);
  assert.equal(counts.get('xp_rain'), 700);
  assert.equal(counts.get('elite_delivery'), 200);
});

test('invalid roulette input falls back safely to the table midpoint', () => {
  assert.equal(rollSurvivalChaosRoulette(Number.NaN), 'heal');
  assert.equal(rollSurvivalChaosRoulette(-100), 'skill');
  assert.equal(rollSurvivalChaosRoulette(100), 'elite_delivery');
});
