import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, css] = await Promise.all([
  read('index.html'),
  read('src/menu-system-v2.css'),
]);

test('main menu exposes all twelve destinations through four named navigation groups', () => {
  const navStart = html.indexOf('<div class="menu-tabs-bar">');
  const contentStart = html.indexOf('<div class="menu-tab-content-area">', navStart);
  assert.ok(navStart >= 0 && contentStart > navStart);
  const nav = html.slice(navStart, contentStart);
  const groupIds = [...nav.matchAll(/<div class="menu-nav-group" data-menu-group="([^"]+)" role="group" aria-label="([^"]+)">([\s\S]*?)<\/div>/g)];
  assert.deepEqual(groupIds.map((match) => match[1]), ['play', 'world', 'progress', 'system']);
  assert.deepEqual(groupIds.map((match) => match[2]), ['ROZGRYWKA', 'ŚWIAT I BHP', 'POSTĘPY', 'SYSTEM']);
  const tabIds = groupIds.flatMap((match) => [...match[3].matchAll(/data-tab="(tab-[^"]+)"/g)].map((item) => item[1]));
  assert.equal(tabIds.length, 12);
  assert.equal(new Set(tabIds).size, 12);
  assert.deepEqual(tabIds, [
    'tab-team', 'tab-map', 'tab-pvp',
    'tab-enemies', 'tab-arsenal', 'tab-perks', 'tab-field-guide',
    'tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements',
    'tab-settings',
  ]);
});

test('the three game modes stay in a dedicated launcher, separate from section navigation', () => {
  const modeStart = html.indexOf('<section class="menu-mode-selector"');
  const modeEnd = html.indexOf('</section>', modeStart);
  const navStart = html.indexOf('<div class="menu-tabs-bar"');
  assert.ok(modeStart >= 0 && modeEnd > modeStart && navStart > modeEnd);
  const modeSelector = html.slice(modeStart, modeEnd);
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp']) {
    assert.equal((modeSelector.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
  }
  assert.match(css, /\.menu-mode-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test('desktop uses a fixed left navigation rail and an independent content viewport', () => {
  assert.match(css, /grid-template-areas:[\s\S]*?"header header"[\s\S]*?"modes modes"[\s\S]*?"navigation content"/);
  assert.match(css, /\.menu-tabs-bar\s*\{[\s\S]*?overflow-y:\s*auto !important/);
  assert.match(css, /\.menu-tab-content-area\s*\{[\s\S]*?overflow-y:\s*auto !important/);
  assert.match(css, /\.menu-tab-content-area\s*\{[\s\S]*?overflow-x:\s*hidden !important/);
});

test('all screen sizes use one always-visible vertical sidebar with a selected category marker', async () => {
  const app = await read('src/index.ts');
  const repair = await read('src/menu-single-sidebar-repair.css');
  assert.doesNotMatch(app, /mobileMenuSegmentQuery|desktopMenuNavigationQuery/);
  assert.match(app, /group\.hidden = false/);
  assert.match(app, /group\.inert = false/);
  assert.match(app, /group\.dataset\.activeGroup = String\(group\.dataset\.menuGroup === groupId\)/);
  assert.match(app, /menuTabList\?\.setAttribute\('role', 'tablist'\)/);
  assert.match(app, /menuTabList\?\.setAttribute\('aria-orientation', 'vertical'\)/);
  assert.doesNotMatch(app, /group\.setAttribute\('role', 'tablist'\)/);
  assert.match(repair, /#title-screen \.menu-tabs-bar\s*\{[\s\S]*?flex-direction: column !important/);
  assert.doesNotMatch(html, /menu-mobile-segment/);
  assert.doesNotMatch(repair, /menu-mobile-segment|menu-nav-group\\[hidden\\]/);
  assert.match(repair, /grid-template-columns: clamp\(122px, 31vw, 188px\) minmax\(0, 1fr\)/);
});

test('all navigation controls map to a real panel and are explicit non-submit buttons', () => {
  const navStart = html.indexOf('<div class="menu-tabs-bar"');
  const contentStart = html.indexOf('<div class="menu-tab-content-area">', navStart);
  const nav = html.slice(navStart, contentStart);
  const buttons = [...nav.matchAll(/<button\b([^>]*)data-tab="(tab-[^"]+)"([^>]*)>/g)];
  const panels = [...html.slice(contentStart).matchAll(/<div id="(tab-(?:team|map|pvp|enemies|arsenal|perks|field-guide|talent-tree|ranks|leaderboard|achievements|settings))" class="tab-panel[^"]*"/g)].map((m) => m[1]);
  assert.equal(buttons.length, 12);
  assert.ok(buttons.every((match) => /type="button"/.test(match[1] + match[3])));
  assert.ok(buttons.every((match) => /aria-controls="tab-[^"]+"/.test(match[1] + match[3])));
  assert.deepEqual(new Set(buttons.map((match) => match[2])), new Set(panels));
});


test('Field Manual has a complete responsive card system for its four section widths', async () => {
  const [html, css] = await Promise.all([
    read('index.html'),
    read('src/menu-system-v2.css'),
  ]);
  const start = html.indexOf('<div id="tab-field-guide"');
  const end = html.indexOf('<div id="tab-leaderboard"', start);
  assert.ok(start >= 0 && end > start);
  const guide = html.slice(start, end);
  assert.match(guide, /class="field-guide-card-grid three-col"/);
  assert.match(guide, /class="field-guide-card-grid four-col"/);
  assert.match(guide, /class="field-guide-card-grid two-col"/);
  for (const selector of [
    '#title-screen #tab-field-guide .field-guide-hero',
    '#title-screen #tab-field-guide .field-guide-metrics',
    '#title-screen #tab-field-guide .field-guide-section',
    '#title-screen #tab-field-guide .field-guide-card-grid.three-col',
    '#title-screen #tab-field-guide .field-guide-card-grid.four-col',
    '#title-screen #tab-field-guide .field-guide-card-grid.two-col',
    '#title-screen #tab-field-guide .field-guide-controls',
  ]) {
    assert.ok(css.includes(selector), 'missing Field Manual layout rule: ' + selector);
  }
  assert.match(guide, /<div><strong>7<\/strong><span>eventów<\/span><\/div>/);
  assert.match(guide, /WYDARZENIA MAGAZYNOWE • 7 SCENARIUSZY/);
});

test('global leaderboard uses the menu content viewport instead of a nested vertical scroller', () => {
  assert.match(css, /#title-screen #tab-leaderboard \.leaderboard-list\s*\{[\s\S]*?max-height:\s*none !important;[\s\S]*?overflow:\s*visible !important/);
});

test('coarse-pointer devices wider than 900 CSS pixels retain the desktop menu geometry', () => {
  assert.match(css, /@media \(max-width: 900px\) \{/);
  assert.doesNotMatch(css, /@media \(pointer: coarse\)\s*\{/);
});


test('ARIA orientation stays vertical at desktop, tablet and phone widths', async () => {
  const app = await read('src/index.ts');
  assert.match(app, /menuTabList\?\.setAttribute\('role', 'tablist'\)/);
  assert.match(app, /menuTabList\?\.setAttribute\('aria-orientation', 'vertical'\)/);
  assert.match(app, /getMenuTabIndexForKey\(event\.key, currentNavigationIndex, navigationTabs\.length, 'vertical'\)/);
  assert.doesNotMatch(app, /desktopMenuNavigationQuery|mobileMenuSegmentQuery/);
});

test('perk catalogue places its description below the structured card header', async () => {
  const [html, css] = await Promise.all([
    read('index.html'),
    read('src/menu-system-v2.css'),
  ]);
  const start = html.indexOf('<div id="tab-perks"');
  const end = html.indexOf('<div id="tab-field-guide"', start);
  assert.ok(start >= 0 && end > start);
  const panel = html.slice(start, end);
  assert.equal((panel.match(/class="perk-card"/g) || []).length, 15);
  assert.match(panel, /class="perk-card-top"[\s\S]*?class="perk-card-desc"/);
  assert.match(css, /#title-screen #tab-perks \.perk-card\s*\{[\s\S]*?grid-template-rows:\s*auto auto !important/);
  assert.match(css, /#title-screen #tab-perks \.perk-card-top\s*\{[\s\S]*?grid-template-columns:\s*38px minmax\(0, 1fr\) auto !important/);
  assert.match(css, /#title-screen #tab-perks \.perk-card-desc\s*\{[\s\S]*?grid-column:\s*1 \/ -1 !important/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?#title-screen #tab-perks \.perk-card-top/);
});


test('enemy dossier exposes twenty entries in a responsive two-column desktop grid', async () => {
  const [html, css] = await Promise.all([
    read('index.html'),
    read('src/menu-system-v2.css'),
  ]);
  const start = html.indexOf('<div id="tab-enemies"');
  const end = html.indexOf('<div id="tab-perks"', start);
  assert.ok(start >= 0 && end > start);
  const panel = html.slice(start, end);
  assert.equal((panel.match(/class="enemy-guide-card/g) || []).length, 20);
  assert.match(panel, /class="enemy-guide-directory-heading"[\s\S]*?<span>20<\/span> POZYCJI/);
  assert.match(css, /#title-screen #tab-enemies \.enemies-guide-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /#title-screen #tab-enemies \.enemy-guide-card\s*\{[\s\S]*?grid-template-rows:\s*auto auto !important/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?#title-screen #tab-enemies \.enemies-guide-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});
