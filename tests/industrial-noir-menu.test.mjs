import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, intro, finalCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/industrial-noir-menu.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/cinematicIntro.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/crimson-shift-menu.css', import.meta.url), 'utf8'),
]);

test('Crimson Shift is the final visual layer without replacing gameplay menu structure', () => {
  assert.match(html, /crimson-shift-menu\\.css/);
  for (const id of [
    'btn-start-survival', 'btn-open-campaign', 'btn-open-pvp',
    'tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks',
    'tab-field-guide', 'tab-talent-tree', 'tab-ranks', 'tab-leaderboard',
    'tab-achievements', 'tab-settings',
  ]) {
    assert.ok(html.includes(id), 'existing menu destination must remain: ' + id);
  }
  for (const selector of [
    '#title-screen .menu-mode-grid',
    '#title-screen .menu-tabs-bar',
    '#title-screen .menu-tab-content-area',
    '.asset-loader-overlay',
    '.cinematic-intro-overlay',
  ]) {
    assert.ok(finalCss.includes(selector), 'missing Crimson Shift treatment: ' + selector);
  }
  assert.match(finalCss, /@media \\(max-width:760px\\)/);
  assert.match(finalCss, /prefers-reduced-motion/);
  assert.match(intro, /MAX FLIX/);
  assert.match(intro, /CRIMSON SHIFT/);
  assert.doesNotMatch(intro, /Warehouse MaDDnes|<h1>WAREHOUSE<\\/h1>/);
  assert.match(intro, /private readonly duration = 11\\.8/);
  assert.match(html, /MAX FLIX <span>22<\\/span>/);
});
