import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalBossRewardOptions } from '../src/survivalBossRewards.ts';

test('boss rewards are three unique legendary choices', () => {
  const options = createSurvivalBossRewardOptions();
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((option) => option.id)).size, 3);
  assert.deepEqual(options.map((option) => option.id), [
    'boss_damage_core',
    'boss_mobility_core',
    'boss_bulwark',
  ]);
  for (const option of options) {
    assert.equal(option.rarity, 'legendary');
    assert.equal(option.rarityLabel, 'LEGENDARNA');
    assert.equal(option.strengthMultiplier, 1.75);
  }
});

test('boss rewards no longer expose unlocks, levels or evolutions from the retired weapon system', () => {
  const options = createSurvivalBossRewardOptions();
  assert.equal(options[1].id, 'boss_mobility_core');
  assert.match(options[1].description, /szybkości ruchu/);
  assert.ok(options.every((option) => !/weapon_unlock:|weapon_upgrade:|weapon_evolve:/.test(option.id)));
});

test('boss rewards pause Survival, trigger on boss defeat and cannot be bypassed', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
  const [game, app, html, css] = await Promise.all([
    read('../src/game.ts'),
    read('../src/index.ts'),
    read('../index.html'),
    read('../src/visual-polish.css'),
  ]);

  assert.ok(game.includes("this.callbacks.onSurvivalLevelUp?.([...this.survivalPendingOptions], 'boss-reward')"));
  assert.ok(game.includes('this.survivalRankUpPending = false;'));
  assert.ok(game.includes("this.beginSurvivalBossReward(e.name)"));
  assert.ok(game.includes("this.survivalBossRewardPending = true"));
  assert.ok(game.includes("this.survivalBossRewardPending || this.survivalRerolls <= 0"));
  assert.ok(game.includes("this.survivalBossRewardPending || this.survivalSkips <= 0"));
  assert.ok(game.includes("this.survivalBossRewardPending ||"));
  assert.ok(app.includes("context: 'levelup' | 'rank-up' | 'boss-reward' | 'chaos-roulette' = 'levelup'"));
  assert.ok(app.includes("survivalRerollBtn?.classList.toggle('hidden', isBossReward || isChaosRoulette)"));
  assert.ok(app.includes("survivalSkipBtn?.classList.toggle('hidden', isBossReward || isChaosRoulette)"));
  assert.ok(html.includes('id="survival-levelup-title"'));
  assert.ok(css.includes('#survival-levelup[data-mode="boss-reward"] .survival-upgrade-actions'));
});

test('boss mobility reward strengthens only operator movement and dodge cadence', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes("choice.id === 'boss_mobility_core'"));
  assert.ok(game.includes('this.survivalMoveMultiplier = Math.min(1.38, this.survivalMoveMultiplier * 1.08)'));
  assert.ok(game.includes('this.survivalDashCooldownMultiplier = Math.max(0.48, this.survivalDashCooldownMultiplier * 0.92)'));
  assert.ok(!game.includes('survivalWeaponReloadMultiplier'));
  assert.ok(!game.includes("choice.id === 'boss_weapon_overdrive'"));
});
