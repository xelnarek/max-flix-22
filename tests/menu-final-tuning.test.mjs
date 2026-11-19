import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const [html, css] = await Promise.all([
  read('index.html'),
  read('src/menu-final-tuning.css'),
]);

test('final menu polish is loaded last and preserves the three launch actions', () => {
  assert.ok(html.indexOf('/src/menu-final-tuning.css') > html.indexOf('/src/menu-art-direction-v3.css'));
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp']) assert.ok(html.includes('id="' + id + '"'));
  for (const id of ['tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks', 'tab-field-guide', 'tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements', 'tab-settings']) assert.ok(html.includes('id="' + id + '"'));
});

test('responsive menu keeps every destination reachable and content scrolling isolated', () => {
  assert.match(css, /grid-template-areas:[\\s\\S]*"header header"[\\s\\S]*"modes modes"[\\s\\S]*"navigation content"/);
  assert.match(css, /\.menu-tab-content-area[^}]*overflow-y: auto/s);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-height: 560px\) and \(orientation: landscape\) and \(pointer: coarse\)/);
});

test('menu retains keyboard focus visibility and honors reduced motion', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
