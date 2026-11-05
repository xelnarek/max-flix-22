import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, css, layout] = await Promise.all([
  read('index.html'),
  read('src/index.css'),
  read('src/menu-layout-fixes.css'),
]);

test('Survival map picker exposes random and all four named arenas in the same menu', () => {
  const ids = ['random', 'warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting'];
  for (const id of ids) assert.ok(html.includes('data-survival-map="' + id + '"'), 'missing selectable map: ' + id);
});

test('desktop keeps a five-column map picker', () => {
  assert.match(css, /\.survival-map-picker-options\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(layout, /\.survival-map-picker-options\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
});

test('the final mobile stylesheet shows every map in a two-column grid and removes the hidden swipe strip', () => {
  const mobile = layout.slice(layout.lastIndexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.menu-tabs-bar\s*\{[\s\S]*?display:\s*grid !important/);
  assert.match(mobile, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mobile, /\.survival-map-picker-options\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mobile, /data-survival-map="random"[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(mobile, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?position:\s*static !important/);
  assert.doesNotMatch(mobile, /position:\s*sticky/);
});

test('the final linked menu stylesheet is loaded after the older global and visual styles', () => {
  const menuStylesheet = html.indexOf('href="/src/menu-layout-fixes.css"');
  const visualStylesheet = html.indexOf('href="/src/visual-polish.css"');
  const baseStylesheet = html.indexOf('href="/src/index.css"');
  assert.ok(baseStylesheet >= 0 && visualStylesheet > baseStylesheet);
  assert.ok(menuStylesheet > visualStylesheet, 'menu overrides must be the last linked stylesheet');
});
