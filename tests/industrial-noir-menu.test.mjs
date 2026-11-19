import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, intro] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/industrial-noir-menu.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/cinematicIntro.ts', import.meta.url), 'utf8'),
]);

test('Industrial Noir is the final visual layer without replacing gameplay menu structure', () => {
  assert.match(html, /industrial-noir-menu\.css/);
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp', 'tab-team', 'tab-map', 'tab-settings']) {
    assert.ok(html.includes(id), 'existing menu destination must remain: ' + id);
  }
  for (const selector of ['#title-screen .menu-mode-grid', '#title-screen .menu-tabs-bar', '#title-screen .menu-tab-content-area', '.asset-loader-overlay', '.cinematic-intro-overlay']) {
    assert.ok(css.includes(selector), 'missing Industrial Noir treatment: ' + selector);
  }
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(intro, /INDUSTRIAL NOIR/);
  assert.match(intro, /private readonly duration = 11\.8/);
});
