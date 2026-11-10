import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [html, app, css] = await Promise.all([
  read('index.html'),
  read('src/index.ts'),
  read('src/menu-separation-overhaul.css'),
]);

test('each top-level menu destination has one dedicated panel', () => {
  const buttons = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/<div id="(tab-[^"]+)" class="tab-panel[^"]*"/g)].map((match) => match[1]);
  assert.equal(buttons.length, 11);
  assert.equal(new Set(buttons).size, 11);
  assert.deepEqual(new Set(buttons), new Set(panels));
});

test('character selection and descriptions stay inside the operator panel', () => {
  const start = html.indexOf('<div id="tab-team"');
  const end = html.indexOf('<div id="tab-enemies"', start);
  assert.ok(start >= 0 && end > start);
  const operators = html.slice(start, end);
  assert.match(operators, /class="char-grid"/);
  assert.match(operators, /id="char-details-box"/);
  assert.match(operators, /id="character-mastery-panel"/);
  assert.doesNotMatch(operators, /survival-map-picker|pvp-menu-hero|btn-open-pvp/);
});

test('Survival map selection is isolated from the dedicated PvP configuration entry', () => {
  const mapStart = html.indexOf('<div id="tab-map"');
  const pvpStart = html.indexOf('<div id="tab-pvp"');
  const contentEnd = html.indexOf('<div class="menu-fixed-bottom-bar">', pvpStart);
  assert.ok(mapStart >= 0 && pvpStart > mapStart && contentEnd > pvpStart);
  const survivalPanel = html.slice(mapStart, pvpStart);
  const pvpPanel = html.slice(pvpStart, contentEnd);
  assert.match(survivalPanel, /id="survival-map-picker"/);
  assert.match(survivalPanel, /data-survival-map=/);
  assert.doesNotMatch(survivalPanel, /pvp-menu-feature-grid|id="pvp-operator-picker"/);
  assert.match(pvpPanel, /RĘCZNE CELOWANIE AKTYWNE/);
  assert.match(pvpPanel, /RÓWNE WARUNKI/);
  assert.match(pvpPanel, /POJEDYNEK LUB TRENING/);
  assert.doesNotMatch(pvpPanel, /survival-map-picker|survival-map-choice/);
});

test('only the active Survival or PvP section reveals its own launch button', () => {
  assert.match(css, /#title-screen \.menu-fixed-bottom-bar\s*\{\s*display:\s*none !important/);
  assert.match(css, /data-active-menu-tab="tab-map"\] \.menu-fixed-bottom-bar/);
  assert.match(css, /data-active-menu-tab="tab-pvp"\] \.menu-fixed-bottom-bar/);
  assert.match(css, /data-active-menu-tab="tab-map"\] \.btn-survival-start\s*\{\s*display:\s*flex !important/);
  assert.match(css, /data-active-menu-tab="tab-pvp"\] \.btn-pvp-start\s*\{\s*display:\s*flex !important/);
  assert.match(css, /#title-screen \.menu-controls-hint\s*\{\s*display:\s*none !important/);
  assert.match(html, /menu-controls-hint-survival/);
  assert.match(html, /menu-controls-hint-pvp/);
});

test('runtime keeps inactive panels inert and changes the section theme with the selected tab', () => {
  assert.match(app, /titleScreenRoot\.dataset\.activeMenuTab = targetId/);
  assert.match(app, /panel\.inert = !active/);
  assert.match(app, /panel\.setAttribute\('aria-hidden', String\(!active\)\)/);
  for (const tab of ['tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks', 'tab-settings']) {
    assert.ok(css.includes('data-active-menu-tab="' + tab + '"') || tab === 'tab-team' || tab === 'tab-enemies' || tab === 'tab-perks' || tab === 'tab-settings');
  }
});

test('menu navigation preserves a desktop rail and scrollable mobile tabs', () => {
  assert.match(css, /@media \(min-width: 761px\) and \(pointer: fine\)/);
  assert.match(css, /flex-direction: column !important/);
  assert.match(css, /overflow-y: auto !important/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /overflow-x: auto !important/);
  assert.match(css, /min-height: 42px !important/);
});

test('mobile menu uses fewer expensive blur effects and reduces hidden panel work', () => {
  assert.match(css, /backdrop-filter: none !important/);
  assert.match(css, /contain: layout style/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
