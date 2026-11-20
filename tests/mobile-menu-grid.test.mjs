import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const [html, css, rosterCss] = await Promise.all([
  read('index.html'),
  read('src/mobile-menu-grid.css'),
  read('src/operator-roster-v2.css'),
]);

test('mobile menu keeps all twelve destinations in one vertical sidebar with readable touch targets', async () => {
  const tabs = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)];
  assert.equal(tabs.length, 12);
  const repair = await read('src/menu-single-sidebar-repair.css');
  assert.match(repair, /#title-screen \.menu-tabs-bar\s*\{[\s\S]*?flex-direction: column !important/);
  assert.match(repair, /#title-screen \.menu-tabs-bar\s*\{[\s\S]*?overflow-y: auto !important/);
  assert.match(repair, /@media \(max-width: 900px\)[\s\S]*grid-template-columns: clamp\(122px, 31vw, 188px\)/);
  assert.doesNotMatch(html, /menu-mobile-segment/);
  assert.doesNotMatch(repair, /menu-mobile-segment|menu-nav-group\[hidden\]/);
  assert.match(repair, /min-height: 42px !important/);
  assert.match(repair, /font-size: clamp\(7\.8px, 2\.1vw, 9px\) !important/);
  assert.match(repair, /\.menu-nav-group\[data-active-group="true"\]/);
  assert.doesNotMatch(repair, /#title-screen \.menu-tabs-bar\s*\{[^}]*overflow-x: auto !important/);
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
  assert.match(rosterFix, /#title-screen #tab-team \.char-grid\s*\{[\s\S]*?display: grid !important/);
  assert.match(rosterFix, /#char-details-box[\s\S]*?width: 100% !important/);
});

test('one tab activates one panel while every sidebar category remains accessible', async () => {
  const app = await read('src/index.ts');
  assert.match(app, /menuTabList\?\.setAttribute\('role', 'navigation'\)/);
  assert.match(app, /group\.hidden = false/);
  assert.match(app, /group\.inert = false/);
  assert.match(app, /menuTabList\?\.setAttribute\('role', 'tablist'\)/);
  assert.match(app, /menuTabList\?\.setAttribute\('aria-orientation', 'vertical'\)/);
  assert.doesNotMatch(app, /group\.setAttribute\('role', 'tablist'\)/);
  assert.match(app, /button\.setAttribute\('role', 'tab'\)/);
  assert.match(app, /button\.setAttribute\('aria-selected', String\(active\)\)/);
  assert.match(app, /panel\.classList\.toggle\('active', active\)/);
  assert.match(app, /panel\.setAttribute\('aria-hidden', String\(!active\)\)/);
  assert.match(app, /panel\.inert = !active/);
  assert.match(app, /getMenuTabIndexForKey\(event\.key, currentNavigationIndex, navigationTabs\.length, 'vertical'\)/);
  assert.doesNotMatch(app, /desktopMenuNavigationQuery|mobileMenuSegmentQuery/);
  assert.match(app, /new MenuScrollMemory\(\)/);
  assert.match(app, /menuScrollMemory\.save\(currentMenuTargetId, menuContentArea\.scrollTop\)/);
  assert.match(app, /menuScrollMemory\.restore\(targetId\)/);
});

test('the three mobile launch modes use compact, equal-width cards', async () => {
  const premium = await read('src/menu-premium-refresh.css');
  assert.match(premium, /\.menu-mode-grid\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/);
  assert.match(premium, /#title-screen \.menu-mode-card,[\s\S]*?grid-template-rows: 28px auto auto !important/);
  assert.match(premium, /#title-screen \.menu-mode-card-copy small\s*\{\s*display: none !important/);
  assert.match(premium, /#title-screen #btn-start-survival\.menu-mode-card/);
  assert.match(premium, /min-height: 88px !important/);
});
