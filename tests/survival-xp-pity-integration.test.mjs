import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival XP pity is connected to the live enemy-elimination reward path', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private survivalXpDropMissStreak = 0/);
  assert.match(game, /this\.survivalXpDropMissStreak,\s*\)/);
  assert.match(game, /if \(xpDrop\) this\.spawnSurvivalXpGem/);
  assert.match(game, /if \(xpDrop\.isPityDrop\)/);
  assert.match(game, /this\.survivalXpDropMissStreak = Math\.min\(4, this\.survivalXpDropMissStreak \+ 1\)/);
});

test('Survival XP pity resets at the beginning of a new run', async () => {
  const game = await read('../src/game.ts');
  const resetIndex = game.indexOf('this.survivalKills = 0;');
  assert.ok(resetIndex >= 0);
  const resetBlock = game.slice(resetIndex, resetIndex + 180);
  assert.match(resetBlock, /this\.survivalXpDropMissStreak = 0/);
});

test('bad-luck protection preserves original base enemy drop chances', async () => {
  const drops = await read('../src/survivalXpDrops.ts');
  assert.match(drops, /regular', chance: 0\.32/);
  assert.match(drops, /heavy', chance: 0\.56/);
  assert.match(drops, /elite', chance: 0\.88/);
  assert.match(drops, /boss', chance: 1/);
  assert.match(drops, /getPityThreshold/);
  assert.match(drops, /A zero chance anomaly remains an intentional hard block/);
});
