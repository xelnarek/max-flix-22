import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, layout] = await Promise.all([
  read('index.html'), read('src/menu-layout-fixes.css'),
]);

test('the map tab exposes a saved stage campaign and connected-world atlas', () => {
  const start = html.indexOf('<div id="tab-map" class="tab-panel world-atlas-panel"');
  const end = html.indexOf('<div id="tab-pvp"', start);
  assert.ok(start >= 0 && end > start);
  const panel = html.slice(start, end);
  for (const name of ['MAGAZYN B4', 'PORT KONTENEROWY 17', 'CHŁODNIA ZERO', 'SORTOWNIA WIDMOWA']) {
    assert.ok(panel.includes(name), 'missing atlas biome: ' + name);
  }
  for (const route of ['B4 → PORT 17', 'PORT 17 → CHŁODNIA', 'CHŁODNIA → SORTOWNIA', 'SORTOWNIA → B4']) {
    assert.ok(panel.includes(route), 'missing route: ' + route);
  }
  for (const id of ['b4_intro', 'port_17', 'cold_zero', 'night_sorting', 'final_audit']) assert.ok(panel.includes('data-campaign-stage="' + id + '"'), 'missing stage: ' + id);
  assert.match(panel, /KAMPANIA ZMIAN/);
  assert.doesNotMatch(panel, /data-survival-map=|survival-map-picker/);
});

test('desktop and mobile atlas grids remain legible inside the scrollable menu', () => {
  assert.match(layout, /\.mega-map-biome-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(layout, /\.mega-map-route-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  const mobileLayout = layout.slice(layout.lastIndexOf('@media (max-width: 760px)'));
  assert.match(mobileLayout, /\.mega-map-route-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(mobileLayout, /position:\s*sticky/);
});

test('menu styles remain ordered after base and visual styles', () => {
  const menuStylesheet = html.indexOf('href="/src/menu-layout-fixes.css"');
  const campaignStylesheet = html.indexOf('href="/src/campaign-mode.css"');
  const visualStylesheet = html.indexOf('href="/src/visual-polish.css"');
  const baseStylesheet = html.indexOf('href="/src/index.css"');
  assert.ok(baseStylesheet >= 0 && visualStylesheet > baseStylesheet);
  assert.ok(menuStylesheet > visualStylesheet);
  assert.ok(campaignStylesheet > menuStylesheet);
});
