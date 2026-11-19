import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const [html, css, intro] = await Promise.all([
  read('index.html'),
  read('src/menu-final-tuning.css'),
  read('src/cinematicIntro.ts'),
]);

test('premium final menu is loaded and preserves real destinations', () => {
  assert.ok(html.indexOf('/src/menu-final-tuning.css') > html.indexOf('/src/menu-art-direction-v3.css'));
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp', 'tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks', 'tab-field-guide', 'tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements', 'tab-settings']) {
    assert.ok(html.includes(id), 'missing menu destination: ' + id);
  }
});

test('premium menu has isolated scrolling and short-screen geometry', () => {
  assert.match(css, /\.menu-tab-content-area[^}]*overflow-y:\s*auto/s);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-height: 560px\) and \(orientation: landscape\) and \(pointer: coarse\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('cinematic intro keeps procedural Canvas 2D and accessible fallback', () => {
  assert.match(intro, /Canvas 2D/);
  assert.match(intro, /prefers-reduced-motion/);
  assert.match(intro, /private readonly duration = 11\.8/);
  assert.match(intro, /drawOperatorPortrait/);
  assert.match(css, /Cinematic intro: premium industrial reveal/);
});
