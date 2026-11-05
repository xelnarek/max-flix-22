import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival contracts are connected to real kills, collected XP and combo chains', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /advanceSurvivalContract\(this\.survivalContract, dt\)/);
  assert.match(game, /this\.survivalContract = createSurvivalContract\(this\.survivalWave\)/);
  assert.match(game, /registerSurvivalContractAction\('eliminations', 1\)/);
  assert.match(game, /registerSurvivalContractAction\('combo', this\.comboStreak\)/);
  assert.match(game, /registerSurvivalContractAction\('xp', xpValue\)/);
  assert.match(game, /KONTRAKT ZALICZONY/);
  assert.match(game, /this\.spawnSurvivalXpGem\([\s\S]*?bonusXp/);
  assert.match(game, /contract: \{ \.\.\.this\.survivalContract \}/);
});

test('the live contract HUD has accessible title, details, timer and progress bar', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'), read('../src/index.ts'), read('../src/hud-layout.css')
  ]);
  for (const id of [
    'survival-contract',
    'survival-contract-title',
    'survival-contract-detail',
    'survival-contract-meta',
    'survival-contract-fill',
  ]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
  }
  assert.match(app, /snapshot\.contract/);
  assert.match(app, /survivalContractFillElem\.style\.width/);
  assert.match(css, /\.survival-contract\.is-complete/);
  assert.match(css, /@media \(max-width: 900px\), \(pointer: coarse\)/);
  assert.match(css, /boss-hud-bar[\s\S]*?138px/);
});
