import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, css] = await Promise.all([
  read('index.html'),
  read('src/menu-layout-fixes.css'),
]);

test('the Survival atlas lives in its dedicated tab and never overlays other panels', () => {
  assert.equal((html.match(/id="tab-map"/g) || []).length, 1);
  const contentStart = html.indexOf('<div class="menu-tab-content-area">');
  const mapStart = html.indexOf('<div id="tab-map" class="tab-panel world-atlas-panel"');
  const pvpStart = html.indexOf('<div id="tab-pvp"');
  const launchBar = html.indexOf('<div class="menu-fixed-bottom-bar">', pvpStart);
  assert.ok(contentStart >= 0 && mapStart > contentStart && pvpStart > mapStart && launchBar > pvpStart);
  const panel = html.slice(mapStart, pvpStart);
  for (const name of ['MAGAZYN B4', 'PORT KONTENEROWY 17', 'CHŁODNIA ZERO', 'SORTOWNIA WIDMOWA']) {
    assert.ok(panel.includes(name));
  }
  assert.doesNotMatch(panel, /data-survival-map=|survival-map-picker/);
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

test('the mega-map atlas is scoped to its own tab with a responsive biome grid', () => {
  assert.match(css, /#title-screen #tab-map\.world-atlas-panel/);
  assert.match(css, /\.mega-map-biome-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.menu-fixed-bottom-bar\s*\{[\s\S]*?position:\s*static !important/);
  assert.match(css, /\.mega-map-route-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});

test('operator selection cards and portraits have enough area on desktop and phones', () => {
  assert.match(css, /#title-screen #tab-team \.char-card\s*\{[\s\S]*?min-height:\s*clamp\(176px, 20vh, 210px\)/);
  assert.match(css, /#title-screen #tab-team \.char-card-badge\.operator-emblem\s*\{[\s\S]*?clamp\(78px, 7vw, 90px\)/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?#title-screen #tab-team \.char-card\s*\{[\s\S]*?min-height:\s*160px/);
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

test('short landscape atlas avoids vertical overflow without transform scaling', () => {
  const landscape = css.slice(css.indexOf('@media (max-height: 560px) and (orientation: landscape)'));
  assert.match(landscape, /\.menu-top-header\s*\{[\s\S]*?padding:/);
  assert.match(landscape, /\.audio-settings-frame \.audio-slider-row\s*\{[\s\S]*?min-height:\s*42px/);
  assert.doesNotMatch(landscape, /transform:\s*scale/);
});
