import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

test('Survival map picker exposes random and all four named arenas in the same menu', () => {
  const ids = ['random', 'warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting'];
  for (const id of ids) {
    assert.ok(html.includes('data-survival-map="' + id + '"'), 'missing selectable map: ' + id);
  }
});

test('desktop keeps a five-column map picker', () => {
  assert.match(css, /\.survival-map-picker-options\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
});

test('phone layout switches to a visible two-column grid, not a hidden horizontal strip', () => {
  const mobileSection = css.slice(css.indexOf('/* Mobile map picker:'));
  assert.match(mobileSection, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mobileSection, /data-survival-map="random"[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(mobileSection, /menu-fixed-bottom-bar\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(mobileSection, /menu-tab-content-area\s*\{[\s\S]*?max-height/);
});
