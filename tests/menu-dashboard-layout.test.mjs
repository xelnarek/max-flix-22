import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, layout, premium] = await Promise.all([
  read('index.html'),
  read('src/menu-layout-fixes.css'),
  read('src/menu-premium-refresh.css'),
]);

test('the desktop menu is a control room with a left navigation rail and independent content panel', () => {
  assert.match(layout, /@media \(min-width: 761px\) and \(pointer: fine\)[\s\S]*?grid-template-columns:\s*clamp\(172px, 17vw, 206px\) minmax\(0, 1fr\)/);
  assert.match(layout, /\.menu-tabs-bar\s*\{[\s\S]*?flex-direction:\s*column !important/);
  assert.match(layout, /\.menu-tab-content-area\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(premium, /grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto !important/);
  assert.match(premium, /\.menu-mode-selector\s*\{[\s\S]*?grid-column:\s*1 \/ -1 !important;[\s\S]*?grid-row:\s*2 !important/);
  assert.match(premium, /\.menu-tabs-bar\s*\{[\s\S]*?grid-column:\s*1 !important;[\s\S]*?grid-row:\s*3 !important/);
  assert.match(premium, /\.menu-tab-content-area\s*\{[\s\S]*?grid-column:\s*2 !important;[\s\S]*?grid-row:\s*3 !important/);
  assert.match(premium, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?grid-row:\s*4 !important/);
});

test('all eleven menu destinations remain available as buttons and panels', () => {
  const buttons = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/id="(tab-(?:team|map|pvp|enemies|perks|field-guide|talent-tree|ranks|leaderboard|achievements|settings))"/g)].map((match) => match[1]);
  assert.equal(buttons.length, 11);
  assert.deepEqual(new Set(buttons), new Set(panels));
  assert.match(layout, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test('the active atlas tab owns its content and the shared launch action remains below it', () => {
  assert.match(layout, /\.menu-tab-content-area\s*\{[\s\S]*?overflow-y:\s*auto !important/);
  assert.match(layout, /\.title-sheet\s*\{[\s\S]*?overflow:\s*hidden !important/);
  assert.match(layout, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?position:\s*static !important/);
  const mapPanel = html.indexOf('<div id="tab-map" class="tab-panel world-atlas-panel"');
  const content = html.indexOf('<div class="menu-tab-content-area">');
  const launch = html.indexOf('<div class="menu-fixed-bottom-bar">', mapPanel);
  assert.ok(content >= 0 && mapPanel > content && launch > mapPanel);
  assert.match(html, /data-tab="tab-map"/);
  assert.match(html, /ATLAS ŚWIATA/);
  assert.match(html, /JEDEN ŚWIAT\. CZTERY BIOMY\./);
  assert.doesNotMatch(html, /id="survival-map-picker"|data-survival-map=/);
  for (const biome of ['MAGAZYN B4', 'PORT KONTENEROWY 17', 'CHŁODNIA ZERO', 'SORTOWNIA WIDMOWA']) {
    assert.ok(html.includes(biome), 'missing atlas biome: ' + biome);
  }
});


test('left navigation uses native destination buttons, one active region and vertical keyboard shortcuts', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const navigation = await readFile(new URL('../src/menuTabNavigation.ts', import.meta.url), 'utf8');
  assert.ok(app.includes("menuTabList?.setAttribute('role', 'navigation')"));
  assert.ok(app.includes("group.setAttribute('role', 'group')"));
  assert.ok(app.includes("button.setAttribute('aria-current', 'page')"));
  assert.ok(app.includes("panel.setAttribute('role', 'region')"));
  assert.ok(app.includes("panel.inert = !active"));
  assert.ok(app.includes("getMenuTabIndexForKey(event.key, currentNavigationIndex, navigationTabs.length, 'vertical')"));
  assert.ok(app.includes("const navigationTabs = menuTabButtons"));
  assert.doesNotMatch(app, /setAttribute\('role', 'tab'\)|setAttribute\('role', 'tabpanel'\)|aria-selected/);
  assert.doesNotMatch(app, /menuMobileSegmentButtons|activeMobileSegmentId|setActiveMobileSegment/);
  assert.doesNotMatch(app, /addEventListener\('touchend'/);
  assert.ok(navigation.includes("ArrowDown"));
  assert.ok(navigation.includes("ArrowUp"));
  assert.ok(navigation.includes("Home"));
  assert.ok(navigation.includes("End"));
});

test('the menu no longer persists a selected Survival arena', async () => {
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /selectedSurvivalMapId|readSurvivalMapPreference|writeSurvivalMapPreference/);
  assert.match(app, /this\.engine\.startSurvival\(\)/);
  assert.doesNotMatch(html, /data-survival-map=|id="survival-map-picker"/);
});
