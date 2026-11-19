import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, app, css] = await Promise.all([
  read('index.html'),
  read('src/index.ts'),
  read('src/menu-single-sidebar-repair.css'),
]);

test('single-sidebar repair is the final menu layout layer', () => {
  assert.ok(
    html.indexOf('/src/menu-single-sidebar-repair.css') > html.indexOf('/src/crimson-shift-mobile-layout-v3.css'),
    'single-sidebar repair must load after all legacy menu layers',
  );
  assert.match(css, /grid-template-areas:[\s\S]*"header header"[\s\S]*"modes modes"[\s\S]*"navigation content"/);
  assert.match(css, /\.menu-tabs-bar\s*\{[\s\S]*flex-direction:\s*column !important/);
  assert.match(css, /\.menu-mobile-segments\s*\{\s*display:\s*none !important/);
});

test('all eleven destinations stay in one vertical navigation rail', () => {
  const buttons = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)];
  assert.equal(buttons.length, 11, 'all original destinations must remain available');
  assert.match(app, /group\.hidden = false;/);
  assert.match(app, /group\.inert = false;/);
  assert.match(app, /getMenuTabIndexForKey\(event\.key, currentNavigationIndex, navigationTabs\.length, 'vertical'\)/);
  assert.doesNotMatch(app, /mobileMenuSegmentQuery\.matches\s*\?/);
});

test('exactly one destination panel is active and inactive panels are hidden', () => {
  assert.match(app, /panel\.classList\.toggle\('active', active\)/);
  assert.match(app, /panel\.inert = !active/);
  assert.match(css, /\.tab-panel:not\(\.active\)\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.tab-panel\.active\s*\{\s*display:\s*flex !important/);
});

test('operator portraits and details have bounded non-overlapping geometry', () => {
  assert.match(css, /\.char-card\s*\{[\s\S]*grid-template-areas:[\s\S]*"portrait code mastery"[\s\S]*"portrait name name"/);
  assert.match(css, /\.char-card-badge\.operator-emblem\s*\{[\s\S]*position:\s*relative !important/);
  assert.match(css, /\.char-card-badge\.operator-emblem :is\(svg, img, \.operator-portrait\)\s*\{[\s\S]*position:\s*static !important/);
  assert.match(css, /\.char-card-mastery\s*\{[\s\S]*position:\s*static !important/);
  assert.match(css, /#char-details-box[\s\S]*overflow:\s*visible !important/);
});


test('the selected category is indicated without hiding other sidebar groups', () => {
  assert.match(app, /group\.dataset\.activeGroup = String\(group\.dataset\.menuGroup === segment\.id\)/);
  assert.match(app, /group\.hidden = false;/);
  assert.match(css, /\.menu-nav-group\[data-active-group="true"\]/);
  assert.match(css, /\.menu-nav-group\[data-active-group="true"\] \.menu-nav-group-label::before/);
});

test('mobile navigation has readable touch targets and narrow content grids remain legible', () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*grid-template-columns: clamp\(122px, 31vw, 188px\)/);
  assert.match(css, /\.menu-tab-btn\s*\{[\s\S]*min-height: 42px !important/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.enemies-guide-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(css, /\.char-detail-view-btn\s*\{[\s\S]*min-height: 34px !important/);
});
