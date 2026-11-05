import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('rotating shift events are connected to real Survival XP, eliminations and combo actions', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /advanceSurvivalShiftEvent\(this\.survivalShiftEvent, this\.survivalElapsed, dt\)/);
  assert.match(game, /registerSurvivalShiftEventAction\('xp', xpValue\)/);
  assert.match(game, /registerSurvivalShiftEventAction\('kills', 1\)/);
  assert.match(game, /registerSurvivalShiftEventAction\('combo', this\.comboStreak\)/);
  assert.match(game, /this\.survivalShiftEvent = createSurvivalShiftEventState\(\)/);
});

test('three completed event objectives reveal the one-time golden pallet easter egg', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /this\.survivalShiftEvent\.successStreak >= 3 && !this\.survivalGoldenPalletFound/);
  assert.match(game, /SEKRET: ZŁOTA PALETA LEGENDY/);
  assert.match(game, /this\.spawnSurvivalXpGem\(this\.playerPos\.x - 1\.4[\s\S]*?12\)/);
});
