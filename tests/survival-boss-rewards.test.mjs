import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalBossRewardOptions } from '../src/survivalBossRewards.ts';

test('boss rewards are three unique legendary choices', () => {
  const options = createSurvivalBossRewardOptions();
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((option) => option.id)).size, 3);
  assert.deepEqual(options.map((option) => option.id), [
    'boss_damage_core',
    'boss_weapon_overdrive',
    'boss_bulwark',
  ]);
  for (const option of options) {
    assert.equal(option.rarity, 'legendary');
    assert.equal(option.rarityLabel, 'LEGENDARNA');
    assert.equal(option.strengthMultiplier, 1.75);
  }
});

test('boss reward can unlock a new weapon at legendary level three', () => {
  const options = createSurvivalBossRewardOptions({
    kind: 'unlock',
    id: 'diamond_saw',
    name: 'Tarcza diamentowa',
    icon: '💿',
  });
  assert.equal(options[1].id, 'weapon_unlock:diamond_saw');
  assert.match(options[1].title, /TARCZA DIAMENTOWA/);
  assert.match(options[1].description, /3\/5/);
});

test('boss reward advances an owned weapon by two levels, capped at five', () => {
  const options = createSurvivalBossRewardOptions({
    kind: 'upgrade',
    id: 'diamond_saw',
    name: 'Tarcza diamentowa',
    icon: '💿',
    currentLevel: 3,
  });
  assert.equal(options[1].id, 'weapon_upgrade:diamond_saw');
  assert.match(options[1].title, /POZIOM 5/);
  assert.match(options[1].description, /3 → 5\/5/);
});

test('boss reward has a useful fallback when every weapon is maxed', () => {
  const options = createSurvivalBossRewardOptions();
  assert.equal(options[1].id, 'boss_weapon_overdrive');
  assert.match(options[1].description, /8% szybciej/);
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
  assert.ok(game.includes("this.beginSurvivalBossReward(e.name)"));
  assert.ok(game.includes("this.survivalBossRewardPending = true"));
  assert.ok(game.includes("this.survivalBossRewardPending || this.survivalRerolls <= 0"));
  assert.ok(game.includes("this.survivalBossRewardPending || this.survivalSkips <= 0"));
  assert.ok(game.includes("this.survivalBossRewardPending ||"));
  assert.ok(app.includes("context: 'levelup' | 'boss-reward' = 'levelup'"));
  assert.ok(app.includes("survivalRerollBtn?.classList.toggle('hidden', isBossReward)"));
  assert.ok(app.includes("survivalSkipBtn?.classList.toggle('hidden', isBossReward)"));
  assert.ok(html.includes('id="survival-levelup-title"'));
  assert.ok(css.includes('#survival-levelup[data-mode="boss-reward"] .survival-upgrade-actions'));
});

test('boss weapon overdrive improves melee and weapon reload cadence and resets each run', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('this.survivalWeaponReloadMultiplier = Math.max(0.72, this.survivalWeaponReloadMultiplier * 0.92)'));
  assert.ok(game.includes('this.survivalAttackRateMultiplier = Math.max(0.78, this.survivalAttackRateMultiplier * 0.92)'));
  assert.ok(game.includes('this.getScaledSurvivalWeaponReloadSeconds(\\n      readyWeapon.id'));
  assert.ok(game.includes('this.survivalWeaponReloadMultiplier = 1;'));
});
