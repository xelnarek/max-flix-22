import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Warehouse MaDDnes final menu layer is loaded last and uses the matching browser theme', async () => {
  const html = await read('../index.html');
  const cssLink = html.lastIndexOf('/src/warehouse-maddnes-unified-menu.css');
  const appCssLinks = [...html.matchAll(/<link rel="stylesheet"/g)];
  assert.ok(cssLink >= 0, 'unified menu stylesheet must be loaded');
  assert.ok(cssLink > html.indexOf('/src/menu-final-tuning.css'), 'unified layer must follow prior menu styles');
  assert.match(html, /<meta name="theme-color" content="#101716"\s*\/>/);
  assert.ok(appCssLinks.length >= 20, 'existing game stylesheet stack must remain intact');
});

test('touch menu geometry compensates for global zoom and Android safe areas', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  assert.match(finalPass, /100dvh[\s\S]{0,180}var\(--ui-scale\)/);
  assert.match(finalPass, /env\(safe-area-inset-top\)/);
  assert.match(finalPass, /grid-template-rows: auto auto auto minmax\(0, 1fr\)/);
  assert.match(finalPass, /overflow: hidden !important/);
});

test('three game modes fit one compact row on touch screens without hiding their actions', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  assert.match(finalPass, /grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(finalPass, /min-height: 72px/);
  assert.match(finalPass, /menu-mode-card-copy strong/);
  assert.match(finalPass, /data-mode="pvp"/);
});

test('all four grouped navigation sections remain visible with readable touch targets', async () => {
  const html = await read('../index.html');
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  for (const group of ['ROZGRYWKA', 'ŚWIAT I BHP', 'POSTĘPY', 'SYSTEM']) {
    assert.ok(html.includes(`aria-label="${group}"`), `missing navigation group: ${group}`);
  }
  assert.match(finalPass, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(finalPass, /min-height: 40px/);
  assert.match(finalPass, /font-size: clamp\(9px,2\.15vw,10px\)/);
});

test('only the active menu content panel owns vertical scrolling on touch devices', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  assert.match(finalPass, /menu-tab-content-area[\s\S]{0,650}overflow-y: auto/);
  assert.match(finalPass, /menu-tab-content-area[\s\S]{0,650}overscroll-behavior-y: contain/);
  assert.match(finalPass, /menu-tabs-bar[\s\S]{0,600}overflow: visible/);
});

test('operator cards stay compact and their detail panel is preserved', async () => {
  const html = await read('../index.html');
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  assert.match(html, /id="char-details-box"/);
  assert.match(finalPass, /#title-screen #tab-team > \.char-grid > \.char-card/);
  assert.match(finalPass, /char-showcase-portrait/);
  assert.match(finalPass, /char-card-ability \{ display: none !important; \}/);
});

test('mobile dialogs and the loading screen remain inside the visible viewport', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  assert.match(finalPass, /loader-modal-card\.loader-maddnes-card[\s\S]{0,800}max-height: calc\(100dvh/);
  assert.match(finalPass, /game-modal > \.modal-card[\s\S]{0,800}overflow-y: auto/);
  assert.match(finalPass, /min-height: 44px/);
});

test('reduced-motion preferences are respected by the final layer', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('RESPONSIVE ACCEPTANCE PASS'));
  assert.match(finalPass, /prefers-reduced-motion:\s*reduce/);
  assert.match(finalPass, /transition: none !important/);
});


test('all menu segments receive the unified card and grid treatment', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('SEGMENT FINISH'));
  const required = [
    '.combat-guide-banner',
    '.enemies-guide-grid',
    '.perk-shop-grid',
    '.field-guide-card-grid',
    '.account-tree-grid',
    '.character-talent-grid',
    '.survival-achievement-grid',
    '.campaign-stage-grid',
    '.mega-map-biome-grid',
    '.mega-map-route-grid',
    '.leaderboard-item',
    '.audio-slider-row',
  ];
  for (const selector of required) {
    assert.ok(finalPass.includes(selector), 'missing segment polish: ' + selector);
  }
});

test('segment card grids protect long copy and avoid fixed-width overflow', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('SEGMENT FINISH'));
  assert.match(finalPass, /grid-template-columns: repeat\(auto-fit,minmax\(min\(100%,220px\),1fr\)\)/);
  assert.match(finalPass, /overflow-wrap: anywhere/);
  assert.match(finalPass, /min-width: 0 !important/);
  assert.match(finalPass, /max-width: 100% !important/);
});

test('perk activation keeps a minimum touch target and adapts to phone and tablet layouts', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('SEGMENT FINISH'));
  assert.match(finalPass, /min-height: 38px/);
  assert.match(finalPass, /@media \(max-width: 640px\), \(pointer: coarse\)/);
  assert.match(finalPass, /@media \(min-width: 641px\) and \(max-width: 900px\) and \(pointer: coarse\)/);
  assert.match(finalPass, /min-height: 42px/);
});

test('settings audio sliders keep labels, range controls and values aligned on touch screens', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('SEGMENT FINISH'));
  assert.match(finalPass, /audio-slider-row[\s\S]{0,450}grid-template-columns/);
  assert.match(finalPass, /audio-slider-row input\[type="range"\]/);
  assert.match(finalPass, /audio-slider-row output/);
  assert.match(finalPass, /touch-action: pan-x/);
});

test('account progression, rank and leaderboard data remain in bounded responsive cards', async () => {
  const css = await read('../src/warehouse-maddnes-unified-menu.css');
  const finalPass = css.slice(css.lastIndexOf('SEGMENT FINISH'));
  assert.match(finalPass, /account-progression-summary/);
  assert.match(finalPass, /account-rank-track > \*/);
  assert.match(finalPass, /leaderboard-item[\s\S]{0,260}grid-template-columns/);
  assert.match(finalPass, /account-cloud-sync-row[\s\S]{0,220}flex-wrap: wrap/);
});
