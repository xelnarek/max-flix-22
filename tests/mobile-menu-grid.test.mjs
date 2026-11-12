import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const [html, css, rosterCss] = await Promise.all([
  read('index.html'),
  read('src/mobile-menu-grid.css'),
  read('src/operator-roster-v2.css'),
]);

test('mobile menu exposes all eleven destinations in an adaptive grid without horizontal swiping', () => {
  assert.match(html, /href="\/src\/mobile-menu-grid\.css"/);
  const tabs = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)];
  assert.equal(tabs.length, 11);
  assert.match(css, /@media \(max-width: 760px\), \(pointer: coarse\)/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 92px\), 1fr\)\) !important/);
  assert.match(css, /overflow-x: visible !important/);
  assert.match(css, /scroll-snap-type: none !important/);
  assert.doesNotMatch(css, /overflow-x:\s*auto !important/);
});

test('touch menu segments scale their hit area, icon and labels together', () => {
  assert.match(css, /min-height: clamp\(48px, 11\.5vw, 56px\) !important/);
  assert.match(css, /font-size: clamp\(7\.5px, 2\.1vw, 9\.25px\) !important/);
  assert.match(css, /\.menu-tab-btn\.active[\s\S]*?var\(--menu-accent\)/);
  assert.match(css, /:focus-visible[\s\S]*?outline: 2px solid var\(--menu-accent\)/);
  assert.match(css, /border-radius: 11px !important/);
});

test('operator roster uses a fresh, bounded two-column mobile grid instead of a horizontal rail', () => {
  assert.match(html, /href="\/src\/operator-roster-v2\.css"/);
  const mobileCssIndex = html.indexOf('href="/src/mobile-menu-grid.css"');
  const rosterCssIndex = html.indexOf('href="/src/operator-roster-v2.css"');
  assert.ok(rosterCssIndex > mobileCssIndex, 'roster overrides must load after legacy menu styles');
  assert.match(rosterCss, /#title-screen #tab-team > \.char-grid\s*\{/);
  assert.match(rosterCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(rosterCss, /grid-auto-flow: row !important/);
  assert.match(rosterCss, /grid-auto-rows: var\(--operator-card-height\) !important/);
  assert.match(rosterCss, /height: var\(--operator-card-height\) !important/);
  assert.match(rosterCss, /max-height: var\(--operator-card-height\) !important/);
  assert.match(rosterCss, /overflow-x: visible !important/);
  assert.doesNotMatch(rosterCss, /overflow-x:\s*auto !important/);
});

test('operator cards stay compact, readable and keep mastery labels from stretching the card', () => {
  assert.match(rosterCss, /\.char-code-tag[\s\S]*?white-space: nowrap !important/);
  assert.match(rosterCss, /\.char-card-ability[\s\S]*?-webkit-line-clamp: 2 !important/);
  assert.match(rosterCss, /\.char-card-model-label[\s\S]*?-webkit-line-clamp: 2 !important/);
  assert.match(rosterCss, /\.char-card-mastery\s*\{[\s\S]*?position: absolute !important/);
  assert.match(rosterCss, /#char-details-box[\s\S]*?width: 100% !important/);
});

test('operator cards adapt to tablet, landscape and narrow portrait layouts', () => {
  assert.match(rosterCss, /@media \(min-width: 641px\) and \(max-width: 760px\) and \(pointer: coarse\)/);
  assert.match(rosterCss, /@media \(max-height: 560px\) and \(orientation: landscape\) and \(pointer: coarse\)/);
  assert.match(rosterCss, /@media \(max-width: 360px\) and \(orientation: portrait\)/);
});

test('existing roster repair keeps the operator profile after the card grid', () => {
  const rosterFix = css.slice(css.indexOf('/* OPERATOR ROSTER REPAIR'));
  assert.match(rosterFix, /#title-screen #tab-team \.char-grid,[\s\S]*?display: grid !important/);
  assert.match(rosterFix, /#char-details-box[\s\S]*?width: 100% !important/);
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
