import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, intro, finalCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/cinematicIntro.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/crimson-shift-menu.css', import.meta.url), 'utf8'),
]);

test('Crimson Shift is the final visual layer without replacing gameplay menu structure', () => {
  assert.ok(html.includes('/src/crimson-shift-menu.css'), 'final CSS must load in the page head');
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
  assert.ok(finalCss.includes('@media (max-width:760px)'), 'mobile layout rules must remain present');
  assert.ok(finalCss.includes('prefers-reduced-motion'), 'reduced-motion support must remain present');
  assert.ok(intro.includes('MAX FLIX'), 'intro must use the final game title');
  assert.ok(intro.includes('CRIMSON SHIFT'), 'intro must use the final menu theme');
  assert.ok(!intro.includes('Warehouse MaDDnes') && !intro.includes('<h1>WAREHOUSE</h1>'), 'obsolete intro branding must be removed');
  assert.ok(intro.includes('private readonly duration = 11.8'), 'cinematic timing must remain stable');
  assert.ok(html.includes('loader-header">MAX FLIX <span>22</span>'), 'loader must use MAX FLIX 22 branding');
});
