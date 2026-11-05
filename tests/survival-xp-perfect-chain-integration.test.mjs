import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('a perfect six-pickup XP chain grants score, a bonus gem and visible feedback in Survival', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /if \(streak\.perfectChainNow\)/);
  assert.match(game, /const chainBonus = 350 \+ this\.survivalWave \* 25/);
  assert.match(game, /this\.spawnSurvivalXpGem\(this\.playerPos\.x \+ 1\.35[\s\S]*?, 3\)/);
  assert.match(game, /ŁAŃCUCH XP PERFEKCYJNY/);
  assert.match(game, /this\.triggerHitStop\(0\.07\)/);
});
