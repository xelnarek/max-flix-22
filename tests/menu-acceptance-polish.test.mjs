import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('acceptance layer follows Industrial Noir and all game destinations remain', async () => {
  const [html, css] = await Promise.all([read('index.html'), read('src/menu-acceptance-polish.css')]);
  const noir = html.indexOf('/src/industrial-noir-menu.css');
  const finalLayer = html.indexOf('/src/menu-acceptance-polish.css');
  assert.ok(noir >= 0 && finalLayer > noir);
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp']) assert.ok(html.includes(id));
  for (const id of ['tab-team','tab-map','tab-pvp','tab-enemies','tab-perks','tab-field-guide','tab-talent-tree','tab-ranks','tab-leaderboard','tab-achievements','tab-settings']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing destination: ' + id);
  }
  assert.match(css, /\.tab-panel:not\(\.active\)\s*\{[\s\S]*?display:\s*none !important/);
  assert.match(css, /data-mode="pvp"[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(css, /overscroll-behavior-y:\s*contain/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('the active panel is the only vertical scroll owner', async () => {
  const css = await read('src/menu-acceptance-polish.css');
  assert.match(css, /\.title-sheet\s*\{[\s\S]*?overflow:\s*hidden !important/);
  assert.match(css, /\.menu-tab-content-area\s*\{[\s\S]*?overflow-y:\s*auto !important/);
  assert.match(css, /\.tab-panel:not\(\.active\)\s*\{[\s\S]*?display:\s*none !important/);
});

test('phone navigation and mode cards use a compact grouped layout', async () => {
  const css = await read('src/menu-acceptance-polish.css');
  assert.match(css, /@media \(max-width: 760px\), \(pointer: coarse\)/);
  assert.match(css, /\.menu-mode-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.menu-tabs-bar\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});
