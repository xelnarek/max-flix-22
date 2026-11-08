import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, layout] = await Promise.all([
  read('index.html'),
  read('src/menu-layout-fixes.css'),
]);

test('the desktop menu is a control room with a left navigation rail and independent content panel', () => {
  assert.match(layout, /@media \(min-width: 761px\) and \(pointer: fine\)[\s\S]*?grid-template-columns:\s*clamp\(172px, 17vw, 206px\) minmax\(0, 1fr\)/);
  assert.match(layout, /\.menu-tabs-bar\s*\{[\s\S]*?flex-direction:\s*column !important/);
  assert.match(layout, /\.menu-tab-content-area\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(layout, /\.menu-map-picker-frame\s*\{[\s\S]*?grid-row:\s*3/);
  assert.match(layout, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?grid-row:\s*4/);
});

test('all nine menu destinations remain available as buttons and panels', () => {
  const buttons = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/id="(tab-(?:team|enemies|perks|field-guide|talent-tree|ranks|leaderboard|achievements|settings))"/g)].map((match) => match[1]);
  assert.equal(buttons.length, 9);
  assert.deepEqual(new Set(buttons), new Set(panels));
  assert.match(layout, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});

test('the active content panel scrolls independently while the map selector and launch remain in normal flow', () => {
  assert.match(layout, /\.menu-tab-content-area\s*\{[\s\S]*?overflow-y:\s*auto !important/);
  assert.match(layout, /\.title-sheet\s*\{[\s\S]*?overflow:\s*hidden !important/);
  assert.match(layout, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?position:\s*static !important/);
  const picker = html.indexOf('<section id="survival-map-picker"');
  const launch = html.indexOf('<div class="menu-fixed-bottom-bar">', picker);
  assert.ok(picker >= 0 && launch > picker);
});


test('menu tabs expose tab semantics and runtime keyboard navigation without duplicate touch handlers', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const navigation = await readFile(new URL('../src/menuTabNavigation.ts', import.meta.url), 'utf8');
  assert.match(app, /setAttribute\('role', 'tablist'\)/);
  assert.match(app, /setAttribute\('role', 'tab'\)/);
  assert.match(app, /setAttribute\('aria-selected', String\(active\)\)/);
  assert.match(app, /setAttribute\('role', 'tabpanel'\)/);
  assert.match(app, /getMenuTabIndexForKey\(event\.key, index, menuTabButtons\.length\)/);
  assert.doesNotMatch(app.slice(app.indexOf('const menuTabButtons'), app.indexOf("document.querySelectorAll<HTMLElement>('.char-card')")), /addEventListener\('touchend'/);
  assert.match(navigation, /ArrowRight/);
  assert.match(navigation, /ArrowLeft/);
  assert.match(navigation, /Home/);
  assert.match(navigation, /End/);
});

test('selected Survival arena is restored from browser storage and persisted after manual selection', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const preference = await readFile(new URL('../src/survivalMapPreference.ts', import.meta.url), 'utf8');
  assert.match(app, /readSurvivalMapPreference\(window\.localStorage\)/);
  assert.match(app, /writeSurvivalMapPreference\(window\.localStorage, selectedSurvivalMapId\)/);
  assert.match(app, /applySurvivalMapChoice\(selectedSurvivalMapId \|\| 'random', false\)/);
  assert.match(preference, /paleciaki\.menu\.survivalMap\.v1/);
});
