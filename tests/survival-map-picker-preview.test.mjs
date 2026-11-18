import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the connected-world atlas replaces the old map picker preview', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'), read('../src/index.ts'), read('../src/menu-layout-fixes.css')
  ]);
  const start = html.indexOf('<div id="tab-map" class="tab-panel world-atlas-panel"');
  const end = html.indexOf('<div id="tab-pvp"', start);
  assert.ok(start >= 0 && end > start);
  const panel = html.slice(start, end);
  for (const label of ['MAGAZYN B4', 'PORT KONTENEROWY 17', 'CHŁODNIA ZERO', 'SORTOWNIA WIDMOWA']) {
    assert.ok(panel.includes(label), 'missing atlas biome: ' + label);
  }
  for (const route of ['B4 → PORT 17', 'PORT 17 → CHŁODNIA', 'CHŁODNIA → SORTOWNIA', 'SORTOWNIA → B4']) {
    assert.ok(panel.includes(route), 'missing transition: ' + route);
  }
  assert.match(panel, /4 OTWARTE BRAMY/);
  assert.match(panel, /BEZ TELEPORTÓW I RESETU ROZGRYWKI/);
  for (const id of ['b4_intro', 'port_17', 'cold_zero', 'night_sorting', 'final_audit']) assert.ok(panel.includes('data-campaign-stage=' + id));
  assert.match(panel, /KAMPANIA ZMIAN/);
  assert.match(panel, /1–3 GWIAZDKI ZA WYNIK/);
  assert.doesNotMatch(panel, /survival-map-preview|data-survival-map=|survival-map-picker/);
  assert.doesNotMatch(app, /selectedSurvivalMapId|survivalMapPreviewTitle|survivalMapPreviewDetail/);
  assert.match(css, /#title-screen #tab-map\.world-atlas-panel\.active/);
  assert.match(css, /\.mega-map-route-grid/);
});
