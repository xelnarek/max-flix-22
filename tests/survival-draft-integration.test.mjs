import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the live Survival level-up draft uses current build, weapon and health state', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /import \{ getSurvivalDraftSynergyHint, selectSurvivalDraftOptions, type SurvivalDraftContext \} from '\.\/survivalDraft\.ts'/);
  assert.match(game, /const draftContext: SurvivalDraftContext = \{/);
  assert.match(game, /stacks: this\.survivalUpgradeStacks/);
  assert.match(game, /weapons: this\.survivalWeapons/);
  assert.match(game, /evolutions: \[\.\.\.this\.survivalEvolutions\]/);
  assert.match(game, /healthRatio: this\.maxHp > 0 \? this\.hp \/ this\.maxHp : 1/);
  assert.match(game, /const selectedOptions = selectSurvivalDraftOptions\(pool, draftContext\)/);
  assert.match(game, /getSurvivalDraftSynergyHint\(/);
  assert.match(game, /return withRarity\(selectedOptions\)/);
});

test('rerolls use the same build-aware selection and preserve the current cards as exclusions', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /this\.survivalPendingOptions = this\.rollSurvivalUpgradeOptions\(this\.survivalPendingOptions\.map\(\(option\) => option\.id\)\)/);
  assert.match(game, /public rerollSurvivalUpgrades\(\): boolean/);
  assert.match(game, /if \(this\.gameMode !== 'survival' \|\| this\.state !== 'levelup'/);
});

test('the weapon offer still requires the actual time unlock and passive pairing for an evolution', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('  private rollSurvivalUpgradeOptions');
  const end = game.indexOf('  public rerollSurvivalUpgrades()', start);
  assert.ok(start >= 0 && end > start);
  const draft = game.slice(start, end);
  assert.match(draft, /this\.survivalElapsed >= definition\.unlockAfter/);
  assert.match(draft, /owned\.level >= 5/);
  assert.match(draft, /this\.survivalElapsed >= 210/);
  assert.match(draft, /this\.survivalUpgradeStacks\[definition\.evolutionPassive\]/);
});
