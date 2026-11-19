import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, css, app, intro] = await Promise.all([
  read('index.html'),
  read('src/menu-final-tuning.css'),
  read('src/index.ts'),
  read('src/cinematicIntro.ts'),
]);

test('final menu tuning is the last stylesheet and wins over earlier mobile overrides', () => {
  const art = html.indexOf('/src/menu-art-direction-v3.css');
  const finalLayer = html.indexOf('/src/menu-final-tuning.css');
  assert.ok(art >= 0 && finalLayer > art);
  assert.equal(html.split('/src/menu-final-tuning.css').length - 1, 1);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(css, /\.menu-mode-card\[data-mode="pvp"\][\s\S]*?grid-column: 1 \/ -1/);
  assert.match(css, /\.menu-tabs-bar[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('the main menu keeps one active, accessible section in a bounded content viewport', () => {
  assert.match(css, /\.menu-tab-content-area[\s\S]*?overflow-y: auto !important/);
  assert.match(css, /\.tab-panel\[aria-hidden="true"\][\s\S]*?display: none !important/);
  assert.match(app, /panel\.inert = !active/);
  assert.match(app, /panel\.setAttribute\('aria-hidden', String\(!active\)\)/);
  assert.match(html, /data-menu-density="compact"/);
  assert.equal((html.match(/data-tab="tab-[^"]+"/g) || []).length, 11);
  for (const id of ['tab-team','tab-map','tab-pvp','tab-enemies','tab-perks','tab-field-guide','tab-talent-tree','tab-ranks','tab-leaderboard','tab-achievements','tab-settings']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing destination panel: ' + id);
  }
});

test('phone layout keeps five compact operators and moves detail below the roster', () => {
  assert.match(css, /#title-screen #tab-team > \.char-grid[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /#title-screen #tab-team #char-details-box[\s\S]*?height: auto !important/);
  assert.match(css, /operator-emblem[\s\S]*?max-width: 30px !important/);
});

test('loader and intro remain viewport-bounded, safe-area-aware and reduced-motion friendly', () => {
  assert.match(css, /\.loader-modal-card[\s\S]*?max-height: calc\(100dvh/);
  assert.match(css, /\.cinematic-intro-overlay[\s\S]*?height: 100dvh/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(intro, /prefers-reduced-motion: reduce/);
});
