import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const [html, css] = await Promise.all([
  read('index.html'),
  read('src/mobile-menu-grid.css'),
]);

test('mobile menu exposes all eleven destinations as a visible grid without horizontal swiping', () => {
  assert.match(html, /href="\/src\/mobile-menu-grid\.css"/);
  const tabs = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)];
  assert.equal(tabs.length, 11);
  assert.match(css, /@media \(max-width: 760px\), \(pointer: coarse\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/);
  assert.match(css, /overflow-x: visible !important/);
  assert.match(css, /scroll-snap-type: none !important/);
  assert.doesNotMatch(css, /overflow-x: auto !important/);
});

test('operator cards stay in a readable two-column grid on phone screens', () => {
  assert.match(css, /#title-screen #tab-team \.char-grid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(css, /#title-screen #tab-team \.char-card\s*\{[\s\S]*?min-height: 144px !important/);
});

test('short landscape phones use a compact six-column menu with no carousel rules', () => {
  assert.match(css, /@media \(max-height: 560px\) and \(orientation: landscape\) and \(pointer: coarse\)/);
  assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\) !important/);
  assert.match(css, /min-height: 29px !important/);
});

test('phone layout presents all menu panels together and turns navigation tiles into section shortcuts', async () => {
  const app = await read('src/index.ts');
  assert.match(app, /window\.matchMedia\('\(max-width: 760px\), \(pointer: coarse\)'\)/);
  assert.match(app, /classList\.toggle\('mobile-menu-overview', overview\)/);
  assert.match(app, /panel\.classList\.toggle\('active', overview \|\| active\)/);
  assert.match(app, /panel\.setAttribute\('aria-hidden', 'false'\)/);
  assert.match(app, /panel\.inert = false/);
  assert.match(app, /getElementById\(targetId\)\?\.scrollIntoView/);
  assert.match(css, /#title-screen\.mobile-menu-overview \.tab-panel\[aria-hidden="true"\]\s*\{[\s\S]*?display: flex !important/);
  for (const section of ['tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks', 'tab-field-guide', 'tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements', 'tab-settings']) {
    assert.ok(css.includes('#title-screen.mobile-menu-overview #' + section + '::before'), 'missing section heading ' + section);
  }
});
