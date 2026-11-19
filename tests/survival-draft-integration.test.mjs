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


test('every draft synergy matches the exact passive thresholds used by the live evolution unlocks', async () => {
  const game = await read('../src/game.ts');
  const draft = await read('../src/survivalDraft.ts');
  const requirements = [
    { id: 'ultimate_charge_chain', game: /stacks\.ability \|\| 0\) >= 3 && \(stacks\.rapid \|\| 0\) >= 2/, draft: /ability: \[\{ partner: 'rapid', selfRequired: 3, partnerRequired: 2/ },
    { id: 'critical_protocol', game: /stacks\.critical \|\| 0\) >= 3 && \(stacks\.critical_damage \|\| 0\) >= 2/, draft: /critical: \[\{ partner: 'critical_damage', selfRequired: 3, partnerRequired: 2/ },
    { id: 'ghost_protocol', game: /stacks\.dash \|\| 0\) >= 3 && \(stacks\.boots \|\| 0\) >= 2/, draft: /dash: \[\{ partner: 'boots', selfRequired: 3, partnerRequired: 2/ },
    { id: 'overdrive', game: /stacks\.damage \|\| 0\) >= 3 && \(stacks\.rapid \|\| 0\) >= 2/, draft: /damage: \[\{ partner: 'rapid', selfRequired: 3, partnerRequired: 2/ },
    { id: 'piorun_mk2', game: /stacks\.drone \|\| 0\) >= 2 && \(stacks\.range \|\| 0\) >= 2/, draft: /drone: \[\{ partner: 'range', selfRequired: 2, partnerRequired: 2/ },
    { id: 'premium_logistics', game: /stacks\.growth \|\| 0\) >= 2 && \(stacks\.scavenger \|\| 0\) >= 2/, draft: /growth: \[\{ partner: 'scavenger', selfRequired: 2, partnerRequired: 2/ },
    { id: 'bhp_fortress', game: /stacks\.regen \|\| 0\) >= 2 && \(stacks\.armor \|\| 0\) >= 2/, draft: /regen: \[\{ partner: 'armor', selfRequired: 2, partnerRequired: 2/ },
    { id: 'chain_reactor', game: /stacks\.ricochet \|\| 0\) >= 2 && \(stacks\.radiation \|\| 0\) >= 2/, draft: /ricochet: \[[\s\S]*?partner: 'radiation', selfRequired: 2, partnerRequired: 2/ },
    { id: 'crystal_cascade', game: /stacks\.shrapnel \|\| 0\) >= 2 && \(stacks\.ricochet \|\| 0\) >= 2/, draft: /partner: 'shrapnel', selfRequired: 2, partnerRequired: 2/ },
  ];
  for (const requirement of requirements) {
    assert.match(game, requirement.game, requirement.id + ' live unlock condition');
    assert.match(draft, requirement.draft, requirement.id + ' draft requirement');
  }
});
