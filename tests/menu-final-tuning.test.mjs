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
  const gridAreas = css.match(/grid-template-areas:\s*([\s\S]*?)!important/);
  assert.ok(gridAreas, 'title sheet must keep explicit grid areas');
  for (const area of ['"header header"', '"modes modes"', '"navigation content"']) {
    assert.ok(gridAreas[1].includes(area), 'missing title-sheet grid area: ' + area);
  }
  assert.match(css, /\.menu-tab-content-area[^}]*overflow-y: auto/s);
  assert.match(css, /@media\\s*\\(\\s*max-width\\s*:\\s*900px\\s*\\)/, 'missing tablet/phone breakpoint');
  assert.match(css, /@media\\s*\\(\\s*max-width\\s*:\\s*760px\\s*\\)/, 'missing touch-menu breakpoint');
  assert.match(css, /@media\\s*\\(\\s*max-height\\s*:\\s*560px\\s*\\)\\s*and\\s*\\(\\s*orientation\\s*:\\s*landscape\\s*\\)\\s*and\\s*\\(\\s*pointer\\s*:\\s*coarse\\s*\\)/, 'missing compact landscape breakpoint');
});

test('menu retains keyboard focus visibility and honors reduced motion', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
