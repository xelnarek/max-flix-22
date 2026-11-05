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

test('all seven menu destinations remain available as buttons and panels', () => {
  const buttons = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/id="(tab-(?:team|enemies|perks|field-guide|leaderboard|achievements|settings))"/g)].map((match) => match[1]);
  assert.equal(buttons.length, 7);
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
