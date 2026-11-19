import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rollSurvivalChaosRoulette,
  SURVIVAL_CHAOS_ROULETTE_TABLE,
} from '../src/survivalChaosRoulette.ts';

test('B4 roulette exposes eighteen reward/risk classes and a bounded weighted table', () => {
  const kinds = new Set(SURVIVAL_CHAOS_ROULETTE_TABLE.map((entry) => entry.kind));
  assert.deepEqual([...kinds].sort(), [
    'bounty', 'double_or_nothing', 'elite_delivery', 'enemy_pack', 'explosion', 'golden_crate',
    'hazard_clear', 'heal', 'magnet_surge', 'nova', 'overdrive', 'perk', 'shield',
    'skill', 'time_lock', 'weapon_draft', 'xp_rain', 'xp_surge',
  ]);
  assert.equal(SURVIVAL_CHAOS_ROULETTE_TABLE.reduce((sum, entry) => sum + entry.weight, 0), 100);
  assert.ok(SURVIVAL_CHAOS_ROULETTE_TABLE.every((entry) => Number.isInteger(entry.weight) && entry.weight > 0));
  const directEnemyRisk = SURVIVAL_CHAOS_ROULETTE_TABLE
    .filter((entry) => entry.kind === 'enemy_pack' || entry.kind === 'elite_delivery')
    .reduce((sum, entry) => sum + entry.weight, 0);
  const doubleOrNothing = SURVIVAL_CHAOS_ROULETTE_TABLE.find((entry) => entry.kind === 'double_or_nothing');
  assert.equal(directEnemyRisk, 8);
  assert.equal(doubleOrNothing?.weight, 2);
  assert.equal(directEnemyRisk + (doubleOrNothing?.weight ?? 0) * 0.45, 8.9,
    'effective hostile delivery remains near the previous 9% risk budget');
});

test('roulette roll boundaries select the first and final outcomes deterministically', () => {
  assert.equal(rollSurvivalChaosRoulette(0), 'skill');
  assert.equal(rollSurvivalChaosRoulette(0.999999), 'weapon_draft');
  assert.equal(rollSurvivalChaosRoulette(0.5), 'nova');
});

test('roulette roll covers all eighteen outcomes across the weighted intervals', () => {
  const counts = new Map();
  for (let index = 0; index < 10000; index++) {
    const kind = rollSurvivalChaosRoulette(index / 10000);
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  assert.equal(counts.size, 18);
  for (const entry of SURVIVAL_CHAOS_ROULETTE_TABLE) {
    assert.equal(counts.get(entry.kind), entry.weight * 100, entry.kind + ' probability interval');
  }
});

test('invalid roulette input falls back safely to the table midpoint', () => {
  assert.equal(rollSurvivalChaosRoulette(Number.NaN), 'nova');
  assert.equal(rollSurvivalChaosRoulette(-100), 'skill');
  assert.equal(rollSurvivalChaosRoulette(100), 'elite_delivery');
});

test('roulette reel feedback is synchronized to the three stop events and final reward class', async () => {
  const [ui, sound, style] = await Promise.all([
    import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/index.ts', import.meta.url), 'utf8')),
    import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/sound.ts', import.meta.url), 'utf8')),
    import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/visual-polish.css', import.meta.url), 'utf8')),
  ]);
  assert.match(ui, /sound\.playRouletteSpin\(\)/);
  assert.match(ui, /sound\.playRouletteStop\(index\)/);
  assert.match(ui, /sound\.playRouletteResult\(isRisk\)/);
  assert.match(ui, /const isRisk = result\.kind === 'enemy_pack' \|\| result\.kind === 'elite_delivery'/);
  assert.match(sound, /public playRouletteSpin\(\)/);
  assert.match(sound, /public playRouletteStop\(reelIndex: number\)/);
  assert.match(sound, /public playRouletteResult\(isRisk = false\)/);
  assert.match(style, /survival-chaos-machine\.is-jackpot/);
  assert.match(style, /survival-chaos-machine\.is-risk/);
  assert.match(style, /survival-chaos-machine \.survival-chaos-reel-symbol\.is-locked/);
});
