import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the final visual quality layer is loaded after every existing theme and layout layer', async () => {
  const html = await read('../index.html');
  const menuCss = html.indexOf('/src/menu-layout-fixes.css');
  const qualityCss = html.indexOf('/src/quality-pass.css');
  assert.ok(menuCss >= 0, 'existing menu layout layer must remain loaded');
  assert.ok(qualityCss > menuCss, 'quality layer must load after the existing styles');
});

test('the visual quality layer covers menu, codex, progression, Survival, PvP and results', async () => {
  const css = await read('../src/quality-pass.css');
  const requiredSelectors = [
    '#title-screen .menu-tabs-bar',
    '#title-screen .field-guide-card',
    '#title-screen .enemy-guide-card',
    '#title-screen .perk-card',
    '#title-screen .survival-map-choice',
    '#title-screen .account-progression-panel',
    '#title-screen .character-mastery-panel',
    '#title-screen .leaderboard-container',
    '#survival-hud .survival-chip',
    '#survival-hud .survival-contract',
    '#pvp-hud .pvp-player-box',
    '#pvp-hud .pvp-center-box',
    '#pvp-lobby-modal .pvp-lobby-card',
    '#pvp-match-end-modal .pvp-match-end-card',
    '#pause-modal .modal-card',
    '#gameover-modal .gameover-card',
    '#gameover-modal .gameover-damage-panel',
  ];
  for (const selector of requiredSelectors) {
    assert.ok(css.includes(selector), 'missing presentation coverage: ' + selector);
  }
});

test('visual polish preserves gameplay canvas rendering and hidden-state ownership', async () => {
  const css = await read('../src/quality-pass.css');
  assert.doesNotMatch(css, /#game-canvas-container\s+canvas/);
  assert.doesNotMatch(css, /\.hidden\s*\{/);
  assert.doesNotMatch(css, /display\s*:\s*none/);
});

test('visual polish retains keyboard focus, reduced-motion and compact-screen support', async () => {
  const css = await read('../src/quality-pass.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /max-width:\s*640px/);
  assert.match(css, /max-height:\s*520px/);
});
