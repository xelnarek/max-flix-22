import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, css] = await Promise.all([
  read('index.html'),
  read('src/menu-layout-fixes.css'),
]);

test('Survival map selector is a standalone sibling, not part of the launch bar or tab content', () => {
  assert.equal((html.match(/id="survival-map-picker"/g) || []).length, 1);
  const contentStart = html.indexOf('<div class="menu-tab-content-area">');
  const contentEnd = html.indexOf('\n          </div>\n\n          <section id="survival-map-picker"', contentStart);
  const pickerStart = html.indexOf('<section id="survival-map-picker"');
  const pickerEnd = html.indexOf('</section>', pickerStart);
  const startBar = html.indexOf('<div class="menu-fixed-bottom-bar">', pickerStart);
  assert.ok(contentStart >= 0 && contentEnd > contentStart, 'tab content area should close before the map card');
  assert.ok(pickerStart > contentEnd, 'map card must live outside the scrollable tab content');
  assert.ok(pickerEnd > pickerStart && startBar > pickerEnd, 'map card must precede the independent launch bar');
  assert.doesNotMatch(html.slice(startBar, html.indexOf('</div>', startBar) + 6), /survival-map-picker/);
  for (const map of ['random', 'warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting']) {
    assert.ok(html.includes('data-survival-map="' + map + '"'), 'missing map ' + map);
  }
});

test('audio controls and related information share one dedicated outer settings frame', () => {
  const panelStart = html.indexOf('<div id="tab-settings"');
  const frameStart = html.indexOf('<section class="audio-settings-frame"', panelStart);
  const frameEnd = html.indexOf('</section>\n            </div>', frameStart);
  assert.ok(panelStart >= 0 && frameStart > panelStart && frameEnd > frameStart);
  const frame = html.slice(frameStart, frameEnd);
  for (const id of [
    'settings-panel-title',
    'audio-master-volume',
    'audio-music-volume',
    'audio-effects-volume',
    'btn-audio-reset',
    'btn-ad-privacy-options',
  ]) {
    assert.ok(frame.includes(id), 'audio frame should contain ' + id);
  }
  assert.equal((html.match(/class="audio-settings-frame"/g) || []).length, 1);
});

test('the map frame stays in normal document flow and uses a visible mobile grid', () => {
  assert.match(css, /\.menu-map-picker-frame\s*\{[\s\S]*?flex:\s*0 0 auto/);
  assert.match(css, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?position:\s*static !important/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /data-survival-map="random"\]\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.doesNotMatch(css, /\.menu-fixed-bottom-bar\s*\{[^}]*position:\s*sticky/s);
});

test('audio settings have one visible frame and compact touch-friendly slider rows', () => {
  assert.match(css, /\.audio-settings-frame\s*\{[\s\S]*?border:\s*1px solid/);
  assert.match(css, /\.audio-settings-frame \.settings-hero\s*\{[\s\S]*?border:\s*0/);
  assert.match(css, /\.audio-settings-frame \.audio-mixer-card\s*\{[\s\S]*?border:\s*0/);
  assert.match(css, /\.audio-settings-frame \.settings-note\s*\{[\s\S]*?border:\s*0/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(74px, 0\.92fr\) 38px/);
  assert.match(css, /min-height:\s*52px/);
  assert.match(css, /input\[type="range"\][\s\S]*?min-height:\s*32px/);
});

test('short landscape menus reduce vertical density without transform scaling', () => {
  const landscape = css.slice(css.indexOf('@media (max-height: 560px) and (orientation: landscape)'));
  assert.match(landscape, /\.menu-top-header\s*\{[\s\S]*?padding:/);
  assert.match(landscape, /\.survival-map-picker-options\s*\{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(landscape, /\.audio-settings-frame \.audio-slider-row\s*\{[\s\S]*?min-height:\s*42px/);
  assert.doesNotMatch(landscape, /transform:\s*scale/);
});
