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
  const compactCss = css.replaceAll(' ', '').replaceAll('\\n', '').replaceAll('\\r', '').replaceAll('\\t', '');
  const contentRuleStart = compactCss.indexOf('#title-screen.menu-tab-content-area{');
  assert.ok(contentRuleStart >= 0, 'menu content viewport must be styled');
  const contentRuleEnd = compactCss.indexOf('}', contentRuleStart);
  assert.ok(compactCss.slice(contentRuleStart, contentRuleEnd).includes('overflow-y:auto'),
    'menu content viewport must own vertical scrolling');
  assert.ok(compactCss.includes('@media(max-width:1100px)'), 'tablet breakpoint must remain');
  assert.ok(compactCss.includes('@media(max-width:760px)'), 'phone breakpoint must remain');
  assert.ok(compactCss.includes('@media(max-height:560px)and(orientation:landscape)and(pointer:coarse)'),
    'compact landscape breakpoint must remain');
  assert.ok(compactCss.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion support must remain');
});

test('cinematic intro keeps procedural Canvas 2D and accessible fallback', () => {
  assert.match(intro, /Canvas 2D/);
  assert.match(intro, /prefers-reduced-motion/);
  assert.match(intro, /private readonly duration = 11\.8/);
  assert.match(intro, /drawOperatorPortrait/);
  assert.match(css, /INTRO \/ industrial alarm/);
});
