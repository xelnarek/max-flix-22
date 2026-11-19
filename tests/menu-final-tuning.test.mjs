import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const [html, css, responsiveCss] = await Promise.all([
  read('index.html'),
  read('src/menu-final-tuning.css'),
  read('src/warehouse-maddnes-unified-menu.css'),
]);

test('final menu polish is loaded last and preserves the three launch actions', () => {
  assert.ok(html.indexOf('/src/menu-final-tuning.css') > html.indexOf('/src/menu-art-direction-v3.css'));
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp']) assert.ok(html.includes('id="' + id + '"'));
  for (const id of ['tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks', 'tab-field-guide', 'tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements', 'tab-settings']) assert.ok(html.includes('id="' + id + '"'));
});

test('responsive menu keeps every destination reachable and content scrolling isolated', () => {
  const gridAreas = css.match(/grid-template-areas:\s*([\s\S]*?)!important/);
  assert.ok(gridAreas, 'title sheet must keep explicit grid areas');
  for (const area of ['"header header"', '"modes modes"', '"navigation content"']) {
    assert.ok(gridAreas[1].includes(area), 'missing title-sheet grid area: ' + area);
  }
  assert.match(css, /\.menu-tab-content-area[^}]*overflow-y: auto/s);
  assert.ok(html.indexOf('/src/warehouse-maddnes-unified-menu.css') > html.indexOf('/src/menu-final-tuning.css'),
    'the responsive acceptance layer must load after the legacy menu stylesheet');
  assert.match(responsiveCss, /@media\\s*\\(\\s*max-width\\s*:\\s*900px\\s*\\)\\s*,\\s*\\(\\s*pointer\\s*:\\s*coarse\\s*\\)/,
    'missing touch viewport breakpoint in final cascade');
  assert.match(responsiveCss, /@media\\s*\\(\\s*max-width\\s*:\\s*640px\\s*\\)\\s*,\\s*\\(\\s*pointer\\s*:\\s*coarse\\s*\\)/,
    'missing compact card-grid breakpoint in final cascade');
  assert.match(responsiveCss, /@media\\s*\\(\\s*max-height\\s*:\\s*580px\\s*\\)/,
    'missing short landscape viewport breakpoint in final cascade');
});

test('menu retains keyboard focus visibility and honors reduced motion', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
