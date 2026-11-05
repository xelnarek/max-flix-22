import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('XP pickup streak is wired into real Survival XP collection and resets on each run', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /registerSurvivalXpPickup\(this\.survivalXpStreak, this\.survivalElapsed\)/);
  assert.match(game, /gem\.value \* this\.survivalXpMultiplier[\s\S]*streak\.multiplier/);
  assert.match(game, /this\.survivalXpStreak = createSurvivalXpStreakState\(\)/);
  assert.match(game, /ŁAŃCUCH XP/);
});

test('weapon evolution unlock timing is reduced to 3.5 minutes in both offer and acceptance checks', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.equal((game.match(/this\.survivalElapsed >= 210/g) || []).length, 2);
  assert.match(game, /3,5 minuty Survival/);
});
